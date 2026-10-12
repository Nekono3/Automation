import logging
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student_profile import StudentProfile
from app.models.customer import Customer
from app.schemas.student_profile import StudentProfileUpdate, StudentProfileCreate

logger = logging.getLogger("insta.students")


class StudentService:
    @staticmethod
    async def get_by_customer_id(db: AsyncSession, customer_id: int) -> Optional[StudentProfile]:
        stmt = select(StudentProfile).where(StudentProfile.customer_id == customer_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def upsert_profile(
        db: AsyncSession,
        customer_id: int,
        data: StudentProfileUpdate,
    ) -> StudentProfile:
        profile = await StudentService.get_by_customer_id(db, customer_id)
        if not profile:
            profile = StudentProfile(customer_id=customer_id)
            db.add(profile)

        for field, val in data.model_dump(exclude_unset=True).items():
            if val is not None:
                setattr(profile, field, val)

        await db.commit()
        await db.refresh(profile)
        return profile
