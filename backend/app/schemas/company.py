from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LeadInput(Input):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(default="", max_length=64)
    email: str = Field(default="", max_length=255)
    assigned_user_id: int | None = None
    category: str = Field(default="Без категории", min_length=1, max_length=128)
    status: Literal["new", "contacted", "qualified", "won", "lost"] = "new"
    next_action: str = Field(default="", max_length=500)


class LeadUpdate(Input):
    assigned_user_id: int | None = None
    category: str = Field(default="Без категории", min_length=1, max_length=128)
    status: Literal["new", "contacted", "qualified", "won", "lost"] = "new"
    next_action: str = Field(default="", max_length=500)


class CategoryInput(Input):
    name: str = Field(min_length=1, max_length=128)


class TransactionInput(Input):
    category_id: int
    kind: Literal["income", "expense"]
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    occurred_on: date
    description: str = Field(default="", max_length=5000)
    student_id: int | None = None
    deal_id: int | None = None
    stage: str = Field(default="", max_length=128)
    recipient: str = Field(default="", max_length=255)
    commission_percent: Decimal | None = Field(default=None, ge=0, le=100, decimal_places=2)

    @model_validator(mode="after")
    def commission_requires_recipient(self):
        if self.commission_percent is not None and (self.kind != "expense" or not self.recipient):
            raise ValueError("Комиссия должна быть расходом с указанным получателем")
        return self


class VoidInput(Input):
    reason: str = Field(min_length=3, max_length=1000)


class AdmissionInput(Input):
    customer_id: int | None = None
    deal_id: int | None = None
    manager_id: int | None = None
    program_id: int | None = None


class MetricInput(Input):
    name: str = Field(min_length=1, max_length=128)
    department: str = Field(default="Продажи", min_length=1, max_length=128)
    position: str = Field(default="", max_length=128)
    unit: str = Field(default="шт.", min_length=1, max_length=32)
    direction: Literal["higher", "lower"] = "higher"


class ResultInput(Input):
    user_id: int
    metric_id: int
    period: date
    target: Decimal = Field(gt=0, max_digits=18, decimal_places=2)
    actual: Decimal = Field(ge=0, max_digits=18, decimal_places=2)
    notes: str = Field(default="", max_length=5000)

    @field_validator("period")
    @classmethod
    def month_start(cls, value):
        if value.day != 1:
            raise ValueError("Период KPI должен начинаться с первого числа месяца")
        return value


class DocumentStatus(Input):
    status: Literal["under_review", "accepted", "rejected"]
