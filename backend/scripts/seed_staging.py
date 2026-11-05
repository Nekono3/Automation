"""Empty, explicitly named synthetic staging database only. Input secrets via stdin."""
import asyncio
from contextlib import redirect_stdout
from io import StringIO
import json
import sys
from sqlalchemy import select, func
from app.config import settings
from app.database import AsyncSessionLocal
from app.models import User, Customer, Conversation, WhatsAppAccount, EnrolledStudent
from app.models.company import LeadRecord
from app.modules.security.models import StudentAssignment
from app.modules.security import bootstrap
from app.modules.security.service import issue_invitation, accept_invitation
from app.security.passwords import hash_password


async def seed(accounts):
    from sqlalchemy.engine import make_url
    if settings.ENVIRONMENT != 'staging' or make_url(settings.async_database_url).database != 'consulteam_staging':
        raise SystemExit('Synthetic seed requires the explicitly named isolated staging database')
    async with AsyncSessionLocal() as db:
        if await db.scalar(select(func.count()).select_from(User)):
            raise SystemExit('Nonempty database preserved. Seed was not applied.')
    director = next(row for row in accounts if row['role'] == 'director')
    output = StringIO()
    with redirect_stdout(output):
        await bootstrap.main(director['email'], 'Synthetic director')
    invitation = output.getvalue().strip().splitlines()[-1]
    async with AsyncSessionLocal() as db:
        await accept_invitation(db, invitation, director['password'])
        users = {'director': await db.scalar(select(User).where(User.email == director['email']))}
        for data in accounts:
            if data['role'] == 'director': continue
            user = User(email=data['email'], full_name='Synthetic '+data['role'], role=data['role'], is_active=False,
                        hashed_password=hash_password(data['password']))
            db.add(user)
            await db.flush()
            token = await issue_invitation(db, user, users['director'].id)
            await accept_invitation(db, token, data['password'])
            users[data['role']] = user
        # This mapping is synthetic and applies only to this isolated database.
        for i, role in enumerate(('head_of_sales', 'manager', 'director'), 1):
            account = WhatsAppAccount(account_id=f'account_{i}', name=f'Synthetic account {i}')
            customer = Customer(name=f'Synthetic client {i}', phone='0000000000')
            db.add_all([account, customer])
            await db.flush()
            users[role].whatsapp_account_id = account.id
            db.add_all([
                Conversation(customer_id=customer.id, channel='whatsapp', whatsapp_account_id=account.id, mode='human'),
                LeadRecord(customer_id=customer.id, assigned_user_id=users[role].id),
            ])
        student = EnrolledStudent(full_name='Synthetic student', country='Synthetic', manager='Synthetic manager')
        db.add(student)
        await db.flush()
        db.add(StudentAssignment(student_id=student.id, user_id=users['mentor'].id, assigned_by=users['director'].id))
        await db.commit()
    print('Six synthetic staging identities and linked records created. No provider was contacted.')


if __name__ == '__main__':
    asyncio.run(seed(json.load(sys.stdin)))
