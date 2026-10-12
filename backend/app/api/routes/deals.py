import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.deal import (
    DealCreate,
    DealUpdate,
    DealStageUpdate,
    DealRead,
    DocumentChecklistRead,
)
from app.services.deal_service import DealService

logger = logging.getLogger("insta.routes.deals")

router = APIRouter(prefix="/api/deals", tags=["Deals"])


class ChecklistStatusPayload(BaseModel):
    status: str
    file_url: Optional[str] = None


@router.get("", response_model=List[DealRead])
async def list_deals(
    pipeline_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List deals filtered by pipeline type (SALES, ADMISSION) or customer."""
    return await DealService.list_deals(db, pipeline_type=pipeline_type, customer_id=customer_id)


@router.post("", response_model=DealRead, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: DealCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new deal."""
    return await DealService.create_deal(db, payload)


@router.get("/{deal_id}", response_model=DealRead)
async def get_deal(
    deal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deal = await DealService.get_by_id(db, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/{deal_id}/stage", response_model=DealRead)
async def update_deal_stage(
    deal_id: int,
    payload: DealStageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update deal stage on the Kanban board."""
    deal = await DealService.update_stage(db, deal_id, payload)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.patch("/checklists/{checklist_id}", response_model=DocumentChecklistRead)
async def update_checklist_status(
    checklist_id: int,
    payload: ChecklistStatusPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update document status in applicant checklist."""
    chk = await DealService.update_checklist_status(
        db, checklist_id=checklist_id, status=payload.status, file_url=payload.file_url
    )
    if not chk:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return chk
