import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.whatsapp_account import (
    WhatsAppAccountCreate,
    WhatsAppAccountUpdate,
    WhatsAppAccountRead,
)
from app.services.whatsapp_service import WhatsAppAccountService

logger = logging.getLogger("insta.whatsapp.routes")

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Accounts"])


@router.get("/accounts", response_model=List[WhatsAppAccountRead])
async def list_whatsapp_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all configured WhatsApp accounts with live bridge connection status & QR codes."""
    return await WhatsAppAccountService.list_accounts(db)


@router.post("/accounts", response_model=WhatsAppAccountRead, status_code=status.HTTP_201_CREATED)
async def create_whatsapp_account(
    data: WhatsAppAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new WhatsApp account / session."""
    acc = await WhatsAppAccountService.create_account(db, data)
    accounts = await WhatsAppAccountService.list_accounts(db)
    match = next((a for a in accounts if a["account_id"] == acc.account_id), None)
    if not match:
        raise HTTPException(status_code=500, detail="Account created but failed to retrieve status")
    return match


@router.patch("/accounts/{account_id}", response_model=WhatsAppAccountRead)
async def update_whatsapp_account(
    account_id: str,
    data: WhatsAppAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update name, role, or main status of a WhatsApp account."""
    acc = await WhatsAppAccountService.update_account(db, account_id, data)
    if not acc:
        raise HTTPException(status_code=404, detail="WhatsApp account not found")
    accounts = await WhatsAppAccountService.list_accounts(db)
    match = next((a for a in accounts if a["account_id"] == acc.account_id), None)
    return match


@router.delete("/accounts/{account_id}")
async def delete_whatsapp_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a WhatsApp account and stop its session."""
    success = await WhatsAppAccountService.delete_account(db, account_id)
    if not success:
        raise HTTPException(status_code=404, detail="WhatsApp account not found")
    return {"status": "ok", "deleted": account_id}


@router.post("/accounts/{account_id}/disconnect")
async def disconnect_whatsapp_session(
    account_id: str,
    current_user: User = Depends(get_current_user),
):
    """Disconnect / logout WhatsApp session so user can rescan."""
    success = await WhatsAppAccountService.disconnect_session(account_id)
    return {"status": "ok", "disconnected": success}


@router.post("/accounts/{account_id}/restart")
async def restart_whatsapp_session(
    account_id: str,
    current_user: User = Depends(get_current_user),
):
    """Restart pairing / QR code generation for a session."""
    success = await WhatsAppAccountService.restart_session(account_id)
    return {"status": "ok", "restarted": success}
