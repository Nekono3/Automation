from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.customer import Customer
from app.schemas.conversation import ConversationRead
from app.schemas.message import MessageRead

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


@router.get("", response_model=List[ConversationRead])
async def list_conversations(
    status: Optional[str] = None,
    mode: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Lists conversations with customer profiles and recent messages."""
    query = (
        select(Conversation)
        .options(selectinload(Conversation.customer), selectinload(Conversation.messages))
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
    )
    if status:
        query = query.where(Conversation.status == status)
    if mode:
        query = query.where(Conversation.mode == mode)

    query = query.offset(skip).limit(limit)
    res = await db.execute(query)
    return list(res.scalars().all())


@router.get("/{conversation_id}/messages", response_model=List[MessageRead])
async def list_messages(
    conversation_id: int,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Lists all messages in a specific conversation."""
    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    res = await db.execute(query)
    return list(res.scalars().all())
