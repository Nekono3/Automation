import secrets
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, delete, update
from app.database import get_db
from app.api.deps import get_current_user
from app.core.permissions import (
    ROLES,
    CATALOG,
    canonical,
    require,
    has,
    team_users,
    check_conversation,
)
from app.models import User, AuditLog, EnrolledStudent, Conversation, WhatsAppAccount
from app.modules.security.models import (
    Team,
    TeamMember,
    UserPermission,
    StudentAssignment,
    ConversationAssignment,
)
from app.modules.security.service import issue_invitation, assign
from app.security.passwords import hash_password

router = APIRouter(prefix="/api/security", tags=["Security and assignments"])
RoleCode = Literal[
    "director",
    "head_of_sales",
    "manager",
    "mentor",
    "operations_director",
    "finance_manager",
]


class Invite(BaseModel):
    email: str = Field(
        min_length=3, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    full_name: str = Field(min_length=1, max_length=255)
    role: RoleCode


class RoleChange(BaseModel):
    role: RoleCode


class Grants(BaseModel):
    permissions: list[str]


class TeamInput(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    user_ids: list[int] = Field(max_length=100)


class Assignment(BaseModel):
    object_id: int
    user_id: int
    reason: str = Field(default="", max_length=1000)


class AccountOwnership(BaseModel):
    # Internal numeric WhatsAppAccount.id, not a guessed employee/session mapping.
    account_id: int | None = Field(default=None, gt=0)


@router.get("/catalog")
async def catalog(user=Depends(get_current_user)):
    return {"roles": ROLES, "permissions": sorted(CATALOG)}


@router.post("/invitations", status_code=201)
async def invite(data: Invite, db=Depends(get_db), actor=Depends(get_current_user)):
    require(actor, "employees.manage")
    if await db.scalar(select(User.id).where(User.email == data.email.lower().strip())):
        raise HTTPException(409, "Сотрудник уже существует")
    user = User(
        email=data.email.lower().strip(),
        full_name=data.full_name,
        role=data.role,
        is_active=False,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
    )
    db.add(user)
    await db.flush()
    token = await issue_invitation(db, user, actor.id)
    return {"user_id": user.id, "invitation_token": token, "expires_in_hours": 24}


@router.post("/users/{user_id}/password-reset")
async def reset_password(
    user_id: int, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "employees.manage")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Сотрудник не найден")
    token = await issue_invitation(db, user, actor.id)
    return {"invitation_token": token, "expires_in_hours": 24}


@router.put("/users/{user_id}/role")
async def change_role(
    user_id: int, data: RoleChange, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "roles.manage")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Сотрудник не найден")
    if user.id == actor.id and canonical(data.role) != "director":
        raise HTTPException(409, "Нельзя снять собственную роль директора")
    old = user.role
    user.role = data.role
    user.token_version += 1
    db.add(
        AuditLog(
            user_id=actor.id,
            action="role_changed",
            entity="user",
            entity_id=user.id,
            extra_data={"before": old, "after": data.role},
        )
    )
    await db.commit()
    return {"user_id": user.id, "role": user.role}


@router.put("/users/{user_id}/permissions")
async def change_grants(
    user_id: int, data: Grants, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "roles.manage")
    if not await db.get(User, user_id):
        raise HTTPException(404, "Сотрудник не найден")
    if not set(data.permissions) <= CATALOG:
        raise HTTPException(422, "Неизвестное разрешение")
    await db.execute(delete(UserPermission).where(UserPermission.user_id == user_id))
    db.add_all(
        [
            UserPermission(user_id=user_id, permission_code=p)
            for p in set(data.permissions)
        ]
    )
    db.add(
        AuditLog(
            user_id=actor.id,
            action="permissions_changed",
            entity="user",
            entity_id=user_id,
            extra_data={"grants": sorted(set(data.permissions))},
        )
    )
    await db.commit()
    return {"user_id": user_id, "permissions": sorted(set(data.permissions))}


@router.post("/teams", status_code=201)
async def create_team(
    data: TeamInput, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "employees.manage")
    ids = set(data.user_ids)
    found = (await db.scalars(select(User.id).where(User.id.in_(ids)))).all()
    if set(found) != ids:
        raise HTTPException(422, "Указан неизвестный сотрудник")
    team = Team(name=data.name)
    db.add(team)
    await db.flush()
    db.add_all([TeamMember(team_id=team.id, user_id=uid) for uid in ids])
    db.add(
        AuditLog(
            user_id=actor.id,
            action="team_created",
            entity="team",
            entity_id=team.id,
            extra_data={"members": sorted(ids)},
        )
    )
    await db.commit()
    return {"id": team.id}


@router.put("/teams/{team_id}")
async def update_team(team_id: int, data: TeamInput, db=Depends(get_db), actor=Depends(get_current_user)):
    require(actor, "employees.manage")
    team = await db.scalar(select(Team).where(Team.id == team_id).with_for_update())
    if not team:
        raise HTTPException(404, "Команда не найдена")
    ids = set(data.user_ids)
    if set((await db.scalars(select(User.id).where(User.id.in_(ids)))).all()) != ids:
        raise HTTPException(422, "Указан неизвестный сотрудник")
    before = list((await db.scalars(select(TeamMember.user_id).where(TeamMember.team_id == team_id))).all())
    team.name = data.name
    await db.execute(delete(TeamMember).where(TeamMember.team_id == team_id))
    db.add_all([TeamMember(team_id=team_id, user_id=uid) for uid in ids])
    db.add(AuditLog(user_id=actor.id, action="team_updated", entity="team", entity_id=team_id,
                    extra_data={"before": sorted(before), "after": sorted(ids)}))
    from sqlalchemy.exc import IntegrityError
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Команда с таким именем уже существует") from None
    return {"id": team_id, "user_ids": sorted(ids)}


@router.put("/users/{user_id}/whatsapp-account")
async def set_account_owner(user_id: int, data: AccountOwnership, db=Depends(get_db), actor=Depends(get_current_user)):
    require(actor, "communication.manage_accounts")
    # Lock account first so concurrent assignments cannot create two owners.
    if data.account_id is not None:
        account = await db.scalar(select(WhatsAppAccount).where(WhatsAppAccount.id == data.account_id).with_for_update())
        if not account:
            raise HTTPException(404, "Аккаунт не найден")
        if await db.scalar(select(User.id).where(User.whatsapp_account_id == account.id, User.id != user_id)):
            raise HTTPException(409, "Сначала снимите назначение текущего владельца")
    target = await db.scalar(select(User).where(User.id == user_id).with_for_update())
    if not target:
        raise HTTPException(404, "Сотрудник не найден")
    if data.account_id is not None and (not target.is_active or canonical(target.role) not in ('director', 'head_of_sales', 'manager')):
        raise HTTPException(422, "Нужен активный сотрудник отдела продаж")
    before = target.whatsapp_account_id
    if before != data.account_id:
        from datetime import datetime, timezone
        # Backfilled explicit assignments must not retain access after ownership is revoked.
        conversations = select(Conversation.id).where(Conversation.whatsapp_account_id == before)
        if before is not None:
            await db.execute(update(ConversationAssignment).where(
                ConversationAssignment.user_id == user_id,
                ConversationAssignment.conversation_id.in_(conversations),
                ConversationAssignment.released_at.is_(None)
            ).values(released_at=datetime.now(timezone.utc)))
        target.whatsapp_account_id = data.account_id
        db.add(AuditLog(user_id=actor.id, action="whatsapp_owner_changed", entity="user", entity_id=user_id,
                        extra_data={"before": before, "after": data.account_id}))
        await db.commit()
    return {"user_id": user_id, "whatsapp_account_id": target.whatsapp_account_id}


@router.post("/student-assignments")
async def assign_student(
    data: Assignment, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "students.assign_mentor")
    if not await db.get(EnrolledStudent, data.object_id):
        raise HTTPException(404, "Ученик не найден")
    target = await db.get(User, data.user_id)
    if not target or not target.is_active or canonical(target.role) != "mentor":
        raise HTTPException(422, "Нужен активный ментор")
    # Serialize reassignments for this student; history remains in released rows.
    await db.scalar(
        select(EnrolledStudent.id)
        .where(EnrolledStudent.id == data.object_id)
        .with_for_update()
    )
    await assign(
        db,
        StudentAssignment,
        "student_id",
        data.object_id,
        data.user_id,
        actor.id,
        data.reason,
    )
    return {"status": "assigned"}


@router.post("/conversation-assignments")
async def assign_conversation(
    data: Assignment, db=Depends(get_db), actor=Depends(get_current_user)
):
    require(actor, "communication.assign")
    await check_conversation(db, actor, data.object_id)
    if not has(
        actor, "communication.read_all"
    ) and data.user_id not in await team_users(db, actor):
        raise HTTPException(403, "Сотрудник вне команды")
    target = await db.get(User, data.user_id)
    if not target or not target.is_active:
        raise HTTPException(422, "Нужен активный сотрудник")
    await db.scalar(
        select(Conversation.id)
        .where(Conversation.id == data.object_id)
        .with_for_update()
    )
    await assign(
        db,
        ConversationAssignment,
        "conversation_id",
        data.object_id,
        data.user_id,
        actor.id,
        data.reason,
    )
    return {"status": "assigned"}
