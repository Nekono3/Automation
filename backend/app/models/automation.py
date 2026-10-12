from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin


class AutomationTrigger(Base, TimestampMixin):
    """
    Keyword triggers for Comment-to-DM and Direct message auto-flows.
    Examples:
    - Keyword: 'ГРАНТ' / 'GRANT'
    - Action: Auto-reply to Instagram comment + send PDF Guide to Direct + followup
    """
    __tablename__ = "automation_triggers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Trigger keyword: 'ГРАНТ', 'ИТАЛИЯ', 'ГАЙД', 'США'
    keyword: Mapped[str] = mapped_column(String(128), index=True, nullable=False)

    # EXACT or CONTAINS
    match_type: Mapped[str] = mapped_column(String(32), default="CONTAINS", nullable=False)

    # ALL, INSTAGRAM, WHATSAPP
    channel: Mapped[str] = mapped_column(String(32), default="ALL", nullable=False)

    # Public reply text for Instagram Comments
    # E.g.: "Отправили вам детали в Direct! Проверьте сообщения ✈️"
    comment_reply_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Private DM / WhatsApp response text
    # E.g.: "Привет! Лови обещанный гайд по университетам Италии и грантам..."
    dm_reply_text: Mapped[str] = mapped_column(Text, nullable=False)

    # Optional file attachment URL (e.g. PDF link, Google Drive, image)
    attachment_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    # Optional display name of attachment, e.g. "Consulteam_Italy_Guide_2026.pdf"
    attachment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Optional follow-up question sent by AI after 1 minute
    # E.g.: "Удалось открыть файл? Подскажите, вы для себя планируете бакалавриат или магистратуру?"
    followup_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Pipeline stage to place/move the lead into
    target_pipeline_stage: Mapped[str] = mapped_column(String(64), default="NEW_LEAD", nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)
    trigger_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
