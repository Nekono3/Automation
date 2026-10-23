from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class KPIScoreAdd(BaseModel):
    seller_id: int
    period: str  # e.g. "01.06-06.06"
    category: str  # "punctuality" | "calls_meetings" | "sales" | "team_meetings" | "innovation" or direct title
    score: float
    evaluator: Optional[str] = None
    notes: Optional[str] = None


class SellerKPIRecordBase(BaseModel):
    period: str
    punctuality: float = 0.0
    calls_meetings: float = 0.0
    sales: float = 0.0
    team_meetings: float = 0.0
    innovation: float = 0.0
    total_score: float = 0.0
    evaluator: Optional[str] = None
    notes: Optional[str] = None


class SellerKPIRecordCreate(SellerKPIRecordBase):
    seller_id: int


class SellerKPIRecordUpdate(BaseModel):
    period: Optional[str] = None
    punctuality: Optional[float] = None
    calls_meetings: Optional[float] = None
    sales: Optional[float] = None
    team_meetings: Optional[float] = None
    innovation: Optional[float] = None
    total_score: Optional[float] = None
    evaluator: Optional[str] = None
    notes: Optional[str] = None


class SellerKPIRecordRead(SellerKPIRecordBase):
    id: int
    seller_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SellerBase(BaseModel):
    name: str
    role: str = "Сатуучу (Менеджер по продажам)"
    phone: Optional[str] = None
    is_active: bool = True


class SellerCreate(SellerBase):
    pass


class SellerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class SellerRead(SellerBase):
    id: int
    records: List[SellerKPIRecordRead] = []
    total_earned_score: float = 0.0
    average_score: float = 0.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
