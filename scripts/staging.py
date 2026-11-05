"""Generate isolated LOCAL staging secrets without reading the application's .env."""
import argparse
import os
from pathlib import Path
import secrets
import subprocess
import json

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.staging'


def init():
    if STATE.exists():
        raise SystemExit('Existing .staging directory preserved. Reuse it; credentials were not changed.')
    os.umask(0o077)
    STATE.mkdir(mode=0o700)
    db, jwt, api, callback = (secrets.token_urlsafe(48) for _ in range(4))
    (STATE / 'compose.env').write_text('STAGING_DB_PASSWORD=' + db + '\nPOSTGRES_PASSWORD=' + db + '\n')
    (STATE / 'backend.env').write_text('\n'.join([
        'ENVIRONMENT=staging', 'DEBUG=false', 'SECRET_KEY=' + jwt,
        'ALLOWED_ORIGINS=https://localhost:8443,https://127.0.0.1:8443',
        'POSTGRES_HOST=postgres', 'POSTGRES_USER=staging', 'POSTGRES_DB=consulteam_staging',
        'POSTGRES_PASSWORD=' + db, 'BRIDGE_URL=http://bridge:3001',
        'BRIDGE_API_TOKEN=' + api, 'BRIDGE_WEBHOOK_TOKEN=' + callback,
        'META_APP_SECRET=', 'META_ACCESS_TOKEN=', 'WHATSAPP_ACCESS_TOKEN=', 'MISTRAL_API_KEY=',
        'BOOTSTRAP_ENABLED=false', '',
    ]))
    (STATE / 'bridge.env').write_text('\n'.join([
        'BRIDGE_HOST=0.0.0.0', 'PORT=3001', 'BRIDGE_AUTO_START=false',
        'BRIDGE_API_TOKEN=' + api, 'BRIDGE_WEBHOOK_TOKEN=' + callback,
        'CRM_WEBHOOK_URL=http://backend:8000/webhooks/whatsapp-bridge', '',
    ]))
    tls = STATE / 'tls'
    tls.mkdir()
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
                    '-keyout', str(tls / 'key.pem'), '-out', str(tls / 'cert.pem'),
                    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('Local staging initialized. Secrets are only in ignored .staging files (0600).')


def seed():
    os.umask(0o077)
    accounts_file = STATE / 'browser_accounts.json'
    if accounts_file.exists():
        raise SystemExit('Existing staging identities preserved. No passwords were changed.')
    roles = ['director', 'head_of_sales', 'manager', 'mentor', 'operations_director', 'finance_manager']
    accounts = [{'role': role, 'email': role+'@staging.example.test', 'password': secrets.token_urlsafe(24)} for role in roles]
    accounts_file.write_text(json.dumps(accounts))
    subprocess.run(['docker', 'compose', '--env-file', str(STATE/'compose.env'), '-f', str(ROOT/'docker-compose.staging.yml'),
                    'run', '--rm', '-T', '--no-deps', 'backend', 'python', '-m', 'scripts.seed_staging'],
                   input=json.dumps(accounts), text=True, check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'seed'])
    args = parser.parse_args()
    (init if args.action == 'init' else seed)()
