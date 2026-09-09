import asyncio
import signal
import sys

from .config import settings
from .consumers.parser_consumer import create_parser_worker
from .services.db_service import db_service
from .utils.logger import get_logger

logger = get_logger("main")


async def main():
    logger.info("Starting Whimsync Binary Parser Worker (Stage 2)...")
    logger.info(f"Connecting to Redis at: {settings.REDIS_URL}")
    logger.info(f"Listening on queue: '{settings.DOCUMENT_PARSING_QUEUE}'")
    logger.info(f"Using MinIO bucket: '{settings.MINIO_BUCKET}' at {settings.minio_url}")

    worker = create_parser_worker(concurrency=2)
    stop_event = asyncio.Event()

    def _signal_handler():
        logger.info("Shutdown signal received. Stopping worker gracefully...")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows does not support add_signal_handler for all signals
            pass

    try:
        # Keep running until stop_event is triggered
        while not stop_event.is_set():
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Worker interrupted by user.")
    finally:
        logger.info("Closing BullMQ worker...")
        await worker.close()
        logger.info("Closing database pool...")
        await db_service.close()
        logger.info("Whimsync Binary Parser Worker shutdown complete.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
