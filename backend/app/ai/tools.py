from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.service_catalog import ServiceCatalogService
from app.services.booking_service import BookingService
from app.services.conversation_service import ConversationService
from app.schemas.booking import BookingCreate


async def execute_get_services(db: AsyncSession) -> List[Dict[str, Any]]:
    """Retrieves list of active consulting services and prices."""
    services = await ServiceCatalogService.list_services(db, active_only=True)
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "duration_minutes": s.duration_minutes,
            "price": s.price,
            "currency": s.currency,
        }
        for s in services
    ]


async def execute_create_booking(
    db: AsyncSession,
    customer_id: int,
    service_id: int,
    customer_phone: Optional[str] = None,
    customer_name: Optional[str] = None,
    meeting_type: str = "online",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates a draft booking for a consulting appointment."""
    booking_in = BookingCreate(
        customer_id=customer_id,
        service_id=service_id,
        customer_phone=customer_phone,
        customer_name=customer_name,
        meeting_type=meeting_type,
        notes=notes,
    )
    booking = await BookingService.create_booking(db, booking_in, status="awaiting_confirmation")
    return {
        "booking_id": booking.id,
        "booking_number": booking.booking_number,
        "service": booking.service_name_snapshot,
        "price": booking.price_snapshot,
        "currency": booking.currency,
        "status": booking.status,
    }


async def execute_confirm_booking(db: AsyncSession, booking_id: int) -> Dict[str, Any]:
    """Confirms a pending booking appointment."""
    booking = await BookingService.confirm_booking(db, booking_id=booking_id)
    if not booking:
        return {"error": "Бронирование не найдено"}
    return {
        "booking_id": booking.id,
        "booking_number": booking.booking_number,
        "status": booking.status,
        "confirmed_at": booking.confirmed_at.isoformat() if booking.confirmed_at else None,
    }


async def execute_request_human_support(
    db: AsyncSession,
    conversation_id: int,
    reason: str,
) -> Dict[str, Any]:
    """Transfers the conversation from AI mode to human mode."""
    conv = await ConversationService.set_mode(
        db, conversation_id=conversation_id, mode="human", reason=reason
    )
    return {
        "status": "transferred_to_human",
        "conversation_id": conversation_id,
        "mode": conv.mode if conv else "human",
    }
