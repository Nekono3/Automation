"""Company modules extend existing CRM records without rewriting imported data."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import String, Text, Numeric, Date, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class CompanyTimestampMixin(TimestampMixin):
    __mapper_args__ = {"eager_defaults": True}


class LeadRecord(Base, CompanyTimestampMixin):
    __tablename__ = "company_leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), unique=True)
    assigned_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    category: Mapped[str] = mapped_column(String(128), default="Без категории", index=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)
    next_action: Mapped[str] = mapped_column(String(500), default="")


class AdmissionLink(Base, CompanyTimestampMixin):
    __tablename__ = "company_admissions"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("enrolled_students.id", ondelete="RESTRICT"), unique=True)
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"), unique=True)
    deal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("deals.id", ondelete="RESTRICT"), unique=True)
    manager_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    program_id: Mapped[Optional[int]] = mapped_column(ForeignKey("university_programs.id", ondelete="RESTRICT"))


class FinanceCategory(Base, CompanyTimestampMixin):
    __tablename__ = "finance_categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)


class FinanceTransaction(Base, CompanyTimestampMixin):
    __tablename__ = "finance_transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("finance_categories.id", ondelete="RESTRICT"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency: Mapped[str] = mapped_column(String(3), index=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("enrolled_students.id", ondelete="RESTRICT"), index=True)
    deal_id: Mapped[Optional[int]] = mapped_column(ForeignKey("deals.id", ondelete="RESTRICT"))
    stage: Mapped[str] = mapped_column(String(128), default="")
    recipient: Mapped[str] = mapped_column(String(255), default="")
    commission_percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    void_reason: Mapped[Optional[str]] = mapped_column(Text)
    __table_args__ = (
        CheckConstraint("amount > 0", name="finance_positive_amount"),
        CheckConstraint("kind IN ('income', 'expense')", name="finance_kind"),
        CheckConstraint("commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100)", name="finance_commission_range"),
    )


class EmployeeMetric(Base, CompanyTimestampMixin):
    __tablename__ = "employee_metrics"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    department: Mapped[str] = mapped_column(String(128), default="Продажи")
    position: Mapped[str] = mapped_column(String(128), default="")
    unit: Mapped[str] = mapped_column(String(32), default="шт.")
    direction: Mapped[str] = mapped_column(String(8), default="higher")
    __table_args__ = (CheckConstraint("direction IN ('higher', 'lower')", name="metric_direction"),)


class EmployeeResult(Base, CompanyTimestampMixin):
    __tablename__ = "employee_results"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    metric_id: Mapped[int] = mapped_column(ForeignKey("employee_metrics.id", ondelete="RESTRICT"))
    period: Mapped[date] = mapped_column(Date, index=True)
    target: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    actual: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    notes: Mapped[str] = mapped_column(Text, default="")
    evaluated_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    __table_args__ = (
        UniqueConstraint("user_id", "metric_id", "period", name="employee_metric_period"),
        CheckConstraint("target > 0 AND actual >= 0", name="employee_result_values"),
    )


class StudentDocument(Base, CompanyTimestampMixin):
    __tablename__ = "student_documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("enrolled_students.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    storage_key: Mapped[str] = mapped_column(String(64), unique=True)
    content_type: Mapped[str] = mapped_column(String(128))
    size: Mapped[int]
    status: Mapped[str] = mapped_column(String(32), default="under_review")
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
