from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.service import ServiceRead


class BookingBase(BaseModel):
    customer_id: int
    service_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 60
    meeting_type: str = "online"  # "online" | "office"
    meeting_location: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[str] = None


class BookingCreate(BookingBase):
    pass


class BookingUpdate(BaseModel):
    service_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    meeting_type: Optional[str] = None
    meeting_location: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    status: str  # "draft" | "awaiting_confirmation" | "confirmed" | "completed" | "cancelled"
    notes: Optional[str] = None


class BookingRead(BookingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    booking_number: str
    service_name_snapshot: str
    price_snapshot: float
    currency: str
    status: str
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    service: Optional[ServiceRead] = None
