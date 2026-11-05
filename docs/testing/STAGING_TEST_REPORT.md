# Staging test report — Iteration 01.5

Дата: 2026-11-05. Проверяется ветка `feat/staging-verification-015`, исходный security commit `6a3b74b`. Итог: **DONE — local staging preparation; NO-GO — production release**.

## Выполненные команды и результаты

Все backend API/SQL checks используют синтетические данные в отдельном PostgreSQL16 container :25432. Тестовая конфигурация отклоняет CRM database names и блокирует реальные HTTP provider requests.

| Test / command | Expected | Actual | PASS / FAIL / BLOCKED | Evidence |
|---|---|---|---|---|
| `python scripts/run_staging_tests.py -q` | Existing + new backend regressions pass | **131 passed** | PASS | backend-full.log; backend/tests/test_staging_*.py |
| `npm ci` frontend / bridge | Reproducible dependency install | Both completed; clean Docker builds also completed | PASS | install/build logs |
| `npm test` in whatsapp-bridge | Auth/routing/real HTTP routes without pairing | **8 passed** | PASS | bridge-tests.log |
| `npx tsc --noEmit` | No TypeScript errors | Exit 0 | PASS | tsc.log |
| `npx eslint . --format json` | No release-blocking lint errors | **0 errors / 21 warnings** | PASS (warnings remain) | lint.json; baseline was18 errors/21 warnings |
| `npm run build` | Next16.4.5 production build | Completed | PASS | frontend-build.log |
| `npx playwright test` | Mocked role/failure/accessibility contracts | **23 passed** | PASS | browser-mock.log |
| `npx playwright test --config playwright.staging.config.ts` | Browser→HTTPS→real API→PostgreSQL | **25 passed** (final full-data suite) | PASS | browser-staging.log |
| `test_migrations.py` | Legacy verify→stamp→upgrade→dump→restore; preserve data | Passed, plus file backup round trip | PASS | storage-migration.log, full backend run |
| `alembic check` in staging image | ORM/schema match | No new upgrade operations detected | PASS | schema-check.log |
| `python scripts/verify_staging.py --database-outage` | Bounded errors, recovery | Real stopped DB: 503; restart: 200 without backend restart | PASS | staging-verification.json |
| `pip-audit` on hash-pinned backend requirements | No known dependency advisories | **0**, after certifi patch | PASS | backend-audit.json |
| `npm audit --omit=dev --json` frontend | No runtime advisories | **0** | PASS | frontend-runtime-audit.json |
| `npm audit --json` bridge | No advisories | **0** | PASS | bridge-audit.json |
| Full frontend `npm audit --json` | Expose remaining dev issues | **8 moderate development-only advisories** | FAIL (known dev debt) | frontend-audit.json |
| Live WhatsApp/Meta/Mistral | Approved provider accounts | No live tests attempted | BLOCKED | No dedicated approved provider setup |
| Production schema/migrations/restore | Approved production-equivalent drill | Not performed | BLOCKED | NO-GO release gates |

Evidence logs and JSON copied to ignored `artifacts/iteration-015/`; source reports/tests are committed. Logs contain synthetic identifiers only; no staging passwords/tokens are included in the release archive. Browser screenshots are synthetic dashboards, not real students/messages. The final full-stack suite also creates/updates an own lead in the UI and verifies mentor download / Finance Manager denial against real storage.

## Дефекты, воспроизведение и исправления

1. Чистый Docker backend упал при регистрации multipart route: dependency отсутствовала в pyproject. Добавлена runtime dependency и pinned/hash-checked requirements. После исправления backend healthy.
2. localhost API URL шёл на :8000 вместо gateway. Явный same-origin build + реальный HTTPS login/role workflows прошли.
3. Невалидные object IDs/JSON вызывали необработанные исключения в authorization до schema validation. Теперь422.
4. Extension/content mismatch и storage-write failure: теперь415/422/413 и sanitized503 без orphan metadata.
5. SELECT-before-insert webhook dedup позволял гонку до provider side effect. Atomic event claim проверен четырьмя конкурентными подписанными комментариями. Private reply rejection сохраняется failed.
6. Дубли manual sends защищены optional Idempotency-Key. Один actor/key/body →one message/provider call; несовместимый body/in-progress →409.
7. Raw provider error text мог содержать секрет. Meta и bridge errors нормализованы; synthetic secret echo не возвращается и не логируется. Для Meta timeout также исправлен неявный None return.
8. Реальная остановка PostgreSQL выявила DNS OSError, не покрытую первоначальным ConnectionError handler. После расширения handler тест остановки/восстановления прошёл.
9. Старый login limiter test пересекал минутную границу. Тест использует управляемое время; production limiter не отключался.
10. Certifi audit вернул одну advisory двумя записями для2026.7.22; обновлён до2026.10.23, повторный audit0.

Два первоначально упавших новых browser tests были ошибками фикстур: URL с query не перехватывался exact glob, alert locator совпадал с Next route announcer. Они исправлены; финальный mocked browser run23passed. Данные об этих сбоях не представлены как production дефекты.

## Что эти результаты подтверждают

Authentication/invitation/reset/JWT, backend RBAC и object scope, team/mentor/WA reassignment, private document boundary, CRM lead conversion и existing finance void/Decimal reports, KPI historical160, university read/create contracts проверены API/SQL tests. Реальный локальный UI проверен для6ролей на3ширинах; screenshots не доказывают полную accessibility certification. Keyboard navigation/Escape/labels проверены отдельными browser assertions.

## Непроверенное и ограничения

Provider calls в backend contract tests — httpx.MockTransport/monkeypatched methods. Bridge HTTP tests — настоящий Express app с подставленными SessionInstance-compatible objects. Full-stack send использует настоящий disconnected local bridge; это проверка ошибки, не успешная WhatsApp доставка. Live Meta permission/API-version acceptance, live Mistral, реальное pairing, media/private reply restrictions не подтверждены.

Нагрузка/latency SLA, crash recovery, очереди после перезапуска, production schema drift и полноценный production restore не подтверждены. Полного antivirus/parser у validator нет: bounded signature/ZIP checks не являются гарантией отсутствия вредоносного файла. Full localization, payroll, admissions v2/versioning отсутствуют в scope и не объявляются broken.

Развёртывание и ротация production не выполнялись. PR подходит для code review после ознакомления с NO-GO gates; тестовые успехи не являются разрешением на production merge/deploy.

Runtime recorded in artifacts/iteration-015/runtime-versions.json: backend tests Python3.11.14, image Python3.12.16; FastAPI0.142.2, SQLAlchemy2.1.3, Pydantic2.13.5, Alembic1.20.0, asyncpg0.32.0, Mistral SDK3.1.0, certifi2026.10.23, python-multipart0.0.33; Node image22.23.4, PostgreSQL16.15.

Дополнительный full-data browser regression обнаружил mentor stats403 после первых navigation-only checks. Statistics теперь фильтруется student assignments до aggregation; отдельный API test исключает foreign countries/counts, browser проверяет отсутствие loading/error states до screenshot. Test login tokens создаются один раз global setup, чтобы worker restart не исчерпывал login rate limit; лимит в приложении не менялся.

Последний UI regression: mentor видел import/create/delete и finance controls, а process edit отправлял защищённые финансовые поля и получал403. Controls теперь используют permissions, process payload исключает финансовые keys; финальный реальный browser test подтверждает mentor PATCH200 и contract_amount=null. Итоговые suite counts: backend131, bridge8, mocked browser23, full-stack browser25.
