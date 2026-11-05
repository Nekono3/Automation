from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserLogin, TokenResponse, UserRead
from app.services.user_service import UserService
from app.security.jwt import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """Logs in user with email and password, returning a JWT access token."""
    from app.core.service_auth import limit_request
    from app.models.audit import AuditLog
    await limit_request(db,request,"login",10)
    user = await UserService.authenticate(db, credentials.email, credentials.password)
    db.add(AuditLog(user_id=user.id if user else None,action="login_success" if user else "login_failed",entity="authentication",extra_data={}))
    await db.commit()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    from app.core.permissions import load_permissions
    await load_permissions(db,user)
    token = create_access_token(data={"sub": str(user.id), "role": user.role, "session_version":user.token_version})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Returns profile of currently authenticated user."""
    return UserRead.model_validate(current_user)

from pydantic import BaseModel,Field,field_validator
class AcceptInvitation(BaseModel):
    token:str=Field(min_length=40,max_length=128)
    password:str=Field(min_length=12,max_length=72)
    @field_validator('password')
    @classmethod
    def password_bytes(cls,value):
        if len(value.encode('utf-8'))>72:raise ValueError('Пароль превышает 72 байта')
        return value

@router.post('/accept-invitation')
async def accept_employee_invitation(data:AcceptInvitation,request:Request,db:AsyncSession=Depends(get_db)):
    from app.core.service_auth import limit_request
    from app.modules.security.service import accept_invitation
    await limit_request(db,request,'invitation',10)
    await accept_invitation(db,data.token,data.password)
    return {'status':'password_set'}
