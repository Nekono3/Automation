from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 60
    price: float = 0.0
    currency: str = "KGS"
    is_active: bool = True
    category: Optional[str] = None


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    category: Optional[str] = None


class ServiceRead(ServiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
