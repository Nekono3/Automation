import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.student_profile import StudentProfileRead, StudentProfileUpdate
from app.services.student_service import StudentService

logger = logging.getLogger("insta.routes.students")

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("/{customer_id}/profile", response_model=Optional[StudentProfileRead])
async def get_student_profile(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve applicant profile (GPA, test scores, target countries, budget)."""
    return await StudentService.get_by_customer_id(db, customer_id)


@router.patch("/{customer_id}/profile", response_model=StudentProfileRead)
async def update_student_profile(
    customer_id: int,
    payload: StudentProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upsert applicant profile fields."""
    return await StudentService.upsert_profile(db, customer_id, payload)
