# Security foundation iteration — 2026-11-05

Base: c809b63. Work is isolated from production and preserves untracked user manuals/static artifacts.

Implemented: six-role database-backed RBAC with default-deny API policies; object scopes for contacts/leads/deals/bookings/conversations/students/documents; team membership and assignment history; separate finance/document/WhatsApp/global-AI permissions; hashed single-use invitations and controlled password reset; JWT claim checks/session invalidation; rate limits and safe audits; authenticated loopback bridge and account-specific delivery; Meta signatures in all environments; failed/pending message states and draft preservation; bounded document content checks; removal of public legacy upload serving, fixed staff credentials and startup DDL/spreadsheet imports. Navigation/landing follows server-provided permissions, with initial RU/KY security dictionaries.

Migrations: frozen 25-table baseline and additive 0002_security, preserving historical IDs, NUMERIC finance values and the 160-point seller KPI fixture. Existing databases must be verified before manual stamping. Private student/staff spreadsheets stay on disk but are excluded from new Git/source artifacts.

Validation results and limitations are appended after final execution. Remaining phases and corporate decisions are listed in architecture/BACKLOG.md. No independent university applications, document versioning, payroll/accounting model, full RU/KY interface or student portal is claimed complete.

## Verified results

- Backend: `backend/.venv/bin/pytest -q --tb=short` from backend — **48 passed**. Includes frozen baseline verification, additive migration, original ID/finance/KPI preservation and a real synthetic PostgreSQL dump/restore round trip.
- Bridge: `node --test whatsapp-bridge/tests/*.test.js` — **4 passed**.
- Frontend: TypeScript — passed; production build on Next.js **16.4.5** — passed without disabling type validation; Playwright — **14 passed** (six roles × desktop/mobile, failed send draft, keyboard/Escape navigation).
- Targeted lint for the new/selected security UI, auth context and browser tests — passed. Full lint — **18 existing errors / 21 warnings**, versus baseline **21 errors / 22 warnings**; no new file/rule error categories. Full lint is not claimed clean.
- Final runtime dependency audit — **0 advisories**; full dependency audit — **8 moderate development-only advisories**, no high/critical. A compatible zod fix was applied; a forced major downgrade of eslint-config-next was not performed. Bridge lockfile audit reported 0 advisories.
- Production/provider rollout — **not performed**. Only read-only VPS dependency/listener inspection was used. Actual Meta scopes, real WhatsApp/Instagram delivery and production restore remain unverified.

Next.js 16.4.0 was flagged by maintainer advisories and the initial build gate. This branch patches Next.js and eslint-config-next to 16.4.5; the official source is linked in architecture/SECURITY.md.
