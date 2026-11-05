# Communication verification

Дата: 2026-11-05. **DONE — локальные transport/HTTP contracts; live providers BLOCKED**.

| Test | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Anonymous/wrong/swapped bridge credentials | No QR/session/send access | HTTP 401 | PASS | whatsapp-bridge/tests/http.test.js |
| All three explicit sessions | Send only through requested session | account_1/2/3 selected independently | PASS | real Express route with injected session objects |
| Disconnected account_1 while 2/3 connected | No fallback | 503, no calls to other sessions | PASS | HTTP test + strictSession tests |
| Missing/invalid/unknown account | Fail closed | 400/503; zero provider calls | PASS | HTTP tests |
| Provider rejection/network/timeout/invalid JSON | Failure, same account, no fallback | normalized errors, one call | PASS | test_staging_communication.py, 15 parameter sets |
| Provider confirms wrong account | Reject result | provider_account_mismatch | PASS | test_security.py |
| Pending → provider ACK → sent | No premature sent | pending visible at provider boundary; then sent | PASS | test_pending_success_failure_and_ai_handoff |
| AI provider delivery failure | failed + human handoff | persisted failed, mode human | PASS | same test |
| Duplicate manual HTTP request | Provider called once | one message; repeats 200 or in-progress 409 | PASS | test_duplicate_manual_requests_do_not_send_twice |
| Changed payload under reused key | Reject | 409, no new send | PASS | same test |
| Missing/invalid Meta signatures | Denied before writes | 403, no message changes | PASS | test_security.py, test_webhooks.py |
| Sequential Meta / bridge duplicate | No second message | one persisted event/message | PASS | existing webhook tests |
| Concurrent comment-to-DM | One private reply | 4 signed parallel requests → one call | PASS | test_concurrent_comment_to_dm_is_sent_once |
| Missing external ID | No untracked message processing | Meta skipped, bridge 422 | PASS | test_missing_provider_ids_have_no_message_side_effects |
| Meta token expired / missing permission / 500 / timeout | Safe failure | normalized error, no secret echo | PASS | 16 contract cases |
| Failed comment private reply | No false sent | outbound failed without external ID | PASS | test_comment_provider_failure_is_recorded_as_failed |
| Real local bridge has no sessions | UI retains failed send/draft | persisted failed and draft retained | PASS | staging Playwright workflow; no provider connected |
| Live WhatsApp pairing/send | Approved test account/contact | Not attempted | BLOCKED | No agreed test accounts/mapping |
| Live Instagram Direct/comment-to-DM | Approved test IG + valid Meta permissions | Not attempted | BLOCKED | No agreed test account/credentials |

## Idempotency и неопределённая доставка

Meta/bridge event claim выполняется атомарным INSERT ON CONFLICT в существующую таблицу webhook_events. Missing IDs не обрабатываются. Claim коммитится до внешнего действия: concurrent duplicate suppression проверено, но recoverable delivery после process crash **не гарантируется**. `claimed` без завершения требует ручного расследования; unmatched/empty events помечаются ignored.

Manual send принимает optional `Idempotency-Key` (8–128 символов), связывает его с actor/conversation/text digest и возвращает сохранённый Message. UI генерирует UUID. In-progress или неопределённый результат возвращает 409, без автоматического replay. Старые API callers без заголовка не получают idempotency. Повтор с НОВЫМ ключом — новая команда отправки. Provider timeout не доказывает, что провайдер не принял сообщение.

**NO-GO risk:** volatile FastAPI background tasks и bridge callbacks не имеют durable retries/outbox/reconciliation. Нужны устойчивое хранение события до ACK, состояния processing/error, worker leases/retry limits и управляемая сверка provider ACK. Эта итерация не заявляет exactly-once или crash recovery.

Staging bridge: `BRIDGE_AUTO_START=false`, empty отдельный session volume, internal network без egress. Runtime default для существующего развёртывания по-прежнему auto-start; production sessions не читались и не изменялись. Service key и callback key различны. Direct bridge-port публикации нет.
