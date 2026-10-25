from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.whatsapp_account import WhatsAppAccount


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Role: 'admin', 'lead_manager', 'manager', 'mentor'
    role: Mapped[str] = mapped_column(String(32), default="manager", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Optional assignment to a specific WhatsApp number
    whatsapp_account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("whatsapp_accounts.id", ondelete="SET NULL"), nullable=True
    )
    whatsapp_account: Mapped[Optional["WhatsAppAccount"]] = relationship("WhatsAppAccount")
