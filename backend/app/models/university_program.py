from typing import Optional
from sqlalchemy import String, Text, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class UniversityProgram(Base, TimestampMixin):
    """
    Catalog of universities, faculties, educational programs, and tuition contracts.
    Organized from official admission databases and spreadsheets (e.g. Turkey state universities).
    """
    __tablename__ = "university_programs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    university: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    faculty: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    program_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    program_name_ru: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    degree_level: Mapped[str] = mapped_column(String(64), index=True, default="Бакалавр", nullable=False)
    
    tuition_fee: Mapped[str] = mapped_column(String(64), default="$0", nullable=False)
    tuition_fee_usd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    
    duration: Mapped[str] = mapped_column(String(64), default="4 года", nullable=False)
    language: Mapped[str] = mapped_column(String(64), default="Турецкий", nullable=False)
    city: Mapped[str] = mapped_column(String(128), default="Турция", nullable=False)
    country: Mapped[str] = mapped_column(String(128), default="Турция", nullable=False)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
