from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingRead
from app.services.booking_service import BookingService

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


class CancelRequest(BaseModel):
    reason: Optional[str] = None


@router.get("", response_model=List[BookingRead])
async def list_bookings(
    customer_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await BookingService.list_bookings(db, customer_id, status, skip, limit)


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = await BookingService.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.post("", response_model=BookingRead)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await BookingService.create_booking(db, payload, user_id=current_user.id)


@router.post("/{booking_id}/confirm", response_model=BookingRead)
async def confirm_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = await BookingService.confirm_booking(db, booking_id, user_id=current_user.id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Send automatic notification to customer in chat
    try:
        from app.models.customer import Customer
        from app.services.conversation_service import ConversationService
        from app.integrations.instagram.client import InstagramClient
        
        customer = await db.get(Customer, booking.customer_id)
        if customer:
            conv, _ = await ConversationService.get_or_create_conversation(db, customer.id)
            date_str = booking.scheduled_at.strftime("%d.%m в %H:%M") if booking.scheduled_at else "в согласованное время"
            name = customer.name or booking.customer_name or "Клиент"
            service_name = booking.service_name_snapshot or "консультация"
            
            confirm_msg = (
                f"Здравствуйте, {name}! 🎉\n\n"
                f"Ваша запись на «{service_name}» на {date_str} успешно подтверждена!\n"
                f"Ждём вас на встрече. Если у вас возникнут вопросы или потребуется перенос — просто напишите нам сюда."
            )
            
            await ConversationService.record_message(
                db=db,
                conversation_id=conv.id,
                customer_id=customer.id,
                channel=conv.channel,
                direction="outbound",
                sender_type="employee",
                text=confirm_msg,
            )
            
            if customer.instagram_id and not customer.instagram_id.startswith("test"):
                ig_client = InstagramClient()
                await ig_client.send_text_message(customer.instagram_id, confirm_msg)
    except Exception as exc:
        import logging
        logging.getLogger("insta.bookings").error("Failed sending confirmation msg to customer: %s", exc)

    return booking


@router.post("/{booking_id}/cancel", response_model=BookingRead)
async def cancel_booking(
    booking_id: int,
    payload: CancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = await BookingService.cancel_booking(db, booking_id, reason=payload.reason, user_id=current_user.id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Send automatic notification to customer in chat
    try:
        from app.models.customer import Customer
        from app.services.conversation_service import ConversationService
        from app.integrations.instagram.client import InstagramClient
        
        customer = await db.get(Customer, booking.customer_id)
        if customer:
            conv, _ = await ConversationService.get_or_create_conversation(db, customer.id)
            date_str = booking.scheduled_at.strftime("%d.%m в %H:%M") if booking.scheduled_at else "в выбранное время"
            name = customer.name or booking.customer_name or "Клиент"
            
            reason_text = f" ({payload.reason})" if payload.reason else ""
            cancel_msg = (
                f"Здравствуйте, {name}!\n\n"
                f"К сожалению, выбранное вами время на {date_str} уже занято другим клиентом{reason_text}.\n\n"
                f"Пожалуйста, напишите другое удобное для вас время или день, и мы с радостью подберем для вас свободный слот! 😊"
            )
            
            await ConversationService.record_message(
                db=db,
                conversation_id=conv.id,
                customer_id=customer.id,
                channel=conv.channel,
                direction="outbound",
                sender_type="employee",
                text=cancel_msg,
            )
            
            if customer.instagram_id and not customer.instagram_id.startswith("test"):
                ig_client = InstagramClient()
                await ig_client.send_text_message(customer.instagram_id, cancel_msg)
    except Exception as exc:
        import logging
        logging.getLogger("insta.bookings").error("Failed sending cancel msg to customer: %s", exc)

    return booking

