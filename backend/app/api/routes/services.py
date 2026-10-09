from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceUpdate, ServiceRead
from app.services.service_catalog import ServiceCatalogService

router = APIRouter(prefix="/api/services", tags=["Services"])


@router.get("", response_model=List[ServiceRead])
async def list_services(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await ServiceCatalogService.list_services(db, active_only=True)


@router.post("", response_model=ServiceRead)
async def create_service(
    payload: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return await ServiceCatalogService.create(db, payload)


@router.patch("/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = await ServiceCatalogService.update(db, service_id, payload)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

