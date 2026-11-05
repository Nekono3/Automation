"""Linked company workspace. Monetary records are append-only with audited voiding."""
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import select, func, or_, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.permissions import has, require, customer_clause, team_users
from app.database import get_db
from app.models import User, Customer, Deal, DocumentChecklist, Conversation, Message, EnrolledStudent, UniversityProgram, AuditLog
from app.models.company import (LeadRecord, AdmissionLink, FinanceCategory, FinanceTransaction,
                                EmployeeMetric, EmployeeResult, StudentDocument)
from app.schemas.company import (LeadInput, LeadUpdate, CategoryInput, TransactionInput, VoidInput,
                                 AdmissionInput, MetricInput, ResultInput, DocumentStatus)

router = APIRouter(prefix="/api/company", tags=["Company workspace"])
PRIVATE_DOCUMENTS = Path(__file__).resolve().parents[3] / "private_documents"


def serialize(record):
    return {column.name: str(value) if isinstance(value := getattr(record, column.name), Decimal) else value
            for column in record.__table__.columns}


def management(user):
    return has(user,"leads.read_all","leads.read_team")


async def exists(db, model, record_id):
    record = await db.get(model, record_id) if record_id is not None else None
    if record is None:
        raise HTTPException(404, f"{model.__name__}: запись не найдена")
    return record


def audit(db, user, action, entity, entity_id, data):
    db.add(AuditLog(user_id=user.id, action=action, entity=entity, entity_id=entity_id,
                    extra_data={k: str(v) if isinstance(v, (date, Decimal)) else v for k, v in data.items()}))


async def commit(db):
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Запись уже существует или связана с другими данными")


def period_filter(statement, column, start, end):
    if start and end and start > end:
        raise HTTPException(422, "Начало периода должно быть раньше окончания")
    if start:
        statement = statement.where(column >= start)
    if end:
        statement = statement.where(column <= end)
    return statement


@router.get("/directory")
async def directory(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    staff = (await db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name))).all()
    if not has(user,"employees.read","employees.manage"):
        allowed=await team_users(db,user) if has(user,"employees.read_team") else [user.id]
        staff=[u for u in staff if u.id in allowed]
    return {"users": [{"id": u.id, "full_name": u.full_name, "role": u.role,
                        "whatsapp_account_id": u.whatsapp_account_id} for u in staff],
            "categories": [serialize(c) for c in (await db.scalars(select(FinanceCategory).order_by(FinanceCategory.name))).all()] if has(user,"finance.read") else [],
            "countries": list((await db.scalars(select(EnrolledStudent.country).distinct().order_by(EnrolledStudent.country))).all())}


@router.get("/leads")
async def leads(search: str = "", category: str | None = None, status: str | None = None,
                assigned_user_id: int | None = None, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
                db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(Customer, LeadRecord).outerjoin(LeadRecord, Customer.id == LeadRecord.customer_id)
    stmt = stmt.where(await customer_clause(db,user))
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern), Customer.email.ilike(pattern)))
    if category:
        stmt = stmt.where(func.coalesce(LeadRecord.category, "Без категории") == category)
    if status:
        stmt = stmt.where(func.coalesce(LeadRecord.status, "new") == status)
    if assigned_user_id:
        stmt = stmt.where(LeadRecord.assigned_user_id == assigned_user_id)
    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.execute(stmt.order_by(Customer.created_at.desc(), Customer.id.desc()).offset(skip).limit(limit))).all()
    return {"total": total, "items": [{"customer": serialize(c), "lead": serialize(l) if l else
            {"customer_id": c.id, "assigned_user_id": None, "category": "Без категории", "status": "new", "next_action": ""}} for c, l in rows]}


@router.post("/leads", status_code=201)
async def create_lead(data: LeadInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    assigned = data.assigned_user_id if management(user) else user.id
    if assigned:
        await exists(db, User, assigned)
        if assigned != user.id:
            require(user,"leads.assign")
            if not has(user,"leads.update_all") and assigned not in await team_users(db,user):
                raise HTTPException(403,"Назначение за пределами команды запрещено")
    customer = Customer(name=data.name, phone=data.phone or None, email=data.email or None)
    db.add(customer)
    await db.flush()
    lead = LeadRecord(customer_id=customer.id, assigned_user_id=assigned, category=data.category,
                      status=data.status, next_action=data.next_action)
    db.add(lead)
    audit(db, user, "create", "company_lead", customer.id, data.model_dump())
    await commit(db)
    return {"customer": serialize(customer), "lead": serialize(lead)}


@router.put("/leads/{customer_id}")
async def update_lead(customer_id: int, data: LeadUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await exists(db, Customer, customer_id)
    lead = await db.scalar(select(LeadRecord).where(LeadRecord.customer_id == customer_id).with_for_update())
    if not management(user) and (not lead or lead.assigned_user_id != user.id or data.assigned_user_id != user.id):
        raise HTTPException(403, "Можно изменять только свои лиды; распределение доступно РОП")
    if data.assigned_user_id:
        await exists(db, User, data.assigned_user_id)
    if data.assigned_user_id != (lead.assigned_user_id if lead else None):
        require(user,"leads.assign")
        if not has(user,"leads.update_all") and data.assigned_user_id not in await team_users(db,user):
            raise HTTPException(403,"Назначение за пределами команды запрещено")
        from app.modules.security.models import LeadAssignment
        from sqlalchemy import update
        await db.execute(update(LeadAssignment).where(LeadAssignment.customer_id==customer_id,LeadAssignment.released_at.is_(None)).values(released_at=datetime.now(timezone.utc)))
        if data.assigned_user_id:
            db.add(LeadAssignment(customer_id=customer_id,user_id=data.assigned_user_id,assigned_by=user.id))
    if not lead:
        lead = LeadRecord(customer_id=customer_id)
        db.add(lead)
    for key, value in data.model_dump().items():
        setattr(lead, key, value)
    audit(db, user, "update", "company_lead", customer_id, data.model_dump())
    await commit(db)
    return serialize(lead)


@router.post("/leads/{customer_id}/enroll", status_code=201)
async def enroll_lead(customer_id: int, country: str = Query(min_length=1, max_length=128),
                       db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not country.strip():
        raise HTTPException(422, "Укажите страну поступления")
    customer = await db.scalar(select(Customer).where(Customer.id == customer_id).with_for_update())
    if not customer:
        raise HTTPException(404, "Контакт не найден")
    lead = await db.scalar(select(LeadRecord).where(LeadRecord.customer_id == customer_id))
    if not management(user) and (not lead or lead.assigned_user_id != user.id):
        raise HTTPException(403, "Лид закреплён за другим сотрудником")
    previous = await db.scalar(select(AdmissionLink).where(AdmissionLink.customer_id == customer_id))
    if previous:
        return {"student_id": previous.student_id}
    manager = await db.get(User, lead.assigned_user_id) if lead and lead.assigned_user_id else user
    student = EnrolledStudent(full_name=customer.name or customer.username or f"Контакт {customer.id}",
                               country=country.strip(), process_stage="Сбор документов", manager=manager.full_name)
    db.add(student)
    await db.flush()
    deal = await db.scalar(select(Deal).where(Deal.customer_id == customer_id, Deal.pipeline_type == "ADMISSION").order_by(Deal.id.desc()))
    if not deal:
        deal = Deal(title=f"Поступление: {student.full_name}", customer_id=customer_id,
                    pipeline_type="ADMISSION", stage="DOCS_COLLECTION", target_country=country.strip(), assigned_user_id=manager.id)
        db.add(deal)
        await db.flush()
        for title in ("Заграничный паспорт", "Аттестат / диплом", "Сертификат языкового теста", "Мотивационное письмо"):
            db.add(DocumentChecklist(deal_id=deal.id, document_name=title, status="NOT_SUBMITTED"))
    db.add(AdmissionLink(student_id=student.id, customer_id=customer_id, manager_id=manager.id, deal_id=deal.id))
    if lead:
        lead.status = "won"
    audit(db, user, "enroll", "enrolled_student", student.id, {"customer_id": customer_id, "country": country})
    await commit(db)
    return {"student_id": student.id}


@router.post("/finance/categories", status_code=201)
async def create_category(data: CategoryInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    category = FinanceCategory(name=data.name)
    db.add(category)
    await commit(db)
    return serialize(category)


@router.get("/finance/transactions")
async def transactions(start: date | None = None, end: date | None = None, currency: str | None = None,
                       category_id: int | None = None, student_id: int | None = None, kind: str | None = None,
                       include_voided: bool = False, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500),
                       db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(FinanceTransaction)
    stmt = period_filter(stmt, FinanceTransaction.occurred_on, start, end)
    for col, val in ((FinanceTransaction.currency, currency), (FinanceTransaction.category_id, category_id),
                     (FinanceTransaction.student_id, student_id), (FinanceTransaction.kind, kind)):
        if val is not None:
            stmt = stmt.where(col == val)
    if not include_voided:
        stmt = stmt.where(FinanceTransaction.voided_at.is_(None))
    count = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = (await db.scalars(stmt.order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.id.desc()).offset(skip).limit(limit))).all()
    return {"total": count, "items": [serialize(row) for row in rows]}


@router.post("/finance/transactions", status_code=201)
async def create_transaction(data: TransactionInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await exists(db, FinanceCategory, data.category_id)
    if data.student_id:
        student = await exists(db, EnrolledStudent, data.student_id)
        if not data.stage:
            data.stage = student.process_stage
    if data.deal_id:
        deal = await exists(db, Deal, data.deal_id)
        if data.student_id:
            link = await db.scalar(select(AdmissionLink).where(AdmissionLink.student_id == data.student_id))
            if not link or (link.deal_id != deal.id and link.customer_id != deal.customer_id):
                raise HTTPException(422, "Сделка не связана с выбранным учеником")
    transaction = FinanceTransaction(**data.model_dump(), created_by=user.id)
    db.add(transaction)
    await db.flush()
    audit(db, user, "create", "finance_transaction", transaction.id, data.model_dump())
    await commit(db)
    return serialize(transaction)


@router.post("/finance/transactions/{transaction_id}/void")
async def void_transaction(transaction_id: int, data: VoidInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    transaction = await db.scalar(select(FinanceTransaction).where(FinanceTransaction.id == transaction_id).with_for_update())
    if not transaction:
        raise HTTPException(404, "Операция не найдена")
    if transaction.voided_at:
        raise HTTPException(409, "Операция уже аннулирована")
    transaction.voided_at = datetime.now(timezone.utc)
    transaction.void_reason = data.reason
    audit(db, user, "void", "finance_transaction", transaction.id, {"reason": data.reason})
    await commit(db)
    return serialize(transaction)


@router.get("/finance/report")
async def finance_report(start: date | None = None, end: date | None = None, currency: str | None = None,
                         category_id: int | None = None, student_id: int | None = None,
                         db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(FinanceTransaction.currency, FinanceTransaction.category_id,
                  func.to_char(FinanceTransaction.occurred_on, "YYYY-MM").label("month"),
                  FinanceTransaction.kind, func.sum(FinanceTransaction.amount).label("amount"))
    stmt = period_filter(stmt.where(FinanceTransaction.voided_at.is_(None)), FinanceTransaction.occurred_on, start, end)
    if currency:
        stmt = stmt.where(FinanceTransaction.currency == currency)
    if category_id:
        stmt = stmt.where(FinanceTransaction.category_id == category_id)
    if student_id:
        stmt = stmt.where(FinanceTransaction.student_id == student_id)
    stmt = stmt.group_by(FinanceTransaction.currency, FinanceTransaction.category_id, "month", FinanceTransaction.kind)
    totals, categories, months, years = {}, {}, {}, {}
    for curr, cat, month, kind, amount in (await db.execute(stmt)).all():
        for collection, key in ((totals, curr), (categories, (curr, cat)), (months, (curr, month)), (years, (curr, month[:4]))):
            bucket = collection.setdefault(key, {"income": Decimal(0), "expense": Decimal(0)})
            bucket[kind] += amount
    def output(buckets, labels):
        return [{**dict(zip(labels, key if isinstance(key, tuple) else (key,))),
                 "income": str(val["income"]), "expense": str(val["expense"]),
                 "profit": str(val["income"] - val["expense"])} for key, val in sorted(buckets.items())]
    return {"totals": output(totals, ("currency",)), "categories": output(categories, ("currency", "category_id")),
            "months": output(months, ("currency", "month")), "years": output(years, ("currency", "year"))}


@router.get("/students/{student_id}")
async def student_dossier(student_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    student = await exists(db, EnrolledStudent, student_id)
    link = await db.scalar(select(AdmissionLink).where(AdmissionLink.student_id == student_id))
    customer = await db.get(Customer, link.customer_id) if link and link.customer_id else None
    program = await db.get(UniversityProgram, link.program_id) if link and link.program_id else None
    docs = (await db.scalars(select(StudentDocument).where(StudentDocument.student_id == student_id).order_by(StudentDocument.id.desc()))).all()
    logs = (await db.scalars(select(AuditLog).where(AuditLog.entity == "enrolled_student", AuditLog.entity_id == student_id).order_by(AuditLog.id.desc()).limit(200))).all()
    payments = (await db.scalars(select(FinanceTransaction).where(FinanceTransaction.student_id == student_id).order_by(FinanceTransaction.occurred_on.desc(), FinanceTransaction.id.desc()))).all() if has(user,"finance.read") else []
    from app.core.projections import student_view
    if not has(user,"student_documents.read_all","student_documents.read_assigned"):
        docs=[]
        logs=[log for log in logs if log.action not in ('upload_document','document_status')]
    if not has(user,"finance.read"):
        from app.core.projections import FINANCIAL_FIELDS
        # Only expose sanitized copies; never mutate stored audit metadata.
        history=[{**serialize(log),'extra_data':{k:v for k,v in log.extra_data.items() if k not in FINANCIAL_FIELDS}} for log in logs]
    else:
        history=[serialize(log) for log in logs]
    return {"student": student_view(student,user), "link": serialize(link) if link else None,
            "customer": serialize(customer) if customer else None, "program": serialize(program) if program else None,
            "documents": [{k: v for k, v in serialize(doc).items() if k != "storage_key"} for doc in docs],
            "history": history, "transactions": [serialize(p) for p in payments]}


@router.put("/students/{student_id}/links")
async def link_student(student_id: int, data: AdmissionInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    student = await exists(db, EnrolledStudent, student_id)
    for model, val in ((Customer, data.customer_id), (Deal, data.deal_id), (User, data.manager_id), (UniversityProgram, data.program_id)):
        if val:
            await exists(db, model, val)
    if data.deal_id:
        deal = await exists(db, Deal, data.deal_id)
        if data.customer_id != deal.customer_id:
            raise HTTPException(422, "Сделка должна принадлежать выбранному контакту")
    if data.program_id:
        program = await exists(db, UniversityProgram, data.program_id)
        if program.country.strip().casefold() != student.country.strip().casefold():
            raise HTTPException(422, "Страна программы должна совпадать со страной поступления")
    link = await db.scalar(select(AdmissionLink).where(AdmissionLink.student_id == student_id))
    if not link:
        link = AdmissionLink(student_id=student_id)
        db.add(link)
    for key, val in data.model_dump().items():
        setattr(link, key, val)
    if data.manager_id:
        student.manager = (await db.get(User, data.manager_id)).full_name
    audit(db, user, "link", "enrolled_student", student_id, data.model_dump())
    await commit(db)
    return serialize(link)


@router.post("/students/{student_id}/documents", status_code=201)
async def upload_document(student_id: int, request: Request, name: str = Query(min_length=1, max_length=255),
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await exists(db, EnrolledStudent, student_id)
    content_type = request.headers.get("content-type", "application/octet-stream").split(";")[0]
    if content_type not in ("application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        raise HTTPException(415, "Разрешены PDF, JPEG, PNG и DOCX")
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(413, "Максимальный размер документа — 10 МБ")
    if not content:
        raise HTTPException(422, "Файл пуст")
    from app.core.files import validate_document
    name=validate_document(bytes(content),content_type,name)
    key = uuid4().hex
    import os
    def write_private():
        with os.fdopen(os.open(PRIVATE_DOCUMENTS / key,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),"wb") as output:
            output.write(content)
    try:
        await asyncio.to_thread(PRIVATE_DOCUMENTS.mkdir, parents=True, exist_ok=True, mode=0o700)
        await asyncio.to_thread(write_private)
    except OSError:
        # A partial file must never become a document record; do not expose paths.
        try:
            await asyncio.to_thread((PRIVATE_DOCUMENTS / key).unlink, missing_ok=True)
        except OSError:
            pass
        raise HTTPException(503, "Хранилище документов временно недоступно") from None
    doc = StudentDocument(student_id=student_id, name=name, storage_key=key, content_type=content_type,
                          size=len(content), uploaded_by=user.id)
    db.add(doc)
    audit(db, user, "upload_document", "enrolled_student", student_id, {"name": name})
    try:
        await commit(db)
    except Exception:
        await asyncio.to_thread((PRIVATE_DOCUMENTS / key).unlink, missing_ok=True)
        raise
    return {k: v for k, v in serialize(doc).items() if k != "storage_key"}


@router.get("/documents/{document_id}/download")
async def download_document(document_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = await exists(db, StudentDocument, document_id)
    path = (PRIVATE_DOCUMENTS / doc.storage_key).resolve()
    if not path.is_relative_to(PRIVATE_DOCUMENTS.resolve()):
        raise HTTPException(404,"Файл недоступен")
    if not path.is_file():
        raise HTTPException(404, "Файл недоступен")
    return FileResponse(path, media_type=doc.content_type, filename=doc.name, headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})


@router.patch("/documents/{document_id}")
async def document_status(document_id: int, data: DocumentStatus, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    doc = await exists(db, StudentDocument, document_id)
    previous = doc.status
    doc.status = data.status
    audit(db, user, "document_status", "enrolled_student", doc.student_id, {"document_id": doc.id, "before": previous, "after": data.status})
    await commit(db)
    return {"id": doc.id, "status": doc.status}


@router.get("/kpi/metrics")
async def metrics(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return [serialize(m) for m in (await db.scalars(select(EmployeeMetric).order_by(EmployeeMetric.department, EmployeeMetric.name))).all()]


@router.post("/kpi/metrics", status_code=201)
async def create_metric(data: MetricInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    metric = EmployeeMetric(**data.model_dump())
    db.add(metric)
    await commit(db)
    return serialize(metric)


@router.get("/kpi/results")
async def results(period: date | None = None, user_id: int | None = None,
                   db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(EmployeeResult)
    if not has(user,"kpi.read_all"):
        allowed=await team_users(db,user) if has(user,"kpi.read_team") else [user.id]
        stmt = stmt.where(EmployeeResult.user_id.in_(allowed))
    if user_id:
        stmt = stmt.where(EmployeeResult.user_id == user_id)
    if period:
        stmt = stmt.where(EmployeeResult.period == period.replace(day=1))
    return [serialize(r) for r in (await db.scalars(stmt.order_by(EmployeeResult.period.desc(), EmployeeResult.user_id).limit(1000))).all()]


@router.put("/kpi/results")
async def save_result(data: ResultInput, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    target=await exists(db, User, data.user_id)
    metric=await exists(db, EmployeeMetric, data.metric_id)
    if not has(user,"kpi.evaluate"):
        if data.user_id not in await team_users(db,user) or target.role not in ("manager","head_of_sales","lead_manager") or metric.department not in ("Продажи","Sales"):
            raise HTTPException(403,"Оценка KPI ограничена отделом продаж своей команды")
    row = await db.scalar(select(EmployeeResult).where(EmployeeResult.user_id == data.user_id,
                           EmployeeResult.metric_id == data.metric_id, EmployeeResult.period == data.period).with_for_update())
    if not row:
        row = EmployeeResult(**data.model_dump(), evaluated_by=user.id)
        db.add(row)
    else:
        for key, val in data.model_dump().items():
            setattr(row, key, val)
        row.evaluated_by = user.id
    await db.flush()
    audit(db, user, "evaluate", "employee_result", row.id, data.model_dump())
    await commit(db)
    return serialize(row)


@router.get("/managers")
async def manager_report(start: date | None = None, end: date | None = None,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # Group independently to avoid multiplying lead/message counts through joins.
    staff = (await db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name))).all()
    leads_stmt = period_filter(select(LeadRecord.assigned_user_id, LeadRecord.status, func.count()).group_by(LeadRecord.assigned_user_id, LeadRecord.status),
                               func.date(LeadRecord.created_at), start, end)
    if not has(user,"leads.read_all"):
        allowed=await team_users(db,user)
        staff=[u for u in staff if u.id in allowed]
    lead_counts = {}
    for uid, status, count in (await db.execute(leads_stmt)).all():
        lead_counts.setdefault(uid, {})[status] = count
    chat_stmt = select(Conversation.whatsapp_account_id, func.count(), func.sum(Conversation.unread_count),
                       func.count().filter(Conversation.status == "open")).where(Conversation.channel == "whatsapp").group_by(Conversation.whatsapp_account_id)
    chats = {aid: {"conversations": n, "unread_messages": unread or 0, "open_conversations": opened}
             for aid, n, unread, opened in (await db.execute(chat_stmt)).all()}
    msg_stmt = period_filter(select(Conversation.whatsapp_account_id, Message.direction, Message.sender_type, func.count())
                  .join(Conversation, Message.conversation_id == Conversation.id).where(Conversation.channel == "whatsapp")
                  .group_by(Conversation.whatsapp_account_id, Message.direction, Message.sender_type), func.date(Message.created_at), start, end)
    activity = {}
    for aid, direction, sender, count in (await db.execute(msg_stmt)).all():
        bucket = activity.setdefault(aid, {"inbound": 0, "outbound": 0, "employee_replies": 0, "ai_replies": 0})
        bucket[direction] = bucket.get(direction, 0) + count
        if direction == "outbound":
            if sender == "employee":
                bucket["employee_replies"] += count
            elif sender == "ai":
                bucket["ai_replies"] += count
    # Historical messages have account attribution; only newer manual replies carry actor IDs.
    return [{"id": u.id, "name": u.full_name, "role": u.role, "whatsapp_account_id": u.whatsapp_account_id,
             "leads": lead_counts.get(u.id, {}), "whatsapp": {**chats.get(u.whatsapp_account_id, {}), **activity.get(u.whatsapp_account_id, {})} if u.whatsapp_account_id else {}}
            for u in staff]

@router.get('/finance/students')
async def billing_students(search:str='',db:AsyncSession=Depends(get_db),user:User=Depends(get_current_user)):
    require(user,'finance.read')
    statement=select(EnrolledStudent.id,EnrolledStudent.full_name).order_by(EnrolledStudent.full_name).limit(1000)
    if search:statement=statement.where(EnrolledStudent.full_name.ilike(f'%{search.strip()}%'))
    return [{'id':sid,'full_name':name} for sid,name in (await db.execute(statement)).all()]
