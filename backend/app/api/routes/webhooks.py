import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Request, Query, Header, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.audit import WebhookEvent
from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService
from app.integrations.instagram.validator import validate_meta_signature
from app.integrations.instagram.parser import parse_instagram_payload, InstagramMessageEvent

logger = logging.getLogger("insta.webhook.routes")

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.get("/instagram")
async def verify_instagram_webhook(
    mode: Optional[str] = Query(None, alias="hub.mode"),
    challenge: Optional[str] = Query(None, alias="hub.challenge"),
    verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Meta Webhook Verification Endpoint.
    Responds to Meta's hub challenge during webhook setup.
    """
    logger.info("Received Meta webhook challenge verification request.")

    if mode == "subscribe" and verify_token == settings.WEBHOOK_VERIFY_TOKEN:
        logger.info("Meta webhook verification SUCCESSFUL. Responding with challenge.")
        return PlainTextResponse(content=challenge or "", status_code=status.HTTP_200_OK)

    logger.warning("Meta webhook verification FAILED: token mismatch or wrong mode.")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch",
    )


@router.post("/instagram")
async def receive_instagram_event(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Meta Instagram Webhook Receiver.
    Validates signature, prevents duplicate event processing, records customer & message.
    """
    raw_body = await request.body()
    logger.info("RECEIVED WEBHOOK POST event from Meta! Length: %d bytes", len(raw_body))
    logger.debug("Webhook headers: %s | Body: %s", dict(request.headers), raw_body.decode(errors="ignore")[:300])

    # Signature verification (warn in dev if signature mismatch, reject in production)
    is_valid_sig = validate_meta_signature(raw_body, x_hub_signature_256, settings.META_APP_SECRET)
    if not is_valid_sig and settings.ENVIRONMENT == "production":
        logger.warning("Rejected webhook event due to invalid HMAC signature in production.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature",
        )

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Failed to parse JSON body from webhook: %s", exc)
        return {"status": "error", "message": "Invalid JSON"}

    events = parse_instagram_payload(payload)
    if not events:
        logger.debug("Webhook received with no actionable messaging events.")
        return {"status": "ok", "events_processed": 0}

    processed_count = 0

    for event in events:
        try:
            # 1. Deduplication via external_message_id check
            if event.message_id:
                existing_event = await db.execute(
                    select(WebhookEvent).where(WebhookEvent.event_id == event.message_id)
                )
                if existing_event.scalar_one_or_none():
                    logger.info("Skipping already processed webhook message ID: %s", event.message_id)
                    continue

                # Log webhook event for audit & idempotency
                db.add(
                    WebhookEvent(
                        event_id=event.message_id,
                        source="instagram",
                        payload=event.raw_event,
                        status="processed",
                    )
                )

            # Skip empty events (e.g. reaction / read receipt without text or attachments)
            if not event.text and not event.attachments:
                continue

            # 2. Handle Echo messages (messages sent by the business page itself)
            if event.is_echo:
                # Recipient is the customer
                customer, _ = await CustomerService.get_or_create_by_instagram_id(
                    db=db, instagram_id=event.recipient_id
                )
                conv, _ = await ConversationService.get_or_create_conversation(
                    db=db, customer_id=customer.id
                )
                # Check if this echo matches an outbound message already recorded by AI or Dashboard
                from app.models.message import Message
                recent_out_q = (
                    select(Message)
                    .where(
                        Message.conversation_id == conv.id,
                        Message.direction == "outbound",
                        Message.text == event.text,
                    )
                    .order_by(Message.id.desc())
                    .limit(1)
                )
                recent_out = (await db.execute(recent_out_q)).scalar_one_or_none()
                if recent_out:
                    if not recent_out.external_message_id and event.message_id:
                        recent_out.external_message_id = event.message_id
                    logger.info("Matched echo to existing outbound message #%d (conv #%d)", recent_out.id, conv.id)
                    processed_count += 1
                    continue

                await ConversationService.record_message(
                    db=db,
                    conversation_id=conv.id,
                    customer_id=customer.id,
                    channel="instagram",
                    direction="outbound",
                    sender_type="employee",
                    text=event.text,
                    external_message_id=event.message_id,
                    attachments=event.attachments,
                )
                processed_count += 1
                continue

            # 3. Handle Inbound customer messages
            customer, created_cust = await CustomerService.get_or_create_by_instagram_id(
                db=db,
                instagram_id=event.sender_id,
            )
            conv, _ = await ConversationService.get_or_create_conversation(
                db=db, customer_id=customer.id
            )

            msg, is_new = await ConversationService.record_message(
                db=db,
                conversation_id=conv.id,
                customer_id=customer.id,
                channel="instagram",
                direction="inbound",
                sender_type="customer",
                text=event.text,
                external_message_id=event.message_id,
                attachments=event.attachments,
            )

            if is_new:
                logger.info(
                    "Recorded inbound message from customer %s (conv #%d): %s",
                    customer.name,
                    conv.id,
                    (event.text or "")[:40],
                )
                # If conversation is in 'ai' mode, trigger AI responder in background
                if conv.mode == "ai" and event.text:
                    from app.services.ai_responder import process_and_reply_background
                    background_tasks.add_task(
                        process_and_reply_background,
                        customer_id=customer.id,
                        conversation_id=conv.id,
                        incoming_text=event.text,
                    )

            processed_count += 1

        except Exception as exc:
            logger.error("Failed processing Instagram event %s: %s", event.message_id, exc)

    await db.commit()
    return {"status": "ok", "events_processed": processed_count}


# =========================================================================
# WHATSAPP BUSINESS WEBHOOKS
# =========================================================================

@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    mode: Optional[str] = Query(None, alias="hub.mode"),
    challenge: Optional[str] = Query(None, alias="hub.challenge"),
    verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Meta WhatsApp Cloud API Webhook Verification Endpoint.
    Responds to Meta's hub challenge during webhook setup in developer console.
    """
    logger.info("Received WhatsApp webhook challenge verification request.")

    if mode == "subscribe" and verify_token == settings.WEBHOOK_VERIFY_TOKEN:
        logger.info("WhatsApp webhook verification SUCCESSFUL. Responding with challenge.")
        return PlainTextResponse(content=challenge or "", status_code=status.HTTP_200_OK)

    logger.warning("WhatsApp webhook verification FAILED: token mismatch or wrong mode.")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification token mismatch",
    )


@router.post("/whatsapp")
async def receive_whatsapp_event(
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Meta WhatsApp Cloud API Webhook Receiver.
    Validates signature, prevents duplicate message processing, creates customer & message,
    and dispatches to AI auto-responder.
    """
    raw_body = await request.body()
    logger.info("RECEIVED WHATSAPP WEBHOOK POST event! Length: %d bytes", len(raw_body))

    # Optional signature verification in production
    is_valid_sig = validate_meta_signature(raw_body, x_hub_signature_256, settings.META_APP_SECRET)
    if not is_valid_sig and settings.ENVIRONMENT == "production":
        logger.warning("Rejected WhatsApp webhook event due to invalid HMAC signature in production.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature",
        )

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Failed to parse JSON body from WhatsApp webhook: %s", exc)
        return {"status": "error", "message": "Invalid JSON"}

    from app.integrations.whatsapp.parser import parse_whatsapp_payload
    events = parse_whatsapp_payload(payload)
    if not events:
        logger.debug("WhatsApp webhook received with no actionable messaging events (possibly status receipt).")
        return {"status": "ok", "events_processed": 0}

    processed_count = 0

    for event in events:
        try:
            # 1. Deduplication via message_id check
            if event.message_id:
                existing_event = await db.execute(
                    select(WebhookEvent).where(WebhookEvent.event_id == event.message_id)
                )
                if existing_event.scalar_one_or_none():
                    logger.info("Skipping already processed WhatsApp message ID: %s", event.message_id)
                    continue

                db.add(
                    WebhookEvent(
                        event_id=event.message_id,
                        source="whatsapp",
                        payload=event.raw_event,
                        status="processed",
                    )
                )

            # Skip empty messages without text
            if not event.text:
                continue

            # 2. Lookup or create customer by phone number / wa_id
            customer, _ = await CustomerService.get_or_create_by_whatsapp_id(
                db=db,
                whatsapp_id=event.sender_phone,
                phone=event.sender_phone,
                name=event.sender_name,
            )

            # 3. Lookup or create active conversation with channel='whatsapp'
            conv, _ = await ConversationService.get_or_create_conversation(
                db=db,
                customer_id=customer.id,
                channel="whatsapp",
            )

            # 4. Record inbound message
            msg, is_new = await ConversationService.record_message(
                db=db,
                conversation_id=conv.id,
                customer_id=customer.id,
                channel="whatsapp",
                direction="inbound",
                sender_type="customer",
                text=event.text,
                external_message_id=event.message_id,
            )

            if is_new:
                logger.info(
                    "Recorded inbound WhatsApp message from %s (conv #%d): %s",
                    customer.name,
                    conv.id,
                    event.text[:40],
                )
                # If conversation is in 'ai' mode, trigger AI responder in background
                if conv.mode == "ai" and event.text:
                    from app.services.ai_responder import process_and_reply_background
                    background_tasks.add_task(
                        process_and_reply_background,
                        customer_id=customer.id,
                        conversation_id=conv.id,
                        incoming_text=event.text,
                    )

            processed_count += 1

        except Exception as exc:
            logger.error("Failed processing WhatsApp event %s: %s", event.message_id, exc)

    await db.commit()
    return {"status": "ok", "events_processed": processed_count}


# =========================================================================
# WHATSAPP BAILEYS QR BRIDGE WEBHOOK
# =========================================================================

class WhatsAppBridgePayload(BaseModel):
    sender_phone: str
    sender_name: Optional[str] = None
    sender_jid: Optional[str] = None
    text: str
    message_id: Optional[str] = None


@router.post("/whatsapp-bridge")
async def receive_whatsapp_bridge_event(
    payload: WhatsAppBridgePayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives incoming WhatsApp message from the local Baileys bridge microservice.
    """
    clean_phone = payload.sender_phone.replace("+", "").strip()
    reply_target = payload.sender_jid or clean_phone
    display_phone = clean_phone.replace("@lid", "")
    if not display_phone.startswith("+") and display_phone.isdigit():
        display_phone = f"+{display_phone}"

    logger.info("Received WhatsApp bridge message from %s (jid: %s): %s", display_phone, reply_target, payload.text[:40])

    # 1. Deduplication via message_id check
    if payload.message_id:
        existing_event = await db.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == payload.message_id)
        )
        if existing_event.scalar_one_or_none():
            logger.info("Skipping already processed WhatsApp bridge message ID: %s", payload.message_id)
            return {"status": "ok", "duplicate": True}

        db.add(
            WebhookEvent(
                event_id=payload.message_id,
                source="whatsapp_bridge",
                payload={"phone": display_phone, "jid": reply_target, "text": payload.text},
                status="processed",
            )
        )

    # 2. Get or create customer by phone number
    customer, _ = await CustomerService.get_or_create_by_whatsapp_id(
        db=db,
        whatsapp_id=reply_target,
        phone=display_phone,
        name=payload.sender_name or f"WhatsApp {display_phone[-4:]}",
    )

    # 3. Get or create conversation with channel='whatsapp'
    conv, _ = await ConversationService.get_or_create_conversation(
        db=db,
        customer_id=customer.id,
        channel="whatsapp",
    )

    # 4. Record inbound message
    msg, is_new = await ConversationService.record_message(
        db=db,
        conversation_id=conv.id,
        customer_id=customer.id,
        channel="whatsapp",
        direction="inbound",
        sender_type="customer",
        text=payload.text,
        external_message_id=payload.message_id,
    )

    await db.commit()

    if is_new and conv.mode == "ai" and payload.text:
        from app.services.ai_responder import process_and_reply_background
        background_tasks.add_task(
            process_and_reply_background,
            customer_id=customer.id,
            conversation_id=conv.id,
            incoming_text=payload.text,
        )

    return {"status": "ok", "conversation_id": conv.id}

