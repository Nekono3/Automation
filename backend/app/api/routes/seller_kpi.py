from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.seller_kpi import (
    SellerCreate,
    SellerRead,
    KPIScoreAdd,
    SellerKPIRecordRead,
)
from app.services.seller_kpi_service import SellerKPIService

router = APIRouter(prefix="/api/kpi", tags=["Seller KPI"])


@router.get("/sellers", response_model=List[SellerRead])
async def list_sellers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all sellers with their weekly KPI records and totals."""
    return await SellerKPIService.list_sellers(session=db)


@router.post("/sellers", response_model=SellerRead, status_code=status.HTTP_201_CREATED)
async def create_seller(
    data: SellerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new sales representative."""
    seller = await SellerKPIService.create_seller(session=db, data=data)
    return SellerRead.model_validate(seller)


@router.delete("/sellers/{seller_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_seller(
    seller_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a seller and all associated KPI records."""
    deleted = await SellerKPIService.delete_seller(session=db, seller_id=seller_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found")
    return None


@router.post("/scores", response_model=SellerKPIRecordRead)
async def add_or_update_kpi_score(
    payload: KPIScoreAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add or update a score for a specific category within a period for a seller.
    Automatically recalculates total score.
    """
    return await SellerKPIService.add_or_update_score(session=db, payload=payload)


@router.delete("/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kpi_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a specific period KPI record."""
    deleted = await SellerKPIService.delete_record(session=db, record_id=record_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return None


@router.post("/sync")
async def sync_kpi_spreadsheet(
    force: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-sync sellers and KPI records from official Google Sheets."""
    seeded = await SellerKPIService.seed_default_kpi(session=db, force_reload=force)
    return {"status": "success", "seeded_records": seeded}
