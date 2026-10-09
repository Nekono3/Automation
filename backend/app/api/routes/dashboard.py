from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.conversation import Conversation
from app.models.booking import Booking
from app.models.customer import Customer

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


class DashboardStats(BaseModel):
    open_conversations: int
    ai_conversations: int
    human_conversations: int
    pending_bookings: int
    total_customers: int
    unread_messages: int


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # open_conversations
    open_convs_query = select(func.count(Conversation.id)).where(Conversation.status == "open")
    open_conversations = (await db.execute(open_convs_query)).scalar() or 0

    # ai_conversations
    ai_convs_query = select(func.count(Conversation.id)).where(Conversation.mode == "ai", Conversation.status == "open")
    ai_conversations = (await db.execute(ai_convs_query)).scalar() or 0

    # human_conversations
    human_convs_query = select(func.count(Conversation.id)).where(Conversation.mode == "human", Conversation.status == "open")
    human_conversations = (await db.execute(human_convs_query)).scalar() or 0

    # pending_bookings
    pending_bookings_query = select(func.count(Booking.id)).where(Booking.status.in_(["draft", "awaiting_confirmation"]))
    pending_bookings = (await db.execute(pending_bookings_query)).scalar() or 0

    # total_customers
    total_customers_query = select(func.count(Customer.id))
    total_customers = (await db.execute(total_customers_query)).scalar() or 0

    # unread_messages
    unread_msgs_query = select(func.sum(Conversation.unread_count)).where(Conversation.status == "open")
    unread_messages = (await db.execute(unread_msgs_query)).scalar() or 0

    return DashboardStats(
        open_conversations=open_conversations,
        ai_conversations=ai_conversations,
        human_conversations=human_conversations,
        pending_bookings=pending_bookings,
        total_customers=total_customers,
        unread_messages=unread_messages,
    )

