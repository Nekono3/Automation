"""Read-only comparison before manually stamping a legacy database. No customer rows read."""

import asyncio, json
from pathlib import Path
from sqlalchemy import inspect
from app.database import engine

MANIFEST = Path(__file__).parents[1] / "migrations/baseline_manifest.json"


def verify(connection):
    inspector = inspect(connection)
    expected = json.loads(MANIFEST.read_text())
    problems = []
    tables = set(inspector.get_table_names())
    for name, spec in expected.items():
        if name not in tables:
            problems.append(f"{name}: missing table")
            continue
        actual = {c["name"]: c for c in inspector.get_columns(name)}
        for field, column in spec["columns"].items():
            value = actual.get(field)
            if (
                value is None
                or str(value["type"].compile(dialect=connection.dialect)).replace(
                    "DOUBLE PRECISION", "FLOAT"
                )
                != column["type"].replace("DOUBLE PRECISION", "FLOAT")
                or value["nullable"] != column["nullable"]
            ):
                problems.append(f"{name}.{field}: schema mismatch")
        if (
            inspector.get_pk_constraint(name)["constrained_columns"]
            != spec["primary_key"]
        ):
            problems.append(f"{name}: primary key mismatch")
        actual_unique = {
            tuple(c["column_names"]) for c in inspector.get_unique_constraints(name)
        }
        for columns in spec["unique_constraints"]:
            if tuple(columns) not in actual_unique:
                problems.append(f"{name}: missing unique constraint")
        indexes = {index["name"]: index for index in inspector.get_indexes(name)}
        for expected_index in spec["indexes"]:
            actual_index = indexes.get(expected_index["name"])
            if (
                not actual_index
                or actual_index["column_names"] != expected_index["columns"]
                or bool(actual_index["unique"]) != bool(expected_index["unique"])
            ):
                problems.append(
                    f"{name}: missing or changed index {expected_index['name']}"
                )
        fks = {
            (
                tuple(fk["constrained_columns"]),
                f"{fk['referred_table']}.{fk['referred_columns'][0]}",
            )
            for fk in inspector.get_foreign_keys(name)
        }
        for fk in spec["foreign_keys"]:
            if (tuple(fk["columns"]), fk["target"]) not in fks:
                problems.append(f"{name}: missing foreign key")
    return problems


async def main():
    async with engine.connect() as conn:
        problems = await conn.run_sync(verify)
    await engine.dispose()
    if problems:
        print("\n".join(problems))
        raise SystemExit(1)
    print(
        "All 25 baseline tables match required columns, types, nullability, keys, uniqueness, indexes and foreign keys. No stamp performed."
    )


if __name__ == "__main__":
    asyncio.run(main())
