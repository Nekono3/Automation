from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.enrolled_student import (
    EnrolledStudentCreate,
    EnrolledStudentUpdate,
    EnrolledStudentRead,
    EnrolledStudentsStats,
)
from app.services.enrolled_student_service import EnrolledStudentService

router = APIRouter(prefix="/api/enrolled-students", tags=["Enrolled Students Tracker"])


@router.get("", response_model=List[EnrolledStudentRead])
async def list_enrolled_students(
    search: str = Query("", description="Search by FIO, country, manager, comment"),
    country: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    risk: Optional[str] = Query(None),
    is_completed: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all tracked enrolled students with filter and search."""
    return await EnrolledStudentService.list_students(
        session=db,
        search=search,
        country=country,
        manager=manager,
        stage=stage,
        risk=risk,
        is_completed=is_completed,
        skip=skip,
        limit=limit,
    )


@router.get("/stats", response_model=EnrolledStudentsStats)
async def get_enrolled_students_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summary statistics for students admission processes and finance."""
    return await EnrolledStudentService.get_stats(session=db)


@router.get("/{student_id}", response_model=EnrolledStudentRead)
async def get_enrolled_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = await EnrolledStudentService.get_by_id(session=db, student_id=student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.post("", response_model=EnrolledStudentRead, status_code=status.HTTP_201_CREATED)
async def create_enrolled_student(
    data: EnrolledStudentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new enrolled student."""
    return await EnrolledStudentService.create_student(session=db, data=data)


@router.patch("/{student_id}", response_model=EnrolledStudentRead)
async def update_enrolled_student(
    student_id: int,
    data: EnrolledStudentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update process stage, next action, risk, or financial details of a student."""
    updated = await EnrolledStudentService.update_student(session=db, student_id=student_id, data=data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return updated


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enrolled_student(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a student from tracker."""
    deleted = await EnrolledStudentService.delete_student(session=db, student_id=student_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return None


@router.post("/sync")
async def sync_students_spreadsheet(
    force: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-sync enrolled students from Google Sheets process and finance sheets."""
    seeded = await EnrolledStudentService.seed_default_students(session=db, force_reload=force)
    return {"status": "success", "seeded_students": seeded}
