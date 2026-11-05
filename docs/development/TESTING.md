# Verification and limits

Baseline before modification: `.venv/bin/pytest -q --tb=short` — **22 passed** on isolated local PostgreSQL. Do not interpret results from the earlier deployment as verification of this security iteration.

Run from backend:

```bash
.venv/bin/pytest -q --tb=short
```

Tests force a dedicated database name (`insta_upgrade_test` or an approved test-pattern name), clear external-provider credentials, sign synthetic webhook payloads and block real provider HTTP requests. Fixtures apply reviewed Alembic revisions, not arbitrary production create_all. The migration test creates temporary `insta_test_migration_*` and `insta_test_restore_*` databases, inserts synthetic legacy roles/finance/KPI, upgrades, uses actual pg_dump/pg_restore, verifies values and removes only those temporary databases. A local PostgreSQL role with CREATEDB plus pg_dump/pg_restore (or the local insta_postgres Docker container) is required.

The negative suite covers other managers' leads/chats, unbound chat access, foreign student documents, ROP finance/global-AI access, finance WhatsApp management, university write permissions, team boundaries, invalid Meta/bridge credentials, no cross-account fallback, failed delivery persistence, one-time invitations, password-reset token invalidation, malformed JWTs, unsafe production configuration, login rate limiting and signed comment-to-DM sequential deduplication. Retained tests cover the original CRUD, finance precision/void and admission stage behavior.

Run bridge tests: `node --test whatsapp-bridge/tests/*.test.js` from repository root. They use synthetic sessions and Node's test runner without opening real WhatsApp sessions. Dependency installation/audit uses the pinned package-lock.json; audit advisory results do not prove the absence of vulnerabilities.

Frontend checks from frontend:

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Lint changed/new frontend code and perform browser checks for role menus/landing, denied operations, failed sends/draft preservation and responsive layouts. The full existing lint backlog must be reported separately from new regressions.

Unverified: real WhatsApp pairing/send/receipts, actual Meta app scopes/private replies, production migration/restore, concurrent exactly-once processing, crash recovery, multi-application admissions and versioned documents. Those latter features are not implemented by this iteration. Final per-iteration commands/results are recorded in docs/CHANGELOG.md.

Browser suite: `node node_modules/@playwright/test/cli.js test` from frontend after building. Install Playwright Chromium, or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to an existing compatible executable. Tests launch the local production server on loopback port 3100 and use synthetic API fixtures; no production/provider data is loaded. The six-role menu/landing checks run at 1440px and 375px, followed by failure/draft and keyboard/Escape navigation checks. Backend permissions are verified separately against real isolated PostgreSQL, not inferred from hidden menus.

## Iteration 01.5

Изолированный PostgreSQL: `python scripts/run_staging_tests.py -q` из корня (после staging init/PG startup и `uv sync --extra dev --frozen`). Runner использует fixed test database и staging container, не production .env. Полный local HTTPS UI: `npx playwright test --config playwright.staging.config.ts` из frontend после synthetic seed. Mocked browser suite остаётся `npx playwright test`. Команды, evidence и ограничения: [STAGING_TEST_REPORT](../testing/STAGING_TEST_REPORT.md).
