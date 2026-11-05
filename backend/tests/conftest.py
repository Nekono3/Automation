import pytest
import os
import secrets
import asyncio
import re
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool
from sqlalchemy.engine import make_url

from app.config import settings
# Never run application integration tests against the configured CRM database.
# Set before importing app.database so API requests also use this isolated database.
settings.DATABASE_URL = os.environ.get("TEST_DATABASE_URL") or make_url(
    settings.async_database_url
).set(database="insta_upgrade_test").render_as_string(hide_password=False)
if not re.search(r"(^test_|_test$|^insta_test_|^insta_upgrade_test$)",make_url(settings.DATABASE_URL).database or ""):
    raise RuntimeError("TEST_DATABASE_URL must point to a dedicated test database")
settings.DEBUG = False
settings.SECRET_KEY = secrets.token_urlsafe(48)
settings.ENVIRONMENT = "testing"
settings.FIRST_ADMIN_PASSWORD = secrets.token_urlsafe(24)
settings.WHATSAPP_PHONE_NUMBER_ID = "synthetic-phone-id"
settings.META_APP_SECRET = secrets.token_urlsafe(32)
settings.BRIDGE_API_TOKEN = secrets.token_urlsafe(32)
settings.BRIDGE_WEBHOOK_TOKEN = secrets.token_urlsafe(32)
settings.META_ACCESS_TOKEN = ""
settings.WHATSAPP_ACCESS_TOKEN = ""
settings.MISTRAL_API_KEY = ""
from app.database import Base


test_engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


@pytest.fixture(scope="session", autouse=True)
async def init_test_db():
    from alembic.config import Config
    from alembic import command
    from pathlib import Path
    from sqlalchemy import inspect
    from scripts.verify_baseline import verify
    cfg=Config(str(Path(__file__).parents[1]/'alembic.ini'))
    cfg.attributes['database_url']=settings.async_database_url
    async with test_engine.connect() as conn:
        names=await conn.run_sync(lambda c:inspect(c).get_table_names())
        if names and 'alembic_version' not in names:
            problems=await conn.run_sync(verify)
            if problems:raise RuntimeError('Test baseline mismatch: '+str(problems))
    if names and 'alembic_version' not in names:
        await asyncio.to_thread(command.stamp,cfg,'0001_existing')
    await asyncio.to_thread(command.upgrade,cfg,'head')
    from app.models import User
    from app.security.passwords import hash_password
    from sqlalchemy import select
    async with TestSessionLocal() as session:
        from sqlalchemy import delete
        from app.modules.security.models import RateBucket
        await session.execute(delete(RateBucket))
        await session.commit()
        admin = await session.scalar(select(User).where(User.email == settings.FIRST_ADMIN_EMAIL.lower()))
        if admin is not None:
            admin.hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD)
            await session.commit()
        if admin is None:
            session.add(User(email=settings.FIRST_ADMIN_EMAIL.lower(), full_name="Test Administrator",
                             hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD), role="director"))
            await session.commit()
    yield
    await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
def no_external_provider_requests(monkeypatch):
    import httpx
    original=httpx.AsyncClient.send
    async def isolated(self,request,*args,**kwargs):
        if not isinstance(self._transport,(httpx.ASGITransport,httpx.MockTransport)):
            raise RuntimeError('External provider requests forbidden in tests')
        return await original(self,request,*args,**kwargs)
    monkeypatch.setattr(httpx.AsyncClient,'send',isolated)
