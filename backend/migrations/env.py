import asyncio
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from app.config import settings
from app.database import Base
import app.models

config = context.config
target_metadata = Base.metadata


def migrate(connection):
    context.configure(
        connection=connection, target_metadata=target_metadata, compare_type=True
    )
    with context.begin_transaction():
        context.run_migrations()


async def online():
    engine = create_async_engine(
        config.attributes.get("database_url") or settings.async_database_url,
        poolclass=NullPool,
        hide_parameters=True,
    )
    async with engine.connect() as conn:
        await conn.run_sync(migrate)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(
        url=config.attributes.get("database_url") or settings.async_database_url,
        literal_binds=True,
        target_metadata=target_metadata,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(online())
