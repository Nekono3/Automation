from datetime import datetime, timezone
from typing import Optional, List
import secrets
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.service import Service
from app.models.customer import Customer
from app.models.audit import AuditLog
from app.schemas.booking import BookingCreate, BookingUpdate


class BookingService:
    @staticmethod
    async def generate_booking_number(db: AsyncSession) -> str:
        """Generates a human-readable unique booking number like B-202610-0042."""
        now = datetime.now(timezone.utc)
        prefix = f"B-{now.strftime('%Y%m')}"
        count_res = await db.execute(
            select(func.count(Booking.id)).where(Booking.booking_number.like(f"{prefix}%"))
        )
        count = (count_res.scalar() or 0) + 1
        random_suffix = secrets.token_hex(2).upper()
        return f"{prefix}-{count:03d}-{random_suffix}"

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        data: BookingCreate,
        status: str = "draft",
        user_id: Optional[int] = None,
    ) -> Booking:
        # Resolve service snapshot
        service_name = "Индивидуальная консультация"
        service_price = 0.0
        currency = "KGS"

        if data.service_id:
            service_res = await db.execute(select(Service).where(Service.id == data.service_id))
            service = service_res.scalar_one_or_none()
            if service:
                service_name = service.name
                service_price = service.price
                currency = service.currency

        booking_number = await BookingService.generate_booking_number(db)

        booking = Booking(
            booking_number=booking_number,
            customer_id=data.customer_id,
            service_id=data.service_id,
            service_name_snapshot=service_name,
            price_snapshot=service_price,
            currency=currency,
            status=status,
            scheduled_at=data.scheduled_at,
            duration_minutes=data.duration_minutes,
            meeting_type=data.meeting_type,
            meeting_location=data.meeting_location,
            customer_name=data.customer_name,
            customer_phone=data.customer_phone,
            customer_email=data.customer_email,
            notes=data.notes,
        )
        db.add(booking)

        # Audit
        audit = AuditLog(
            user_id=user_id,
            action="booking_created",
            entity="booking",
            extra_data={"booking_number": booking_number, "status": status, "service": service_name},
        )
        db.add(audit)

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def confirm_booking(
        db: AsyncSession,
        booking_id: int,
        user_id: Optional[int] = None,
    ) -> Optional[Booking]:
        result = await db.execute(select(Booking).where(Booking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            return None

        now = datetime.now(timezone.utc)
        booking.status = "confirmed"
        booking.confirmed_at = now

        audit = AuditLog(
            user_id=user_id,
            action="booking_confirmed",
            entity="booking",
            entity_id=booking.id,
            extra_data={"booking_number": booking.booking_number, "confirmed_at": now.isoformat()},
        )
        db.add(audit)

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def cancel_booking(
        db: AsyncSession,
        booking_id: int,
        reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Optional[Booking]:
        result = await db.execute(select(Booking).where(Booking.id == booking_id))
        booking = result.scalar_one_or_none()
        if not booking:
            return None

        now = datetime.now(timezone.utc)
        booking.status = "cancelled"
        booking.cancelled_at = now

        audit = AuditLog(
            user_id=user_id,
            action="booking_cancelled",
            entity="booking",
            entity_id=booking.id,
            extra_data={"booking_number": booking.booking_number, "reason": reason},
        )
        db.add(audit)

        await db.commit()
        await db.refresh(booking)
        return booking

    @staticmethod
    async def get_by_id(db: AsyncSession, booking_id: int) -> Optional[Booking]:
        result = await db.execute(
            select(Booking)
            .where(Booking.id == booking_id)
            .options(selectinload(Booking.customer), selectinload(Booking.service))
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_bookings(
        db: AsyncSession,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Booking]:
        query = (
            select(Booking)
            .options(selectinload(Booking.service), selectinload(Booking.customer))
            .order_by(Booking.created_at.desc())
        )
        if customer_id:
            query = query.where(Booking.customer_id == customer_id)
        if status:
            query = query.where(Booking.status == status)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
