from typing import AsyncGenerator, Optional
import uuid
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.schemas.token import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    try:
        user_id = uuid.UUID(token_data.sub)
    except ValueError:
        raise credentials_exception
        
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


async def _decode_token(token: str, db: AsyncSession) -> User:
    """Token string'inden kullanıcıyı çözer."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        token_data = TokenPayload(**payload)
        if token_data.sub is None:
            raise credentials_exception
        user_id = uuid.UUID(token_data.sub)
    except (JWTError, ValueError):
        raise credentials_exception
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_or_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_query: Optional[str] = Query(None, alias="token"),
) -> User:
    """
    Önce Authorization header'ına, sonra ?token= query param'ına bakar.
    React Native Image komponenti header gönderemediğinde query param kullanılır.
    """
    # 1. Header'dan dene
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return await _decode_token(auth[7:], db)
    # 2. Query param'dan dene
    if token_query:
        return await _decode_token(token_query, db)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
