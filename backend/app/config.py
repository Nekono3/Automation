from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field

# Root project dir is one level up from backend
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    APP_NAME: str = "INSTA CRM"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change_this_to_a_secure_random_string_in_production"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Database
    POSTGRES_USER: str = "insta_user"
    POSTGRES_PASSWORD: str = "insta_password"
    POSTGRES_DB: str = "insta_crm"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str | None = None

    # Meta / Instagram Graph API
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_ACCESS_TOKEN: str = ""
    INSTAGRAM_ACCOUNT_ID: str = ""
    WEBHOOK_VERIFY_TOKEN: str = "insta_crm_verify_token_dev"

    # AI Provider
    MISTRAL_API_KEY: str = ""
    AI_MODEL: str = "mistral-small-latest"

    # Initial Admin
    FIRST_ADMIN_EMAIL: str = "admin@instacrm.local"
    FIRST_ADMIN_PASSWORD: str = "AdminSecurePassword123!"

    @computed_field
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            # Ensure using asyncpg driver
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
