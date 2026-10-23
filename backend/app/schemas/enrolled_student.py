from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class EnrolledStudentBase(BaseModel):
    full_name: str
    country: str
    process_stage: str = "Виза"
    manager: str = "Аяна"
    next_action: str = ""
    risk: str = ""
    comment: Optional[str] = None
    is_completed: bool = False
    status_raw: Optional[str] = None

    contract_amount: str = ""
    paid_amount: str = "0"
    remaining_amount: str = "0"
    seller_commission_paid: bool = False
    mentor_commission_paid: bool = False
    next_payment_condition: str = ""
    last_payment_date: str = ""
    finance_comment: Optional[str] = None
    full_payment_received: bool = False


class EnrolledStudentCreate(EnrolledStudentBase):
    pass


class EnrolledStudentUpdate(BaseModel):
    full_name: Optional[str] = None
    country: Optional[str] = None
    process_stage: Optional[str] = None
    manager: Optional[str] = None
    next_action: Optional[str] = None
    risk: Optional[str] = None
    comment: Optional[str] = None
    is_completed: Optional[bool] = None
    status_raw: Optional[str] = None

    contract_amount: Optional[str] = None
    paid_amount: Optional[str] = None
    remaining_amount: Optional[str] = None
    seller_commission_paid: Optional[bool] = None
    mentor_commission_paid: Optional[bool] = None
    next_payment_condition: Optional[str] = None
    last_payment_date: Optional[str] = None
    finance_comment: Optional[str] = None
    full_payment_received: Optional[bool] = None


class EnrolledStudentRead(EnrolledStudentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EnrolledStudentsStats(BaseModel):
    total_students: int
    completed_count: int
    in_process_count: int
    countries_breakdown: Dict[str, int]
    stages_breakdown: Dict[str, int]
    managers_breakdown: Dict[str, int]
    risks_breakdown: Dict[str, int]
