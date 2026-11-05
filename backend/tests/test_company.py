"""Integration tests; run with POSTGRES_DB=insta_upgrade_test."""
from uuid import uuid4
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.database import get_db
from app.models import User, EnrolledStudent, AuditLog, WhatsAppAccount, Conversation, Message, Customer
from app.security.jwt import create_access_token
from app.services.user_service import UserService

@pytest.fixture
async def workspace(db_session, tmp_path, monkeypatch):
    from app.api.routes import company
    monkeypatch.setattr(company, 'PRIVATE_DOCUMENTS', tmp_path / 'documents')
    suffix = uuid4().hex
    admin = User(email=f'admin-{suffix}@test.local', full_name='Test Admin', hashed_password='unused', role='admin')
    manager = User(email=f'manager-{suffix}@test.local', full_name='Test Manager', hashed_password='unused', role='manager')
    db_session.add_all([admin, manager])
    await db_session.commit()
    async def override_db():
        yield db_session
    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as client:
        def auth(user):
            return {'Authorization': f'Bearer {create_access_token(data={"sub":str(user.id)})}'}
        yield client, db_session, admin, manager, auth
    app.dependency_overrides.pop(get_db, None)

async def category(client, headers):
    r = await client.post('/api/company/finance/categories', headers=headers, json={'name':uuid4().hex})
    assert r.status_code == 201, r.text
    return r.json()['id']

@pytest.mark.asyncio
async def test_finance_exact_currency_period_and_void(workspace):
    c, db, admin, _, auth = workspace
    h = auth(admin)
    cat = await category(c,h)
    ids = []
    for amount,kind,curr,day in [('100.10','income','USD','2026-01-12'),('20.01','expense','USD','2026-01-20'),('0.20','income','USD','2026-02-01'),('900','income','KGS','2026-01-01'),('999','income','USD','2025-12-31')]:
        r = await c.post('/api/company/finance/transactions',headers=h,json={'category_id':cat,'amount':amount,'kind':kind,'currency':curr,'occurred_on':day})
        assert r.status_code == 201, r.text
        ids.append(r.json()['id'])
    path = f'/api/company/finance/report?start=2026-01-01&end=2026-12-31&category_id={cat}'
    r = await c.get(path,headers=h)
    assert r.status_code == 200, r.text
    d=r.json()
    assert next(t for t in d['totals'] if t['currency']=='USD') == {'currency':'USD','income':'100.30','expense':'20.01','profit':'80.29'}
    assert len(d['months'])==3 and len(d['years'])==2
    assert next(t for t in d['totals'] if t['currency']=='KGS')['profit']=='900.00'
    r=await c.post(f'/api/company/finance/transactions/{ids[1]}/void',headers=h,json={'reason':'Duplicate entry'})
    assert r.status_code == 200,r.text
    assert (await c.post(f'/api/company/finance/transactions/{ids[1]}/void',headers=h,json={'reason':'Again'})).status_code==409
    d=(await c.get(path+'&currency=USD',headers=h)).json()
    assert d['totals'][0]['profit']=='100.30'
    assert await db.scalar(select(AuditLog.id).where(AuditLog.entity=='finance_transaction',AuditLog.entity_id==ids[1],AuditLog.action=='void'))
    assert (await c.get('/api/company/finance/report?start=2027-01-01&end=2026-01-01',headers=h)).status_code==422

@pytest.mark.asyncio
async def test_finance_validation_permissions(workspace):
    c,_,admin,manager,auth=workspace
    cat=await category(c,auth(admin))
    valid={'category_id':cat,'amount':'1.01','kind':'income','currency':'KGS','occurred_on':'2026-01-01'}
    for patch in ({'amount':'0'},{'amount':'-1'},{'amount':'1.001'},{'commission_percent':'101'},{'commission_percent':'5','recipient':'Test'},{'kind':'other'},{'currency':'usd'},{'student_id':999999999}):
        r=await c.post('/api/company/finance/transactions',headers=auth(admin),json={**valid,**patch})
        assert r.status_code in (422,404),r.text
    assert (await c.post('/api/company/finance/transactions',headers=auth(manager),json=valid)).status_code==403
    assert (await c.get('/api/company/finance/report',headers=auth(manager))).status_code==403
    assert (await c.get('/api/company/finance/transactions')).status_code==401

@pytest.mark.asyncio
async def test_lead_conversion_student_payments_history(workspace):
    c,_,admin,manager,auth=workspace
    h=auth(admin)
    r=await c.post('/api/company/leads',headers=h,json={'name':'Test Lead','category':'China','assigned_user_id':manager.id})
    assert r.status_code==201,r.text
    cid=r.json()['customer']['id']
    update={'assigned_user_id':manager.id,'status':'qualified','category':'China','next_action':'Call'}
    r=await c.put(f'/api/company/leads/{cid}',headers=auth(manager),json=update)
    assert r.status_code==200,r.text
    assert (await c.put(f'/api/company/leads/{cid}',headers=auth(manager),json={**update,'assigned_user_id':admin.id})).status_code==403
    own=(await c.get('/api/company/leads',headers=auth(manager))).json()
    assert all(l['lead']['assigned_user_id']==manager.id for l in own['items'])
    r=await c.post(f'/api/company/leads/{cid}/enroll?country=Китай',headers=auth(admin))
    assert r.status_code==201,r.text
    sid=r.json()['student_id']
    assert (await c.post(f'/api/company/leads/{cid}/enroll?country=Китай',headers=auth(admin))).json()['student_id']==sid
    cat=await category(c,h)
    payment={'category_id':cat,'amount':'200','kind':'income','currency':'USD','occurred_on':'2026-01-01','student_id':sid}
    r=await c.post('/api/company/finance/transactions',headers=h,json=payment)
    assert r.status_code==201,r.text
    assert r.json()['stage']=='Сбор документов'
    r=await c.post('/api/company/finance/transactions',headers=h,json={**payment,'amount':'20','kind':'expense','recipient':'Manager','commission_percent':'10'})
    assert r.status_code==201,r.text
    r=await c.patch(f'/api/enrolled-students/{sid}',headers=h,json={'process_stage':'Виза'})
    assert r.status_code==200,r.text
    dossier=(await c.get(f'/api/company/students/{sid}',headers=h)).json()
    assert dossier['link']['customer_id']==cid and len(dossier['transactions'])==2
    assert any(l['action']=='update' and l['extra_data']['process_stage']['before']=='Сбор документов' for l in dossier['history'])
    assert (await c.delete(f'/api/enrolled-students/{sid}',headers=h)).status_code==409
    assert (await c.post('/api/enrolled-students/sync?force=true',headers=h)).status_code==409

@pytest.mark.asyncio
async def test_employee_kpi_upsert_scope(workspace):
    c,_,admin,manager,auth=workspace
    r=await c.post('/api/company/kpi/metrics',headers=auth(admin),json={'name':uuid4().hex,'department':'Admissions','position':'Mentor','unit':'students','direction':'higher'})
    assert r.status_code==201,r.text
    payload={'user_id':manager.id,'metric_id':r.json()['id'],'period':'2026-03-01','target':'10','actual':'4'}
    initial=await c.put('/api/company/kpi/results',headers=auth(admin),json=payload)
    assert initial.status_code==200,initial.text
    edited=await c.put('/api/company/kpi/results',headers=auth(admin),json={**payload,'actual':'12'})
    assert edited.status_code==200,edited.text
    assert edited.json()['id']==initial.json()['id']
    rows=(await c.get('/api/company/kpi/results?period=2026-03-01',headers=auth(manager))).json()
    assert len(rows)==1 and rows[0]['actual']=='12.00'
    assert (await c.put('/api/company/kpi/results',headers=auth(manager),json=payload)).status_code==403
    assert (await c.put('/api/company/kpi/results',headers=auth(admin),json={**payload,'period':'2026-03-02'})).status_code==422

@pytest.mark.asyncio
async def test_private_documents(workspace):
    c,db,admin,_,auth=workspace
    student=EnrolledStudent(full_name='Document Test',country='Китай')
    db.add(student)
    await db.commit()
    content=b'%PDF-1.4\nSynthetic test fixture\n%%EOF'
    r=await c.post(f'/api/company/students/{student.id}/documents?name=passport.pdf',headers={**auth(admin),'Content-Type':'application/pdf'},content=content)
    assert r.status_code==201,r.text
    did=r.json()['id']
    assert 'storage_key' not in r.json()
    assert (await c.get(f'/api/company/documents/{did}/download')).status_code==401
    assert (await c.get(f'/api/company/documents/{did}/download',headers=auth(admin))).content==content
    r=await c.patch(f'/api/company/documents/{did}',headers=auth(admin),json={'status':'accepted'})
    assert r.status_code==200,r.text
    d=(await c.get(f'/api/company/students/{student.id}',headers=auth(admin))).json()
    assert d['documents'][0]['status']=='accepted' and len(d['history'])==2
    assert (await c.post(f'/api/company/students/{student.id}/documents?name=bad.html',headers={**auth(admin),'Content-Type':'text/html'},content=b'<script>')).status_code==415

@pytest.mark.asyncio
async def test_manager_aggregates_not_multiplied(workspace):
    c,db,admin,manager,auth=workspace
    account=WhatsAppAccount(account_id=uuid4().hex,name='Test account',role='manager')
    db.add(account)
    await db.flush()
    manager.whatsapp_account_id=account.id
    customer=Customer(name='Chat Test')
    db.add(customer)
    await db.flush()
    conv=Conversation(customer_id=customer.id,channel='whatsapp',whatsapp_account_id=account.id,unread_count=2)
    db.add(conv)
    await db.flush()
    db.add_all([Message(conversation_id=conv.id,customer_id=customer.id,channel='whatsapp',direction='inbound',sender_type='customer'),Message(conversation_id=conv.id,customer_id=customer.id,channel='whatsapp',direction='outbound',sender_type='employee')])
    await db.commit()
    r=await c.get('/api/company/managers',headers=auth(admin))
    assert r.status_code==200,r.text
    row=next(row for row in r.json() if row['id']==manager.id)
    assert row['whatsapp']['conversations']==1 and row['whatsapp']['employee_replies']==1
    assert row['whatsapp']['inbound']==1 and row['whatsapp']['unread_messages']==2

@pytest.mark.asyncio
async def test_staff_seed_preserves_credentials(db_session):
    email='synthetic-staff@example.test'
    user=await db_session.scalar(select(User).where(User.email==email))
    if user is None:
        user=User(email=email,full_name='Custom Name',hashed_password='custom hash',role='mentor',is_active=False)
        db_session.add(user)
        await db_session.commit()
    original=(user.hashed_password,user.full_name,user.role,user.is_active,user.whatsapp_account_id)
    await UserService.seed_default_staff_users(db_session)
    await db_session.refresh(user)
    assert (user.hashed_password,user.full_name,user.role,user.is_active,user.whatsapp_account_id)==original

@pytest.mark.asyncio
async def test_admission_board_student_sync_and_country_links(workspace):
    c,db,admin,manager,auth=workspace
    h=auth(admin)
    lead=(await c.post('/api/company/leads',headers=h,json={'name':'Board Student','assigned_user_id':manager.id})).json()
    cid=lead['customer']['id']
    sale=await c.post('/api/deals',headers=h,json={'title':'Board Sale','customer_id':cid,'assigned_user_id':manager.id,'target_country':'Китай'})
    assert sale.status_code==201,sale.text
    sale_id=sale.json()['id']
    r=await c.patch(f'/api/deals/{sale_id}/stage',headers=h,json={'stage':'CLOSED_WON'})
    assert r.status_code==200,r.text
    from app.models.company import AdmissionLink
    from app.models import UniversityProgram
    link=await db.scalar(select(AdmissionLink).where(AdmissionLink.customer_id==cid))
    assert link is not None
    sid=link.student_id
    r=await c.patch(f'/api/deals/{link.deal_id}/stage',headers=h,json={'stage':'OFFER_RECEIVED'})
    assert r.status_code==200,r.text
    d=(await c.get(f'/api/company/students/{sid}',headers=h)).json()
    assert d['student']['process_stage']=='Оффер получен'
    r=await c.patch(f'/api/enrolled-students/{sid}',headers=h,json={'process_stage':'Виза'})
    assert r.status_code==200,r.text
    assert (await c.get(f'/api/deals/{link.deal_id}',headers=h)).json()['stage']=='VISA_STAGE'
    program=UniversityProgram(university='Example University',faculty='IT',program_name='CS',program_name_ru='Информатика',country='Китай')
    db.add(program)
    await db.commit()
    r=await c.put(f'/api/company/students/{sid}/links',headers=h,json={'customer_id':cid,'deal_id':link.deal_id,'program_id':program.id,'manager_id':manager.id})
    assert r.status_code==200,r.text
    assert (await c.delete(f'/api/programs/{program.id}',headers=h)).status_code==409
    assert (await c.post('/api/programs/sync?force=true',headers=h)).status_code==409
    rows=(await c.get('/api/programs?country=Китай',headers=h)).json()
    assert rows and all(p['country']=='Китай' for p in rows)
    # Reopening and winning the sale must not create duplicate admission deals.
    await c.patch(f'/api/deals/{sale_id}/stage',headers=h,json={'stage':'NEW_LEAD'})
    await c.patch(f'/api/deals/{sale_id}/stage',headers=h,json={'stage':'CLOSED_WON'})
    deals=(await c.get(f'/api/deals?pipeline_type=ADMISSION&customer_id={cid}',headers=h)).json()
    assert len(deals)==1

@pytest.mark.asyncio
async def test_inbound_whatsapp_assigns_lead_to_account_owner(workspace):
    c,db,_,manager,auth=workspace
    from app.services.conversation_service import ConversationService
    account=WhatsAppAccount(account_id=uuid4().hex,name='Assigned WA')
    customer=Customer(name='Incoming Lead')
    db.add_all([account,customer])
    await db.flush()
    manager.whatsapp_account_id=account.id
    conversation=Conversation(customer_id=customer.id,channel='whatsapp',whatsapp_account_id=account.id)
    db.add(conversation)
    await db.commit()
    for _ in range(2):
        await ConversationService.record_message(db,conversation.id,customer.id,direction='inbound',sender_type='customer',text='Hello',channel='whatsapp')
    rows=(await c.get('/api/company/leads',headers=auth(manager))).json()['items']
    assert len(rows)==1 and rows[0]['customer']['id']==customer.id
