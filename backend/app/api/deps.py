from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.security.jwt import decode_access_token
from app.services.user_service import UserService

security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the JWT Bearer token from the request."""
    if getattr(request.state, 'authenticated_user', None) is not None:
        return request.state.authenticated_user
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(payload["sub"])
        if user_id <= 0: raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    user = await UserService.get_by_id(db, user_id)
    if not user or not user.is_active or payload.get("session_version",0) != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.core.permissions import load_permissions
    await load_permissions(db, user)
    request.state.actor_id = user.id
    request.state.authenticated_user = user
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that checks if the authenticated user has admin role."""
    from app.core.permissions import require
    require(current_user,"settings.manage")
    return current_user
