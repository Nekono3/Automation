"""Additive security catalog and explicit legacy-role migration. No business PK changes."""

import json
from pathlib import Path
from alembic import op
import sqlalchemy as sa

revision = "0002_security"
down_revision = "0001_existing"
branch_labels = None
depends_on = None


def upgrade():
    root = Path(__file__).parents[1]
    for statement in json.loads((root / "security_schema.json").read_text()):
        op.execute(statement)
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    grants = json.loads((root / "initial_grants.json").read_text())
    bind = op.get_bind()
    for code in grants["roles"]:
        bind.execute(sa.text("INSERT INTO roles (code) VALUES (:code)"), {"code": code})
    for code in grants["permissions"]:
        bind.execute(
            sa.text("INSERT INTO permissions (code) VALUES (:code)"), {"code": code}
        )
    for role, permissions in grants["grants"].items():
        for permission in permissions:
            bind.execute(
                sa.text(
                    "INSERT INTO role_permissions (role_code,permission_code) VALUES (:role,:permission)"
                ),
                {"role": role, "permission": permission},
            )
    op.execute("""INSERT INTO audit_logs (user_id,action,entity,entity_id,extra_data)
      SELECT NULL,'legacy_role_migrated','user',id,json_build_object('before',role,'after',CASE role WHEN 'admin' THEN 'director' ELSE 'head_of_sales' END)
      FROM users WHERE role IN ('admin','lead_manager')""")
    op.execute(
        "UPDATE users SET role=CASE role WHEN 'admin' THEN 'director' WHEN 'lead_manager' THEN 'head_of_sales' ELSE role END WHERE role IN ('admin','lead_manager')"
    )
    op.execute(
        """INSERT INTO lead_assignments (customer_id,user_id,reason)
      SELECT customer_id,assigned_user_id,'Existing explicit lead ownership' FROM company_leads WHERE assigned_user_id IS NOT NULL"""
    )
    op.execute(
        """INSERT INTO conversation_assignments (conversation_id,user_id,reason)
      SELECT c.id,u.id,'Existing explicit WhatsApp account binding' FROM conversations c JOIN users u ON u.whatsapp_account_id=c.whatsapp_account_id WHERE u.is_active=TRUE"""
    )


def downgrade():
    raise RuntimeError(
        "Preserve assignment/audit history: roll back compatible code without dropping security tables. See ROLLBACK.md."
    )
