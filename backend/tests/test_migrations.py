"""Fresh PostgreSQL databases only; legacy migration and real pg_dump/restore round trip."""

import asyncio, json, shutil, subprocess
from pathlib import Path
from uuid import uuid4
import asyncpg
import pytest
from alembic.config import Config
from alembic import command
from sqlalchemy.engine import make_url
from app.config import settings


@pytest.mark.asyncio
async def test_legacy_migration_and_backup_restore(tmp_path):
    url = make_url(settings.async_database_url)
    source = "insta_test_migration_" + uuid4().hex
    restored = "insta_test_restore_" + uuid4().hex

    def dsn(name):
        return url.set(drivername="postgresql", database=name).render_as_string(
            hide_password=False
        )

    admin = await asyncpg.connect(dsn("postgres"))
    connection = None
    try:
        for name in (source, restored):
            await admin.execute(f'CREATE DATABASE "{name}"')
        cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
        cfg.attributes["database_url"] = url.set(database=source).render_as_string(
            hide_password=False
        )
        await asyncio.to_thread(command.upgrade, cfg, "0001_existing")
        from sqlalchemy.ext.asyncio import create_async_engine
        from scripts.verify_baseline import verify

        validation_engine = create_async_engine(cfg.attributes["database_url"])
        async with validation_engine.connect() as checked:
            assert await checked.run_sync(verify) == []
        await validation_engine.dispose()
        connection = await asyncpg.connect(dsn(source))
        for uid, role in (
            (42, "admin"),
            (43, "lead_manager"),
            (44, "manager"),
            (45, "mentor"),
        ):
            await connection.execute(
                "INSERT INTO users (id,email,hashed_password,full_name,role,is_active) VALUES ($1,$2,$3,$4,$5,TRUE)",
                uid,
                f"fixture{uid}@example.test",
                "unused",
                "Synthetic employee",
                role,
            )
        await connection.execute(
            "INSERT INTO customers (id,name,tags,extra_data,role_type,preferred_language) VALUES (84,'Synthetic client','[]','{}','STUDENT','RU')"
        )
        await connection.execute(
            "INSERT INTO company_leads (customer_id,assigned_user_id,category,status,next_action) VALUES (84,43,'Synthetic','new','')"
        )
        await connection.execute(
            "INSERT INTO finance_categories (id,name) VALUES (90,'Synthetic category')"
        )
        await connection.execute(
            "INSERT INTO finance_transactions (id,category_id,kind,amount,currency,occurred_on,description,stage,recipient,created_by) VALUES (91,90,'income',100.10,'USD','2026-01-01','','','',42)"
        )
        await connection.execute(
            "INSERT INTO sellers (id,name,role,is_active) VALUES (92,'Synthetic seller','manager',TRUE)"
        )
        await connection.execute(
            "INSERT INTO seller_kpi_records (id,seller_id,period,punctuality,calls_meetings,sales,team_meetings,innovation,total_score) VALUES (93,92,'synthetic-week',10,40,50,10,50,160)"
        )
        await asyncio.to_thread(command.upgrade, cfg, "head")
        assert dict(
            await connection.fetch("SELECT id,role FROM users ORDER BY id")
        ) == {42: "director", 43: "head_of_sales", 44: "manager", 45: "mentor"}
        assert (
            str(
                await connection.fetchval(
                    "SELECT amount FROM finance_transactions WHERE id=91"
                )
            )
            == "100.10"
        )
        assert (
            await connection.fetchval(
                "SELECT total_score FROM seller_kpi_records WHERE id=93"
            )
            == 160
        )
        assert (
            await connection.fetchval(
                "SELECT user_id FROM lead_assignments WHERE customer_id=84"
            )
            == 43
        )
        assert (
            await connection.fetchval(
                "SELECT count(*) FROM audit_logs WHERE action='legacy_role_migrated'"
            )
            == 2
        )
        assert (
            await connection.fetchval("SELECT count(*) FROM student_assignments") == 0
        )
        dump = tmp_path / "synthetic.dump"
        if shutil.which("pg_dump") and shutil.which("pg_restore"):
            env = __import__("os").environ.copy()
            env["PGPASSWORD"] = url.password or ""
            base = [
                "-h",
                url.host or "localhost",
                "-p",
                str(url.port or 5432),
                "-U",
                url.username,
            ]
            dump_cmd = ["pg_dump", *base, "-Fc", source]
            restore_cmd = ["pg_restore", *base, "--exit-on-error", "-d", restored]
        else:
            env = None
            dump_cmd = [
                "docker",
                "exec",
                "insta_postgres",
                "pg_dump",
                "-U",
                url.username,
                "-Fc",
                source,
            ]
            restore_cmd = [
                "docker",
                "exec",
                "-i",
                "insta_postgres",
                "pg_restore",
                "-U",
                url.username,
                "--exit-on-error",
                "-d",
                restored,
            ]

        def roundtrip():
            with dump.open("wb") as stream:
                subprocess.run(
                    dump_cmd, stdout=stream, stderr=subprocess.PIPE, check=True, env=env
                )
            with dump.open("rb") as stream:
                subprocess.run(
                    restore_cmd,
                    stdin=stream,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    check=True,
                    env=env,
                )

        await asyncio.to_thread(roundtrip)
        clone = await asyncpg.connect(dsn(restored))
        try:
            assert (
                await clone.fetchval("SELECT version_num FROM alembic_version")
                == "0002_security"
            )
            assert (
                str(
                    await clone.fetchval(
                        "SELECT amount FROM finance_transactions WHERE id=91"
                    )
                )
                == "100.10"
            )
            assert (
                await clone.fetchval(
                    "SELECT total_score FROM seller_kpi_records WHERE id=93"
                )
                == 160
            )
            assert await clone.fetchval("SELECT count(*) FROM users") == 4
        finally:
            await clone.close()
        with pytest.raises(RuntimeError, match="Preserve assignment"):
            await asyncio.to_thread(command.downgrade, cfg, "0001_existing")
        assert (
            await connection.fetchval("SELECT version_num FROM alembic_version")
            == "0002_security"
        )
    finally:
        if connection:
            await connection.close()
        for name in (source, restored):
            assert name.startswith(("insta_test_migration_", "insta_test_restore_"))
            await admin.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')
        await admin.close()
