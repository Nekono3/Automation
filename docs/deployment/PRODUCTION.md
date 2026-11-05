# Production release — approval required

**This iteration has not been deployed.** The previous company upgrade remains on production. The old deploy_company_upgrade.py apply mode is disabled because its create_all path is not suitable for this security release.

Before a separately approved release:

- Complete staging and verify backup restoration. Capture PostgreSQL, private documents, published guides, deployment configuration and Baileys sessions into access-controlled backups. Keep secrets/session backups outside Git and release ZIPs.
- Confirm actual account-to-employee mapping and all team/mentor assignments. Do not infer identities from account_1/2/3 or spreadsheet names.
- Review production schema with the baseline verifier. Approve the stamp/migration plan and a restoration window; migrations are never blindly stamped.
- Set strict production configuration and independently generated service secrets in protected environment files/secret storage. Plan controlled reset of formerly fixed staff passwords and forced reauthentication for the new JWT claim policy. Do not print secrets in deployment output.
- Deploy backend/bridge authentication changes together during a controlled integration maintenance window. Preserve AUTH_DIR and private documents. Restrict service listeners/firewall to loopback/private network. Remove the old Caddy /whatsapp-qr→bridge public proxy; manage QR via the authenticated CRM API. Bridge bind configuration alone is not proof of firewall isolation.
- Build reviewed frontend source with TypeScript validation enabled. Apply approved Alembic migration, start services, then perform read-only health/auth/object-scope checks. Conduct provider sends only to authorized test identities.

Record commit, migration revision, backup locations, verified restore evidence and observed checks. Do not claim business integration readiness without provider-level acceptance. Logs must not contain personal messages, credentials or document contents.
