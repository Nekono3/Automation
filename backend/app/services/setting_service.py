import logging
from typing import Optional, Dict, Any
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import SystemSetting
from app.models.conversation import Conversation
from app.models.audit import AuditLog

logger = logging.getLogger("insta.settings")


class SettingService:
    @staticmethod
    async def get_setting(db: AsyncSession, key: str, default: Optional[str] = None) -> Optional[str]:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = res.scalar_one_or_none()
        if setting is not None:
            return setting.value
        return default

    @staticmethod
    async def set_setting(
        db: AsyncSession,
        key: str,
        value: str,
        description: Optional[str] = None,
    ) -> SystemSetting:
        res = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        setting = res.scalar_one_or_none()
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            setting = SystemSetting(key=key, value=value, description=description)
            db.add(setting)
        await db.commit()
        await db.refresh(setting)
        return setting

    @staticmethod
    async def get_global_ai_state(db: AsyncSession) -> Dict[str, Any]:
        global_mode = await SettingService.get_setting(db, "global_ai_mode", default="ai")
        wa_val = await SettingService.get_setting(db, "global_ai_whatsapp", default="true")
        ig_val = await SettingService.get_setting(db, "global_ai_instagram", default="true")

        # Count open conversations by mode
        counts_res = await db.execute(
            select(Conversation.mode, func.count(Conversation.id))
            .where(Conversation.status == "open")
            .group_by(Conversation.mode)
        )
        counts = {row[0]: row[1] for row in counts_res.all()}

        total_open = sum(counts.values())
        ai_open = counts.get("ai", 0)
        human_open = counts.get("human", 0)
        paused_open = counts.get("paused", 0)

        return {
            "global_mode": global_mode if global_mode in ("ai", "human") else "ai",
            "global_ai_whatsapp": wa_val.lower() == "true",
            "global_ai_instagram": ig_val.lower() == "true",
            "total_open": total_open,
            "ai_open": ai_open,
            "human_open": human_open,
            "paused_open": paused_open,
        }

    @staticmethod
    async def set_global_ai_mode(
        db: AsyncSession,
        mode: str,
        channel: str = "all",
        apply_to_existing: bool = True,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if mode not in ("ai", "human"):
            raise ValueError("Mode must be 'ai' or 'human'")

        # 1. Update persisted settings
        await SettingService.set_setting(
            db,
            "global_ai_mode",
            mode,
            description="Global default AI chatbot mode: 'ai' or 'human' (consultant)",
        )

        is_ai_enabled = mode == "ai"
        if channel in ("all", "whatsapp"):
            await SettingService.set_setting(
                db,
                "global_ai_whatsapp",
                str(is_ai_enabled).lower(),
                description="WhatsApp AI auto-responder toggle",
            )
        if channel in ("all", "instagram"):
            await SettingService.set_setting(
                db,
                "global_ai_instagram",
                str(is_ai_enabled).lower(),
                description="Instagram AI auto-responder toggle",
            )

        # 2. Optionally batch update existing open conversations
        updated_count = 0
        if apply_to_existing:
            stmt = update(Conversation).where(Conversation.status == "open")
            if channel == "whatsapp":
                stmt = stmt.where(Conversation.channel == "whatsapp")
            elif channel == "instagram":
                stmt = stmt.where(Conversation.channel == "instagram")

            stmt = stmt.values(mode=mode)
            res = await db.execute(stmt)
            updated_count = res.rowcount or 0
            await db.commit()

        # 3. Log audit event
        audit = AuditLog(
            user_id=user_id,
            action="global_ai_mode_changed",
            entity="system_settings",
            extra_data={
                "target_mode": mode,
                "channel": channel,
                "apply_to_existing": apply_to_existing,
                "updated_conversations": updated_count,
            },
        )
        db.add(audit)
        await db.commit()

        logger.info(
            "Global AI mode changed to '%s' (channel=%s, apply_to_existing=%s, updated=%d)",
            mode,
            channel,
            apply_to_existing,
            updated_count,
        )

        return await SettingService.get_global_ai_state(db)
