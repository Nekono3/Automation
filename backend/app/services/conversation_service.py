from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.message import Message
from app.models.audit import AuditLog


class ConversationService:
    @staticmethod
    async def get_or_create_conversation(
        db: AsyncSession,
        customer_id: int,
        channel: str = "instagram",
    ) -> tuple[Conversation, bool]:
        """Gets active conversation for customer on channel, or creates a new one."""
        query = (
            select(Conversation)
            .where(
                Conversation.customer_id == customer_id,
                Conversation.channel == channel,
                Conversation.status != "archived",
            )
            .order_by(Conversation.created_at.desc())
        )
        result = await db.execute(query)
        conversation = result.scalars().first()

        created = False
        if not conversation:
            conversation = Conversation(
                customer_id=customer_id,
                channel=channel,
                mode="ai",
                status="open",
            )
            db.add(conversation)
            await db.commit()
            await db.refresh(conversation)
            created = True

        return conversation, created

    @staticmethod
    async def get_by_id(
        db: AsyncSession,
        conversation_id: int,
        load_messages: bool = True,
    ) -> Optional[Conversation]:
        query = select(Conversation).where(Conversation.id == conversation_id).options(selectinload(Conversation.customer))
        if load_messages:
            query = query.options(selectinload(Conversation.messages))
        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def set_mode(
        db: AsyncSession,
        conversation_id: int,
        mode: str,
        reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Conversation]:
        """Sets conversation mode to 'ai', 'human', or 'paused' and logs the audit event."""
        if mode not in ("ai", "human", "paused"):
            raise ValueError(f"Invalid conversation mode: {mode}")

        conversation = await ConversationService.get_by_id(db, conversation_id, load_messages=False)
        if not conversation:
            return None

        old_mode = conversation.mode
        conversation.mode = mode

        # Audit trail
        audit = AuditLog(
            user_id=user_id,
            action="conversation_mode_changed",
            entity="conversation",
            entity_id=conversation_id,
            extra_data={
                "from_mode": old_mode,
                "to_mode": mode,
                "reason": reason,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(conversation)
        return conversation

    @staticmethod
    async def record_message(
        db: AsyncSession,
        conversation_id: int,
        customer_id: int,
        direction: str,
        sender_type: str,
        text: Optional[str] = None,
        external_message_id: Optional[str] = None,
        attachments: Optional[list] = None,
        extra_data: Optional[dict] = None,
        channel: str = "instagram",
    ) -> tuple[Message, bool]:
        """
        Records a message idempotently.
        If external_message_id already exists, returns existing message and created=False.
        """
        # Deduplication check
        if external_message_id:
            existing = await db.execute(
                select(Message).where(Message.external_message_id == external_message_id)
            )
            existing_msg = existing.scalar_one_or_none()
            if existing_msg:
                return existing_msg, False

        now = datetime.now(timezone.utc)
        message = Message(
            conversation_id=conversation_id,
            customer_id=customer_id,
            channel=channel,
            external_message_id=external_message_id,
            direction=direction,
            sender_type=sender_type,
            text=text,
            attachments=attachments or [],
            extra_data=extra_data or {},
            status="received" if direction == "inbound" else "sent",
        )
        db.add(message)

        # Update conversation metadata
        conv = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
        conversation = conv.scalar_one_or_none()
        if conversation:
            conversation.last_message_at = now
            if direction == "inbound":
                conversation.unread_count += 1
            else:
                conversation.unread_count = 0  # reset unread when reply is sent

        await db.commit()
        await db.refresh(message)
        return message, True

    @staticmethod
    async def list_conversations(
        db: AsyncSession,
        status: Optional[str] = None,
        mode: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Conversation]:
        query = (
            select(Conversation)
            .options(selectinload(Conversation.customer))
            .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.created_at.desc())
        )
        if status:
            query = query.where(Conversation.status == status)
        if mode:
            query = query.where(Conversation.mode == mode)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
