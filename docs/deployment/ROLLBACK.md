# Recovery

Additive security tables and assignment/invitation/audit history are retained during code recovery. Alembic destructive downgrades intentionally refuse to drop business/security history.

For a failed staging release, stop workers and affected services, preserve failure logs without secrets, and restore a tested compatible application/configuration snapshot. Keep coordinated service authentication settings and restricted network bindings. The pre-security version is not a security-equivalent rollback; restoring it requires an explicit risk/mitigation decision rather than silently reopening unauthenticated bridge/API access.

For database recovery, restore a verified dump into an isolated database first and compare original IDs, finance values, KPI scores, role data and migration revision. A full database restore discards writes since the dump, so reconcile pending webhooks, outbound deliveries and files before cutover. Restore private document/session files under their original access controls. Do not log or publish recovered secrets.

The automated test verifies pg_dump/restore using synthetic databases only. Production backups and restore procedures have not been exercised in this iteration. The earlier `/root/insta-backups/company-20261103-054502` backup was created by the preceding deployment; its existence is not claimed as a verified production restore.
