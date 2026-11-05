import asyncio
from uuid import uuid4
import httpx
import pytest
from sqlalchemy import select, func
from app.main import app
from app.config import settings
from app.database import get_db
from app.models import Customer, Conversation, Message, WhatsAppAccount
from app.models.audit import WebhookEvent
from app.models.automation import AutomationTrigger
from app.integrations.instagram.client import InstagramClient
from app.integrations.whatsapp.client import WhatsAppClient
from app.services.message_delivery import deliver
from tests.test_company import workspace
from tests.test_webhooks import signed_post
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
@pytest.mark.parametrize('account_id', ['account_1', 'account_2', 'account_3'])
@pytest.mark.parametrize('outcome', ['success', 'reject', 'timeout', 'network', 'invalid_json'])
async def test_whatsapp_transport_matrix(monkeypatch, account_id, outcome):
    calls = []
    original = httpx.AsyncClient
    def transport(request):
        calls.append(request)
        if outcome == 'timeout': raise httpx.ReadTimeout('synthetic', request=request)
        if outcome == 'network': raise httpx.ConnectError('synthetic', request=request)
        if outcome == 'reject': return httpx.Response(503, json={'error': settings.BRIDGE_API_TOKEN})
        if outcome == 'invalid_json': return httpx.Response(200, text='invalid')
        return httpx.Response(200, json={'session_id': account_id, 'message_id': 'synthetic-message'})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs))
    result = await WhatsAppClient().send_text_message('00000', 'Synthetic', account_id=account_id)
    assert len(calls) == 1 and calls[0].read().find(account_id.encode()) >= 0
    assert calls[0].headers['Authorization'] == 'Bearer '+settings.BRIDGE_API_TOKEN
    assert bool(result.get('error')) == (outcome != 'success')
    assert settings.BRIDGE_API_TOKEN not in str(result)


@pytest.mark.asyncio
@pytest.mark.parametrize('method', ['send_text_message', 'send_private_reply', 'reply_to_comment', 'get_account_profile'])
@pytest.mark.parametrize('outcome', ['expired_token', 'missing_permission', 'server_error', 'timeout'])
async def test_meta_error_contracts_are_sanitized(monkeypatch, caplog, method, outcome):
    token = 'synthetic-meta-secret-'+uuid4().hex
    original = httpx.AsyncClient
    calls = []
    def transport(request):
        calls.append(request)
        if outcome == 'timeout': raise httpx.ReadTimeout(token, request=request)
        return httpx.Response({'expired_token':401,'missing_permission':403,'server_error':500}[outcome], json={'error': token})
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs))
    client = InstagramClient(access_token=token)
    args = () if method == 'get_account_profile' else ('synthetic-provider-id', 'Synthetic')
    result = await getattr(client, method)(*args)
    assert result.get('error') and len(calls) == 1
    assert token not in str(calls[0].url)
    assert token not in str(result) and token not in caplog.text


@pytest.mark.asyncio
async def test_pending_success_failure_and_ai_handoff(workspace, monkeypatch):
    _, db, director, _, _ = workspace
    customer = Customer(name='Synthetic delivery', phone='00000')
    account = WhatsAppAccount(account_id=uuid4().hex, name='Synthetic account')
    db.add_all([customer, account])
    await db.flush()
    conv = Conversation(customer_id=customer.id, channel='whatsapp', whatsapp_account_id=account.id, mode='ai')
    conv.customer = customer
    db.add(conv)
    await db.commit()
    calls = []
    async def provider(self, phone, text, account_id=None):
        calls.append(account_id)
        assert await db.scalar(select(Message.status).where(Message.conversation_id == conv.id).order_by(Message.id.desc()).limit(1)) == 'pending'
        return {'message_id': uuid4().hex}
    monkeypatch.setattr(WhatsAppClient, 'send_text_message', provider)
    sent = await deliver(db, conv, 'Synthetic successful message', actor_id=director.id)
    assert sent.status == 'sent' and calls == [account.account_id]
    async def unavailable(*args, **kwargs):
        raise httpx.ReadTimeout('Synthetic timeout')
    monkeypatch.setattr(WhatsAppClient, 'send_text_message', unavailable)
    failed = await deliver(db, conv, 'Synthetic AI message', sender_type='ai')
    assert failed.status == 'failed' and conv.mode == 'human'
    assert failed.text == 'Synthetic AI message'


@pytest.mark.asyncio
async def test_concurrent_comment_to_dm_is_sent_once(workspace, monkeypatch, caplog):
    c, db, _, _, _ = workspace
    keyword = 'SYNTHETIC'+uuid4().hex
    comment_id = uuid4().hex
    db.add(AutomationTrigger(name='Synthetic concurrency', keyword=keyword, channel='INSTAGRAM', dm_reply_text='Synthetic reply'))
    await db.commit()
    calls = []
    async def private(self, comment_id, text):
        calls.append(comment_id)
        await asyncio.sleep(0.05)
        return {'message_id': 'synthetic-private-'+uuid4().hex}
    monkeypatch.setattr(InstagramClient, 'send_private_reply', private)
    async def independent_db():
        async with TestSessionLocal() as session:
            yield session
    app.dependency_overrides[get_db] = independent_db
    payload = {'object':'instagram','entry':[{'id':'synthetic','changes':[{'field':'comments','value':{
        'id':comment_id,'from':{'id':'synthetic-'+uuid4().hex,'username':'synthetic'},'text':keyword,'media':{'id':'synthetic'}}}]}]}
    results = await asyncio.gather(*(signed_post(c, '/webhooks/instagram', payload) for _ in range(4)))
    assert all(r.status_code == 200 for r in results)
    assert sum(r.json()['events_processed'] for r in results) == 1, [getattr(r, 'error_type', r.message) for r in caplog.records]
    assert calls == [comment_id]
    assert await db.scalar(select(func.count()).select_from(WebhookEvent).where(WebhookEvent.event_id == 'comment_'+comment_id)) == 1
    assert await db.scalar(select(WebhookEvent.status).where(WebhookEvent.event_id == 'comment_'+comment_id)) == 'processed'


@pytest.mark.asyncio
async def test_missing_provider_ids_have_no_message_side_effects(workspace):
    c, db, _, _, _ = workspace
    before = await db.scalar(select(func.count()).select_from(Message))
    payload = {'object':'instagram','entry':[{'id':'synthetic','messaging':[{
        'sender':{'id':'synthetic'},'recipient':{'id':'synthetic'},'message':{'text':'Synthetic without ID'}}]}]}
    r = await signed_post(c, '/webhooks/instagram', payload)
    assert r.status_code == 200 and r.json()['events_processed'] == 0
    account = WhatsAppAccount(account_id=uuid4().hex, name='Synthetic callback account')
    db.add(account)
    await db.commit()
    r = await c.post('/webhooks/whatsapp-bridge', headers={'Authorization':'Bearer '+settings.BRIDGE_WEBHOOK_TOKEN},
                     json={'account_id':account.account_id,'sender_phone':'00000','text':'Synthetic without ID'})
    assert r.status_code == 422
    assert await db.scalar(select(func.count()).select_from(Message)) == before


@pytest.mark.asyncio
async def test_duplicate_manual_requests_do_not_send_twice(workspace, monkeypatch):
    c, db, director, _, auth = workspace
    customer = Customer(name='Synthetic duplicate request', phone='00000')
    account = WhatsAppAccount(account_id=uuid4().hex, name='Synthetic account')
    db.add_all([customer, account])
    await db.flush()
    conv = Conversation(customer_id=customer.id, channel='whatsapp', whatsapp_account_id=account.id)
    db.add(conv)
    await db.commit()
    calls = []
    async def provider(*args, **kwargs):
        calls.append(kwargs['account_id'])
        await asyncio.sleep(0.05)
        return {'message_id': uuid4().hex}
    monkeypatch.setattr(WhatsAppClient, 'send_text_message', provider)
    async def independent_db():
        async with TestSessionLocal() as session:
            yield session
    app.dependency_overrides[get_db] = independent_db
    key = uuid4().hex
    path = f'/api/conversations/{conv.id}/messages'
    headers = {**auth(director), 'Idempotency-Key': key}
    results = await asyncio.gather(*(c.post(path, headers=headers, json={'text':'Synthetic repeated request'}) for _ in range(3)))
    assert all(r.status_code in (200,409) for r in results)
    assert any(r.status_code == 200 for r in results)
    repeated = await c.post(path, headers=headers, json={'text':'Synthetic repeated request'})
    assert repeated.status_code == 200 and repeated.json()['status'] == 'sent'
    assert calls == [account.account_id]
    assert await db.scalar(select(func.count()).select_from(Message).where(Message.conversation_id == conv.id)) == 1
    conflict = await c.post(path, headers=headers, json={'text':'Different synthetic text'})
    assert conflict.status_code == 409 and len(calls) == 1


@pytest.mark.asyncio
async def test_comment_provider_failure_is_recorded_as_failed(workspace, monkeypatch):
    c, db, _, _, _ = workspace
    keyword = 'SYNTHETIC'+uuid4().hex
    comment_id = uuid4().hex
    db.add(AutomationTrigger(name='Synthetic failure', keyword=keyword, channel='INSTAGRAM', dm_reply_text='Synthetic failed reply'))
    await db.commit()
    async def fail(*args, **kwargs): return {'error':'provider_rejected','status_code':403}
    monkeypatch.setattr(InstagramClient, 'send_private_reply', fail)
    payload = {'object':'instagram','entry':[{'id':'synthetic','changes':[{'field':'comments','value':{
        'id':comment_id,'from':{'id':'synthetic-'+uuid4().hex,'username':'synthetic'},'text':keyword,'media':{'id':'synthetic'}}}]}]}
    result = await signed_post(c, '/webhooks/instagram', payload)
    assert result.status_code == 200 and result.json()['events_processed'] == 1
    row = await db.scalar(select(Message).where(Message.text == 'Synthetic failed reply').order_by(Message.id.desc()))
    assert row and row.status == 'failed' and row.external_message_id is None
