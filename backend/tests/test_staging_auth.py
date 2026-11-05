"""Iteration 01.5: real PostgreSQL / ASGI authentication, synthetic identities only."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import jwt
import pytest
from sqlalchemy import select, delete
from app.config import settings
from app.models import User, AuditLog
from app.modules.security.models import EmployeeInvitation, RateBucket
from app.security.jwt import create_access_token
from app.security.passwords import hash_password
from tests.test_company import workspace


@pytest.mark.asyncio
@pytest.mark.parametrize('mutation', ['expired', 'issuer', 'audience', 'missing_sub', 'missing_iat', 'missing_exp', 'missing_iss', 'missing_aud', 'signature', 'disabled'])
async def test_jwt_negative_matrix(workspace, mutation):
    c, db, director, _, auth = workspace
    payload = jwt.decode(create_access_token({'sub': str(director.id)}), settings.SECRET_KEY,
                         algorithms=['HS256'], audience=settings.JWT_AUDIENCE, issuer=settings.JWT_ISSUER)
    key = settings.SECRET_KEY
    if mutation == 'expired': payload['exp'] = int((datetime.now(timezone.utc)-timedelta(seconds=1)).timestamp())
    elif mutation == 'issuer': payload['iss'] = 'untrusted'
    elif mutation == 'audience': payload['aud'] = 'untrusted'
    elif mutation.startswith('missing_'): payload.pop(mutation.removeprefix('missing_'))
    elif mutation == 'signature': key = secrets.token_urlsafe(48)
    elif mutation == 'disabled':
        director.is_active = False
        await db.commit()
    token = jwt.encode(payload, key, algorithm='HS256')
    r = await c.get('/api/auth/me', headers={'Authorization': 'Bearer '+token})
    assert r.status_code == 401
    assert token not in r.text and key not in r.text


@pytest.mark.asyncio
async def test_invitation_expiration_invalid_token_and_sensitive_logs(workspace, caplog):
    c, db, director, _, auth = workspace
    await db.execute(delete(RateBucket))
    await db.commit()
    r = await c.post('/api/security/invitations', headers=auth(director), json={
        'email': uuid4().hex+'@example.test', 'full_name': 'Synthetic employee', 'role': 'manager'})
    assert r.status_code == 201
    token = r.json()['invitation_token']
    row = await db.scalar(select(EmployeeInvitation).where(EmployeeInvitation.user_id == r.json()['user_id']))
    assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert timedelta(hours=23, minutes=59) < row.expires_at-datetime.now(timezone.utc) <= timedelta(hours=24)
    # Move persisted expiry, no 24-hour wait and no clock-dependent sleeps.
    row.expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
    await db.commit()
    for supplied in (token, secrets.token_urlsafe(48)):
        result = await c.post('/api/auth/accept-invitation', json={'token': supplied, 'password': 'SyntheticPassword123!'})
        assert result.status_code == 400
        assert supplied not in result.text
    assert token not in caplog.text and 'SyntheticPassword123!' not in caplog.text


@pytest.mark.asyncio
async def test_reset_login_password_and_audit(workspace):
    c, db, director, _, auth = workspace
    await db.execute(delete(RateBucket))
    user = User(email=uuid4().hex+'@example.test', full_name='Synthetic login', role='manager',
                hashed_password=hash_password('OriginalSynthetic123!'))
    db.add(user)
    await db.commit()
    async def login(password):
        return await c.post('/api/auth/login', json={'email': user.email, 'password': password})
    initial = await login('OriginalSynthetic123!')
    assert initial.status_code == 200
    old = initial.json()['access_token']
    assert (await login('IncorrectSynthetic123!')).status_code == 401
    r = await c.post(f'/api/security/users/{user.id}/password-reset', headers=auth(director))
    token = r.json()['invitation_token']
    data = {'token': token, 'password': 'ReplacementSynthetic123!'}
    assert (await c.post('/api/auth/accept-invitation', json=data)).status_code == 200
    assert (await c.post('/api/auth/accept-invitation', json=data)).status_code == 400
    assert (await c.get('/api/auth/me', headers={'Authorization': 'Bearer '+old})).status_code == 401
    assert (await login('OriginalSynthetic123!')).status_code == 401
    assert (await login('ReplacementSynthetic123!')).status_code == 200
    user.is_active = False
    await db.commit()
    assert (await login('ReplacementSynthetic123!')).status_code == 401
    actions = set((await db.scalars(select(AuditLog.action).where(AuditLog.user_id == user.id))).all())
    assert {'login_success', 'password_set'} <= actions
    assert await db.scalar(select(AuditLog.id).where(AuditLog.entity_id == user.id, AuditLog.action == 'invitation_created'))
    assert (await c.post('/api/auth/bootstrap', json={})).status_code in (401, 404)


@pytest.mark.asyncio
async def test_bootstrap_refuses_nonempty_installation(workspace, monkeypatch, capsys):
    from app.modules.security import bootstrap
    from tests.conftest import TestSessionLocal
    monkeypatch.setattr(bootstrap, 'AsyncSessionLocal', TestSessionLocal)
    with pytest.raises(SystemExit, match='Existing users found'):
        await bootstrap.main('synthetic-director@example.test', 'Synthetic Director')
    assert capsys.readouterr().out == ''


@pytest.mark.asyncio
@pytest.mark.parametrize('path,method,body', [
    ('/api/customers/not-an-id', 'get', None),
    ('/api/company/students/bad', 'get', None),
    ('/api/deals', 'post', {'customer_id': 'invalid'}),
    ('/api/bookings', 'post', ['invalid']),
])
async def test_invalid_requests_do_not_crash_authorization(workspace, path, method, body):
    c, _, director, _, auth = workspace
    r = await c.request(method, path, headers=auth(director), **({'json': body} if body is not None else {}))
    assert r.status_code == 422, r.text
