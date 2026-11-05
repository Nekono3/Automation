"""Bounded content checks; these do not claim to replace malware scanning."""

from io import BytesIO
from pathlib import PurePath
from zipfile import ZipFile, BadZipFile
from fastapi import HTTPException

LIMIT = 10 * 1024 * 1024


def validate_document(content, content_type, name):
    original = name.replace("\\", "/")
    name = PurePath(original).name
    if not name or original != name or any(ord(c) < 32 for c in name):
        raise HTTPException(422, "Некорректное имя файла")
    extensions = {
        'application/pdf': {'.pdf'}, 'image/jpeg': {'.jpg', '.jpeg'}, 'image/png': {'.png'},
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'.docx'},
    }
    if PurePath(name).suffix.lower() not in extensions.get(content_type, set()):
        raise HTTPException(415, "Расширение файла не соответствует разрешённому формату")
    if not content or len(content) > LIMIT:
        raise HTTPException(413, "Размер документа: от 1 байта до 10 МБ")
    valid = False
    if content_type == "application/pdf":
        valid = content.startswith(b"%PDF-") and b"%%EOF" in content[-2048:]
    elif content_type == "image/jpeg":
        valid = content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9")
    elif content_type == "image/png":
        valid = content.startswith(b"\x89PNG\r\n\x1a\n") and content.endswith(
            b"IEND\xaeB`\x82"
        )
    elif (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        try:
            with ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                valid = (
                    len(entries) <= 1000
                    and sum(i.file_size for i in entries) <= 40 * 1024 * 1024
                    and {"[Content_Types].xml", "word/document.xml"}
                    <= set(archive.namelist())
                    and all(
                        not i.filename.startswith(("/", "\\"))
                        and ".." not in PurePath(i.filename.replace("\\", "/")).parts
                        for i in entries
                    )
                    and not any(i.filename.endswith("vbaProject.bin") for i in entries)
                    and archive.testzip() is None
                )
        except (BadZipFile, RuntimeError, ValueError):
            pass
    if not valid:
        raise HTTPException(
            415, "Содержимое файла не соответствует разрешённому формату"
        )
    return name
