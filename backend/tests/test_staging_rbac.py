import pytest
from app.core.permissions import ROLES
from tests.test_company import workspace
from tests.test_security import employee


# Direct API decisions using real database role grants, never frontend mocks.
@pytest.mark.asyncio
@pytest.mark.parametrize('role', ROLES)
async def test_six_role_api_matrix(workspace, role):
    c, db, _, _, auth = workspace
    user = await employee(db, role)
    for path, allowed in [
        ('/api/security/catalog', {'director'}),
        ('/api/company/finance/report', {'director', 'finance_manager'}),
        ('/api/conversations/global-ai', {'director'}),
        ('/api/programs', set(ROLES)-{'finance_manager'}),
        ('/api/enrolled-students', {'director', 'operations_director', 'mentor'}),
        ('/api/company/leads', {'director', 'head_of_sales', 'manager'}),
        ('/api/company/kpi/results', set(ROLES)-{'finance_manager'}),
        ('/api/company/directory', set(ROLES)),
    ]:
        r = await c.get(path, headers=auth(user))
        assert r.status_code == (200 if role in allowed else 403), (role, path, r.status_code, r.text)
    if role != 'director':
        for path in ('/api/whatsapp/accounts', '/api/automations'):
            assert (await c.get(path, headers=auth(user))).status_code == 403


@pytest.mark.asyncio
async def test_object_scope_applies_before_customer_pagination(workspace):
    c, db, director, manager, auth = workspace
    outsider = await employee(db, 'manager')
    own = []
    for i in range(6):
        owner = outsider if i % 2 == 0 else manager
        result = await c.post('/api/company/leads', headers=auth(director), json={
            'name': 'Synthetic pagination', 'assigned_user_id': owner.id})
        assert result.status_code == 201
        if owner == manager: own.append(result.json()['customer']['id'])
    all_rows = (await c.get('/api/customers?limit=100', headers=auth(manager))).json()
    assert {int(row['id']) for row in all_rows} == set(own)
    first = (await c.get('/api/customers?skip=0&limit=2', headers=auth(manager))).json()
    second = (await c.get('/api/customers?skip=2&limit=2', headers=auth(manager))).json()
    assert len(first) == 2 and len(second) == 1
    assert {int(row['id']) for row in first+second} == set(own)


@pytest.mark.asyncio
async def test_mentor_statistics_are_scoped_like_student_list(workspace):
    from app.models import EnrolledStudent
    from app.modules.security.models import StudentAssignment
    c, db, director, _, auth = workspace
    mentor = await employee(db, 'mentor')
    own = EnrolledStudent(full_name='Synthetic assigned', country='Own synthetic country', is_completed=True)
    other = EnrolledStudent(full_name='Synthetic other', country='Foreign synthetic country')
    db.add_all([own, other])
    await db.flush()
    db.add(StudentAssignment(student_id=own.id, user_id=mentor.id))
    await db.commit()
    result = await c.get('/api/enrolled-students/stats', headers=auth(mentor))
    assert result.status_code == 200
    stats = result.json()
    assert stats['total_students'] == 1 and stats['completed_count'] == 1 and stats['in_process_count'] == 0
    assert stats['countries_breakdown'] == {'Own synthetic country':1}
    assert (await c.get('/api/enrolled-students/stats', headers=auth(director))).json()['total_students'] >= 2
    finance = await employee(db, 'finance_manager')
    assert (await c.get('/api/enrolled-students/stats', headers=auth(finance))).status_code == 403
