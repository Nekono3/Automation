from io import BytesIO
from zipfile import ZipFile
import pytest
from sqlalchemy import select, func
from app.models import EnrolledStudent
from app.models.company import StudentDocument
from tests.test_company import workspace
from tests.test_security import employee


def docx():
    output = BytesIO()
    with ZipFile(output, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        archive.writestr('word/document.xml', '<document/>')
    return output.getvalue()


@pytest.mark.asyncio
@pytest.mark.parametrize('name,mime,content,expected', [
    ('synthetic.pdf', 'application/pdf', b'%PDF-1.4\nSynthetic\n%%EOF', 201),
    ('synthetic.jpg', 'image/jpeg', b'\xff\xd8\xffsynthetic\xff\xd9', 201),
    ('synthetic.png', 'image/png', b'\x89PNG\r\n\x1a\nsyntheticIEND\xaeB`\x82', 201),
    ('synthetic.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docx(), 201),
    ('synthetic.exe', 'application/pdf', b'%PDF-1.4\n%%EOF', 415),
    ('synthetic.pdf', 'text/html', b'%PDF-1.4\n%%EOF', 415),
    ('forged.pdf', 'application/pdf', b'<html>synthetic</html>', 415),
    ('forged.png', 'image/png', b'%PDF-1.4\n%%EOF', 415),
    ('../../escape.pdf', 'application/pdf', b'%PDF-1.4\n%%EOF', 422),
    ('..\\escape.pdf', 'application/pdf', b'%PDF-1.4\n%%EOF', 422),
    ('empty.pdf', 'application/pdf', b'', 422),
    ('large.pdf', 'application/pdf', b'%PDF-'+b'x'*(10*1024*1024), 413),
])
async def test_private_upload_validation(workspace, name, mime, content, expected):
    c, db, director, _, auth = workspace
    student = EnrolledStudent(full_name='Synthetic documents', country='Synthetic')
    db.add(student)
    await db.commit()
    r = await c.post(f'/api/company/students/{student.id}/documents', params={'name': name},
                     headers={**auth(director), 'Content-Type': mime}, content=content)
    assert r.status_code == expected, r.text
    if expected == 201:
        assert 'storage_key' not in r.json()
        path = f"/api/company/documents/{r.json()['id']}/download"
        downloaded = await c.get(path, headers=auth(director))
        assert downloaded.status_code == 200 and downloaded.content == content
        assert downloaded.headers['cache-control'] == 'no-store'
        assert (await c.get(path)).status_code == 401
        for role in ('manager', 'finance_manager', 'operations_director', 'mentor'):
            unauthorized = await employee(db, role)
            assert (await c.get(path, headers=auth(unauthorized))).status_code in (403, 404)


@pytest.mark.asyncio
async def test_storage_failure_does_not_create_document(workspace, tmp_path, monkeypatch):
    from app.api.routes import company
    c, db, director, _, auth = workspace
    student = EnrolledStudent(full_name='Synthetic storage outage', country='Synthetic')
    db.add(student)
    await db.commit()
    inaccessible = tmp_path/'unavailable'
    inaccessible.write_text('This is a file, not a document directory')
    monkeypatch.setattr(company, 'PRIVATE_DOCUMENTS', inaccessible)
    r = await c.post(f'/api/company/students/{student.id}/documents?name=synthetic.pdf',
                     headers={**auth(director), 'Content-Type': 'application/pdf'}, content=b'%PDF-1.4\n%%EOF')
    assert r.status_code == 503 and str(inaccessible) not in r.text
    assert await db.scalar(select(func.count()).select_from(StudentDocument).where(StudentDocument.student_id == student.id)) == 0


def test_docx_rejects_unsafe_archive_entries():
    from app.core.files import validate_document
    from fastapi import HTTPException
    for entry in ('../escape', '..\\escape', '/absolute', 'word/vbaProject.bin'):
        output = BytesIO()
        with ZipFile(output, 'w') as archive:
            archive.writestr('[Content_Types].xml', '<Types/>')
            archive.writestr('word/document.xml', '<document/>')
            archive.writestr(entry, 'synthetic')
        with pytest.raises(HTTPException) as error:
            validate_document(output.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'synthetic.docx')
        assert error.value.status_code == 415
