from typing import List, Optional
from sqlalchemy import String, Float, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin


class Seller(Base, TimestampMixin):
    """
    Sales representative / manager tracked in the KPI system.
    """
    __tablename__ = "sellers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(128), default="Сатуучу (Менеджер по продажам)", nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    # Relationships
    records: Mapped[List["SellerKPIRecord"]] = relationship(
        "SellerKPIRecord", back_populates="seller", cascade="all, delete-orphan", order_by="SellerKPIRecord.id"
    )


class SellerKPIRecord(Base, TimestampMixin):
    """
    Weekly/periodic KPI scoring record for a seller across categories.
    """
    __tablename__ = "seller_kpi_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("sellers.id", ondelete="CASCADE"), index=True, nullable=False)
    period: Mapped[str] = mapped_column(String(64), index=True, nullable=False)  # e.g. "01.06-06.06"

    # Category Scores
    punctuality: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)      # Кечигүү, Лид база (max 10)
    calls_meetings: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)   # 2 Созвон, 3 Офиске чакыруу (max 40)
    sales: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)            # Сатуу (жумасына 2, max 50)
    team_meetings: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)    # Командалык чогулуштар (max 10)
    innovation: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)       # Компанияга 1 жаңылык (max 50)
    total_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)      # Жалпы чогултулган балл

    evaluator: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship
    seller: Mapped["Seller"] = relationship("Seller", back_populates="records")
