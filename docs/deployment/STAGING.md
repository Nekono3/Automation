# Staging gate

Use separate database, private file storage, ports/domain, .env and Baileys auth directory. Never restore personal data to an external test service. Prefer synthetic fixtures; any company-approved production copy needs its own access/retention controls.

Set ENVIRONMENT=staging, DEBUG=false, explicit strong JWT/bridge/webhook keys, an explicit HTTPS allowed origin, PUBLIC_BASE_URL and correct provider configuration. Do not use wildcard credentialed CORS. Configure bridge service on loopback, matching backend→bridge and bridge→backend credentials. Never publish bridge administration/QR routes or ports 3001/8000/3000 directly.

Migrate as documented in development/MIGRATIONS.md. Bootstrap only a new empty users table; existing staff use director-issued invitations/password resets. Explicitly establish teams and student/conversation assignments. Verify legacy-role backfill before enabling access.

Gate release on: negative permissions suite, database/restore test, frontend type/lint/build checks, manual team/mentor assignment checks, file upload/download checks, correct account selection for all three dedicated WhatsApp accounts, signed Instagram Direct/comment-to-DM duplicate tests and safe human takeover. Provider verification needs company-owned test identities and real authorized Meta scopes. Record observed results and remaining failures; do not call a running service a successful messaging integration.

## Iteration 01.5: проверенный локальный запуск

Актуальные команды полного изолированного Docker staging, проверки отказов и ограничения: [STAGING_VERIFICATION.md](STAGING_VERIFICATION.md). Результаты: [STAGING_TEST_REPORT](../testing/STAGING_TEST_REPORT.md). Прежние synthetic результаты Iteration01 не заменяют новые проверки; production release имеет статус NO-GO, см. [RELEASE_READINESS](RELEASE_READINESS.md).
