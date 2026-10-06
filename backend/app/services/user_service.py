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
