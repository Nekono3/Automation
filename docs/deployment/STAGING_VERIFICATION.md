# Воспроизводимое локальное staging

Дата: 2026-11-05. **DONE — контейнеры реально собраны, запущены и проверены. Это local staging equivalent, не отдельный production-equivalent VPS.**

## Изоляция

Существующий `docker-compose.yml` используется через extends для PostgreSQL. Отдельный `docker-compose.staging.yml`, project `consulteam-staging`, PG16 container `consulteam-staging-postgres`, DB `consulteam_staging`, test DB `insta_test_015`. Новый named volume `consulteam-staging_staging_db`; отдельные `staging_documents` и `staging_sessions`. Production .env и sessions не копируются.

Backend, frontend и bridge работают только на internal Docker network без egress и без host port publication. Gateway и PostgreSQL дополнительно подключены к edge network; опубликованы только `127.0.0.1:8443` и `127.0.0.1:25432`. PostgreSQL доступен с хоста для тестов. Это не является доступом к прежней локальной DB :5432. Не объединять staging compose с production compose и не запускать `down -v` на чужом project.

Bridge auto-start выключен; session volume пуст. Три synthetic database accounts существуют, но не paired. Meta/WhatsApp Cloud/Mistral keys пусты. Frontend→gateway→backend→PostgreSQL и backend↔bridge проверены через реальные HTTP-запросы. Интернет-провайдеры не использовались.

## Новый запуск

Требуются Docker Compose с поддержкой `!override` (проверено 5.6.1), Python, openssl, Node>=22; для backend tests — uv environment с dev extra.

```bash
python scripts/staging.py init
docker compose --env-file .staging/compose.env -f docker-compose.staging.yml build
docker compose --env-file .staging/compose.env -f docker-compose.staging.yml up -d --wait postgres
docker compose --env-file .staging/compose.env -f docker-compose.staging.yml run --rm backend alembic upgrade head
python scripts/staging.py seed
docker compose --env-file .staging/compose.env -f docker-compose.staging.yml up -d --wait
python scripts/verify_staging.py
```

На проверяемом хосте Docker build DNS работал нестабильно. Успешная сборка выполнена командами `docker build --network=host -t consulteam-staging-backend backend`, аналогично `consulteam-staging-frontend frontend` и `consulteam-staging-bridge whatsapp-bridge`. Это временная сеть build, runtime isolation сохраняется. Не отключать TLS verification для package downloads. Образы собраны с hash-locked Python dependencies и `npm ci` lockfiles. Floating base image tags требуют фиксации digests для согласованного production release.

`init` создаёт новые случайные секреты, owner-only `.staging` и файлы 0600, self-signed TLS на 30 дней. Повторный init ничего не ротирует. `seed` применим только к пустой DB с именем consulteam_staging и ENVIRONMENT=staging. Первого директора создаёт настоящий bootstrap, остальных — одноразовые приглашения. Созданы шесть synthetic identities, связанные leads/conversations/student assignment. Пароли только в ignored `.staging/browser_accounts.json`; в отчёты и ZIP не включаются. Повторный seed не сбрасывает учётные записи.

Открыть `https://localhost:8443`; доверять только локальному сертификату `.staging/tls/cert.pem`. Для CLI: `curl --cacert .staging/tls/cert.pem https://localhost:8443/api/ready`. Playwright ignoreHTTPSErrors используется исключительно для локального self-signed test gateway, реальные provider clients TLS verification не отключают.

## Проверено

- Backend/frontend/bridge healthchecks healthy; `/api/ready` проверяет DB revision и возвращает 503 при её недоступности. `/api/health` сохраняет старый contract 200/degraded.
- 25 full-stack browser tests: 6 ролей × 3 viewport (1440/768/375), ожидание окончания загрузки до screenshot; login/logout, failed delivery, lead create/update, private mentor download и mentor process edit без financial fields.
- `python scripts/verify_staging.py --database-outage`: реально останавливает ТОЛЬКО fixed local staging PostgreSQL, гарантирует start в finally. Проверено: readiness/protected API 503 без секретов; восстановление без restart backend.
- Логи Uvicorn access выключены; API request IDs/security headers; bridge service audit — JSON. App error logs пока стандартного Python формата, полноценный централизованный log pipeline — backlog.

Health/readiness не доказывают live provider connectivity, writable storage во всех обстоятельствах, performance SLA или durable delivery. Filesystem outage проверяется отдельно API test.

## Повторные тесты

```bash
cd backend
uv sync --extra dev --frozen
cd ..
python scripts/run_staging_tests.py -q
cd whatsapp-bridge
npm ci
npm test
cd ../frontend
npm ci
npx tsc --noEmit
npm run lint
npm run build
npx playwright test
npx playwright test --config playwright.staging.config.ts
```

Playwright требует `npx playwright install chromium` либо доступный `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests/staging читают ignored account file. Не запускать их с production URL. Перед многократным быстрым повтором live-local login-набора учитывать лимит 10 попыток/мин на direct peer; limiter не отключать.

Остановка с сохранением данных: `docker compose --env-file .staging/compose.env -f docker-compose.staging.yml stop`. Secrets и volumes сохранить для последующего review. Удалять их только отдельным осознанным действием для этого project.
