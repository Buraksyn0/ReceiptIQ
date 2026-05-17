from typing import List, Union, Literal
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ReceiptIQ"
    API_V1_STR: str = "/api/v1"

    # JWT
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # PostgreSQL
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "receiptiq"
    POSTGRES_PORT: str = "5432"

    # CORS — virgülle ayrılmış string ya da liste kabul eder
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = "*"

    # === Faz 1: OCR & Storage ===
    # OCR_PROVIDER: "google_vision" | "tesseract"
    OCR_PROVIDER: Literal["google_vision", "tesseract"] = "tesseract"
    # Google Vision: GOOGLE_APPLICATION_CREDENTIALS env'den kullanılır
    # ya da burada bir path verilir
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    # Tesseract dil paketleri (TR varsa: "tur+eng")
    TESSERACT_LANG: str = "tur+eng"

    # Storage
    STORAGE_DIR: str = "storage"
    MAX_UPLOAD_SIZE_MB: int = 10

    # === Faz 3: RAG + LLM Chat ===
    OPENAI_API_KEY: str | None = None

    # === E-posta ===
    SENDGRID_API_KEY: str | None = None
    SENDGRID_FROM_EMAIL: str = "sayannburakks@gmail.com"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v == "*" or v == "":
                return ["*"]
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
