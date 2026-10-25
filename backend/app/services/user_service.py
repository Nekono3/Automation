from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User
from app.schemas.user import UserCreate
from app.security.passwords import hash_password, verify_password


class UserService:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email.lower().strip()))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_user(db: AsyncSession, data: UserCreate) -> User:
        user = User(
            email=data.email.lower().strip(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=data.role,
            is_active=data.is_active,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate(db: AsyncSession, email: str, password: str) -> Optional[User]:
        user = await UserService.get_by_email(db, email)
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    async def seed_initial_admin(db: AsyncSession) -> Optional[User]:
        """Seeds the initial administrator account if no users exist."""
        existing = await db.execute(select(User))
        if existing.scalars().first():
            return None

        admin = User(
            email=settings.FIRST_ADMIN_EMAIL.lower().strip(),
            hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
            full_name="Default Administrator",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        return admin

    @staticmethod
    async def seed_default_staff_users(db: AsyncSession) -> int:
        """Seeds or updates the 5 default staff accounts with roles and whatsapp bindings."""
        from app.models.whatsapp_account import WhatsAppAccount

        # Fetch whatsapp accounts map (account_id -> id)
        wa_result = await db.execute(select(WhatsAppAccount))
        wa_accounts = wa_result.scalars().all()
        wa_map = {acc.account_id: acc.id for acc in wa_accounts}

        default_staff = [
            {
                "email": "admin@consulteam.kg",
                "full_name": "Администратор Consulteam",
                "password": "AdminConsul2026!",
                "role": "admin",
                "whatsapp_account_id": None,
            },
            {
                "email": "rop@consulteam.kg",
                "full_name": "РОП (Главный менеджер)",
                "password": "RopConsul2026!",
                "role": "lead_manager",
                "whatsapp_account_id": wa_map.get("account_1"),
            },
            {
                "email": "nursuluu@consulteam.kg",
                "full_name": "Nursuluu (Менеджер)",
                "password": "Nursuluu2026!",
                "role": "manager",
                "whatsapp_account_id": wa_map.get("account_2"),
            },
            {
                "email": "manager3@consulteam.kg",
                "full_name": "Менеджер 3",
                "password": "Manager3Consul!",
                "role": "manager",
                "whatsapp_account_id": wa_map.get("account_3"),
            },
            {
                "email": "mentor@consulteam.kg",
                "full_name": "Ментор Consulteam",
                "password": "MentorConsul2026!",
                "role": "mentor",
                "whatsapp_account_id": None,
            },
        ]

        count = 0
        for staff in default_staff:
            user = await UserService.get_by_email(db, staff["email"])
            if not user:
                user = User(
                    email=staff["email"],
                    hashed_password=hash_password(staff["password"]),
                    full_name=staff["full_name"],
                    role=staff["role"],
                    whatsapp_account_id=staff["whatsapp_account_id"],
                    is_active=True,
                )
                db.add(user)
                count += 1
            else:
                user.role = staff["role"]
                user.full_name = staff["full_name"]
                if staff["whatsapp_account_id"] is not None:
                    user.whatsapp_account_id = staff["whatsapp_account_id"]
                user.hashed_password = hash_password(staff["password"])
                user.is_active = True

        await db.commit()
        return count
