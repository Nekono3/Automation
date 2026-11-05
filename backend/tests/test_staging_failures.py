import pytest
from sqlalchemy.exc import OperationalError
from app.main import app
from app.database import get_db
from tests.test_company import workspace


@pytest.mark.asyncio
async def test_database_readiness_failure_is_sanitized(workspace, caplog):
    c, _, _, _, _ = workspace
    secret = 'synthetic-sensitive-database-error'
    class Unavailable:
        async def scalar(self, *args, **kwargs): raise ConnectionRefusedError(secret)
        async def execute(self, *args, **kwargs): raise ConnectionRefusedError(secret)
    async def unavailable(): yield Unavailable()
    app.dependency_overrides[get_db] = unavailable
    result = await c.get('/api/ready')
    assert result.status_code == 503 and result.json() == {'status':'unavailable'}
    result = await c.get('/api/health')
    assert result.status_code == 200 and result.json()['database'] == 'disconnected'
    assert secret not in result.text and secret not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize('failure', ['sql', 'dns', 'connection', 'timeout'])
async def test_database_exception_is_safe_503(workspace, caplog, failure):
    c, _, director, _, auth = workspace
    secret = 'synthetic-sensitive-database-parameters'
    async def unavailable():
        import socket
        exception = {'sql': OperationalError('SELECT 1', {'secret':secret}, Exception(secret)), 'dns': socket.gaierror(secret), 'connection': ConnectionRefusedError(secret), 'timeout': TimeoutError(secret)}[failure]
        raise exception
        yield
    app.dependency_overrides[get_db] = unavailable
    result = await c.get('/api/company/leads', headers=auth(director))
    assert result.status_code == 503 and secret not in result.text and secret not in caplog.text
