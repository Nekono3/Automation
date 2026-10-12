from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class DocumentChecklistBase(BaseModel):
    document_name: str
    status: str = "NOT_SUBMITTED"
    file_url: Optional[str] = None


class DocumentChecklistCreate(DocumentChecklistBase):
    deal_id: int


class DocumentChecklistUpdate(BaseModel):
    document_name: Optional[str] = None
    status: Optional[str] = None
    file_url: Optional[str] = None


class DocumentChecklistRead(DocumentChecklistBase):
    id: int
    deal_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DealBase(BaseModel):
    title: str
    customer_id: int
    pipeline_type: str = "SALES"  # SALES or ADMISSION
    stage: str = "NEW_LEAD"
    target_country: Optional[str] = None
    target_degree: Optional[str] = None
    amount: float = 0.0
    currency: str = "KGS"
    lost_reason: Optional[str] = None
    assigned_user_id: Optional[int] = None
    notes: Optional[str] = None


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    title: Optional[str] = None
    pipeline_type: Optional[str] = None
    stage: Optional[str] = None
    target_country: Optional[str] = None
    target_degree: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    lost_reason: Optional[str] = None
    assigned_user_id: Optional[int] = None
    notes: Optional[str] = None


class DealStageUpdate(BaseModel):
    stage: str
    lost_reason: Optional[str] = None


class DealRead(DealBase):
    id: int
    created_at: datetime
    updated_at: datetime
    checklists: List[DocumentChecklistRead] = []

    model_config = ConfigDict(from_attributes=True)
