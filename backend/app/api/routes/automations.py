import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.automation import (
    AutomationTriggerCreate,
    AutomationTriggerUpdate,
    AutomationTriggerRead,
)
from app.services.automation_service import AutomationService

logger = logging.getLogger("insta.routes.automations")

router = APIRouter(prefix="/api/automations", tags=["Automations"])


@router.get("", response_model=List[AutomationTriggerRead])
async def list_automation_triggers(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all keyword triggers and Comment-to-DM rules."""
    return await AutomationService.list_triggers(db, active_only=active_only)


@router.post("", response_model=AutomationTriggerRead, status_code=status.HTTP_201_CREATED)
async def create_automation_trigger(
    payload: AutomationTriggerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new keyword automation trigger."""
    return await AutomationService.create_trigger(db, payload)


@router.get("/{trigger_id}", response_model=AutomationTriggerRead)
async def get_automation_trigger(
    trigger_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trigger = await AutomationService.get_by_id(db, trigger_id)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return trigger


@router.patch("/{trigger_id}", response_model=AutomationTriggerRead)
async def update_automation_trigger(
    trigger_id: int,
    payload: AutomationTriggerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trigger = await AutomationService.update_trigger(db, trigger_id, payload)
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return trigger


@router.delete("/{trigger_id}")
async def delete_automation_trigger(
    trigger_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await AutomationService.delete_trigger(db, trigger_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Trigger not found")
    return {"status": "deleted", "id": trigger_id}


from fastapi import UploadFile, File
import shutil
import uuid
import os

@router.post("/upload-attachment")
async def upload_automation_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Uploads a PDF guide or attachment file to the CRM server."""
    filename = file.filename or f"guide_{uuid.uuid4().hex[:8]}.pdf"
    clean_name = "".join(c for c in filename if c.isalnum() or c in (".", "_", "-")).strip()
    unique_filename = f"{uuid.uuid4().hex[:6]}_{clean_name}"

    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "static")
    target_dir = os.path.join(static_dir, "guides")
    os.makedirs(target_dir, exist_ok=True)

    dest_path = os.path.join(target_dir, unique_filename)
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Return public URL accessible via sslip.io / IP
    public_url = f"https://2-26-50-235.sslip.io/guides/{unique_filename}"
    return {
        "status": "ok",
        "filename": filename,
        "saved_filename": unique_filename,
        "url": public_url,
    }

