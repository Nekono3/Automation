import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import select, update
from app.models import User, AuditLog
from app.modules.security.models import (
    EmployeeInvitation,
    StudentAssignment,
    ConversationAssignment,
)
from app.security.passwords import hash_password


async def issue_invitation(db, user, actor_id=None):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(EmployeeInvitation)
        .where(
            EmployeeInvitation.user_id == user.id, EmployeeInvitation.used_at.is_(None)
        )
        .values(used_at=now)
    )
    token = secrets.token_urlsafe(48)
    db.add(
        EmployeeInvitation(
            user_id=user.id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            expires_at=now + timedelta(hours=24),
            created_by=actor_id,
        )
    )
    db.add(
        AuditLog(
            user_id=actor_id,
            action="invitation_created",
            entity="user",
            entity_id=user.id,
            extra_data={},
        )
    )
    await db.commit()
    return token


async def accept_invitation(db, token, password):
    invitation = await db.scalar(
        select(EmployeeInvitation)
        .where(
            EmployeeInvitation.token_hash == hashlib.sha256(token.encode()).hexdigest()
        )
        .with_for_update()
    )
    now = datetime.now(timezone.utc)
    if not invitation or invitation.used_at or invitation.expires_at <= now:
        raise HTTPException(400, "Приглашение недействительно или истекло")
    user = await db.scalar(
        select(User).where(User.id == invitation.user_id).with_for_update()
    )
    user.hashed_password = hash_password(password)
    user.token_version += 1
    user.is_active = True
    invitation.used_at = now
    db.add(
        AuditLog(
            user_id=user.id,
            action="password_set",
            entity="user",
            entity_id=user.id,
            extra_data={},
        )
    )
    await db.commit()


async def assign(db, model, object_key, object_id, target_id, actor_id, reason=""):
    now = datetime.now(timezone.utc)
    await db.execute(
        update(model)
        .where(getattr(model, object_key) == object_id, model.released_at.is_(None))
        .values(released_at=now)
    )
    db.add(
        model(
            **{
                object_key: object_id,
                "user_id": target_id,
                "assigned_by": actor_id,
                "reason": reason,
            }
        )
    )
    db.add(
        AuditLog(
            user_id=actor_id,
            action="assignment_changed",
            entity=object_key,
            entity_id=object_id,
            extra_data={"assigned_user_id": target_id},
        )
    )
    await db.commit()
