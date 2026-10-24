from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.schemas.customer import CustomerRead
from app.schemas.message import MessageRead


class ConversationBase(BaseModel):
    customer_id: int
    channel: str = "instagram"
    mode: str = "ai"  # "ai" | "human" | "paused"
    status: str = "open"  # "open" | "closed" | "archived"
    priority: str = "normal"


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(BaseModel):
    mode: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    unread_count: Optional[int] = None


class ConversationModeUpdate(BaseModel):
    mode: str  # "ai" | "human" | "paused"
    reason: Optional[str] = None


class WhatsAppAccountSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: str
    name: str
    role: str
    phone: Optional[str] = None
    color: str = "emerald"


class ConversationRead(ConversationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    whatsapp_account_id: Optional[int] = None
    whatsapp_account: Optional[WhatsAppAccountSimple] = None
    unread_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerRead] = None
    messages: List[MessageRead] = []

