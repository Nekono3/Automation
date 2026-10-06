import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService


@pytest.mark.asyncio
async def test_meta_webhook_verification():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        challenge_code = "1158201444"

        # 1. Valid verification challenge
        resp = await client.get(
            "/webhooks/instagram",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": challenge_code,
                "hub.verify_token": settings.WEBHOOK_VERIFY_TOKEN,
            },
        )
        assert resp.status_code == 200
        assert resp.text == challenge_code

        # 2. Invalid verify token
        bad_resp = await client.get(
            "/webhooks/instagram",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": challenge_code,
                "hub.verify_token": "wrong_token",
            },
        )
        assert bad_resp.status_code == 403


@pytest.mark.asyncio
async def test_meta_webhook_message_event_and_idempotency(db_session):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        customer_ig_id = f"cust_ig_{uuid.uuid4().hex[:8]}"
        message_mid = f"mid_test_{uuid.uuid4().hex}"
        page_id = "17841400000000000"

        payload = {
            "object": "instagram",
            "entry": [
                {
                    "id": page_id,
                    "time": 1728230000000,
                    "messaging": [
                        {
                            "sender": {"id": customer_ig_id},
                            "recipient": {"id": page_id},
                            "timestamp": 1728230000000,
                            "message": {
                                "mid": message_mid,
                                "text": "Здравствуйте! Сколько стоит первичная консультация?",
                            },
                        }
                    ],
                }
            ],
        }

        # First delivery of webhook event
        resp1 = await client.post("/webhooks/instagram", json=payload)
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["status"] == "ok"
        assert data1["events_processed"] == 1

        # Verify customer was created
        cust = await CustomerService.get_by_instagram_id(db_session, customer_ig_id)
        assert cust is not None

        # Verify conversation was created
        conv, _ = await ConversationService.get_or_create_conversation(db_session, customer_id=cust.id)
        assert conv is not None

        # Redelivery of same webhook event (Meta retry simulation)
        resp2 = await client.post("/webhooks/instagram", json=payload)
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["status"] == "ok"
        assert data2["events_processed"] == 0  # Deduplicated!
