from pathlib import Path
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, Field, model_validator
import secrets

# Root project dir is one level up from backend
ROOT_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(ROOT_DIR / ".env", Path(__file__).resolve().parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )

    # Application
    APP_NAME: str = "INSTA CRM"
    ENVIRONMENT: Literal["development", "testing", "staging", "production"] = (
        "development"
    )
    DEBUG: bool = False
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(48))
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    PUBLIC_BASE_URL: str = ""

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

    # WhatsApp Business Cloud API
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""

    # AI Provider
    MISTRAL_API_KEY: str = ""
    AI_MODEL: str = "mistral-small-latest"

    # Initial Admin
    FIRST_ADMIN_EMAIL: str = "admin@instacrm.local"
    FIRST_ADMIN_PASSWORD: str = ""
    BOOTSTRAP_ENABLED: bool = False
    BRIDGE_URL: str = "http://127.0.0.1:3001"
    BRIDGE_API_TOKEN: str = ""
    BRIDGE_WEBHOOK_TOKEN: str = ""
    ACCESS_TOKEN_MINUTES: int = Field(default=60, ge=5, le=120)
    JWT_ISSUER: str = "consulteam-crm"
    JWT_AUDIENCE: str = "consulteam-staff"

    @model_validator(mode="after")
    def production_requirements(self):
        if self.ENVIRONMENT in ("production", "staging"):
            invalid = (
                "SECRET_KEY" not in self.model_fields_set
                or self.DEBUG
                or len(self.SECRET_KEY) < 32
                or self.SECRET_KEY.startswith("change_this")
                or "ALLOWED_ORIGINS" not in self.model_fields_set
                or not ({"DATABASE_URL", "POSTGRES_PASSWORD"} & self.model_fields_set)
                or "*" in self.cors_origins
                or not self.cors_origins
                or any(
                    not origin.startswith("https://") for origin in self.cors_origins
                )
                or len(self.BRIDGE_API_TOKEN) < 32
                or len(self.BRIDGE_WEBHOOK_TOKEN) < 32
                or self.BRIDGE_API_TOKEN == self.BRIDGE_WEBHOOK_TOKEN
                or self.BOOTSTRAP_ENABLED
            )
            if invalid:
                raise ValueError(
                    "Unsafe production configuration: debug, JWT, database, origins, bridge credentials or bootstrap"
                )
            if (self.META_ACCESS_TOKEN or self.WHATSAPP_ACCESS_TOKEN) and (
                not self.META_APP_SECRET or not self.WEBHOOK_VERIFY_TOKEN
            ):
                raise ValueError(
                    "Configured Meta integration requires webhook credentials"
                )
        return self

    @computed_field
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            # Ensure using asyncpg driver
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace(
                    "postgresql://", "postgresql+asyncpg://", 1
                )
            return self.DATABASE_URL
        from sqlalchemy.engine import URL

        return URL.create(
            "postgresql+asyncpg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)

    @computed_field
    @property
    def cors_origins(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]


settings = Settings()
