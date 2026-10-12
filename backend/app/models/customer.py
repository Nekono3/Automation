from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.conversation import Conversation
    from app.models.booking import Booking
    from app.models.student_profile import StudentProfile
    from app.models.deal import Deal


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    instagram_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    whatsapp_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    extra_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    last_contact_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # EdTech fields from Tech Spec
    role_type: Mapped[str] = mapped_column(String(32), default="STUDENT", nullable=False)  # STUDENT, PARENT, OTHER
    preferred_language: Mapped[str] = mapped_column(String(16), default="RU", nullable=False)  # RU, KY, EN
    parent_contact_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Relationships
    conversations: Mapped[List["Conversation"]] = relationship(
        "Conversation", back_populates="customer", cascade="all, delete-orphan"
    )
    bookings: Mapped[List["Booking"]] = relationship(
        "Booking", back_populates="customer", cascade="all, delete-orphan"
    )
    student_profile: Mapped[Optional["StudentProfile"]] = relationship(
        "StudentProfile", back_populates="customer", uselist=False, cascade="all, delete-orphan"
    )
    deals: Mapped[List["Deal"]] = relationship(
        "Deal", back_populates="customer", cascade="all, delete-orphan"
    )
