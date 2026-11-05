# Iteration 01 — audit, P0 security and RBAC foundation

**Status:** locally verified iteration; not acceptance of the complete target platform. Production was not changed.

## 1. Findings

Baseline c809b63: 25 tables, 22 passing tests, Next.js 16.4.0. Confirmed fixed staff passwords in config/user_service; startup DDL and spreadsheet imports in main; incomplete ownership checks in routers; unauthenticated bridge control/webhooks; cross-account fallback; permissive Meta validation; unvalidated file contents; optimistic delivery states; Graph tokens in profile request query strings. Dependency audit also identified critical Next.js advisories. A read-only VPS check confirmed a bridge listener on all IPv4 interfaces, without claiming Internet reachability.

## 2. Implemented changes — DONE locally

Persisted RBAC grants for six primary roles, team/object scopes, separate document/finance/WhatsApp/global-AI permissions, assignment history, invitations/password reset, JWT validation/session versions and rate limits. All current APIs have explicit coarse policy coverage. Strong production/staging settings fail closed. Startup performs no schema changes or external imports. Bridge requests and incoming callbacks use distinct credentials; delivery requires the assigned account and stores pending/sent/failed truthfully. File reads/uploads have object authorization, private storage and bounded content checks. Student finance data is projected according to permission. Sensitive SQL/provider logging and token query parameters are removed. Existing comment-to-DM is retained.

Frontend navigation and landing use server permissions; failed sends retain text; initial RU/KY security dictionaries are centralized. Next.js/eslint-config-next are patched to 16.4.5. Full role dashboards/localization and later business modules remain incomplete.

## 3. Changed files

Private spreadsheet entries below mean removal from the **Git index only**: both existing files remain on disk. Pre-existing untracked static/manual artifacts were preserved and are not included in this iteration's ZIP.

- `.env.example`
- `.gitignore`
- `README.md`
- `backend/alembic.ini`
- `backend/app/ai/agent.py`
- `backend/app/api/deps.py`
- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/automations.py`
- `backend/app/api/routes/bookings.py`
- `backend/app/api/routes/company.py`
- `backend/app/api/routes/conversations.py`
- `backend/app/api/routes/customers.py`
- `backend/app/api/routes/deals.py`
- `backend/app/api/routes/enrolled_students.py`
- `backend/app/api/routes/seller_kpi.py`
- `backend/app/api/routes/university_programs.py`
- `backend/app/api/routes/webhooks.py`
- `backend/app/config.py`
- `backend/app/core/__init__.py`
- `backend/app/core/authorization.py`
- `backend/app/core/files.py`
- `backend/app/core/http_security.py`
- `backend/app/core/permissions.py`
- `backend/app/core/projections.py`
- `backend/app/core/service_auth.py`
- `backend/app/data/kpi_sellers.xlsx`
- `backend/app/data/students.xlsx`
- `backend/app/database.py`
- `backend/app/integrations/instagram/client.py`
- `backend/app/integrations/instagram/validator.py`
- `backend/app/integrations/whatsapp/client.py`
- `backend/app/main.py`
- `backend/app/models/__init__.py`
- `backend/app/models/user.py`
- `backend/app/modules/__init__.py`
- `backend/app/modules/security/__init__.py`
- `backend/app/modules/security/bootstrap.py`
- `backend/app/modules/security/models.py`
- `backend/app/modules/security/router.py`
- `backend/app/modules/security/service.py`
- `backend/app/schemas/enrolled_student.py`
- `backend/app/schemas/user.py`
- `backend/app/security/jwt.py`
- `backend/app/services/ai_responder.py`
- `backend/app/services/booking_service.py`
- `backend/app/services/customer_service.py`
- `backend/app/services/deal_service.py`
- `backend/app/services/enrolled_student_service.py`
- `backend/app/services/message_delivery.py`
- `backend/app/services/user_service.py`
- `backend/app/services/whatsapp_service.py`
- `backend/migrations/baseline_manifest.json`
- `backend/migrations/baseline_schema.json`
- `backend/migrations/env.py`
- `backend/migrations/initial_grants.json`
- `backend/migrations/script.py.mako`
- `backend/migrations/security_schema.json`
- `backend/migrations/versions/0001_existing_schema.py`
- `backend/migrations/versions/0002_security_foundation.py`
- `backend/scripts/verify_baseline.py`
- `backend/tests/conftest.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_company.py`
- `backend/tests/test_migrations.py`
- `backend/tests/test_security.py`
- `backend/tests/test_webhooks.py`
- `docker-compose.yml`
- `docs/CHANGELOG.md`
- `docs/architecture/API_MAP.md`
- `docs/architecture/BACKLOG.md`
- `docs/architecture/COMMUNICATION.md`
- `docs/architecture/CURRENT_STATE.md`
- `docs/architecture/DATABASE.md`
- `docs/architecture/PERMISSIONS.md`
- `docs/architecture/SECURITY.md`
- `docs/architecture/TARGET_ARCHITECTURE.md`
- `docs/deployment/PRODUCTION.md`
- `docs/deployment/ROLLBACK.md`
- `docs/deployment/STAGING.md`
- `docs/development/MIGRATIONS.md`
- `docs/development/SETUP.md`
- `docs/development/TESTING.md`
- `frontend/next.config.ts`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.config.ts`
- `frontend/src/app/dashboard/conversations/page.tsx`
- `frontend/src/app/dashboard/finance/page.tsx`
- `frontend/src/app/dashboard/kpi/page.tsx`
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/app/dashboard/leads/page.tsx`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/dashboard/students/[id]/page.tsx`
- `frontend/src/app/dashboard/team/page.tsx`
- `frontend/src/components/ChatPanel.tsx`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/i18n/security.ts`
- `frontend/src/lib/types.ts`
- `frontend/src/permissions/index.ts`
- `frontend/tests/security.spec.ts`
- `scripts/deploy_company_upgrade.py`
- `whatsapp-bridge/package-lock.json`
- `whatsapp-bridge/package.json`
- `whatsapp-bridge/security.js`
- `whatsapp-bridge/server.js`
- `whatsapp-bridge/tests/security.test.js`

## 4. Migrations

0001_existing freezes the original 25-table DDL. The read-only baseline verifier checks column types/nullability, primary keys, uniqueness, indexes and foreign keys before any manual stamp. 0002_security adds security tables and users.token_version, migrates only known legacy roles with audit, and backfills explicit owners/account bindings without inferring mentors or teams. Both revisions were applied to fresh synthetic PostgreSQL; original IDs, a 100.10 USD amount and 160-point KPI result were preserved. A real dump/restore round trip passed. Destructive downgrade refuses to erase history. No production migration/stamp or production restore was performed.

Commands and safe legacy/new-database paths: ../development/MIGRATIONS.md. Recovery: ../deployment/ROLLBACK.md.

## 5. Checks

- `backend/.venv/bin/pytest -q --tb=short` from backend: **48 passed**.
- `node --test whatsapp-bridge/tests/*.test.js`: **4 passed**.
- Frontend TypeScript: passed. `next build` on 16.4.5: passed with type validation enabled.
- Playwright: **14 passed** — six-role landing/menu at 1440/375px, failed-send draft, keyboard/Escape navigation.
- Targeted security UI/test lint: passed. Full existing lint: **18 errors / 21 warnings**, compared with baseline **21 / 22**; no new file/rule error categories. This gate remains partial.
- Runtime npm audit: **0 advisories**. Full audit: **8 moderate dev-only advisories**, no high/critical; compatible fixes applied, forced major lint downgrade deferred. Bridge package audit: 0 advisories.

Provider transport is mocked only in tests; no synthetic business data was seeded into the product. Real provider sends/pairing, actual Meta permissions and production release are **IMPLEMENTED / UNVERIFIED** where applicable, not DONE.

## 6. Preservation

Existing customer/student/deal/message/finance/KPI IDs and schema are retained. Cash journal precision/void and admission regressions pass. Existing communication sessions are not deleted or logged out. University catalog and comment-to-DM remain in the project. Real student/staff spreadsheets remain locally but are excluded from new Git/source artifacts; prior Git history was not rewritten. No production records, secrets, services or configuration were modified.

## 7. Next priorities

Staging approval/controlled secret rotation and explicit team/mentor mapping; live-provider tests with company-owned test identities; durable communication inbox/outbox and concurrency handling; then independent university applications, versioned document review and approved handoff. Extended Knowledge Base, KPI templates, proper revenue/transit/accounting/payroll, tasks/notifications, full RU/KY dashboards and Student Portal remain in BACKLOG.md. Do not present these as completed.

Run locally with ../development/SETUP.md; review release prerequisites in ../deployment/STAGING.md and ../deployment/PRODUCTION.md. The sanitized ZIP includes source, migrations, tests and documentation, excluding credentials, provider sessions, private documents, imports with personal data, node_modules, build/test artifacts and Git history.
