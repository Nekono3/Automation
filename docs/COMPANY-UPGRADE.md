# Consulteam company workspace

The original project is a Next.js 16 / React 19 operator workspace with a FastAPI / SQLAlchemy backend, PostgreSQL, Meta Instagram webhooks, and a Baileys WhatsApp bridge. Production runs at `crm.consulteam.edu.kg` under Caddy and the `insta-backend`, `insta-frontend`, and `insta-whatsapp-bridge` systemd services in `/opt/insta`.

## Modules

- **База лидов** (`/dashboard/leads`): existing contacts plus manual leads, category, owner, status, next action, search and pagination. New inbound conversations create lead records automatically; WhatsApp leads are assigned when exactly one active employee owns the receiving account. Managers see their assigned leads; admin/ROP can distribute leads. Converting a lead creates or opens a linked student and admission deal.
- **Финансы** (`/dashboard/finance`): admin/ROP journal, categories, income/expense, currency, date, student, admission stage, recipient and commission percentage. Reports show income, expense and net cash profit by currency, category, month and year, with inclusive date filters. Amounts use PostgreSQL `NUMERIC(18,2)` and Python `Decimal`. Different currencies are never added together. Corrections use audited voiding; original entries remain.
- **Сотрудники и KPI** (`/dashboard/team`): reusable metric definitions with department, position, unit and direction; individual monthly targets, actual values and notes. Admin/ROP evaluate staff; employees read their own results. The original seller KPI register is retained as an archive. WhatsApp metrics count activity by assigned account, with the distinction between employee and AI replies, and a link to filtered conversations. Counts of open conversations/unread messages describe current state; messages and newly registered leads use the selected month.
- **Student dossier** (`/dashboard/students/{id}`): linked contact, admission deal, manager and university program; payments by stage; commissions; private documents and review status; timestamped change history. Student country sections remain available in the main register. University programs can also be filtered by country; requirements and additional details use program notes.

## Relationships and compatibility

`Customer → LeadRecord → AdmissionLink → EnrolledStudent` connects sales to admissions. `AdmissionLink` also points to `Deal`, `User` and `UniversityProgram`. Transactions and documents reference the existing enrolled student. KPI results reference the same staff users used for lead ownership and WhatsApp assignment.

A won sales deal creates an admission deal and linked student. Standard admission stages synchronize in both directions between the board and student register. Imported, nonstandard stage labels are preserved. Existing imported students and existing deals can be linked explicitly in the dossier; names are not matched automatically.

The additive `company_*`, `finance_*`, `employee_*` and `student_documents` tables are registered in `app.models` and created through the existing startup schema initialization. No original table or spreadsheet data is deleted or rewritten by the upgrade. Destructive spreadsheet reloads and deletions are blocked when records have new links.

Historical contract/paid/remaining strings from Excel remain visible separately. They are **not** automatically posted to the cash journal: dates, currencies and commission recipients must be reconciled before importing historical transactions. Recorded commission amount is the actual cash payout; percentage is its reference rate, not an automatically recomputed payout. Reports describe recorded cash movements; no currency conversion or accrual accounting is implied.

Documents are stored under `backend/private_documents/`, outside the public static mounts; downloading requires a bearer token. Allowed types: PDF, JPEG, PNG, DOCX; maximum 10 MiB. Include this directory in future backups along with PostgreSQL. Existing authorized staff access student documents, consistent with the student register's shared access.

Staff startup seeding now creates missing users without resetting existing passwords, roles, names or WhatsApp assignments. Manual replies record the acting user in message metadata; historical message analytics remain attributed to accounts because old messages have no actor ID.

## Validation

Create a dedicated PostgreSQL database `insta_upgrade_test` using the same local database role, then run:

```bash
cd backend
.venv/bin/pytest -q
```

Tests always redirect API/database connections to `insta_upgrade_test` or `TEST_DATABASE_URL` (its name must contain `test`), and clear provider credentials to avoid sending real messages. The tests cover finance precision/periods/currencies/voids/permissions, linked lead conversion and commissions, individual KPI upserts and access, private document downloads, aggregation counts, preservation of staff settings, and two-way admission stage synchronization, in addition to the original integration tests.

```bash
cd frontend
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

## Deployment and rollback

Build a separate frontend release first. Before switching, capture a PostgreSQL custom-format dump, a source/configuration archive and the previous `.next` directory in a root-only backup directory. Apply the reviewed source patch, initialize additive tables and restart backend/frontend. The bridge and WhatsApp authentication directories are preserved. Check the health endpoint, authenticated company endpoints, and all new page routes.

For a code rollback, restore the source archive and previous `.next` directory and restart backend/frontend. Leave the additive database tables intact so newly recorded data remains available. A full database restore is a separate recovery action and would discard writes since the dump; it is not part of a normal code rollback.
