import logging
from typing import List, Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal import Deal, DocumentChecklist
from app.models.customer import Customer
from app.schemas.deal import DealCreate, DealUpdate, DealStageUpdate

logger = logging.getLogger("insta.deals")


class DealService:
    @staticmethod
    async def list_deals(
        db: AsyncSession,
        pipeline_type: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> List[Deal]:
        stmt = (
            select(Deal)
            .options(
                selectinload(Deal.checklists),
                selectinload(Deal.customer),
            )
            .order_by(Deal.updated_at.desc())
        )
        if pipeline_type:
            stmt = stmt.where(Deal.pipeline_type == pipeline_type)
        if customer_id:
            stmt = stmt.where(Deal.customer_id == customer_id)

        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, deal_id: int) -> Optional[Deal]:
        stmt = (
            select(Deal)
            .options(
                selectinload(Deal.checklists),
                selectinload(Deal.customer),
            )
            .where(Deal.id == deal_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_deal(db: AsyncSession, data: DealCreate) -> Deal:
        deal = Deal(
            title=data.title,
            customer_id=data.customer_id,
            pipeline_type=data.pipeline_type,
            stage=data.stage,
            target_country=data.target_country,
            target_degree=data.target_degree,
            amount=data.amount,
            currency=data.currency,
            lost_reason=data.lost_reason,
            assigned_user_id=data.assigned_user_id,
            notes=data.notes,
        )
        db.add(deal)
        await db.commit()
        await db.refresh(deal)

        # Seed standard checklists if pipeline is ADMISSION
        if deal.pipeline_type == "ADMISSION":
            standard_docs = [
                "Заграничный паспорт",
                "Табель оценок (10-11 класс / диплом)",
                "Сертификат IELTS / Duolingo / TOEFL",
                "Мотивационное письмо (Personal Statement)",
                "Резюме / CV",
                "Выписка из банка (финансовая гарантия)",
            ]
            for doc_name in standard_docs:
                chk = DocumentChecklist(deal_id=deal.id, document_name=doc_name, status="NOT_SUBMITTED")
                db.add(chk)
            await db.commit()
            await db.refresh(deal)

        return await DealService.get_by_id(db, deal.id)

    @staticmethod
    async def update_stage(
        db: AsyncSession,
        deal_id: int,
        data: DealStageUpdate,
    ) -> Optional[Deal]:
        deal = await DealService.get_by_id(db, deal_id)
        if not deal:
            return None

        old_stage = deal.stage
        deal.stage = data.stage
        if data.lost_reason:
            deal.lost_reason = data.lost_reason

        # Automatic transition: If SALES pipeline deal hits CLOSED_WON, auto-create card in ADMISSION pipeline!
        if deal.pipeline_type == "SALES" and data.stage == "CLOSED_WON" and old_stage != "CLOSED_WON":
            logger.info("Deal #%d closed won! Auto-creating ADMISSION pipeline deal...", deal.id)
            admission_deal = Deal(
                title=f"Поступление: {deal.title}",
                customer_id=deal.customer_id,
                pipeline_type="ADMISSION",
                stage="DOCS_COLLECTION",
                target_country=deal.target_country,
                target_degree=deal.target_degree,
                amount=deal.amount,
                currency=deal.currency,
            )
            db.add(admission_deal)
            await db.flush()

            standard_docs = [
                "Заграничный паспорт",
                "Табель оценок (10-11 класс / диплом)",
                "Сертификат языкового теста",
                "Мотивационное письмо",
                "Резюме / CV",
                "Выписка из банка",
            ]
            for doc_name in standard_docs:
                db.add(DocumentChecklist(deal_id=admission_deal.id, document_name=doc_name, status="NOT_SUBMITTED"))

        await db.commit()
        return await DealService.get_by_id(db, deal.id)

    @staticmethod
    async def update_checklist_status(
        db: AsyncSession,
        checklist_id: int,
        status: str,
        file_url: Optional[str] = None,
    ) -> Optional[DocumentChecklist]:
        stmt = select(DocumentChecklist).where(DocumentChecklist.id == checklist_id)
        res = await db.execute(stmt)
        chk = res.scalar_one_or_none()
        if not chk:
            return None
        chk.status = status
        if file_url:
            chk.file_url = file_url
        await db.commit()
        await db.refresh(chk)
        return chk
