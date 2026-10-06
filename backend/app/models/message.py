from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.conversation import Conversation


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(32), default="instagram", index=True)
    
    # External ID from Meta/Instagram for deduplication and idempotency
    external_message_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    
    # Direction: "inbound", "outbound"
    direction: Mapped[str] = mapped_column(String(16), index=True)
    # Sender type: "customer", "ai", "employee", "system"
    sender_type: Mapped[str] = mapped_column(String(16), index=True)
    
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachments: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    
    # Status: "received", "pending", "sent", "failed"
    status: Mapped[str] = mapped_column(String(32), default="received")
    extra_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationship
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("idx_msg_conv_created", "conversation_id", "created_at"),
    )
