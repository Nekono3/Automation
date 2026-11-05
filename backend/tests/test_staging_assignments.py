from uuid import uuid4
import pytest
from sqlalchemy import select
from app.models import Customer, Conversation, WhatsAppAccount, EnrolledStudent
from app.modules.security.models import StudentAssignment, ConversationAssignment
from tests.test_security import employee
from tests.test_company import workspace


@pytest.mark.asyncio
async def test_team_membership_changes_revoke_and_grant_access(workspace):
    c, db, director, manager, auth = workspace
    head = await employee(db, 'head_of_sales')
    replacement = await employee(db, 'manager')
    name = 'Synthetic '+uuid4().hex
    team = await c.post('/api/security/teams', headers=auth(director), json={'name': name, 'user_ids': [head.id, manager.id]})
    assert team.status_code == 201
    lead = (await c.post('/api/company/leads', headers=auth(director), json={'name': name, 'assigned_user_id': manager.id})).json()['customer']['id']
    assert (await c.get(f'/api/customers/{lead}', headers=auth(head))).status_code == 200
    assert (await c.put(f"/api/security/teams/{team.json()['id']}", headers=auth(manager), json={'name': name, 'user_ids': [manager.id]})).status_code == 403
    r = await c.put(f"/api/security/teams/{team.json()['id']}", headers=auth(director), json={'name': name, 'user_ids': [head.id, replacement.id]})
    assert r.status_code == 200
    assert (await c.get(f'/api/customers/{lead}', headers=auth(head))).status_code == 404
    second = (await c.post('/api/company/leads', headers=auth(director), json={'name': name, 'assigned_user_id': replacement.id})).json()['customer']['id']
    assert (await c.get(f'/api/customers/{second}', headers=auth(head))).status_code == 200


@pytest.mark.asyncio
async def test_mentor_reassignment_keeps_history_and_revokes_previous_access(workspace):
    c, db, director, _, auth = workspace
    mentors = [await employee(db, 'mentor') for _ in range(2)]
    ops = await employee(db, 'operations_director')
    student = EnrolledStudent(full_name='Synthetic handoff', country='Synthetic')
    db.add(student)
    await db.commit()
    for mentor in mentors:
        r = await c.post('/api/security/student-assignments', headers=auth(ops), json={'object_id': student.id, 'user_id': mentor.id, 'reason': 'Synthetic handoff'})
        assert r.status_code == 200, r.text
        assert (await c.get(f'/api/company/students/{student.id}', headers=auth(mentor))).status_code == 200
    assert (await c.get(f'/api/company/students/{student.id}', headers=auth(mentors[0]))).status_code == 404
    history = (await db.scalars(select(StudentAssignment).where(StudentAssignment.student_id == student.id).order_by(StudentAssignment.id))).all()
    assert len(history) == 2 and history[0].released_at and history[1].released_at is None


@pytest.mark.asyncio
async def test_explicit_account_ownership_transfer_and_scope(workspace):
    c, db, director, manager, auth = workspace
    other = await employee(db, 'manager')
    account = WhatsAppAccount(account_id=uuid4().hex, name='Synthetic account')
    customer = Customer(name='Synthetic conversation')
    db.add_all([account, customer])
    await db.flush()
    conversation = Conversation(customer_id=customer.id, channel='whatsapp', whatsapp_account_id=account.id)
    db.add(conversation)
    await db.flush()
    db.add(ConversationAssignment(conversation_id=conversation.id, user_id=manager.id))
    await db.commit()
    path = f'/api/security/users/{manager.id}/whatsapp-account'
    assert (await c.put(path, headers=auth(manager), json={'account_id': account.id})).status_code == 403
    assert (await c.put(path, headers=auth(director), json={'account_id': account.id})).status_code == 200
    assert (await c.get(f'/api/conversations/{conversation.id}', headers=auth(manager))).status_code == 200
    assert (await c.get(f'/api/conversations/{conversation.id}', headers=auth(other))).status_code == 404
    assert (await c.put(f'/api/security/users/{other.id}/whatsapp-account', headers=auth(director), json={'account_id': account.id})).status_code == 409
    assert (await c.put(path, headers=auth(director), json={'account_id': None})).status_code == 200
    assert (await c.get(f'/api/conversations/{conversation.id}', headers=auth(manager))).status_code == 404
    assert (await c.put(f'/api/security/users/{other.id}/whatsapp-account', headers=auth(director), json={'account_id': account.id})).status_code == 200
    assert (await c.get(f'/api/conversations/{conversation.id}', headers=auth(other))).status_code == 200
