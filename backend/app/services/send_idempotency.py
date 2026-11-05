"""Optional request idempotency using existing event storage; no automatic replay.

Uncertain/crashed claims return 409 for operator investigation. This does not
promise provider exactly-once delivery or replace the planned durable outbox.
"""
import hashlib
from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import Message
from app.models.audit import WebhookEvent
from app.services.webhook_claims import claim_event
from app.services.message_delivery import deliver


async def send_once(db, conversation, text, actor_id, key=None):
    if key is None:
        return await deliver(db, conversation, text, actor_id=actor_id)
    event_id = f'send:{actor_id}:'+hashlib.sha256(key.encode()).hexdigest()
    digest = hashlib.sha256(f'{conversation.id}\0{text}'.encode()).hexdigest()
    claimed = await claim_event(db, event_id, 'manual_send', {'digest': digest})
    if not claimed:
        event = await db.scalar(select(WebhookEvent).where(WebhookEvent.event_id == event_id))
        if not event or event.payload.get('digest') != digest:
            raise HTTPException(409, 'Ключ отправки уже используется для другого сообщения')
        if event.status != 'processed' or not event.payload.get('message_id'):
            raise HTTPException(409, 'Результат отправки уточняется. Не повторяйте отправку автоматически')
        return await db.get(Message, event.payload['message_id'])
    message = await deliver(db, conversation, text, actor_id=actor_id)
    await db.execute(update(WebhookEvent).where(WebhookEvent.event_id == event_id).values(
        status='processed', payload={'digest': digest, 'message_id': message.id}))
    await db.commit()
    return message
