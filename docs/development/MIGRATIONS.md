# Controlled migrations

All commands run from backend using the intended environment/database. Never run development scripts against production. Back up data and files and verify restoration on an isolated resource first.

For a **new empty database**:

```bash
.venv/bin/alembic upgrade head
```

For an existing 25-table deployment without alembic_version:

1. Take schema/data/file backups. Restore into isolated staging; do not point tests at production.
2. Run `.venv/bin/python -m scripts.verify_baseline` against the copy. It reads schema metadata only and performs **no stamp**. Review all mismatches and unmodeled additions. A mismatch blocks stamping.
3. Only after review, on the staging copy: `.venv/bin/alembic stamp 0001_existing`, then `.venv/bin/alembic upgrade head`.
4. Compare IDs, financial amounts, original KPI scores and record counts. Review role-migration audits. Establish teams/mentor assignments explicitly; names are not identity keys.
5. Test application authorization, session policy and provider account mapping before approving production rollout. Production migration/stamp requires a separately approved release window and verified recovery plan.

0001 contains frozen DDL, not mutable model.create_all. 0002 contains frozen grants/additive DDL, explicit role backfill, token versioning and assignment history. No existing business table/record is dropped. Ordinary app startup checks alembic_version and fails closed when migration is needed; it neither creates tables nor downloads spreadsheets.

Destructive downgrade is intentionally refused. Roll back to compatible code while retaining additive data, or restore a verified backup under a recovery plan. A code rollback to the pre-security version reintroduces its known vulnerabilities and cannot be advertised as a secure fallback.
