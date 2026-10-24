from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict



class WhatsAppAccountBase(BaseModel):
    name: str
    role: str = "Менеджер"
    color: str = "emerald"
    is_main: bool = False
    is_active: bool = True


class WhatsAppAccountCreate(WhatsAppAccountBase):
    account_id: Optional[str] = None


class WhatsAppAccountUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    color: Optional[str] = None
    is_main: Optional[bool] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None


class WhatsAppAccountRead(WhatsAppAccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: str
    phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Live bridge status
    live_status: Optional[str] = "disconnected"
    qr_image: Optional[str] = None
    has_qr: bool = False
