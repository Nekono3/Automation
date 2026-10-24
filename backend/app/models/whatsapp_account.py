from typing import Optional
from sqlalchemy import String, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class WhatsAppAccount(Base, TimestampMixin):
    __tablename__ = "whatsapp_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    account_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(128), default="Менеджер", nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_main: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    color: Mapped[str] = mapped_column(String(32), default="emerald", nullable=False)
