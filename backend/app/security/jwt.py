from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt

from app.config import settings

ALGORITHM = "HS256"


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Encodes a JWT access token with expiration timestamp."""
    to_encode = {"session_version":0,**data}
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc), "iss": settings.JWT_ISSUER, "aud": settings.JWT_AUDIENCE})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token. Returns payload or None if invalid/expired."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM], issuer=settings.JWT_ISSUER, audience=settings.JWT_AUDIENCE, options={"require": ["sub", "exp", "iat", "iss", "aud"]})
        return payload
    except jwt.PyJWTError:
        return None
