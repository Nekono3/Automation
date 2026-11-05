"""Deny by default API policy and object access boundary for legacy routers."""

from fastapi import Request, Depends, HTTPException
from app.database import get_db
from app.api.deps import get_current_user, security_scheme
from app.core.permissions import (
    require,
    check_customer,
    check_student,
    check_conversation,
)


# Lists return only scoped rows; global-only aggregate endpoints are explicitly gated.
def policy(path, method):
    write = method not in ("GET", "HEAD")
    if path == "/api/auth/me":
        return None
    if path.endswith("/student-assignments"):
        return "students.assign_mentor"
    if path.endswith("/conversation-assignments"):
        return "communication.assign"
    if path.startswith("/api/security/"):
        return "roles.manage"
    if path.startswith("/api/whatsapp/"):
        return "communication.manage_accounts"
    if path.startswith("/api/automations"):
        return "automations.manage"
    if path.startswith("/api/services"):
        return "settings.manage" if write else "services.read"
    if path.startswith("/api/dashboard"):
        return "dashboard.read_all"
    if path.startswith("/api/conversations/global-ai"):
        return "ai.settings.manage"
    if path.startswith("/api/conversations"):
        if path.endswith("/messages") and write:
            return "communication.send"
        if write:
            return "communication.mode"
        return (
            "communication.read_all",
            "communication.read_team",
            "communication.read_assigned",
        )
    if path.startswith("/api/programs"):
        if path.endswith("/sync"):
            return "imports.manage"
        if method == "DELETE":
            return "universities.archive"
        return (
            ("universities.create" if method == "POST" else "universities.update")
            if write
            else "universities.read"
        )
    if path.startswith("/api/kpi"):
        return "kpi.legacy_manage"
    if path.startswith("/api/company/finance"):
        return "finance.manage" if write else "finance.read"
    if path.startswith("/api/company/documents"):
        return (
            "student_documents.review"
            if write
            else ("student_documents.read_all", "student_documents.read_assigned")
        )
    if path.startswith("/api/company/students"):
        if path.endswith("/documents"):
            return "student_documents.upload"
        if path.endswith("/links"):
            return "students.update_all"
        return ("students.read_all", "students.read_assigned")
    if path.startswith("/api/enrolled-students"):
        if path.endswith("/sync"):
            return "imports.manage"
        if path.endswith("/stats"):
            return "students.read_all"
        if method == "DELETE":
            return "students.archive"
        if method == "POST":
            return "students.create"
        return (
            ("students.update_all", "students.update_assigned")
            if write
            else ("students.read_all", "students.read_assigned")
        )
    if path == "/api/company/directory":
        return "directory.read"
    if path == "/api/company/managers":
        return ("leads.read_all", "leads.read_team")
    if path.startswith("/api/company/kpi"):
        if path.endswith("/metrics") and write:
            return "kpi.evaluate"
        return (
            ("kpi.evaluate", "kpi.evaluate_sales")
            if write
            else ("kpi.read_all", "kpi.read_team", "kpi.read_own")
        )
    if path.startswith(
        (
            "/api/company/leads",
            "/api/customers",
            "/api/deals",
            "/api/students",
            "/api/bookings",
        )
    ):
        if path.endswith("/enroll"):
            return "students.create"
        if method == "POST" and path in ("/api/company/leads", "/api/deals"):
            return "leads.create"
        if path.startswith("/api/bookings") and write:
            return "bookings.manage"
        return (
            ("leads.update_all", "leads.update_team", "leads.update_own")
            if write
            else ("leads.read_all", "leads.read_team", "leads.read_own")
        )
    return ()


async def authorize_request(
    request: Request, db=Depends(get_db), credentials=Depends(security_scheme)
):
    path = request.url.path
    if (
        not path.startswith("/api/")
        or path == "/api/health"
        or path.startswith("/api/webhooks/")
        or path in ("/api/auth/login", "/api/auth/accept-invitation")
    ):
        return
    user = await get_current_user(request, credentials, db)
    permissions = policy(path, request.method)
    if permissions is not None:
        require(
            user, *((permissions,) if isinstance(permissions, str) else permissions)
        )
    p = request.path_params
    write = request.method not in ("GET", "HEAD")
    if "conversation_id" in p:
        await check_conversation(db, user, int(p["conversation_id"]))
    if "customer_id" in p:
        await check_customer(db, user, int(p["customer_id"]), write)
    if "student_id" in p:
        await check_student(
            db,
            user,
            int(p["student_id"]),
            write and not path.endswith("/documents"),
            documents=path.endswith("/documents"),
        )
    if "document_id" in p:
        from app.models.company import StudentDocument

        doc = await db.get(StudentDocument, int(p["document_id"]))
        if not doc:
            raise HTTPException(404, "Документ не найден")
        await check_student(db, user, doc.student_id, documents=True)
    if "deal_id" in p or "checklist_id" in p:
        from app.models import Deal, DocumentChecklist

        deal_id = p.get("deal_id")
        if not deal_id:
            doc = await db.get(DocumentChecklist, int(p["checklist_id"]))
            deal_id = doc.deal_id if doc else None
        deal = await db.get(Deal, int(deal_id)) if deal_id else None
        if not deal:
            raise HTTPException(404, "Сделка не найдена")
        await check_customer(db, user, deal.customer_id, write)
    if "booking_id" in p:
        from app.models import Booking

        booking = await db.get(Booking, int(p["booking_id"]))
        if not booking:
            raise HTTPException(404, "Консультация не найдена")
        await check_customer(db, user, booking.customer_id, write)
    if write and path in ("/api/deals", "/api/bookings"):
        body = await request.json()
        if body.get("customer_id") is not None:
            await check_customer(db, user, int(body["customer_id"]), True)
        target = body.get("assigned_user_id")
        if target and target != user.id:
            from app.core.permissions import has, team_users

            require(user, "leads.assign")
            if not has(user, "leads.update_all") and target not in await team_users(
                db, user
            ):
                raise HTTPException(403, "Назначение вне команды запрещено")
