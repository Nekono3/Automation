import logging
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.automation import AutomationTrigger
from app.schemas.automation import AutomationTriggerCreate, AutomationTriggerUpdate

logger = logging.getLogger("insta.automations")


class AutomationService:
    @staticmethod
    async def list_triggers(
        db: AsyncSession,
        active_only: bool = False,
    ) -> List[AutomationTrigger]:
        stmt = select(AutomationTrigger).order_by(AutomationTrigger.id.desc())
        if active_only:
            stmt = stmt.where(AutomationTrigger.is_active == True)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, trigger_id: int) -> Optional[AutomationTrigger]:
        stmt = select(AutomationTrigger).where(AutomationTrigger.id == trigger_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def create_trigger(
        db: AsyncSession,
        data: AutomationTriggerCreate,
    ) -> AutomationTrigger:
        trigger = AutomationTrigger(
            name=data.name,
            keyword=data.keyword.strip().upper(),
            match_type=data.match_type,
            channel=data.channel,
            comment_reply_text=data.comment_reply_text,
            dm_reply_text=data.dm_reply_text,
            attachment_url=data.attachment_url,
            attachment_name=data.attachment_name,
            followup_text=data.followup_text,
            target_pipeline_stage=data.target_pipeline_stage,
            is_active=data.is_active,
        )
        db.add(trigger)
        await db.commit()
        await db.refresh(trigger)
        return trigger

    @staticmethod
    async def update_trigger(
        db: AsyncSession,
        trigger_id: int,
        data: AutomationTriggerUpdate,
    ) -> Optional[AutomationTrigger]:
        trigger = await AutomationService.get_by_id(db, trigger_id)
        if not trigger:
            return None

        for field, val in data.model_dump(exclude_unset=True).items():
            if field == "keyword" and val:
                val = val.strip().upper()
            setattr(trigger, field, val)

        await db.commit()
        await db.refresh(trigger)
        return trigger

    @staticmethod
    async def delete_trigger(db: AsyncSession, trigger_id: int) -> bool:
        trigger = await AutomationService.get_by_id(db, trigger_id)
        if not trigger:
            return False
        await db.delete(trigger)
        await db.commit()
        return True

    @staticmethod
    async def match_trigger(
        db: AsyncSession,
        text: str,
        channel: str = "ALL",
    ) -> Optional[AutomationTrigger]:
        """
        Finds the first active trigger matching the given incoming text or comment.
        Increments trigger count upon match.
        """
        if not text:
            return None

        clean_text = text.strip().upper()
        triggers = await AutomationService.list_triggers(db, active_only=True)

        for tr in triggers:
            # Channel filter
            if tr.channel != "ALL" and tr.channel.upper() != channel.upper():
                continue

            kw = tr.keyword.upper()
            matched = False
            if tr.match_type == "EXACT":
                matched = clean_text == kw
            else:  # CONTAINS
                matched = kw in clean_text

            if matched:
                tr.trigger_count += 1
                await db.commit()
                await db.refresh(tr)
                logger.info("Matched automation trigger #%d [%s] for message: '%s'", tr.id, tr.keyword, text[:40])
                return tr

        return None

    @staticmethod
    async def seed_default_consulteam_triggers(db: AsyncSession) -> List[AutomationTrigger]:
        """Seeds standard EdTech triggers for Consulteam if none exist."""
        existing = await AutomationService.list_triggers(db)
        if existing:
            return existing

        defaults = [
            AutomationTriggerCreate(
                name="Гайд по грантам в Италию (Reels Comment-to-DM)",
                keyword="ИТАЛИЯ",
                match_type="CONTAINS",
                channel="ALL",
                comment_reply_text="Отправили вам детали в Direct! Проверьте личные сообщения ✈️🇮🇹",
                dm_reply_text="Салам! Держи наш официальный гайд по поступлению и государственным стипендиям DSU в Италию (до 8 000€ в год + бесплатное обучение):\n\nСсылка на скачивание гайда: https://2-26-50-235.sslip.io/guides/italy-grants-2026.pdf",
                attachment_url="https://2-26-50-235.sslip.io/guides/italy-grants-2026.pdf",
                attachment_name="Гайд_Италия_Гранты_2026.pdf",
                followup_text="Удалось открыть файл? Подскажите, вы для себя планируете поступление на бакалавриат или магистратуру?",
                target_pipeline_stage="NEW_LEAD",
                is_active=True,
            ),
            AutomationTriggerCreate(
                name="Универсальный лид-магнит ГРАНТ",
                keyword="ГРАНТ",
                match_type="CONTAINS",
                channel="ALL",
                comment_reply_text="Отправили чек-лист по грантам вам в Direct! 🎓",
                dm_reply_text="Привет! Отправляем подробный чек-лист: «Топ-5 стран с бесплатным обучением и полным финансированием для студентов из Кыргызстана и СНГ».\n\nФайл: https://2-26-50-235.sslip.io/guides/top-scholarships.pdf",
                attachment_url="https://2-26-50-235.sslip.io/guides/top-scholarships.pdf",
                attachment_name="Чеклист_Гранты_Consulteam.pdf",
                followup_text="В какую страну или направление хотите поступить? (США, Европа, Корея, Турция)",
                target_pipeline_stage="NEW_LEAD",
                is_active=True,
            ),
            AutomationTriggerCreate(
                name="Поступление в США (Full-ride стипендии)",
                keyword="США",
                match_type="CONTAINS",
                channel="ALL",
                comment_reply_text="Ловите гайд по американским ВУЗам в Direct 🇺🇸",
                dm_reply_text="Привет! Лови дорожную карту поступления в университеты США с финансовой помощью (Need-based & Merit-based aid):\n\nГайд: https://2-26-50-235.sslip.io/guides/usa-admissions.pdf",
                attachment_url="https://2-26-50-235.sslip.io/guides/usa-admissions.pdf",
                attachment_name="Roadmap_USA_Universities.pdf",
                followup_text="Сдавали ли вы уже IELTS/TOEFL или SAT, или только планируете подготовку?",
                target_pipeline_stage="NEW_LEAD",
                is_active=True,
            ),
        ]

        created = []
        for d in defaults:
            t = await AutomationService.create_trigger(db, d)
            created.append(t)
        logger.info("Seeded %d default Consulteam automation triggers.", len(created))
        return created
