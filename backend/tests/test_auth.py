import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.services.user_service import UserService


@pytest.mark.asyncio
async def test_auth_login_and_me_flow(db_session):
    # Ensure admin exists
    await UserService.seed_initial_admin(db_session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Successful Login
        login_resp = await client.post(
            "/api/auth/login",
            json={
                "email": settings.FIRST_ADMIN_EMAIL,
                "password": settings.FIRST_ADMIN_PASSWORD,
            },
        )
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        assert "access_token" in token_data
        token = token_data["access_token"]

        # 2. Access /api/auth/me with Bearer token
        me_resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        user_info = me_resp.json()
        assert user_info["email"] == settings.FIRST_ADMIN_EMAIL.lower()
        assert user_info["role"] == "admin"

        # 3. Bad password login
        bad_resp = await client.post(
            "/api/auth/login",
            json={
                "email": settings.FIRST_ADMIN_EMAIL,
                "password": "WrongPassword!",
            },
        )
        assert bad_resp.status_code == 401

        # 4. Unauthenticated access
        unauth_resp = await client.get("/api/auth/me")
        assert unauth_resp.status_code == 401
