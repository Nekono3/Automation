from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.service import Service


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    booking_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    
    # Historical Snapshots
    service_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    price_snapshot: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="KGS", nullable=False)
    
    # Status: "draft", "awaiting_confirmation", "confirmed", "completed", "cancelled"
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True, nullable=False)
    
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    
    # Meeting details
    meeting_type: Mapped[str] = mapped_column(String(32), default="online", nullable=False)
    meeting_location: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    
    # Contact info provided for booking
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    customer_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer", back_populates="bookings")
    service: Mapped[Optional["Service"]] = relationship("Service", back_populates="bookings")

    __table_args__ = (
        Index("idx_booking_status_date", "status", "scheduled_at"),
    )
