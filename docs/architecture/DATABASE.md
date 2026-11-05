# Database changes

Baseline: frozen DDL for the existing 25 tables in backend/migrations/baseline_schema.json. Neither historical IDs nor business columns are renamed or removed. Legacy FLOAT values in deals/program fee estimates remain a documented phase-7 migration; the cash journal uses NUMERIC.

Revision 0002_security adds roles, permissions, role_permissions, user_roles, user_permissions, teams, team_members, lead_assignments, student_assignments, conversation_assignments, employee_invitations and security_rate_buckets, plus users.token_version. Primary role stays on users; user_roles holds optional additional roles only. This avoids retaining an old director role accidentally after changing the primary role.

Legacy role migration updates only admin→director and lead_manager→head_of_sales, preserving manager/mentor and recording before/after in audit_logs. Unknown roles receive no permissions until reviewed. Existing explicit lead owners and WhatsApp account bindings are copied into assignment history. Mentor assignments and team memberships are **not inferred from names, spreadsheet text or technical account IDs**.

Partial unique indexes prevent duplicate active student/conversation assignments for the same user/object. Assignment changes lock the parent record and retain released rows. Foreign keys restrict deleting identities/objects with history. The existing broad cascading relationships are not silently rewritten; archiving and retention require a separate reviewed migration.

Startup requires revision 0002_security. It performs no create_all, ALTER TABLE, staff seeding or spreadsheet import. New databases run both revisions; legacy databases must pass the read-only baseline comparison before manually stamping 0001_existing. See development/MIGRATIONS.md.
