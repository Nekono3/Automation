from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.service import Service
from app.schemas.service import ServiceCreate, ServiceUpdate


class ServiceCatalogService:
    @staticmethod
    async def get_by_id(db: AsyncSession, service_id: int) -> Optional[Service]:
        result = await db.execute(select(Service).where(Service.id == service_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_services(db: AsyncSession, active_only: bool = True) -> List[Service]:
        query = select(Service)
        if active_only:
            query = query.where(Service.is_active == True)
        query = query.order_by(Service.price.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, data: ServiceCreate) -> Service:
        service = Service(**data.model_dump())
        db.add(service)
        await db.commit()
        await db.refresh(service)
        return service

    @staticmethod
    async def update(db: AsyncSession, service_id: int, data: ServiceUpdate) -> Optional[Service]:
        service = await ServiceCatalogService.get_by_id(db, service_id)
        if not service:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(service, key, value)
        await db.commit()
        await db.refresh(service)
        return service

    @staticmethod
    async def seed_default_services(db: AsyncSession) -> List[Service]:
        """Seeds standard consulting service offerings if the catalog is empty."""
        existing = await db.execute(select(Service))
        if existing.scalars().first():
            return []

        defaults = [
            Service(
                name="Первичная консультация",
                description="Вводная консультация (30 мин) для анализа вашей ситуации и постановки целей.",
                duration_minutes=30,
                price=1500.0,
                currency="KGS",
                category="Консультации",
            ),
            Service(
                name="Полная стратегическая сессия",
                description="Глубокий разбор кейса (60 мин), составление пошагового плана действий.",
                duration_minutes=60,
                price=3500.0,
                currency="KGS",
                category="Стратегия",
            ),
            Service(
                name="Аудит процессов",
                description="Комплексный анализ текущих процессов (90 мин) и выявление ключевых точек роста.",
                duration_minutes=90,
                price=5000.0,
                currency="KGS",
                category="Аудит",
            ),
        ]
        db.add_all(defaults)
        await db.commit()
        return defaults
