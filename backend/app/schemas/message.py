from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class MessageBase(BaseModel):
    conversation_id: int
    customer_id: int
    channel: str = "instagram"
    external_message_id: Optional[str] = None
    direction: str  # "inbound" | "outbound"
    sender_type: str  # "customer" | "ai" | "employee" | "system"
    text: Optional[str] = None
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "received"
    extra_data: Dict[str, Any] = Field(default_factory=dict)


class MessageCreate(MessageBase):
    pass


class MessageRead(MessageBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
