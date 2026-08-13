from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

from app.data.storage import storage_db
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    public_user,
)

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=72)
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateMeRequest(BaseModel):
    nickname: Optional[str] = None
    avatarUrl: Optional[str] = None


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> Dict[str, Any]:
    if storage_db.get_user_by_username(body.username):
        raise HTTPException(status_code=400, detail="用户名已被注册")

    user = storage_db.create_user(
        username=body.username,
        hashed_pwd=hash_password(body.password),
        email=body.email,
    )
    token = create_access_token(user["id"])
    return {"accessToken": token, "user": public_user(user)}


@router.post("/login")
def login(body: LoginRequest) -> Dict[str, Any]:
    user = storage_db.get_user_by_username(body.username)
    if not user or not verify_password(body.password, user["hashed_pwd"]):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token(user["id"])
    return {"accessToken": token, "user": public_user(user)}


@router.get("/me")
def read_me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return public_user(user)


@router.put("/me")
def update_me(body: UpdateMeRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    updated = storage_db.update_user(user["id"], nickname=body.nickname, avatar_url=body.avatarUrl)
    return public_user(updated)
