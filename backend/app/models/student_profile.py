from datetime import datetime
from typing import Optional, TYPE_CHECKING, Dict, Any, List
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.customer import Customer


class StudentProfile(Base, TimestampMixin):
    """
    Detailed academic profile of an applicant for university admissions.
    1-to-1 relationship with Customer (Contact).
    """
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    customer_id: Mapped[int] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )

    current_grade_or_status: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    school_or_university: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gpa: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # {"ielts": 6.5, "toefl": null, "sat": 1350, "duolingo": null, "topik": null}
    language_tests: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # ["Италия", "США", "Корея", "Германия", "Турция"]
    target_countries: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)

    # BACHELOR, MASTER, FOUNDATION, LANGUAGE_SCHOOL
    target_degree: Mapped[Optional[str]] = mapped_column(String(64), default="BACHELOR", nullable=True)

    # Planned enrollment year, e.g. 2026, 2027
    planned_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # FULL_SCHOLARSHIP_ONLY, PARTIAL_GRANT, SELF_FUNDED_UP_TO_5K, SELF_FUNDED_ABOVE_10K
    budget_expectation: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Relationship
    customer: Mapped["Customer"] = relationship("Customer", back_populates="student_profile")
