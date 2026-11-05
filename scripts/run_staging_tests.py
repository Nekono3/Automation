"""Run backend checks only against the independently generated staging PostgreSQL."""
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def test_environment():
    values = dict(line.split('=', 1) for line in (ROOT/'.staging/backend.env').read_text().splitlines() if '=' in line)
    return {**os.environ, **values, 'ENVIRONMENT': 'testing', 'POSTGRES_HOST': '127.0.0.1', 'POSTGRES_PORT': '25432',
            'TEST_DATABASE_URL': 'postgresql+asyncpg://staging:'+quote(values['POSTGRES_PASSWORD'], safe='')+'@127.0.0.1:25432/insta_test_015',
            'PG_TEST_CONTAINER': 'consulteam-staging-postgres'}


if __name__ == '__main__':
    # This fixed container and fixed database name cannot target the CRM database.
    result = subprocess.run(['docker', 'exec', 'consulteam-staging-postgres', 'psql', '-U', 'staging', '-d', 'postgres', '-Atc',
                             "SELECT 1 FROM pg_database WHERE datname='insta_test_015'"], check=True, capture_output=True, text=True)
    if result.stdout.strip() != '1':
        subprocess.run(['docker', 'exec', 'consulteam-staging-postgres', 'createdb', '-U', 'staging', 'insta_test_015'], check=True)
    raise SystemExit(subprocess.run([str(ROOT/'backend/.venv/bin/python'), '-m', 'pytest', *(sys.argv[1:] or ['-q'])],
                                   cwd=ROOT/'backend', env=test_environment()).returncode)
