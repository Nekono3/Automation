from typing import Optional
from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class EnrolledStudent(Base, TimestampMixin):
    """
    Active student admissions process and financial tracker, synced with Consulteam Google Sheets.
    """
    __tablename__ = "enrolled_students"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)   # ФИО
    country: Mapped[str] = mapped_column(String(128), index=True, nullable=False)     # Өлкө (Чехия, Китай, Тайвань...)
    process_stage: Mapped[str] = mapped_column(String(128), index=True, default="Виза", nullable=False) # Процесс
    manager: Mapped[str] = mapped_column(String(128), index=True, default="Аяна", nullable=False)       # Менеджер / Ментор
    next_action: Mapped[str] = mapped_column(String(255), default="", nullable=False) # Next action
    risk: Mapped[str] = mapped_column(String(128), default="", nullable=False)        # Risk factor
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)                # Comment
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False) # Баары бүттү / Отказ
    status_raw: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Financial details
    contract_amount: Mapped[str] = mapped_column(String(64), default="", nullable=False) # Договор (500евро, 1200доллар)
    paid_amount: Mapped[str] = mapped_column(String(64), default="0", nullable=False)    # Берди
    remaining_amount: Mapped[str] = mapped_column(String(64), default="0", nullable=False) # Таза калганы
    seller_commission_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # % сатуучу
    mentor_commission_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False) # % ментор
    next_payment_condition: Mapped[str] = mapped_column(String(255), default="", nullable=False) # Кийинки төлөм
    last_payment_date: Mapped[str] = mapped_column(String(64), default="", nullable=False)       # Last payment
    finance_comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)          # Комментарий
    full_payment_received: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Акча баары алынды
