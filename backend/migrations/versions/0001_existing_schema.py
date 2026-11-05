"""Frozen snapshot of the existing 25-table schema, prior to security refactoring."""

import json
from pathlib import Path
from alembic import op

revision = "0001_existing"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    for statement in json.loads(
        (Path(__file__).parents[1] / "baseline_schema.json").read_text()
    ):
        op.execute(statement)


def downgrade():
    raise RuntimeError(
        "Baseline downgrade would delete business data. Restore a verified backup instead."
    )
