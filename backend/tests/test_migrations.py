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
async def test_legacy_migration_and_backup_restore(tmp_path, monkeypatch):
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
        # Emulate an unstamped legacy installation, not an already-versioned DB.
        legacy = await asyncpg.connect(dsn(source))
        await legacy.execute('DROP TABLE alembic_version')
        await legacy.close()
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from sqlalchemy import inspect, select

        from scripts.verify_baseline import verify

        validation_engine = create_async_engine(cfg.attributes["database_url"])
        async with validation_engine.connect() as checked:
            assert await checked.run_sync(verify) == []
            assert 'alembic_version' not in await checked.run_sync(lambda c: inspect(c).get_table_names())
            # A genuinely mismatched legacy schema must fail verification before stamp.
            from sqlalchemy import text
            nested = await checked.begin_nested()
            await checked.execute(text('ALTER TABLE customers ALTER COLUMN name TYPE TEXT'))
            assert any('customers.name' in problem for problem in await checked.run_sync(verify))
            await nested.rollback()
            assert await checked.run_sync(verify) == []
        # Stamp ONLY after the above read-only verification has passed.
        await asyncio.to_thread(command.stamp, cfg, "0001_existing")
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
        from app.models import Deal, EnrolledStudent, WhatsAppAccount, Conversation, Message
        from app.models.company import AdmissionLink, StudentDocument
        fixture_engine = create_async_engine(cfg.attributes['database_url'])
        async with async_sessionmaker(fixture_engine, expire_on_commit=False)() as session:
            session.add_all([
                Deal(id=85, title='Synthetic legacy deal', customer_id=84, assigned_user_id=44, pipeline_type='SALES', stage='CONTRACT_SIGNED', amount=1234.50, currency='USD'),
                EnrolledStudent(id=86, full_name='Synthetic legacy student', country='Synthetic', manager='Synthetic employee', contract_amount='1234.50 USD', paid_amount='100.10 USD'),
                WhatsAppAccount(id=88, account_id='account_1', name='Synthetic legacy account'),
            ])
            await session.flush()
            session.add_all([
                AdmissionLink(id=87, student_id=86, customer_id=84, deal_id=85, manager_id=44),
                Conversation(id=89, customer_id=84, channel='whatsapp', whatsapp_account_id=88),
            ])
            await session.flush()
            session.add(Message(id=94, conversation_id=89, customer_id=84, channel='whatsapp', direction='inbound', sender_type='customer', text='Synthetic legacy message', external_message_id='synthetic-legacy-message', status='received'))
            session.add(StudentDocument(id=95, student_id=86, name='synthetic.pdf', storage_key='synthetic-legacy-document', content_type='application/pdf', size=len(b'%PDF-1.4\nfixture\n%%EOF'), uploaded_by=44))
            await session.commit()
        await fixture_engine.dispose()
        await connection.execute('UPDATE users SET whatsapp_account_id=88 WHERE id=44')
        history_tables = ['customers','company_leads','deals','enrolled_students','company_admissions','whatsapp_accounts','conversations','messages','finance_categories','finance_transactions','sellers','seller_kpi_records','student_documents']
        async def snapshot(conn):
            return {table: [tuple(row) for row in await conn.fetch(f'SELECT * FROM "{table}" ORDER BY id')] for table in history_tables}
        original = await snapshot(connection)
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
        assert await snapshot(connection) == original
        assert await connection.fetchval('SELECT user_id FROM conversation_assignments WHERE conversation_id=89') == 44
        assert await connection.fetchval('SELECT count(*) FROM users WHERE token_version=0') == 4
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
                __import__("os").environ.get("PG_TEST_CONTAINER", "insta_postgres"),
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
                __import__("os").environ.get("PG_TEST_CONTAINER", "insta_postgres"),
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
        # Independent private-file backup/restore accompanies the database dump.
        import tarfile
        source_files = tmp_path / 'source_documents'
        source_files.mkdir()
        fixture_content = b'%PDF-1.4\nfixture\n%%EOF'
        (source_files / 'synthetic-legacy-document').write_bytes(fixture_content)
        file_backup = tmp_path / 'synthetic_documents.tar'
        with tarfile.open(file_backup, 'w') as archive:
            archive.add(source_files / 'synthetic-legacy-document', arcname='synthetic-legacy-document')
        restored_files = tmp_path / 'restored_documents'
        restored_files.mkdir()
        with tarfile.open(file_backup) as archive:
            archive.extractall(restored_files, filter='data')
        assert (restored_files / 'synthetic-legacy-document').read_bytes() == fixture_content
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
            assert await snapshot(clone) == original
            assert await clone.fetchval("SELECT size FROM student_documents WHERE id=95") == len((restored_files / 'synthetic-legacy-document').read_bytes())
            for query in (
                'SELECT count(*) FROM deals d LEFT JOIN customers c ON c.id=d.customer_id WHERE c.id IS NULL',
                'SELECT count(*) FROM messages m LEFT JOIN conversations c ON c.id=m.conversation_id WHERE c.id IS NULL',
                'SELECT count(*) FROM company_admissions a LEFT JOIN enrolled_students s ON s.id=a.student_id WHERE s.id IS NULL',
                'SELECT count(*) FROM finance_transactions t LEFT JOIN finance_categories c ON c.id=t.category_id WHERE c.id IS NULL',
            ):
                assert await clone.fetchval(query) == 0
            restored_engine = create_async_engine(url.set(database=restored).render_as_string(hide_password=False))
            async with async_sessionmaker(restored_engine)() as session:
                assert await session.scalar(select(EnrolledStudent.id).where(EnrolledStudent.id == 86)) == 86
                assert await session.scalar(select(Message.text).where(Message.id == 94)) == 'Synthetic legacy message'
            import app.main as application
            monkeypatch.setattr(application, 'engine', restored_engine)
            async with application.lifespan(application.app):
                pass  # Real backend startup/revision check against restored PostgreSQL.
            restore_cfg = Config(str(Path(__file__).parents[1] / 'alembic.ini'))
            restore_cfg.attributes['database_url'] = url.set(database=restored).render_as_string(hide_password=False)
            await asyncio.to_thread(command.upgrade, restore_cfg, 'head')
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
