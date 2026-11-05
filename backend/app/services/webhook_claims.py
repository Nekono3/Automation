"""Atomic duplicate suppression, not a durable inbox or a retry worker.

A process crash after the committed claim can strand an event. Keep the claimed
state observable; never replay uncertain provider side effects automatically.
"""
from sqlalchemy.dialects.postgresql import insert
from app.models.audit import WebhookEvent


async def claim_event(db, event_id, source, payload):
    if not isinstance(event_id, str) or not event_id or len(event_id) > 255:
        return False
    claimed = await db.scalar(insert(WebhookEvent).values(
        event_id=event_id, source=source, payload=payload, status='claimed'
    ).on_conflict_do_nothing(index_elements=['event_id']).returning(WebhookEvent.id))
    await db.commit()
    return claimed is not None


async def finish_event(db, event_id, status='processed'):
    from sqlalchemy import update
    await db.execute(update(WebhookEvent).where(WebhookEvent.event_id == event_id).values(status=status))
    await db.commit()
