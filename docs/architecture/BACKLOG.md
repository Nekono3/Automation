# Prioritized implementation backlog

Statuses describe this iteration, not acceptance of the entire platform.

- DONE — baseline source/version/API inventory; existing 22-test baseline recorded.
- DONE — local P0 service authentication, strict WhatsApp routing, signatures, object authorization, private file content checks, persisted failure statuses, removal of fixed staff passwords/startup mutations.
- DONE — RBAC foundation: six roles, persisted grants, teams, explicit assignments/history, invitations, token invalidation, additive migration and synthetic restore round trip.
- IN PROGRESS — release readiness: staging runtime/provider acceptance and coordinated secret rotation/network isolation. No production changes are authorized by this iteration.
- NOT STARTED — communication transactional inbox/outbox, concurrent deduplication/receipts/retry reconciliation, internal notes and reliable workers.
- NOT STARTED — approved manager→mentor handoff, independent multiple university applications, visa/deadlines, document versioning and reviewer workflow.
- NOT STARTED — extended Knowledge Base (scholarships/intakes/campuses/materials/source verification).
- NOT STARTED — legacy seller→user identity mapping, database-backed 160-point weekly templates, mentor metric weights and department reporting. Preserve current historical scores and configurable employee metrics.
- NOT STARTED — agency revenue versus transit/liabilities, contracts/schedules/debts/refunds/accounts/payroll/FX and proper accounting profit.
- NOT STARTED — shared tasks, notifications/calendar beyond existing consultations.
- PARTIAL — permission-driven frontend compatibility and RU/KY security dictionaries; six dedicated dashboards, complete localization, invitations/settings UI and full accessibility workflows remain phase 8.
- NOT STARTED — Student Portal, pending separate approval after security stabilization.

Decisions still required: ROP student/financial access; manager document access; handoff approver/acceptance; operations salary access; approved sales template and mentor weights; university material archival rights; verified account-to-employee mapping; actual Meta private-reply scopes; deleted-message retention; AI data policy; revenue recognition/transit accounting; salary/commission currencies; portal timing.

- NOT STARTED — repair the remaining 18 pre-existing frontend lint errors; 21 existed on the baseline and no new error categories were introduced. The new/selected changed security UI and tests pass targeted lint.
- NOT STARTED — resolve the 8 moderate development-only advisories in the ESLint/typescript-eslint dependency chain through a compatible reviewed update; do not force a major downgrade of eslint-config-next. Runtime dependency audit is clean after the Next.js patch and compatible advisory fixes.
