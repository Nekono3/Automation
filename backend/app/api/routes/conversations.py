from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.customer import Customer
from app.schemas.conversation import ConversationRead, ConversationUpdate, ConversationModeUpdate
from app.schemas.message import MessageRead
from app.services.conversation_service import ConversationService
from app.integrations.instagram.client import InstagramClient

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])


class OperatorMessage(BaseModel):
    text: str


@router.get("", response_model=List[ConversationRead])
async def list_conversations(
    status: Optional[str] = None,
    mode: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await ConversationService.get_by_id(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("/{conversation_id}/messages", response_model=List[MessageRead])
async def list_messages(
    conversation_id: int,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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


@router.post("/{conversation_id}/messages", response_model=MessageRead)
async def send_operator_message(
    conversation_id: int,
    payload: OperatorMessage,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await ConversationService.get_by_id(db, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    channel = conversation.channel or "instagram"
    msg = Message(
        conversation_id=conversation.id,
        customer_id=conversation.customer_id,
        channel=channel,
        direction="outbound",
        sender_type="employee",
        text=payload.text,
        status="sent"
    )
    db.add(msg)
    
    conversation.last_message_at = msg.created_at
    conversation.unread_count = 0
    await db.commit()
    await db.refresh(msg)
    
    if channel == "whatsapp" and (conversation.customer.whatsapp_id or conversation.customer.phone):
        from app.integrations.whatsapp.client import WhatsAppClient
        wa_client = WhatsAppClient()
        target_phone = conversation.customer.whatsapp_id or conversation.customer.phone
        await wa_client.send_text_message(target_phone, payload.text)
    elif conversation.customer.instagram_id:
        client = InstagramClient()
        await client.send_text_message(conversation.customer.instagram_id, payload.text)
    
    return msg


@router.patch("/{conversation_id}/mode", response_model=ConversationRead)
async def change_conversation_mode(
    conversation_id: int,
    payload: ConversationModeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await ConversationService.set_mode(db, conversation_id, payload.mode, payload.reason, current_user.id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationRead)
async def update_conversation(
    conversation_id: int,
    payload: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = await ConversationService.get_by_id(db, conversation_id, load_messages=True)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(conversation, key, value)
        
    await db.commit()
    await db.refresh(conversation)
    return conversation

