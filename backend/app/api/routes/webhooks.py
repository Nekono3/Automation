import logging
from typing import Optional
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

            # 2. Handle Echo messages (messages sent by the business page itself)
            if event.is_echo:
                # Recipient is the customer
                customer, _ = await CustomerService.get_or_create_by_instagram_id(
                    db=db, instagram_id=event.recipient_id
                )
                conv, _ = await ConversationService.get_or_create_conversation(
                    db=db, customer_id=customer.id
                )
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
