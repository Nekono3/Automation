from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.university_program import (
    UniversityProgramCreate,
    UniversityProgramUpdate,
    UniversityProgramResponse,
    UniversityRenameRequest,
    UniversitySummary,
    ProgramsStatsResponse,
)
from app.services.university_program_service import UniversityProgramService

router = APIRouter(prefix="/api/programs", tags=["University Programs"])


@router.get("", response_model=List[UniversityProgramResponse])
async def list_programs(
    search: str = Query("", description="Search by program, faculty, university, city"),
    university: Optional[str] = Query(None, description="Filter by university name"),
    faculty: Optional[str] = Query(None, description="Filter by faculty name"),
    degree_level: Optional[str] = Query(None, description="Filter by degree level"),
    language: Optional[str] = Query(None, description="Filter by language"),
    sort_by: str = Query("name", description="Sorting: 'name', 'university', 'fee_asc', 'fee_desc'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve catalog of university programs with filtering and search."""
    return await UniversityProgramService.list_programs(
        session=db,
        search=search,
        university=university,
        faculty=faculty,
        degree_level=degree_level,
        language=language,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
    )


@router.get("/stats", response_model=ProgramsStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated statistics across universities and programs."""
    return await UniversityProgramService.get_stats(session=db)


@router.get("/universities", response_model=List[UniversitySummary])
async def list_universities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of all active universities with their program counts."""
    return await UniversityProgramService.list_universities(session=db)


@router.get("/{program_id}", response_model=UniversityProgramResponse)
async def get_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single program by ID."""
    program = await UniversityProgramService.get_by_id(session=db, program_id=program_id)
    if not program:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return program


@router.post("", response_model=UniversityProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_program(
    data: UniversityProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new educational program or university."""
    return await UniversityProgramService.create_program(session=db, data=data)


@router.patch("/{program_id}", response_model=UniversityProgramResponse)
async def update_program(
    program_id: int,
    data: UniversityProgramUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update program details (rename, tuition contract, degree, language, notes)."""
    updated = await UniversityProgramService.update_program(session=db, program_id=program_id, data=data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return updated


@router.delete("/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a program from catalog."""
    deleted = await UniversityProgramService.delete_program(session=db, program_id=program_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return None


@router.post("/rename-university")
async def rename_university(
    data: UniversityRenameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a university across all programs in the database."""
    affected = await UniversityProgramService.rename_university(
        session=db, old_name=data.old_name, new_name=data.new_name
    )
    return {"status": "success", "affected_programs": affected, "new_name": data.new_name}


@router.post("/sync")
async def sync_from_spreadsheet(
    force: bool = Query(True, description="Force re-seed all records from spreadsheet"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-sync programs from official Google Sheet export."""
    seeded = await UniversityProgramService.seed_default_programs(session=db, force_reload=force)
    return {"status": "success", "seeded_programs": seeded}
