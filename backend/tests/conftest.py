import pytest
import os
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
if "test" not in (make_url(settings.DATABASE_URL).database or ""):
    raise RuntimeError("TEST_DATABASE_URL must point to a dedicated test database")
settings.DEBUG = False
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
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from app.models import User
    from app.security.passwords import hash_password
    from sqlalchemy import select
    async with TestSessionLocal() as session:
        admin = await session.scalar(select(User).where(User.email == settings.FIRST_ADMIN_EMAIL.lower()))
        if admin is None:
            session.add(User(email=settings.FIRST_ADMIN_EMAIL.lower(), full_name="Test Administrator",
                             hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD), role="admin"))
            await session.commit()
    yield
    await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session
