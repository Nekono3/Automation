import logging
from datetime import datetime,timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Request, Query, Header, HTTPException, status, Depends, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.audit import WebhookEvent
from app.services.webhook_claims import claim_event, finish_event
from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService
from app.integrations.instagram.validator import validate_meta_signature
from app.integrations.instagram.parser import (
    parse_instagram_payload,
    InstagramMessageEvent,
    parse_instagram_comments,
    InstagramCommentEvent,
)

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

    if mode == "subscribe" and bool(settings.WEBHOOK_VERIFY_TOKEN) and verify_token == settings.WEBHOOK_VERIFY_TOKEN:
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
    logger.info("Integration event processed")

    # Signature verification (warn in dev if signature mismatch, reject in production)
    is_valid_sig = validate_meta_signature(raw_body, x_hub_signature_256, settings.META_APP_SECRET)
    if not is_valid_sig:
        logger.warning("Rejected webhook event due to invalid HMAC signature in production.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature",
        )

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Integration event processing failed", extra={"error_type": type(exc).__name__})
        return {"status": "error", "message": "Invalid JSON"}

    events = parse_instagram_payload(payload)
    comment_events = parse_instagram_comments(payload)

    if not events and not comment_events:
        logger.debug("Webhook received with no actionable messaging or comment events.")
        return {"status": "ok", "events_processed": 0}

    processed_count = 0

    for event in events:
        try:
            if not await claim_event(db, event.message_id, 'instagram', event.raw_event):
                continue

            # Skip empty events (e.g. reaction / read receipt without text or attachments)
            if not event.text and not event.attachments:
                await finish_event(db, event.message_id, 'ignored')
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
                    await finish_event(db, event.message_id)
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
                await finish_event(db, event.message_id)
                processed_count += 1
                continue

            # 3. Handle Inbound customer messages
            customer, created_cust = await CustomerService.get_or_create_by_instagram_id(
                db=db,
                instagram_id=event.sender_id,
            )

            # Auto-enrich customer name and username via Instagram Graph API
            if (customer.name or "").startswith("IG-") or not customer.username:
                try:
                    from app.integrations.instagram.client import InstagramClient
                    from app.services.deal_service import DealService
                    ig_client = InstagramClient()
                    ig_prof = await ig_client.get_user_profile(event.sender_id)
                    if ig_prof:
                        if ig_prof.get("username"):
                            customer.username = ig_prof["username"]
                        if ig_prof.get("name"):
                            customer.name = ig_prof["name"]
                        elif ig_prof.get("username") and (customer.name or "").startswith("IG-"):
                            customer.name = ig_prof["username"]
                        await db.commit()
                        await DealService.sync_customer_deal_title(db, customer.id)
                except Exception as exc:
                    logger.warning("Integration event processing failed")

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
                logger.info("Integration event processed")
                # If conversation is in 'ai' mode, trigger AI responder in background
                if conv.mode == "ai" and event.text:
                    from app.services.ai_responder import process_and_reply_background
                    background_tasks.add_task(
                        process_and_reply_background,
                        customer_id=customer.id,
                        conversation_id=conv.id,
                        incoming_text=event.text,
                    )

            await finish_event(db, event.message_id)
            processed_count += 1

        except Exception as exc:
            logger.error("Integration event processing failed", extra={"error_type": type(exc).__name__})

    # 4. Handle Instagram Comment Events (field == 'comments', e.g. Reels/Post comments)
    if comment_events:
        from app.services.automation_service import AutomationService
        from app.integrations.instagram.client import InstagramClient
        insta_client = InstagramClient()

        for comment in comment_events:
            try:
                if not comment.comment_id or not await claim_event(db, f'comment_{comment.comment_id}', 'instagram_comment', comment.raw_event):
                    continue

                logger.info("Integration event processed")

                # Match against automation triggers (Comment-to-DM)
                trigger = await AutomationService.match_trigger(
                    db=db,
                    text=comment.text,
                    channel="INSTAGRAM",
                )

                # If no direct match on INSTAGRAM, try ALL
                if not trigger:
                    trigger = await AutomationService.match_trigger(
                        db=db,
                        text=comment.text,
                        channel="ALL",
                    )

                if trigger:
                    logger.info("Trigger matched for comment: [%s] (ID #%d)", trigger.keyword, trigger.id)

                    # 1. Public comment reply (if configured)
                    if trigger.comment_reply_text:
                        reply_res = await insta_client.reply_to_comment(
                            comment_id=comment.comment_id,
                            text=trigger.comment_reply_text,
                        )
                        logger.info("Integration event processed")

                    # 2. Private reply to user in Direct Message (Comment-to-DM)
                    dm_text = trigger.dm_reply_text or "Здравствуйте! Мы получили ваш комментарий."
                    if trigger.attachment_url:
                        dm_text += f"\n\nМатериал: {trigger.attachment_url}"

                    dm_res = await insta_client.send_private_reply(
                        comment_id=comment.comment_id,
                        text=dm_text,
                    )
                    logger.info("Integration event processed")

                    # 3. Create or find Customer and record message in CRM
                    if comment.sender_id:
                        customer, _ = await CustomerService.get_or_create_by_instagram_id(
                            db=db,
                            instagram_id=comment.sender_id,
                        )
                        if comment.sender_username and not customer.username:
                            customer.username = comment.sender_username
                            if (customer.name or "").startswith("IG-"):
                                customer.name = comment.sender_username

                        if (customer.name or "").startswith("IG-") or not customer.username:
                            try:
                                ig_prof = await insta_client.get_user_profile(comment.sender_id)
                                if ig_prof:
                                    if ig_prof.get("username"):
                                        customer.username = ig_prof["username"]
                                    if ig_prof.get("name"):
                                        customer.name = ig_prof["name"]
                                    elif ig_prof.get("username") and (customer.name or "").startswith("IG-"):
                                        customer.name = ig_prof["username"]
                                    await db.commit()
                                    from app.services.deal_service import DealService
                                    await DealService.sync_customer_deal_title(db, customer.id)
                            except Exception as exc:
                                logger.warning("Integration event processing failed")

                        conv, _ = await ConversationService.get_or_create_conversation(
                            db=db, customer_id=customer.id
                        )

                        # Record inbound comment as customer message
                        await ConversationService.record_message(
                            db=db,
                            conversation_id=conv.id,
                            customer_id=customer.id,
                            channel="instagram",
                            direction="inbound",
                            sender_type="customer",
                            text=f"[Комментарий под Reels]: {comment.text}",
                            external_message_id=comment.comment_id,
                        )

                        # Record outbound reply as bot message
                        await ConversationService.record_message(
                            db=db,
                            conversation_id=conv.id,
                            customer_id=customer.id,
                            channel="instagram",
                            direction="outbound",
                            sender_type="ai",
                            text=dm_text,
                            external_message_id=dm_res.get("message_id") if isinstance(dm_res, dict) else None,
                            status="sent" if isinstance(dm_res, dict) and dm_res.get("message_id") and not dm_res.get("error") else "failed",
                        )

                    await finish_event(db, f"comment_{comment.comment_id}")
                    processed_count += 1

                else:
                    await finish_event(db, f"comment_{comment.comment_id}", "ignored")

            except Exception as exc:
                logger.error("Integration event processing failed", extra={"error_type": type(exc).__name__})

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

    if mode == "subscribe" and bool(settings.WEBHOOK_VERIFY_TOKEN) and verify_token == settings.WEBHOOK_VERIFY_TOKEN:
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
    if not is_valid_sig:
        logger.warning("Rejected WhatsApp webhook event due to invalid HMAC signature in production.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid signature",
        )

    try:
        payload = await request.json()
    except Exception as exc:
        logger.error("Integration event processing failed", extra={"error_type": type(exc).__name__})
        return {"status": "error", "message": "Invalid JSON"}

    from app.integrations.whatsapp.parser import parse_whatsapp_payload
    events = parse_whatsapp_payload(payload)
    if not events:
        logger.debug("WhatsApp webhook received with no actionable messaging events (possibly status receipt).")
        return {"status": "ok", "events_processed": 0}

    processed_count = 0

    for event in events:
        try:
            if not await claim_event(db, event.message_id, 'whatsapp', event.raw_event):
                continue

            # Skip empty messages without text
            if not event.text:
                await finish_event(db, event.message_id, 'ignored')
                continue

            # 2. Lookup or create customer by phone number / wa_id
            customer, _ = await CustomerService.get_or_create_by_whatsapp_id(
                db=db,
                whatsapp_id=event.sender_phone,
                phone=event.sender_phone,
                name=event.sender_name,
            )

            from app.models.whatsapp_account import WhatsAppAccount
            cloud_account = await db.scalar(select(WhatsAppAccount).where(
                WhatsAppAccount.account_id == f"cloud:{event.recipient_phone_id}",
                WhatsAppAccount.is_active.is_(True)))
            if not cloud_account:
                raise HTTPException(422, "Cloud account must be configured explicitly")
            # 3. Lookup or create active conversation with channel='whatsapp'
            conv, _ = await ConversationService.get_or_create_conversation(
                db=db,
                customer_id=customer.id,
                channel="whatsapp",
                whatsapp_account_id=cloud_account.id,
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
                logger.info("Integration event processed")
                # If conversation is in 'ai' mode, trigger AI responder in background
                if conv.mode == "ai" and event.text:
                    from app.services.ai_responder import process_and_reply_background
                    background_tasks.add_task(
                        process_and_reply_background,
                        customer_id=customer.id,
                        conversation_id=conv.id,
                        incoming_text=event.text,
                    )

            await finish_event(db, event.message_id)
            processed_count += 1

        except Exception as exc:
            logger.error("Integration event processing failed", extra={"error_type": type(exc).__name__})

    await db.commit()
    return {"status": "ok", "events_processed": processed_count}


# =========================================================================
# WHATSAPP BAILEYS QR BRIDGE WEBHOOK
# =========================================================================

class WhatsAppBridgePayload(BaseModel):
    account_id: str = __import__("pydantic").Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    sender_phone: Optional[str] = ""
    sender_name: Optional[str] = None
    sender_jid: Optional[str] = None
    text: Optional[str] = ""
    message_id: Optional[str] = None
    event_type: Optional[str] = "message"
    revoked_message_id: Optional[str] = None


async def authenticate_bridge(request:Request,db:AsyncSession=Depends(get_db)):
    from app.core.service_auth import verify_bridge_request
    await verify_bridge_request(request,db)


@router.post("/whatsapp-bridge",dependencies=[Depends(authenticate_bridge)])
async def receive_whatsapp_bridge_event(
    payload: WhatsAppBridgePayload,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives incoming WhatsApp message or revocation event from Baileys bridge.
    """
    from app.models.whatsapp_account import WhatsAppAccount
    from app.models.conversation import Conversation
    wa_account=await db.scalar(select(WhatsAppAccount).where(WhatsAppAccount.account_id==payload.account_id,WhatsAppAccount.is_active.is_(True)))
    if not wa_account:raise HTTPException(422,"Unknown or inactive WhatsApp account")
    wa_account_id=wa_account.id
    # 0. Handle message revocation ("Delete for everyone" in WhatsApp)
    if payload.event_type == "revoke" and payload.revoked_message_id:
        from app.models.message import Message
        msg_res = await db.execute(
            select(Message).join(Conversation,Message.conversation_id==Conversation.id).where(Message.external_message_id == payload.revoked_message_id,Conversation.whatsapp_account_id==wa_account_id)
        )
        msg_obj = msg_res.scalar_one_or_none()
        if msg_obj:
            logger.info("Marking message #%d (ext: %s) as deleted_by_user in WhatsApp", msg_obj.id, payload.revoked_message_id)
            msg_obj.status = "deleted_by_user"
            extra = dict(msg_obj.extra_data or {})
            extra["deleted_in_whatsapp"] = True
            extra["deleted_at"] = datetime.now(timezone.utc).isoformat()
            msg_obj.extra_data = extra
            await db.commit()
            return {"status": "ok", "action": "marked_as_deleted", "message_id": msg_obj.id}
        return {"status": "ok", "action": "not_found"}

    clean_phone = (payload.sender_phone or "").replace("+", "").strip()
    reply_target = payload.sender_jid or clean_phone
    display_phone = clean_phone.replace("@lid", "")
    if not display_phone.startswith("+") and display_phone.isdigit():
        display_phone = f"+{display_phone}"

    account_key = payload.account_id
    logger.info("Integration event processed")

    if not payload.message_id:
        raise HTTPException(422, "Message ID required")
    if not await claim_event(db, payload.message_id, 'whatsapp_bridge',
                             {'account_id': account_key, 'phone': display_phone, 'jid': reply_target, 'text': payload.text}):
        return {"status": "ok", "duplicate": True}

    # 3. Get or create customer by phone number
    customer, _ = await CustomerService.get_or_create_by_whatsapp_id(
        db=db,
        whatsapp_id=reply_target,
        phone=display_phone,
        name=payload.sender_name or f"WhatsApp {display_phone[-4:]}",
    )

    # 4. Get or create conversation with channel='whatsapp' and assigned WhatsApp account
    conv, _ = await ConversationService.get_or_create_conversation(
        db=db,
        customer_id=customer.id,
        channel="whatsapp",
        whatsapp_account_id=wa_account_id,
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

    await finish_event(db, payload.message_id)
    return {"status": "ok", "conversation_id": conv.id}

