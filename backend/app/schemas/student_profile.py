from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class StudentProfileBase(BaseModel):
    current_grade_or_status: Optional[str] = None
    school_or_university: Optional[str] = None
    gpa: Optional[float] = None
    language_tests: Dict[str, Any] = {}
    target_countries: List[str] = []
    target_degree: Optional[str] = "BACHELOR"
    planned_year: Optional[int] = 2026
    budget_expectation: Optional[str] = None


class StudentProfileCreate(StudentProfileBase):
    customer_id: int


class StudentProfileUpdate(BaseModel):
    current_grade_or_status: Optional[str] = None
    school_or_university: Optional[str] = None
    gpa: Optional[float] = None
    language_tests: Optional[Dict[str, Any]] = None
    target_countries: Optional[List[str]] = None
    target_degree: Optional[str] = None
    planned_year: Optional[int] = None
    budget_expectation: Optional[str] = None


class StudentProfileRead(StudentProfileBase):
    id: int
    customer_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
