from pydantic_settings import BaseSettings
from typing import Optional
import secrets
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    PROJECT_NAME: str = "InvestScope API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"

    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

if not settings.JWT_SECRET_KEY:
    settings.JWT_SECRET_KEY = secrets.token_hex(32)
    logger.warning(
        "未设置 JWT_SECRET_KEY 环境变量，已生成临时随机密钥（服务重启后所有旧 token 将失效）。"
        "生产环境请在 server/.env 中设置固定的 JWT_SECRET_KEY。"
    )

