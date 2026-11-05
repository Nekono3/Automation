# Release readiness — Iteration 01.5

Дата: 2026-11-05. Решение: **NO-GO для production release**. **DONE** — локальная staging-подготовка, исправления и синтетические интеграционные tests. Это не запрет на code review: изменения подготовлены в отдельной ветке для review, без автоматического merge.

## Подтверждённые gates

- [x] PR #2/head/base проверены GitHub API и fetch; отдельная рабочая ветка.
- [x] Изолированные PostgreSQL/storage/service credentials; runtime app network без provider egress.
- [x] Fresh migrations и read-only legacy baseline verification перед stamp.
- [x] Data preservation, exact money/KPI, legacy roles и assignments.
- [x] Изолированный PostgreSQL dump/restore, private synthetic file restore, ORM/startup после restore.
- [x] Invitation single-use/hash/expiry, password reset, JWT negative matrix, rate limiting.
- [x] Шесть ролей, object/team scope, financial projections, authorized documents.
- [x] Bridge authentication, account routing и failures; Meta signatures/comment-to-DM contracts.
- [x] Full frontend type check/build; lint 0 errors / 21 warnings.
- [x] Browser role navigation на desktop/tablet/mobile; real local backend workflows и mocked failure tests.
- [x] Backend/runtime frontend/bridge dependency audit: 0 known advisories на момент проверки.
- [x] Реальный staging DB outage/recovery; безопасные 503, health/readiness.
- [x] Описаны rotation, migration и recovery; production не менялся.

## Release blockers

| Priority | Gate | Status / required evidence |
|---|---|---|
| P0 | Recoverable messaging | NOT STARTED: durable inbox/outbox, worker retries/reconciliation. Подтвердить crash scenarios до ACK/после provider acceptance. Claim/idempotency не дают crash recovery |
| P0 | Production schema / migration review | BLOCKED: read-only verifier на утверждённой схеме/обезличенной копии, сравнительный diff и операторский review; не слепой stamp |
| P0 | Production backup/restore | BLOCKED: восстановить настоящую утверждённую пару PostgreSQL + files в изолированную среду, проверить integrity, counts, permissions и recovery timings |
| P0 | WhatsApp ownership и live verification | BLOCKED: директор подтверждает technical ID→employee; отдельные согласованные test accounts/contacts; pairing, send/receive/revoke/errors |
| P0 | Meta live integration | BLOCKED: утверждённый test Instagram, подтверждённые permissions/token scopes, Direct + comment-to-DM + duplicate delivery |
| P0 | Production rollout approval | BLOCKED: отдельное разрешение на миграции/deploy/rotation, окно и ответственный оператор |
| P1 | Infrastructure equivalence | CONDITIONAL — NOT VERIFIED: staging PostgreSQL16 и Docker/Linux проверены; версия/объём production DB, firewall, ingress/proxy settings, host storage и capacity в этой итерации не проверялись |
| P1 | Log pipeline / observability | Частично: request IDs, audit, health и JSON bridge events есть; централизованная доставка/alerting/retention не подтверждены |

Оставшиеся 21 frontend lint warnings и 8 moderate development-tool advisories не скрыты; runtime audit чист. Они требуют планового устранения, но сами по себе не представлены как доказанный production exploit. Нагрузочный тест, penetration test, независимый review всех permission paths и live credential rotation не выполнялись.

## План выпуска после снятия blockers

1. Review security foundation PR #2 и follow-up Iteration01.5 относительно правильных feature branches. Не использовать main как будто он уже содержит foundation.
2. Зафиксировать approved commit, immutable image digests, environment config и все решения по access/ownership. Не копировать staging passwords в production.
3. Подтвердить recovery drill, backup DB/files/session state и доступность rollback release. Сохранить текущий code/config до изменений.
4. Остановить потоки отправки/записи в согласованном окне; выполнить read-only baseline verifier. При mismatch остановиться и подготовить отдельную reviewed migration.
5. Только после review выполнить stamp 0001_existing для действительно legacy schema и upgrade 0002_security. Для уже versioned DB — проверенный upgrade head. Сверить IDs/counts/relationships/money/KPI и permissions.
6. Применить проверенную procedure credentials/service isolation, сохраняя WhatsApp auth directories. Затем запуск backend/frontend/bridge и live-approved smoke flows.
7. Наблюдать failures, pending/claimed и audit. Откатывать код только на совместимую схему; data restore — отдельная процедура с учётом новых записей после backup.

До выполнения этих пунктов не менять статус на PRODUCTION READY. Полный отчёт: [STAGING_TEST_REPORT](../testing/STAGING_TEST_REPORT.md), восстановление: [DATABASE_MIGRATION_TESTS](../testing/DATABASE_MIGRATION_TESTS.md), [ROLLBACK](ROLLBACK.md).

## Iteration 02

Сначала завершить сообщение/release blockers. Затем Students/Admissions/Mentor Management: несколько независимых university applications, handoff, document versioning/review и mentor workflows. Не изменять KPI160 или финансовые правила в рамках этой стабилизации; не открывать Student Portal до отдельного согласования.
