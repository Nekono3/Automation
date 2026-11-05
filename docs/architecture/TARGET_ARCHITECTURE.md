# Target architecture

Evolve the existing modular monolith. `app/core` owns shared security boundaries; `app/modules/security` owns role/team/assignment/invitation persistence and workflows. Existing route/service/model modules remain compatible while business logic is gradually extracted from company.py. No speculative microservices or wholesale file moves are introduced.

The next communication step is a persisted webhook inbox and durable transactional outbox, with account-specific delivery jobs, bounded retries, worker leases and provider delivery receipts. Current manual/AI delivery persists pending/sent/failed but **is not a complete outbox worker**; process death after provider acceptance can require reconciliation. Existing sequential deduplication is not claimed to guarantee exactly-once delivery under concurrency.

Separate Student, University Application, Visa and Document states in phase 4. Retain company_admissions as the existing CRM link while adding independent student_applications and a verified backfill. Document versions must be append-only with current-version references and reviewer records. Do not collapse multiple university applications into student.process_stage.

Finance must distinguish agency revenue, transit receipts, liabilities, expenses, receivables and payroll before presenting accounting profit. Keep existing NUMERIC transactions and void history; introduce explicit accounts, contracts, schedules and reversals additively. Do not auto-convert ambiguous historical spreadsheet strings.

Student Portal remains a separately approved phase with distinct student identities and student-scoped capabilities, never ordinary employee access.
