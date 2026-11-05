import hashlib, hmac, json
from uuid import uuid4
import pytest
import httpx
from sqlalchemy import select, func
from app.main import app
from app.models import (
    User,
    Customer,
    Conversation,
    Message,
    EnrolledStudent,
    WhatsAppAccount,
)
from app.models.company import LeadRecord, StudentDocument
from app.modules.security.models import (
    StudentAssignment,
    Team,
    TeamMember,
    UserPermission,
    EmployeeInvitation,
)
from app.core.permissions import load_permissions, has, ROLES
from app.config import settings, Settings
from app.integrations.whatsapp.client import WhatsAppClient
from app.security.jwt import create_access_token
from tests.test_company import workspace


async def employee(db, role):
    user = User(
        email=f"{uuid4().hex}@example.test",
        full_name="Synthetic employee",
        role=role,
        hashed_password="unused",
    )
    db.add(user)
    await db.commit()
    return user


@pytest.mark.asyncio
async def test_six_role_grants_are_least_privilege(workspace):
    _, db, _, _, _ = workspace
    for role in ROLES:
        user = await employee(db, role)
        await load_permissions(db, user)
        if role in ("head_of_sales", "manager", "mentor", "operations_director"):
            assert not has(
                user, "finance.read", "salaries.read", "communication.manage_accounts"
            )
        if role == "finance_manager":
            assert not has(
                user,
                "communication.manage_accounts",
                "student_documents.read_all",
                "student_documents.read_assigned",
            )
        if role == "director":
            assert has(user, "roles.manage") and has(user, "salaries.manage")


@pytest.mark.asyncio
async def test_manager_cannot_read_or_change_another_lead(workspace):
    c, db, director, manager, auth = workspace
    other = await employee(db, "manager")
    r = await c.post(
        "/api/company/leads",
        headers=auth(director),
        json={"name": "Other client", "assigned_user_id": other.id},
    )
    cid = r.json()["customer"]["id"]
    for path in (f"/api/customers/{cid}", f"/api/students/{cid}/profile"):
        assert (await c.get(path, headers=auth(manager))).status_code == 404
    assert (
        await c.patch(
            f"/api/customers/{cid}", headers=auth(manager), json={"name": "Attack"}
        )
    ).status_code == 404
    assert (
        await c.put(
            f"/api/company/leads/{cid}",
            headers=auth(manager),
            json={"assigned_user_id": manager.id},
        )
    ).status_code == 404
    assert all(
        row["customer"]["id"] != cid
        for row in (await c.get("/api/company/leads", headers=auth(manager))).json()[
            "items"
        ]
    )


@pytest.mark.asyncio
async def test_unbound_manager_cannot_read_or_mutate_conversations(workspace):
    c, db, _, manager, auth = workspace
    customer = Customer(name="Synthetic chat")
    db.add(customer)
    await db.flush()
    conv = Conversation(customer_id=customer.id, channel="instagram")
    db.add(conv)
    await db.commit()
    for suffix in ("", "/messages"):
        assert (
            await c.get(f"/api/conversations/{conv.id}{suffix}", headers=auth(manager))
        ).status_code == 404
    assert (
        await c.patch(
            f"/api/conversations/{conv.id}/mode",
            headers=auth(manager),
            json={"mode": "human"},
        )
    ).status_code == 404
    assert (
        await c.post(
            f"/api/conversations/{conv.id}/messages",
            headers=auth(manager),
            json={"text": "Attack"},
        )
    ).status_code == 404
    assert (await c.get("/api/conversations", headers=auth(manager))).json() == []


@pytest.mark.asyncio
async def test_mentor_document_scope_and_private_files(workspace):
    c, db, director, _, auth = workspace
    mentor = await employee(db, "mentor")
    other = await employee(db, "mentor")
    student = EnrolledStudent(full_name="Synthetic student", country="Китай")
    db.add(student)
    await db.flush()
    db.add(StudentAssignment(student_id=student.id, user_id=mentor.id))
    await db.commit()
    r = await c.post(
        f"/api/company/students/{student.id}/documents?name=passport.pdf",
        headers={**auth(director), "Content-Type": "application/pdf"},
        content=b"%PDF-1.4\nfixture\n%%EOF",
    )
    assert r.status_code == 201, r.text
    docid = r.json()["id"]
    assert (
        await c.get(f"/api/company/documents/{docid}/download", headers=auth(mentor))
    ).status_code == 200
    assert (
        await c.get(f"/api/company/documents/{docid}/download", headers=auth(other))
    ).status_code == 404
    assert (
        await c.patch(
            f"/api/company/documents/{docid}",
            headers=auth(other),
            json={"status": "accepted"},
        )
    ).status_code == 404
    assert (await c.get("/uploads/private.pdf")).status_code == 404
    r = await c.post(
        f"/api/company/students/{student.id}/documents?name=forged.pdf",
        headers={**auth(mentor), "Content-Type": "application/pdf"},
        content=b"<script>alert(1)</script>",
    )
    assert r.status_code == 415
    own = (
        await c.get(f"/api/company/students/{student.id}", headers=auth(mentor))
    ).json()
    assert own["student"]["contract_amount"] is None and own["transactions"] == []


@pytest.mark.asyncio
async def test_head_of_sales_cannot_read_finance_or_global_ai(workspace):
    c, db, _, _, auth = workspace
    rop = await employee(db, "head_of_sales")
    finance = await employee(db, "finance_manager")
    assert (
        await c.get("/api/company/finance/report", headers=auth(rop))
    ).status_code == 403
    assert (
        await c.post(
            "/api/conversations/global-ai", headers=auth(rop), json={"mode": "human"}
        )
    ).status_code == 403
    assert (
        await c.get("/api/whatsapp/accounts", headers=auth(finance))
    ).status_code == 403
    assert (
        await c.get("/api/company/finance/report", headers=auth(finance))
    ).status_code == 200


@pytest.mark.asyncio
async def test_university_mutation_requires_permission(workspace):
    c, db, _, manager, auth = workspace
    ops = await employee(db, "operations_director")
    payload = {
        "university": "Synthetic University",
        "faculty": "IT",
        "program_name": "CS",
        "program_name_ru": "Информатика",
    }
    assert (
        await c.post("/api/programs", headers=auth(manager), json=payload)
    ).status_code == 403
    r = await c.post("/api/programs", headers=auth(ops), json=payload)
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_team_scope_does_not_expose_other_teams(workspace):
    c, db, director, manager, auth = workspace
    rop = await employee(db, "head_of_sales")
    outside = await employee(db, "manager")
    team = Team(name=uuid4().hex)
    db.add(team)
    await db.flush()
    db.add_all([TeamMember(team_id=team.id, user_id=u.id) for u in (rop, manager)])
    await db.commit()
    owned = []
    for owner in (manager, outside):
        row = (
            await c.post(
                "/api/company/leads",
                headers=auth(director),
                json={"name": "Team test", "assigned_user_id": owner.id},
            )
        ).json()
        owned.append(row["customer"]["id"])
    rows = (await c.get("/api/company/leads", headers=auth(rop))).json()["items"]
    assert owned[0] in [r["customer"]["id"] for r in rows] and owned[1] not in [
        r["customer"]["id"] for r in rows
    ]
    assert (
        await c.put(
            f"/api/company/leads/{owned[0]}",
            headers=auth(rop),
            json={"assigned_user_id": outside.id},
        )
    ).status_code == 403


@pytest.mark.asyncio
async def test_missing_and_invalid_webhook_credentials_fail_closed(workspace):
    c, db, _, _, _ = workspace
    before = await db.scalar(select(func.count()).select_from(Message))
    for path in (
        "/webhooks/instagram",
        "/api/webhooks/instagram",
        "/webhooks/whatsapp",
    ):
        assert (await c.post(path, json={})).status_code == 403
        assert (
            await c.post(
                path, json={}, headers={"X-Hub-Signature-256": "sha256=invalid"}
            )
        ).status_code == 403
    payload = {
        "account_id": "account_1",
        "message_id": uuid4().hex,
        "text": "Synthetic message",
    }
    assert (await c.post("/webhooks/whatsapp-bridge", json=payload)).status_code == 401
    assert await db.scalar(select(func.count()).select_from(Message)) == before


@pytest.mark.asyncio
async def test_whatsapp_bridge_failure_never_calls_cloud_or_other_account(monkeypatch):
    calls = []

    def transport(request):
        calls.append(request)
        return httpx.Response(503, json={"error": "not connected"})

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs),
    )
    result = await WhatsAppClient(
        access_token="synthetic-cloud-token"
    ).send_text_message("00000", "Synthetic text", account_id="account_1")
    assert result.get("error") and len(calls) == 1
    assert (
        calls[0].url.path == "/send"
        and json.loads(calls[0].content)["account_id"] == "account_1"
    )
    assert (await WhatsAppClient().send_text_message("00000", "Synthetic text")).get(
        "error"
    )
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_failed_manual_delivery_is_persisted(workspace, monkeypatch):
    c, db, director, _, auth = workspace
    account = WhatsAppAccount(account_id=uuid4().hex, name="Unavailable fixture")
    customer = Customer(name="Synthetic recipient", phone="00000")
    db.add_all([account, customer])
    await db.flush()
    conv = Conversation(
        customer_id=customer.id, channel="whatsapp", whatsapp_account_id=account.id
    )
    db.add(conv)
    await db.commit()

    async def fail(*args, **kwargs):
        return {"error": "unavailable"}

    monkeypatch.setattr(WhatsAppClient, "send_text_message", fail)
    r = await c.post(
        f"/api/conversations/{conv.id}/messages",
        headers=auth(director),
        json={"text": "Synthetic message"},
    )
    assert r.status_code == 200 and r.json()["status"] == "failed", r.text
    assert (await db.get(Message, r.json()["id"])).status == "failed"


@pytest.mark.asyncio
async def test_invitation_single_use_and_password_reset_revokes_session(workspace):
    c, db, director, _, auth = workspace
    r = await c.post(
        "/api/security/invitations",
        headers=auth(director),
        json={
            "email": f"{uuid4().hex}@example.test",
            "full_name": "Synthetic invitee",
            "role": "mentor",
        },
    )
    assert r.status_code == 201, r.text
    token = r.json()["invitation_token"]
    uid = r.json()["user_id"]
    row = await db.scalar(
        select(EmployeeInvitation).where(EmployeeInvitation.user_id == uid)
    )
    assert row.token_hash != token
    r = await c.post(
        "/api/auth/accept-invitation",
        json={"token": token, "password": "SyntheticPassword123!"},
    )
    assert r.status_code == 200, r.text
    assert (
        await c.post(
            "/api/auth/accept-invitation",
            json={"token": token, "password": "SyntheticPassword123!"},
        )
    ).status_code == 400
    user = await db.get(User, uid)
    old = create_access_token({"sub": str(uid), "session_version": user.token_version})
    reset = (
        await c.post(
            f"/api/security/users/{uid}/password-reset", headers=auth(director)
        )
    ).json()["invitation_token"]
    assert (
        await c.post(
            "/api/auth/accept-invitation",
            json={"token": reset, "password": "AnotherSynthetic123!"},
        )
    ).status_code == 200
    assert (
        await c.get("/api/auth/me", headers={"Authorization": "Bearer " + old})
    ).status_code == 401


@pytest.mark.asyncio
async def test_malformed_jwt_subject_is_unauthorized(workspace):
    c, _, _, _, _ = workspace
    for sub in ("not-a-number", "-1"):
        r = await c.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer " + create_access_token({"sub": sub})},
        )
        assert r.status_code == 401


@pytest.mark.parametrize(
    "patch",
    [
        {"DEBUG": True},
        {"SECRET_KEY": "change_this"},
        {"ALLOWED_ORIGINS": "*"},
        {"BRIDGE_API_TOKEN": ""},
        {"BOOTSTRAP_ENABLED": True},
    ],
)
def test_production_rejects_unsafe_configuration(patch):
    values = {
        "DATABASE_URL": "postgresql+asyncpg://test:synthetic-test-password@127.0.0.1/insta_test_config",
        "ENVIRONMENT": "production",
        "DEBUG": False,
        "SECRET_KEY": "x" * 48,
        "BRIDGE_API_TOKEN": "a" * 48,
        "BRIDGE_WEBHOOK_TOKEN": "b" * 48,
        "ALLOWED_ORIGINS": "https://example.test",
        "META_ACCESS_TOKEN": "",
        "WHATSAPP_ACCESS_TOKEN": "",
    }
    with pytest.raises(ValueError):
        Settings(_env_file=None, **{**values, **patch})


def test_all_existing_api_routes_have_explicit_permission_policy():
    from app.core.authorization import policy

    for path, operations in app.openapi()["paths"].items():
        if (
            not path.startswith("/api/")
            or path.startswith("/api/webhooks/")
            or path in ("/api/health", "/api/auth/login", "/api/auth/accept-invitation")
        ):
            continue
        for method in operations:
            if method.upper() in ("GET", "POST", "PUT", "PATCH", "DELETE"):
                assert policy(path, method.upper()) != (), (path, method)


@pytest.mark.asyncio
async def test_login_rate_limit_is_enforced(workspace):
    c, _, _, _, _ = workspace
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app, client=("synthetic-rate-peer", 1234)),
        base_url="http://test",
    ) as isolated:
        for _ in range(10):
            r = await isolated.post(
                "/api/auth/login",
                json={"email": "absent@example.test", "password": "incorrect"},
            )
            assert r.status_code == 401
        assert (
            await isolated.post(
                "/api/auth/login",
                json={"email": "absent@example.test", "password": "incorrect"},
            )
        ).status_code == 429


@pytest.mark.asyncio
async def test_comment_to_dm_is_preserved_and_sequentially_idempotent(
    workspace, monkeypatch
):
    c, db, _, _, _ = workspace
    from app.models.automation import AutomationTrigger
    from app.integrations.instagram.client import InstagramClient

    keyword = "SYNTHETIC" + uuid4().hex
    db.add(
        AutomationTrigger(
            name="Synthetic comment rule",
            keyword=keyword,
            channel="INSTAGRAM",
            dm_reply_text="Synthetic private reply",
        )
    )
    await db.commit()
    calls = []

    async def private(self, comment_id, text):
        calls.append(comment_id)
        return {"message_id": "synthetic-reply-" + uuid4().hex}

    monkeypatch.setattr(InstagramClient, "send_private_reply", private)
    commentid = uuid4().hex
    payload = {
        "object": "instagram",
        "entry": [
            {
                "id": "synthetic-page",
                "changes": [
                    {
                        "field": "comments",
                        "value": {
                            "id": commentid,
                            "from": {
                                "id": "synthetic-" + uuid4().hex,
                                "username": "synthetic",
                            },
                            "text": keyword,
                            "media": {"id": "synthetic-media"},
                        },
                    }
                ],
            }
        ],
    }
    body = json.dumps(payload).encode()
    sig = (
        "sha256="
        + hmac.new(settings.META_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    )
    for _ in range(2):
        r = await c.post(
            "/webhooks/instagram",
            content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig},
        )
        assert r.status_code == 200, r.text
    assert calls == [commentid]


@pytest.mark.asyncio
async def test_upload_body_size_rejected_before_spooling(workspace):
    c, _, director, _, auth = workspace
    r = await c.post(
        "/api/automations/upload-attachment",
        headers={
            **auth(director),
            "Content-Type": "application/octet-stream",
            "Content-Length": str(12 * 1024 * 1024),
        },
        content=b"fixture",
    )
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_empty_bridge_request_still_requires_authentication(workspace):
    c, _, _, _, _ = workspace
    assert (await c.post("/webhooks/whatsapp-bridge", json={})).status_code == 401


@pytest.mark.asyncio
async def test_bridge_provider_cannot_confirm_a_different_account(monkeypatch):
    original = httpx.AsyncClient

    def transport(request):
        return httpx.Response(
            200,
            json={
                "session_id": "account_2",
                "message_id": "synthetic-id",
                "success": True,
            },
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs),
    )
    result = await WhatsAppClient().send_text_message(
        "00000", "Synthetic text", account_id="account_1"
    )
    assert result.get("error") == "provider_account_mismatch"


def test_explicit_safe_production_configuration_is_accepted():
    configuration = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DEBUG=False,
        SECRET_KEY="s" * 48,
        BRIDGE_API_TOKEN="a" * 48,
        BRIDGE_WEBHOOK_TOKEN="b" * 48,
        ALLOWED_ORIGINS="https://example.test",
        META_ACCESS_TOKEN="",
        WHATSAPP_ACCESS_TOKEN="",
        DATABASE_URL="postgresql+asyncpg://test:synthetic-test-password@127.0.0.1/insta_test_config",
    )
    assert configuration.cors_origins == ["https://example.test"]


@pytest.mark.asyncio
async def test_graph_profile_tokens_are_not_placed_in_request_urls(monkeypatch):
    from app.integrations.instagram.client import InstagramClient

    calls = []
    original = httpx.AsyncClient

    def transport(request):
        calls.append(request)
        return httpx.Response(200, json={"id": "synthetic-user", "name": "Synthetic"})

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(transport), **kwargs),
    )
    client = InstagramClient(access_token="synthetic-profile-token")
    await client.get_account_profile()
    await client.get_user_profile("synthetic-user")
    assert len(calls) == 2
    assert all("access_token" not in str(request.url) for request in calls)
    assert all(
        request.headers["Authorization"] == "Bearer synthetic-profile-token"
        for request in calls
    )
