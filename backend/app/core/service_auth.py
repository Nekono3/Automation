import hashlib
import hmac
import time
from fastapi import HTTPException
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from app.config import settings
from app.modules.security.models import RateBucket


async def limit_request(db, request, bucket, limit):
    # Use the direct peer. Do not trust arbitrary client-supplied forwarding headers.
    peer = request.client.host if request.client else "unknown"
    key = hashlib.sha256(f"{bucket}:{peer}".encode()).hexdigest()
    window = int(time.time() // 60)
    await db.execute(delete(RateBucket).where(RateBucket.window < window - 2))
    statement = insert(RateBucket).values(key=key, window=window, count=1)
    count = await db.scalar(
        statement.on_conflict_do_update(
            index_elements=["key", "window"], set_={"count": RateBucket.count + 1}
        ).returning(RateBucket.count)
    )
    await db.commit()
    if count > limit:
        raise HTTPException(
            429, "Слишком много запросов", headers={"Retry-After": "60"}
        )


async def verify_bridge_request(request, db):
    expected = settings.BRIDGE_WEBHOOK_TOKEN
    header = request.headers.get("authorization", "")
    if len(expected) < 32 or not hmac.compare_digest(
        header.encode("utf-8"), f"Bearer {expected}".encode("utf-8")
    ):
        raise HTTPException(401, "Bridge authentication required")
    await limit_request(db, request, "bridge", 300)
