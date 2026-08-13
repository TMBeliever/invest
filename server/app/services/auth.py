import datetime
import bcrypt
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Any

from app.config import settings
from app.data.storage import storage_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# bcrypt 本身限制密码明文最长 72 字节，超出部分直接截断
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    pwd_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> str:
    """解码 JWT，返回 user_id (sub)。失败抛 401。"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的登录凭证")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录凭证已过期或无效，请重新登录")


def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    user_id = decode_access_token(token)
    user = storage_db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """去除 hashed_pwd 等敏感字段，转为前端可用的 camelCase"""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user.get("email"),
        "nickname": user.get("nickname"),
        "avatarUrl": user.get("avatar_url"),
        "createdAt": user.get("created_at"),
    }
