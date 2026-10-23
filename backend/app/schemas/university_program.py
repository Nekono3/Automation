from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class UniversityProgramBase(BaseModel):
    university: str
    faculty: str
    program_name: str
    program_name_ru: str
    degree_level: str = "Бакалавр"
    tuition_fee: str = "$0"
    tuition_fee_usd: Optional[float] = None
    currency: str = "USD"
    duration: str = "4 года"
    language: str = "Турецкий"
    city: str = "Турция"
    country: str = "Турция"
    is_active: bool = True
    notes: Optional[str] = None


class UniversityProgramCreate(UniversityProgramBase):
    pass


class UniversityProgramUpdate(BaseModel):
    university: Optional[str] = None
    faculty: Optional[str] = None
    program_name: Optional[str] = None
    program_name_ru: Optional[str] = None
    degree_level: Optional[str] = None
    tuition_fee: Optional[str] = None
    tuition_fee_usd: Optional[float] = None
    currency: Optional[str] = None
    duration: Optional[str] = None
    language: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class UniversityProgramResponse(UniversityProgramBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UniversityRenameRequest(BaseModel):
    old_name: str
    new_name: str


class UniversitySummary(BaseModel):
    name: str
    city: str
    country: str
    program_count: int
    degrees: list[str]


class ProgramsStatsResponse(BaseModel):
    total_programs: int
    total_universities: int
    total_faculties: int
    degrees_breakdown: dict[str, int]
    universities: list[UniversitySummary]
