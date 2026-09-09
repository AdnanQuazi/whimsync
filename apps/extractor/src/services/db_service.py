import asyncpg

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger("db_service")


class DatabaseService:
    def __init__(self):
        self._pool: asyncpg.Pool | None = None

    async def get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                dsn=settings.DATABASE_URL,
                min_size=1,
                max_size=5,
            )
        return self._pool

    async def close(self):
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def update_status(self, ingestion_id: str, status: str) -> None:
        """Updates the status of an ingestion record."""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE ingestion_records
                SET status = $1::ingestion_status, updated_at = NOW()
                WHERE id = $2::uuid
                """,
                status,
                ingestion_id,
            )
        logger.info(f"Updated ingestion_records {ingestion_id} status -> {status}")

    async def update_parsing_complete(
        self,
        ingestion_id: str,
        markdown_storage_key: str,
        converted_pdf_storage_key: str | None = None,
    ) -> None:
        """Updates ingestion_records with markdown key and converted pdf key upon Stage 2 completion."""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE ingestion_records
                SET markdown_storage_key = $1,
                    converted_pdf_storage_key = COALESCE($2, converted_pdf_storage_key),
                    updated_at = NOW()
                WHERE id = $3::uuid
                """,
                markdown_storage_key,
                converted_pdf_storage_key,
                ingestion_id,
            )
        logger.info(
            f"Ingestion {ingestion_id} parsed -> markdown_storage_key={markdown_storage_key}"
        )


db_service = DatabaseService()
