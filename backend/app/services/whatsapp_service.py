import logging
import time
from typing import List, Optional, Dict, Any
import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.whatsapp_account import WhatsAppAccount
from app.schemas.whatsapp_account import WhatsAppAccountCreate, WhatsAppAccountUpdate

logger = logging.getLogger("insta.whatsapp.service")
BRIDGE_URL = "http://127.0.0.1:3001"


class WhatsAppAccountService:
    @staticmethod
    async def get_bridge_sessions() -> Dict[str, Any]:
        """Fetch live status of all sessions from WhatsApp Baileys bridge."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(f"{BRIDGE_URL}/api/sessions")
                if resp.status_code == 200:
                    return resp.json().get("sessions", {})
        except Exception as exc:
            logger.debug("Failed to query WhatsApp bridge sessions: %s", exc)
        return {}

    @staticmethod
    async def list_accounts(db: AsyncSession) -> List[Dict[str, Any]]:
        """List all configured WhatsApp accounts merged with live bridge connection status."""
        stmt = select(WhatsAppAccount).order_by(WhatsAppAccount.is_main.desc(), WhatsAppAccount.id.asc())
        result = await db.execute(stmt)
        accounts = result.scalars().all()

        live_sessions = await WhatsAppAccountService.get_bridge_sessions()

        enriched = []
        for acc in accounts:
            live = live_sessions.get(acc.account_id, {})
            # If bridge detected a phone, optionally sync it
            live_phone = live.get("phone")
            if live_phone and live_phone != acc.phone:
                acc.phone = f"+{live_phone}" if not live_phone.startswith("+") else live_phone
                await db.commit()

            acc_dict = {
                "id": acc.id,
                "account_id": acc.account_id,
                "name": acc.name,
                "role": acc.role,
                "phone": acc.phone or (f"+{live_phone}" if live_phone else None),
                "is_active": acc.is_active,
                "is_main": acc.is_main,
                "color": acc.color,
                "created_at": acc.created_at,
                "updated_at": acc.updated_at,
                "live_status": live.get("status", "disconnected"),
                "qr_image": live.get("qr_image"),
                "has_qr": bool(live.get("qr_image")),
            }
            enriched.append(acc_dict)

        return enriched

    @staticmethod
    async def get_by_account_id(db: AsyncSession, account_id: str) -> Optional[WhatsAppAccount]:
        stmt = select(WhatsAppAccount).where(WhatsAppAccount.account_id == account_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_account(db: AsyncSession, data: WhatsAppAccountCreate) -> WhatsAppAccount:
        account_id = data.account_id or f"account_{int(time.time())}"
        
        # If this is main, unset previous main
        if data.is_main:
            await db.execute(update(WhatsAppAccount).values(is_main=False))

        new_acc = WhatsAppAccount(
            account_id=account_id,
            name=data.name,
            role=data.role,
            color=data.color or "emerald",
            is_main=data.is_main,
            is_active=data.is_active,
        )
        db.add(new_acc)
        await db.commit()
        await db.refresh(new_acc)

        # Notify bridge to start session
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{BRIDGE_URL}/api/sessions/start",
                    json={"sessionId": account_id, "name": new_acc.name, "role": new_acc.role},
                )
        except Exception as exc:
            logger.warning("Failed to start session in bridge: %s", exc)

        return new_acc

    @staticmethod
    async def update_account(
        db: AsyncSession, account_id: str, data: WhatsAppAccountUpdate
    ) -> Optional[WhatsAppAccount]:
        acc = await WhatsAppAccountService.get_by_account_id(db, account_id)
        if not acc:
            return None

        if data.is_main:
            await db.execute(update(WhatsAppAccount).values(is_main=False))

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(acc, field, value)

        await db.commit()
        await db.refresh(acc)
        return acc

    @staticmethod
    async def delete_account(db: AsyncSession, account_id: str) -> bool:
        acc = await WhatsAppAccountService.get_by_account_id(db, account_id)
        if not acc:
            return False

        await db.delete(acc)
        await db.commit()

        # Notify bridge to stop and remove session
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(f"{BRIDGE_URL}/api/sessions/{account_id}/logout")
        except Exception as exc:
            logger.warning("Failed to logout session in bridge: %s", exc)

        return True

    @staticmethod
    async def disconnect_session(account_id: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(f"{BRIDGE_URL}/api/sessions/{account_id}/logout")
                return resp.status_code == 200
        except Exception as exc:
            logger.warning("Failed to disconnect bridge session: %s", exc)
            return False

    @staticmethod
    async def restart_session(account_id: str) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(f"{BRIDGE_URL}/api/sessions/{account_id}/restart")
                return resp.status_code == 200
        except Exception as exc:
            logger.warning("Failed to restart bridge session: %s", exc)
            return False

    @staticmethod
    async def seed_default_accounts(db: AsyncSession) -> int:
        """Seed initial 3 WhatsApp accounts if table is empty."""
        stmt = select(WhatsAppAccount)
        res = await db.execute(stmt)
        if res.scalars().first():
            return 0

        defaults = [
            WhatsAppAccount(
                account_id="account_1",
                name="Главный менеджер",
                role="Руководитель",
                is_main=True,
                color="emerald",
            ),
            WhatsAppAccount(
                account_id="account_2",
                name="Менеджер 2",
                role="Консультант",
                is_main=False,
                color="blue",
            ),
            WhatsAppAccount(
                account_id="account_3",
                name="Менеджер 3",
                role="Консультант",
                is_main=False,
                color="violet",
            ),
        ]
        db.add_all(defaults)
        await db.commit()
        logger.info("Seeded 3 default WhatsApp accounts (account_1, account_2, account_3).")
        return len(defaults)
