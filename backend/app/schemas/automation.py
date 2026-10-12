from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AutomationTriggerBase(BaseModel):
    name: str
    keyword: str
    match_type: str = "CONTAINS"  # EXACT, CONTAINS
    channel: str = "ALL"  # ALL, INSTAGRAM, WHATSAPP
    comment_reply_text: Optional[str] = None
    dm_reply_text: str
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    followup_text: Optional[str] = None
    target_pipeline_stage: str = "NEW_LEAD"
    is_active: bool = True


class AutomationTriggerCreate(AutomationTriggerBase):
    pass


class AutomationTriggerUpdate(BaseModel):
    name: Optional[str] = None
    keyword: Optional[str] = None
    match_type: Optional[str] = None
    channel: Optional[str] = None
    comment_reply_text: Optional[str] = None
    dm_reply_text: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    followup_text: Optional[str] = None
    target_pipeline_stage: Optional[str] = None
    is_active: Optional[bool] = None


class AutomationTriggerRead(AutomationTriggerBase):
    id: int
    trigger_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
