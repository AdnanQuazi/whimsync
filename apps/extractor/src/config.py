from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Redis / Valkey
    REDIS_URL: str = "redis://localhost:6379"

    # Database
    DATABASE_URL: str = "postgres://whimsync:whimsync_dev_pass@localhost:5432/whimsync"

    # MinIO Storage
    MINIO_ENDPOINT: str = "localhost"
    MINIO_PORT: int = 9000
    MINIO_ACCESS_KEY: str = "whimsync"
    MINIO_SECRET_KEY: str = "whimsync_dev_pass"
    MINIO_BUCKET: str = "whimsync-cold"
    MINIO_USE_SSL: bool = False
    MINIO_REGION: str = "us-east-1"

    @property
    def minio_url(self) -> str:
        if self.MINIO_ENDPOINT.startswith("http://") or self.MINIO_ENDPOINT.startswith("https://"):
            return self.MINIO_ENDPOINT
        scheme = "https" if self.MINIO_USE_SSL else "http"
        return f"{scheme}://{self.MINIO_ENDPOINT}:{self.MINIO_PORT}"

    # Google Gemini VLM
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    VLM_CONCURRENCY: int = 3
    VLM_DELAY_SECONDS: float = 0.5
    VLM_MAX_RETRIES: int = 3

    # Office Conversion
    LIBREOFFICE_PATH: str = "soffice"

    # Queue Names
    DOCUMENT_PARSING_QUEUE: str = "document-parsing"
    CHUNKING_QUEUE: str = "chunking"


settings = Settings()
