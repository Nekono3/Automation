# Iteration 01.5 — стабилизация и staging

Дата проверки: 2026-11-05. Статус: **DONE — локальная staging-подготовка; NO-GO для production**.

## Исходное состояние

GitHub API и `git fetch` подтвердили: PR [#2](https://github.com/Nekono3/Automation/pull/2) открыт, draft, не объединён, mergeable. Head `feat/security-rbac-foundation` = `6a3b74bb3940a1c23b1edb22e40875ab7db8880c`; base `feat/central-company-workspace` = `c809b632b5a40e1f6f7188a1d972b16ffa330a98`. В исходной итерации 107 изменённых файлов относительно target, +8829/−765 строк. Работа продолжена в `feat/staging-verification-015` без изменения исходных веток.

Начальный повторный прогон: 48 backend tests passed; полный lint — 18 errors / 21 warnings. Архив Iteration 01 не использовался для перезаписи рабочей копии. Существовавшие untracked `backend/static/`, `frontend/public/docs/`, `frontend/public/manual/`, `scripts/generate_doc_html.py` сохранены и не включаются в коммит этой итерации.

## Подтверждённые дефекты и изменения

| Дефект | Реальное исправление | Проверка |
|---|---|---|
| Чистый backend не запускался: не объявлен `python-multipart` | Runtime dependency, uv lock и hash-locked Docker requirements | Запуск чистого контейнера и HTTPS staging |
| Python audit выявил старый certifi: одна advisory, продублированная двумя записями | certifi 2026.10.23, нижняя граница 2026.10.19 | Повторный pip-audit: 0 |
| localhost игнорировал конфигурацию API и HTTPS gateway | Явный `NEXT_PUBLIC_API_URL`, режим `same-origin`; dev :3000 → :8000 сохранён | Настоящие браузерные запросы через HTTPS :8443 |
| Некорректные ID / JSON падали до Pydantic | Авторизация возвращает 422 | Негативные API tests |
| PDF с `.exe` принимался; archive paths с обратным слешем не нормализовались | Проверка extension/MIME/content; запрет traversal | Матрица файлов, DOCX unsafe paths |
| Ошибка записи private storage давала необработанное исключение | 503 без путей, cleanup частичного файла, нет metadata record | Storage outage test |
| Конкурентные webhook-запросы могли одновременно начать comment-to-DM | PostgreSQL INSERT ON CONFLICT перед внешним действием | 4 параллельных подписанных webhook → 1 ответ |
| Comment-to-DM мог записывать отклонённый ответ как sent | sent только при provider message ID, иначе failed | Provider rejection regression |
| Повтор ручного HTTP send вызывал новую отправку | Опциональный Idempotency-Key, сохранённый результат; UI передаёт UUID | 3 конкурентных запроса → 1 provider call |
| Provider errors могли содержать секреты | Нормализованные ошибки Meta/bridge; убраны raw exceptions и phone из bridge logs | Синтетический secret echo/timeout tests |
| Изменение состава команды и ownership не имело административного API | Team update и явное назначение WA-владельца, audit, отзыв прежних assignments | API access/reassignment tests |
| Bootstrap имел гонку empty-install check | PostgreSQL advisory transaction lock | Empty staging bootstrap + refusal в непустой БД; конкурентный bootstrap отдельно не проверен |
| Нет readiness, DB/DNS outage мог выдавать 500 | `/api/ready`, безопасный 503, bounded connection/query timeouts, pre-ping | Unit fault injection + остановка staging PostgreSQL |
| Истечение сессии в работающем UI не очищало её | Обработка API 401 и переход на login; fetch timeout | Browser tests |
| Mentor UI падал на director-only student statistics | Stats API использует тот же SQL object scope, что student list | Own/foreign aggregate test и fully loaded mentor browser page |
| Mentor process edit отправлял finance fields; запрещённые controls оставались видимы | Permission-based controls и payload без финансовых fields | Real mentor PATCH200, null financial response, UI assertions |
| 18 lint errors и старые role labels | Уточнены TS-типы, отложен initial polling, общий словарь 6 ролей | TypeScript, полный lint, build |

Файлы сгруппированы в `docs/testing/ITERATION_015_FILES.txt`. Полные результаты: [STAGING_TEST_REPORT](../testing/STAGING_TEST_REPORT.md).

## Миграции и совместимость

Новых revisions и DDL для бизнес-таблиц нет. Остаются `0001_existing → 0002_security`. Использованы существующие `webhook_events`, assignments и audit. Optional header расширяет send contract совместимо; старые клиенты без ключа сохраняют прежнее поведение и не получают защиты от повторных запросов. Новые административные endpoints добавлены к существующему security module.

Существующие PK не менялись. Синтетический legacy round trip проверяет customers/leads/deals/students/admissions/accounts/conversations/messages/finance/KPI/documents. Историческая KPI-шкала 160 и финансовый void не менялись. WhatsApp sessions, Instagram Direct и comment-to-DM сохранены; реальные провайдеры не подключались.

## Оставшиеся ограничения

**BLOCKED:** реальные соответствия account_1/2/3 сотрудникам, утверждённые тестовые WA/Meta accounts, production schema verification и rehearsal на утверждённой обезличенной копии, production backup restore. Ничего из этого не подменено mocks.

**NOT STARTED:** durable inbox/outbox workers, reconciliation неопределённой доставки. Claim предотвращает конкурентный дубль, но авария после claim может оставить необработанное событие; после provider success и до записи результата возможен неопределённый pending. Автоматический replay запрещён. Это блокирует production rollout до устранения либо отдельного явно принятого плана ограниченного запуска.

Следующая работа: завершить release blockers в [RELEASE_READINESS](../deployment/RELEASE_READINESS.md), затем Iteration 02 — Students, Admissions & Mentor Management. Admissions v2, portal, новые финансы и редизайн в этой итерации не реализовывались.
