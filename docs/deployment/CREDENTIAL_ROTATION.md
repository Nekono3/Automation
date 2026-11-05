# Credential rotation readiness

Дата: 2026-11-05. **DONE — процедура и отрицательные tests; production rotation NOT PERFORMED**.

Никакие реальные значения в этом документе не приводятся. На staging новые независимые секреты генерируются scripts/staging.py; production .env не копируется. В production использовать secret manager либо owner-only env files вне Git/backups общего доступа. Доступ к backups, process environment и Docker administration равносилен доступу к секретам.

| Credential | Consumer / location | Изменение и проверка |
|---|---|---|
| SECRET_KEY | Backend JWT signer; защищённый backend env | Новая случайная строка >=32 байт, restart всех backend workers, старый JWT →401, новый login →200 |
| BRIDGE_API_TOKEN | Backend outbound HTTP; bridge inbound guard | Одинаковое новое значение в обоих сервисах; bridge и backend restart; authenticated sessions 200, wrong/callback token 401 |
| BRIDGE_WEBHOOK_TOKEN | Bridge callbacks; backend webhook authentication | Другое случайное значение; согласованный restart bridge/backend; invalid callback401, valid synthetic callback accepted на staging |
| META_ACCESS_TOKEN / WHATSAPP_ACCESS_TOKEN | Backend Meta/Cloud clients | Сначала проверить новые токены и permissions на утверждённом test account; update/restart backend; provider ACK через утверждённый контакт |
| META_APP_SECRET / WEBHOOK_VERIFY_TOKEN | Backend webhook signature/challenge | Согласовать с Meta configuration; синхронизировать secret, подписанный test event accepted, tampered event403 |
| MISTRAL_API_KEY | Backend AI integration | Подтвердить новую key на synthetic data, update/restart backend, AI error →human; старую revoke после подтверждения |
| POSTGRES_PASSWORD или DATABASE_URL | PostgreSQL role + backend/migration jobs | Создать/проверить новый credential с минимальными runtime grants; update backend/jobs, restart pool; ready и read/write smoke; revoke old |
| GitHub / VPS credentials | Repository/deployment operators | Отдельная управляемая ротация вне CRM; не писать их в приложение, image, PR или logs |

## Последовательность

1. Зафиксировать текущий approved release, владельца действия и окно. Сохранить проверяемую пару PostgreSQL/files backup и список потребителей секрета. Старые значения хранить только в закрытом recovery storage.
2. На staging выполнить отрицательные проверки и rotation rehearsal. Смена signing secret инвалидирует все JWT; предупредить сотрудников о повторном входе. Password/role changes также меняют token_version.
3. Остановить приём новых исходящих отправок на время bridge rotation. Текущая система не имеет durable callback/outbox queue: короткая несовместимость ключей может потерять callback. Не обещать zero-downtime rotation. При отсутствии способа безопасно остановить поток — отложить production rotation до durable processing/провайдерского replay plan.
4. Изменить backend→bridge token в обоих env; изменить callback token в обоих env, сохраняя их различие. Restart services в согласованном окне, затем проверить аутентификацию в обе стороны. Старые ключи после полного restart больше не принимаются; dual-key grace period сейчас не реализован.
5. JWT rotation: заменить signing key и перезапустить все workers; проверить старый/новый login. Не оставлять workers с разными ключами.
6. Meta/AI keys заменять отдельно от service keys. Не revoke единственный рабочий provider credential до проверки нового. Изменение app secret синхронизировать с Meta, иначе реальные webhooks будут отвергнуты. Проверка реальных permissions/token scopes — BLOCKED до предоставления согласованного test account.
7. DB rotation: изменение `POSTGRES_PASSWORD` в Compose env не меняет пароль уже созданного PostgreSQL role. Нужен управляемый ALTER ROLE или новый role с проверенными grants, затем смена backend/jobs и restart pools. Пароль не передавать в shell argv/SQL history/logging. Прогнать migration read-only validation и connection checks. После успеха удалить старый credential.
8. Зафиксировать actor, тип секрета, время, release и результаты без значений/hash секретов. Health без прикладных запросов недостаточен.

## При ошибке

Остановить отправку/не делать автоматический replay. Сохранить failed/pending/claimed records для расследования. Если прежний credential не скомпрометирован и ещё действителен, согласованно вернуть его всем потребителям и перезапустить сервисы. Если скомпрометирован — закрыть доступ и выпустить новый вместо возврата. Не восстанавливать старую БД ради обычной ошибки конфигурации.

**Сохранность WhatsApp sessions:** auth volume/directories и их owner/permissions сохраняются. Token rotation не требует logout, удаления creds.json, копирования session на staging или повторного pairing. Не выполнять disconnect/logout как способ проверки ключа: это разрушает сессию. Backup auth state хранить отдельно, зашифрованно, с доступом только оператору; в source ZIP его нет.

## Выполненные отрицательные проверки

JWT expired/issuer/audience/signature/missing claims/disabled/reset →401; service missing/wrong/swapped token →401; unsafe staging/production settings rejected; Meta signature missing/tampered →403; synthetic secret in provider response/exception не попадает в response/log. Live rotation и provider acceptance — **BLOCKED**, эти tests не являются их подтверждением.
