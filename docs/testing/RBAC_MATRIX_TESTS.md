# RBAC — реальные API проверки

Дата: 2026-11-05. **DONE — PostgreSQL/ASGI и локальный HTTPS staging**. Permissions загружаются из БД; frontend mocks для этой таблицы не используются.

| API / permission boundary | Director | Head of Sales | Manager | Mentor | Operations | Finance |
|---|---|---|---|---|---|---|
| Security catalog / role management | 200 | 403 | 403 | 403 | 403 | 403 |
| Leads list | all | scoped team/own | scoped own | 403 | 403 | 403 |
| Students list | all | 403 | 403 | assigned only | all | 403 |
| University catalog read | 200 | 200 | 200 | 200 | 200 | 403 |
| Finance report | 200 | 403 | 403 | 403 | 403 | 200 |
| Global AI configuration read | 200 | 403 | 403 | 403 | 403 | 403 |
| Employee KPI results | all | team/own | own | own | all | 403 |
| Staff directory | 200 | scoped | scoped | scoped | scoped | scoped |
| WhatsApp administration | permitted | 403 | 403 | 403 | 403 | 403 |

Evidence: `tests/test_staging_rbac.py::test_six_role_api_matrix` — 6 parameter sets, direct API requests. Director WA successful status additionally verified through the running HTTPS environment, with zero paired sessions.

## Негативные и scope-сценарии

| Test | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| Manager A читает/меняет customer Manager B | 404 / no disclosure | 404 | PASS | test_security.py::test_manager_cannot_read_or_change_another_lead |
| Mentor statistics | Только assigned aggregates, без чужих стран/counts | 200, own count1 | PASS | test_mentor_statistics_are_scoped_like_student_list |
| Подмена conversation ID | History/send/mode denied | 404 | PASS | test_unbound_manager_cannot_read_or_mutate_conversations; HTTPS staging API |
| Mentor A скачивает документ Mentor B | No file | 404 | PASS | test_mentor_document_scope_and_private_files |
| Finance / Ops / Manager читают private file без разрешения | Denied | 403/404 | PASS | test_staging_files.py (4 valid MIME cases × roles) |
| ROP назначает сотрудника вне команды | Forbidden | 403 | PASS | test_team_scope_does_not_expose_other_teams |
| Смена состава команды | Удалённый manager больше не виден ROP | 404; новый виден 200 | PASS | test_staging_assignments.py |
| Смена ментора | Старый доступ отозван, история остаётся | 404 / 200, 2 assignment rows | PASS | test_mentor_reassignment_keeps_history_and_revokes_previous_access |
| Account ownership change | Explicit only; один владелец; старый доступ отозван | 200, conflicting owner 409, old owner 404 | PASS | test_explicit_account_ownership_transfer_and_scope |
| List scope до pagination | Страницы содержат только own records | 2 + 1 own records | PASS | test_object_scope_applies_before_customer_pagination |
| Mentor student response | Нет финансовых сумм/transactions | null / [] | PASS | test_mentor_document_scope_and_private_files |
| Manager изменяет catalog | Forbidden | 403 | PASS | test_university_mutation_requires_permission |
| Ops создаёт catalog entry | Allowed | 201 | PASS | same test |
| ROP/Ops salary permissions | Не выданы | absent in DB grants | PASS | test_six_role_grants_are_least_privilege |

Полноценного payroll API пока нет: salary endpoint workflow — **NOT STARTED**, а не проверенная функция. Импортированный seller archive остаётся director-only до утверждения seller↔user mapping; новые employee KPI имеют own/team scope. Это существующее ограничение, а не утрата истории.

Администрирование: `POST /api/security/teams`, `PUT /api/security/teams/{id}` с `{name,user_ids}`. РОП определяется его основной ролью и явным членством. `PUT /api/security/users/{id}/whatsapp-account` принимает numeric account PK либо null. Для передачи сначала снять текущего владельца; изменения фиксируются в audit. Реальная схема account_1/2/3 — **BLOCKED — requires business confirmation**. Синтетическое staging-сопоставление не является production-конфигурацией.
