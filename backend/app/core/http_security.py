from uuid import uuid4
from app.models.audit import AuditLog
from app.database import AsyncSessionLocal


async def security_response(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Request-ID"] = uuid4().hex
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    actor = getattr(request.state, "actor_id", None)
    if actor is not None and request.method not in ("GET", "HEAD", "OPTIONS"):
        route = request.scope.get("route")
        async with AsyncSessionLocal() as db:
            db.add(
                AuditLog(
                    user_id=actor,
                    action=f"api.{request.method.lower()}.{response.status_code}",
                    entity="api",
                    extra_data={"route": getattr(route, "path", "unknown")},
                )
            )
            await db.commit()
    return response


class RequestSizeLimit:
    """Cap JSON and multipart bodies before unbounded parsing/spooling."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        from starlette.responses import JSONResponse
        from starlette.exceptions import HTTPException

        path = scope.get("path", "")
        maximum = (
            10 * 1024 * 1024 + 65536
            if path.endswith(("/documents", "/upload-attachment"))
            else 1024 * 1024
        )
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            declared = maximum + 1
        if declared > maximum:
            return await JSONResponse(
                {"detail": "Request body too large"}, status_code=413
            )(scope, receive, send)
        seen = 0

        async def bounded_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > maximum:
                    raise HTTPException(413, "Request body too large")
            return message

        await self.app(scope, bounded_receive, send)
