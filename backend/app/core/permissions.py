"""Catalog seeds database grants; request authorization reads persisted grants only."""

from sqlalchemy import select, or_, false
from sqlalchemy.dialects.postgresql import insert
from fastapi import HTTPException
from app.modules.security.models import (
    Role,
    Permission,
    RolePermission,
    UserRole,
    UserPermission,
    TeamMember,
    StudentAssignment,
    ConversationAssignment,
)

ALIASES = {"admin": "director", "lead_manager": "head_of_sales"}
ROLES = (
    "director",
    "head_of_sales",
    "manager",
    "mentor",
    "operations_director",
    "finance_manager",
)
OWN_LEADS = {
    "leads.read_own",
    "leads.update_own",
    "leads.create",
    "bookings.manage",
    "communication.read_assigned",
    "communication.send",
    "communication.mode",
    "universities.read",
    "services.read",
    "kpi.read_own",
    "directory.read",
}
MENTOR = {
    "students.read_assigned",
    "students.update_assigned",
    "student_documents.read_assigned",
    "student_documents.upload",
    "student_documents.review",
    "communication.read_assigned",
    "communication.send",
    "communication.mode",
    "universities.read",
    "services.read",
    "kpi.read_own",
    "directory.read",
}
ROLE_GRANTS = {
    "manager": OWN_LEADS,
    "mentor": MENTOR,
    "head_of_sales": OWN_LEADS
    | {
        "leads.read_team",
        "leads.update_team",
        "leads.assign",
        "communication.read_team",
        "communication.assign",
        "employees.read_team",
        "kpi.read_team",
        "kpi.evaluate_sales",
    },
    "operations_director": {
        "students.read_all",
        "students.update_all",
        "students.assign_mentor",
        "universities.read",
        "universities.create",
        "universities.update",
        "universities.archive",
        "knowledge.manage",
        "kpi.read_all",
        "kpi.evaluate",
        "employees.read",
        "directory.read",
        "services.read",
    },
    "finance_manager": {
        "finance.read",
        "finance.manage",
        "salaries.read",
        "salaries.manage",
        "students.read_financial",
        "directory.read",
    },
}
CATALOG = set().union(*ROLE_GRANTS.values()) | {
    "leads.read_all",
    "leads.update_all",
    "students.create",
    "students.archive",
    "student_documents.read_all",
    "student_documents.manage",
    "communication.read_all",
    "communication.manage_accounts",
    "ai.settings.manage",
    "automations.manage",
    "settings.manage",
    "roles.manage",
    "employees.manage",
    "audit.read",
    "imports.manage",
    "dashboard.read_all",
    "kpi.legacy_manage",
}
ROLE_GRANTS["director"] = CATALOG.copy()


def canonical(role):
    return ALIASES.get(role, role)


async def seed_permissions(db):
    for model, rows, keys in (
        (Role, [{"code": r} for r in ROLES], ["code"]),
        (Permission, [{"code": p} for p in sorted(CATALOG)], ["code"]),
        (
            RolePermission,
            [
                {"role_code": r, "permission_code": p}
                for r, grants in ROLE_GRANTS.items()
                for p in sorted(grants)
            ],
            ["role_code", "permission_code"],
        ),
    ):
        if rows:
            await db.execute(
                insert(model).values(rows).on_conflict_do_nothing(index_elements=keys)
            )
    await db.commit()


async def load_permissions(db, user):
    role_codes = select(UserRole.role_code).where(UserRole.user_id == user.id)
    grants = await db.scalars(
        select(RolePermission.permission_code).where(
            or_(
                RolePermission.role_code == canonical(user.role),
                RolePermission.role_code.in_(role_codes),
            )
        )
    )
    direct = await db.scalars(
        select(UserPermission.permission_code).where(UserPermission.user_id == user.id)
    )
    user.permissions = frozenset(grants.all()) | frozenset(direct.all())
    return user


def has(user, *permissions):
    return bool(set(permissions) & getattr(user, "permissions", frozenset()))


def require(user, *permissions):
    if not has(user, *permissions):
        raise HTTPException(403, "Недостаточно прав доступа")


async def team_users(db, user):
    own_teams = select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    return list(
        (
            await db.scalars(
                select(TeamMember.user_id).where(TeamMember.team_id.in_(own_teams))
            )
        ).all()
    )


async def customer_clause(db, user, write=False):
    from app.models.company import LeadRecord
    from app.models.deal import Deal
    from app.models.conversation import Conversation
    from app.models.customer import Customer

    suffix = "update" if write else "read"
    if has(user, f"leads.{suffix}_all"):
        return True
    ids = [user.id]
    if has(user, f"leads.{suffix}_team"):
        ids += await team_users(db, user)
    if not has(user, f"leads.{suffix}_own", f"leads.{suffix}_team"):
        return false()
    leads = select(LeadRecord.customer_id).where(LeadRecord.assigned_user_id.in_(ids))
    deals = select(Deal.customer_id).where(Deal.assigned_user_id.in_(ids))
    return or_(Customer.id.in_(leads), Customer.id.in_(deals))


async def student_clause(db, user, write=False):
    from app.models.enrolled_student import EnrolledStudent

    if has(user, "students.update_all" if write else "students.read_all"):
        return True
    permission = "students.update_assigned" if write else "students.read_assigned"
    if not has(user, permission):
        return false()
    assigned = select(StudentAssignment.student_id).where(
        StudentAssignment.user_id == user.id, StudentAssignment.released_at.is_(None)
    )
    return EnrolledStudent.id.in_(assigned)


async def conversation_clause(db, user):
    from app.models.conversation import Conversation

    if has(user, "communication.read_all"):
        return True
    ids = [user.id]
    if has(user, "communication.read_team"):
        ids += await team_users(db, user)
    if not has(user, "communication.read_assigned", "communication.read_team"):
        return false()
    assigned = select(ConversationAssignment.conversation_id).where(
        ConversationAssignment.user_id.in_(ids),
        ConversationAssignment.released_at.is_(None),
    )
    # Explicit account ownership is authoritative; an unbound employee gets no implicit chats.
    from app.models.user import User

    accounts = select(User.whatsapp_account_id).where(
        User.id.in_(ids), User.whatsapp_account_id.is_not(None)
    )
    return or_(
        Conversation.id.in_(assigned), Conversation.whatsapp_account_id.in_(accounts)
    )


async def check_customer(db, user, customer_id, write=False):
    from app.models.customer import Customer

    if not await db.scalar(
        select(Customer.id).where(
            Customer.id == customer_id, await customer_clause(db, user, write)
        )
    ):
        raise HTTPException(404, "Контакт не найден")


async def check_student(db, user, student_id, write=False, documents=False):
    from app.models.enrolled_student import EnrolledStudent

    if documents and has(user, "student_documents.read_all"):
        clause = True
    else:
        clause = await student_clause(db, user, write)
    if not await db.scalar(
        select(EnrolledStudent.id).where(EnrolledStudent.id == student_id, clause)
    ):
        raise HTTPException(404, "Ученик не найден")
    if documents:
        require(user, "student_documents.read_all", "student_documents.read_assigned")


async def check_conversation(db, user, conversation_id):
    from app.models.conversation import Conversation

    if not await db.scalar(
        select(Conversation.id).where(
            Conversation.id == conversation_id, await conversation_clause(db, user)
        )
    ):
        raise HTTPException(404, "Переписка не найдена")
