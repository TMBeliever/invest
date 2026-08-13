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

    JWT_SECRET_KEY: str = "investscope_permanent_secret_key_2026_dev_key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

