from datetime import datetime, timezone
from sqlalchemy import select
from app.models import Message, WhatsAppAccount, AuditLog
from app.integrations.whatsapp.client import WhatsAppClient
from app.integrations.instagram.client import InstagramClient


async def deliver(db, conversation, text, sender_type="employee", actor_id=None):
    message = Message(
        conversation_id=conversation.id,
        customer_id=conversation.customer_id,
        channel=conversation.channel,
        direction="outbound",
        sender_type=sender_type,
        text=text,
        status="pending",
        extra_data={"user_id": actor_id},
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    result = {"error": "channel_not_configured"}
    try:
        if conversation.channel == "whatsapp":
            account = (
                await db.get(WhatsAppAccount, conversation.whatsapp_account_id)
                if conversation.whatsapp_account_id
                else None
            )
            if account and account.is_active:
                result = await WhatsAppClient().send_text_message(
                    conversation.customer.whatsapp_id
                    or conversation.customer.phone
                    or "",
                    text,
                    account_id=account.account_id,
                )
        elif conversation.channel == "instagram" and conversation.customer.instagram_id:
            result = await InstagramClient().send_text_message(
                conversation.customer.instagram_id, text
            )
    except Exception:
        result = {"error": "provider_unavailable"}
    external_id = (
        result.get("message_id") or (result.get("messages") or [{}])[0].get("id")
        if isinstance(result, dict)
        else None
    )
    successful = (
        bool(external_id) and not result.get("error") and not result.get("mock")
    )
    message.status = "sent" if successful else "failed"
    # Provider echoes are reconciled separately; do not race the unique external id on a concurrent echo.
    message.extra_data = {
        **message.extra_data,
        "provider_message_id": external_id,
        "delivery_error": None if successful else "delivery_failed",
    }
    if successful:
        conversation.last_message_at = datetime.now(timezone.utc)
        conversation.unread_count = 0
    elif sender_type == "ai":
        conversation.mode = "human"
    db.add(
        AuditLog(
            user_id=actor_id,
            action="message_sent" if successful else "message_failed",
            entity="message",
            entity_id=message.id,
            extra_data={
                "conversation_id": conversation.id,
                "account_id": conversation.whatsapp_account_id,
            },
        )
    )
    await db.commit()
    await db.refresh(message)
    return message
