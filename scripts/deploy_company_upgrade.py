#!/usr/bin/env python3
"""Apply the reviewed company upgrade on its existing VPS with automatic code rollback.
Run with the production backend virtualenv after the separate frontend build succeeds.
"""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time

parser = argparse.ArgumentParser()
parser.add_argument('--production', default='/opt/insta')
parser.add_argument('--release', default='/opt/insta-upgrade-20261103')
parser.add_argument('--patch', default='/tmp/insta-company-upgrade-final.tar.gz')
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
production, release, patch = Path(args.production), Path(args.release), Path(args.patch)
assert production.is_dir() and release.is_dir() and patch.is_file()
assert (release/'frontend/.next/BUILD_ID').is_file(), 'Build the release first'
with tarfile.open(patch) as archive:
    for member in archive.getmembers():
        assert not member.name.startswith('/') and '..' not in Path(member.name).parts
        assert member.isfile(), f'Unexpected patch entry: {member.name}'
if not args.apply:
    print('Patch and frontend build verified. Pass --apply to back up and switch services.')
    sys.exit(0)

os.umask(0o077)
backup = Path('/root/insta-backups') / ('company-'+datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S'))
backup.mkdir(parents=True, mode=0o700)
sys.path.insert(0,str(production/'backend'))
from app.config import settings
from sqlalchemy.engine import make_url
url = make_url(settings.async_database_url)
assert url.host in ('localhost','127.0.0.1',None), 'Expected local PostgreSQL'

def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)

async def counts():
    import asyncpg
    conn = await asyncpg.connect(user=url.username,password=url.password,host=url.host or 'localhost',port=url.port or 5432,database=url.database)
    result = {}
    for table in ('customers','conversations','messages','users','enrolled_students','deals','university_programs'):
        result[table]=await conn.fetchval(f'SELECT count(*) FROM {table}')
    await conn.close()
    return result

# Short maintenance window prevents writes between the dump and the new schema.
run(['systemctl','stop','insta-backend'])
frontend_switched = False
try:
    before = asyncio.run(counts())
    with (backup/'database.dump').open('wb') as output:
        run(['runuser','-u','postgres','--','pg_dump','-Fc',url.database],stdout=output)
    run(['tar','-C',str(production),'--exclude=.git','--exclude=frontend/node_modules',
         '--exclude=frontend/.next','--exclude=backend/.venv','--exclude=backend/.pytest_cache',
         '--exclude=whatsapp-bridge/node_modules','-czf',str(backup/'source.tar.gz'),'.'])
    (backup/'counts.json').write_text(json.dumps(before,indent=2))
    run(['tar','-C',str(production),'-xzf',str(patch)])
    # This process imported only the old config; table metadata is imported now from the patched source.
    from app.database import Base, engine
    import app.models
    async def migrate():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()
    asyncio.run(migrate())
    assert asyncio.run(counts())==before, 'Original row counts changed during migration'
    run(['systemctl','stop','insta-frontend'])
    shutil.move(str(production/'frontend/.next'),str(backup/'frontend.next'))
    shutil.move(str(release/'frontend/.next'),str(production/'frontend/.next'))
    frontend_switched = True
    run(['systemctl','start','insta-backend','insta-frontend'])
    import httpx
    for attempt in range(30):
        try:
            health=httpx.get('http://127.0.0.1:8000/api/health',timeout=3)
            page=httpx.get('http://127.0.0.1:3000/dashboard/finance',timeout=3)
            if health.status_code==200 and health.json().get('status')=='healthy' and page.status_code==200:
                break
        except httpx.HTTPError:
            pass
        time.sleep(1)
    else:
        raise RuntimeError('Service health checks failed')
    after=asyncio.run(counts())
    assert all(after[k]>=v for k,v in before.items()), 'Original record count decreased'
    (backup/'deployment.json').write_text(json.dumps({'release':str(release),'before':before,'after':after,'status':'healthy'},indent=2))
    print(json.dumps({'status':'healthy','backup':str(backup),'counts_before':before,'counts_after':after}))
except Exception:
    # Roll back code and build only; retain additive tables and any new business data.
    run(['systemctl','stop','insta-backend','insta-frontend'])
    if (backup/'source.tar.gz').is_file():
        run(['tar','-C',str(production),'-xzf',str(backup/'source.tar.gz')])
    if (backup/'frontend.next').is_dir():
        if (production/'frontend/.next').is_dir():
            shutil.move(str(production/'frontend/.next'),str(backup/'failed-frontend.next'))
        shutil.move(str(backup/'frontend.next'),str(production/'frontend/.next'))
    run(['systemctl','start','insta-backend','insta-frontend'])
    print(f'Code rollback completed. Backup: {backup}',file=sys.stderr)
    raise
