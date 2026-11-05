# PostgreSQL migrations, preservation, backup / restore

Дата: 2026-11-05. **DONE — синтетический PostgreSQL 16; production verification BLOCKED**.

## Что выполнено

`python scripts/run_staging_tests.py -q tests/test_migrations.py` использует отдельный `consulteam-staging-postgres` (127.0.0.1:25432). Создаёт временные БД `insta_test_migration_<uuid>` и `insta_test_restore_<uuid>`; cleanup разрешён только для этих префиксов. Обычная CRM DB и старый контейнер не являются test targets.

| Test | Expected | Actual | Result | Evidence |
|---|---|---|---|---|
| Fresh install | Alembic head, приложение стартует | 0001_existing → 0002_security, HTTPS ready | PASS | Fresh consulteam_staging + initial insta_test_015 |
| Legacy unstamped DB | Verify перед stamp | Удалён version table только в синтетической БД; verifier перед stamp | PASS | test_migrations.py |
| Неверный column type | Verifier отклоняет baseline | customers.name TEXT detected; изменение отменено savepoint | PASS | same test |
| PK / FK / unique / indexes / nullability | Frozen baseline совпадает | verify() = [] | PASS | same test; verify_baseline.py |
| Legacy roles | IDs сохранены, 2 role aliases мигрировали | 42→director, 43→head_of_sales, 44 manager, 45 mentor | PASS | exact user map, 2 audit entries |
| Assignments / token version | Только явные связи | Lead→43, WA conversation→44, все token_version=0; mentor не угадан | PASS | same test |
| История и IDs | Строки и отношения сохранены | Exact before/after snapshots в 13 business tables | PASS | see fixture below |
| NUMERIC / KPI | Точные значения | 100.10 USD; 160 points | PASS | before migration, after migration, after restore |
| pg_dump / pg_restore | Реальный архив восстанавливается | Custom-format dump, --exit-on-error restore в новую БД | PASS | subprocess pg tools from staging container |
| Private file backup | Файл соответствует metadata после restore | Синтетический PDF, tar round trip, byte equality | PASS | source_documents → restored_documents |
| Referential integrity | Нет orphan relations | 4 explicit orphan queries = 0; FKs recreated by restore | PASS | deals/messages/admissions/finance |
| Restored ORM / backend | Читает записи, startup revision accepted | Student 86 / Message 94, lifespan succeeds | PASS | same test |
| Upgrade restored head | No accidental reapplication | Alembic upgrade head succeeds | PASS | same test |
| Destructive downgrade | Refused without loss | RuntimeError; revision stays 0002_security | PASS | same test |
| ORM vs current schema | No migration drift | No new upgrade operations detected | PASS | `alembic check` in staging image |
| Production baseline, realistic volume, locks | Approved copy and review | Not attempted | BLOCKED | Нет утверждённого production clone/rehearsal |
| Production backup restore | Real recovery drill | Not attempted | BLOCKED | Синтетический restore не заменяет production restore |

Fixture: users 42–45; customer 84; deal 85; enrolled student 86; admission link 87; account 88; conversation 89; category 90; finance transaction 91; seller 92; KPI record 93; message 94; private document metadata 95. Lead ID тоже входит в snapshots. Личные данные отсутствуют. Legacy text financial fields сохраняются как есть; новая финансовая модель в этой итерации не создаётся.

Новых migrations нет; PK, historical records и frozen baseline не переписывались. Alembic history имеет одну последовательность `0001_existing → 0002_security`.

## Восстановление на изолированной БД

Команды теста используют fixed staging container; имена ниже — ТОЛЬКО примеры новых тестовых БД:

```bash
docker exec consulteam-staging-postgres pg_dump -U staging -Fc insta_test_015 > synthetic.dump
docker exec consulteam-staging-postgres createdb -U staging insta_test_restore_manual
docker exec -i consulteam-staging-postgres pg_restore -U staging --exit-on-error -d insta_test_restore_manual < synthetic.dump
```

Файлы восстанавливаются в отдельный private directory, затем проверяются storage_key, размер, hash/байты и доступ через ORM/API с соответствующим assignment. Не подменять живой volume. Прогнать Alembic current/head, read-only schema check, counts, integrity и login. Для синтетической DB этот цикл автоматизирован; production-процедуру применять только после отдельного согласования и проверенного восстановления обеих частей — PostgreSQL и файлов.

Baseline mismatch — STOP для stamp. Не использовать `alembic stamp head` для устранения ошибки версии. Downgrade с удалением security-таблиц запрещён; совместимый code rollback сохраняет схему, полный data rollback требует проверенной пары backup DB + files и плана обработки записей после backup.
