"""Read local staging readiness/isolation; optional reversible local DB outage."""
import argparse
import json
from pathlib import Path
import ssl
import subprocess
import time
import urllib.request
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://localhost:8443'


def request(path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer '+token
    req = urllib.request.Request(BASE+path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ssl.create_default_context(cafile=str(ROOT/'.staging/tls/cert.pem')), timeout=15) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        try:
            result = json.load(error)
        except ValueError:
            result = {'error':'non_json_response'}
        return error.code, result


def docker(*args):
    return subprocess.check_output(['docker', *args], text=True)


def verify(outage=False):
    evidence = {}
    status, body = None, None
    for _ in range(20):
        try:
            status, body = request('/api/ready')
            if status == 200: break
        except (OSError, URLError): pass
        time.sleep(0.5)
    assert status == 200 and body == {'status':'ready'}
    evidence['readiness'] = 'PASS: HTTPS, trusted local certificate, 200 ready'
    config = json.loads(docker('compose', '--env-file', str(ROOT/'.staging/compose.env'), '-f', str(ROOT/'docker-compose.staging.yml'), 'config', '--format', 'json'))
    for service in ('backend', 'bridge', 'frontend'):
        assert config['services'][service]['networks'] == {'isolated': None}
    assert config['networks']['isolated']['internal']
    for service in ('postgres', 'gateway'):
        assert all(p['host_ip'] == '127.0.0.1' for p in config['services'][service]['ports'])
    mounts = json.loads(docker('inspect', 'consulteam-staging-postgres'))[0]['Mounts']
    assert any(m['Name']=='consulteam-staging_staging_db' for m in mounts)
    evidence['isolation'] = 'PASS: separate named PostgreSQL volume, loopback-only published ports; application services only on internal network'
    for service in ('backend', 'bridge', 'frontend'):
        container = json.loads(docker('inspect', 'consulteam-staging-'+service+'-1'))[0]
        assert container['State']['Health']['Status'] == 'healthy'
        assert not container['HostConfig']['PortBindings']
    evidence['healthchecks'] = 'PASS: backend, frontend, bridge healthy; no directly published service ports'
    if outage:
        account = next(a for a in json.loads((ROOT/'.staging/browser_accounts.json').read_text()) if a['role']=='director')
        code, login = request('/api/auth/login', {'email':account['email'], 'password':account['password']})
        assert code == 200
        token = login['access_token']
        account_code, account_status = request('/api/whatsapp/accounts', token=token)
        assert account_code == 200 and len(account_status) == 3
        assert all(a['live_status'] == 'disconnected' for a in account_status)
        check = "import os,urllib.request; req=urllib.request.Request(os.environ['BRIDGE_URL']+'/api/sessions',headers={'Authorization':'Bearer '+os.environ['BRIDGE_API_TOKEN']}); print(urllib.request.urlopen(req, timeout=3).status)"
        assert docker('exec', 'consulteam-staging-backend-1', 'python', '-c', check).strip() == '200'
        values = dict(line.split('=',1) for line in (ROOT/'.staging/backend.env').read_text().splitlines() if '=' in line)
        assert request('/webhooks/whatsapp-bridge', {}, token=values['BRIDGE_API_TOKEN'])[0] == 401
        evidence['bridge_service_auth'] = 'PASS: real backend-to-bridge authenticated HTTP 200; API token rejected as callback token (401); three disconnected synthetic accounts'
        # Hard-coded local staging container only. Always restart it in finally.
        try:
            docker('stop', 'consulteam-staging-postgres')
            code, result = request('/api/ready')
            assert code == 503 and result == {'status':'unavailable'}
            code, result = request('/api/company/leads', token=token)
            assert code == 503 and result == {'detail':'Сервис временно недоступен'}
            evidence['database_outage'] = 'PASS: stopped staging PostgreSQL; readiness and protected API returned sanitized 503'
        finally:
            docker('start', 'consulteam-staging-postgres')
        for _ in range(20):
            try:
                if request('/api/ready')[0] == 200: break
            except (OSError, URLError): pass
            time.sleep(0.5)
        assert request('/api/ready')[0] == 200
        assert request('/api/company/leads', token=token)[0] == 200
        evidence['database_recovery'] = 'PASS: readiness and authenticated API recovered without application restart'
    target = ROOT/'artifacts/iteration-015'
    target.mkdir(parents=True, exist_ok=True)
    (target/'staging-verification.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-outage', action='store_true', help='Stop and always restart ONLY consulteam-staging-postgres')
    verify(parser.parse_args().database_outage)
