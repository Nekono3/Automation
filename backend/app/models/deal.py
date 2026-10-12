from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.user import User


class Deal(Base, TimestampMixin):
    """
    Deal entity for multi-pipeline tracking:
    Pipeline 1: SALES (NEW_LEAD, AI_QUALIFIED, CONSULTATION_SCHEDULED, CONSULTATION_COMPLETED, CONTRACT_PENDING, CLOSED_WON, CLOSED_LOST)
    Pipeline 2: ADMISSION (DOCS_COLLECTION, ESSAY_AND_PORTFOLIO, APPLICATIONS_SUBMITTED, OFFER_RECEIVED, VISA_STAGE, ENROLLED_AND_DEPARTED)
    """
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # SALES or ADMISSION
    pipeline_type: Mapped[str] = mapped_column(String(32), default="SALES", index=True, nullable=False)

    # Stage identifier
    stage: Mapped[str] = mapped_column(String(64), default="NEW_LEAD", index=True, nullable=False)

    target_country: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    target_degree: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="KGS", nullable=False)

    lost_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assigned_user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="deals")
    assigned_user: Mapped[Optional["User"]] = relationship("User")
    checklists: Mapped[List["DocumentChecklist"]] = relationship(
        "DocumentChecklist", back_populates="deal", cascade="all, delete-orphan"
    )


class DocumentChecklist(Base, TimestampMixin):
    """
    Checklist of required applicant documents for admissions (deal).
    """
    __tablename__ = "document_checklists"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    deal_id: Mapped[int] = mapped_column(
        ForeignKey("deals.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # E.g. "Загранпаспорт", "Табель 10-11 класс", "IELTS / Duolingo", "Мотивационное письмо", "Выписка из банка"
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # NOT_SUBMITTED, UNDER_REVIEW, ACCEPTED, REJECTED
    status: Mapped[str] = mapped_column(String(32), default="NOT_SUBMITTED", nullable=False)

    file_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Relationship
    deal: Mapped["Deal"] = relationship("Deal", back_populates="checklists")
