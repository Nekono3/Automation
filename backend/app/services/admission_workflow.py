"""Keep the linked admission board and student register in sync."""
from sqlalchemy import select
from app.models import EnrolledStudent, Customer, User, AuditLog
from app.models.company import AdmissionLink

STAGES = {
    'DOCS_COLLECTION': 'Сбор документов',
    'ESSAY_AND_PORTFOLIO': 'Эссе и портфолио',
    'APPLICATIONS_SUBMITTED': 'Заявки поданы',
    'OFFER_RECEIVED': 'Оффер получен',
    'VISA_STAGE': 'Виза',
    'ENROLLED_AND_DEPARTED': 'Зачислен и выехал',
}

async def ensure_student(db, deal):
    link = await db.scalar(select(AdmissionLink).where(AdmissionLink.customer_id == deal.customer_id))
    if link:
        if not link.deal_id:
            link.deal_id = deal.id
        return
    customer = await db.get(Customer, deal.customer_id)
    manager = await db.get(User, deal.assigned_user_id) if deal.assigned_user_id else None
    student = EnrolledStudent(full_name=customer.name or customer.username or f'Контакт #{customer.id}',
        country=deal.target_country or 'Не указана', process_stage=STAGES.get(deal.stage, deal.stage),
        manager=manager.full_name if manager else 'Не назначен', is_completed=deal.stage=='ENROLLED_AND_DEPARTED')
    db.add(student)
    await db.flush()
    db.add(AdmissionLink(student_id=student.id,customer_id=customer.id,deal_id=deal.id,manager_id=deal.assigned_user_id))
    db.add(AuditLog(action='enroll',entity='enrolled_student',entity_id=student.id,
                    extra_data={'customer_id':customer.id,'deal_id':deal.id}))

async def sync_student_stage(db, deal, actor_id=None):
    link = await db.scalar(select(AdmissionLink).where(AdmissionLink.deal_id == deal.id))
    if link:
        student = await db.get(EnrolledStudent,link.student_id)
        previous = student.process_stage
        student.process_stage = STAGES.get(deal.stage,deal.stage)
        student.is_completed = deal.stage=='ENROLLED_AND_DEPARTED'
        if previous != student.process_stage:
            db.add(AuditLog(user_id=actor_id,action='update',entity='enrolled_student',entity_id=student.id,
                extra_data={'process_stage':{'before':previous,'after':student.process_stage},'deal_id':deal.id}))
