import traceback
from pathlib import Path

from bullmq import Job, Queue, Worker

from ..config import settings
from ..parsing.engine import parsing_engine
from ..schemas.parsing import ParseTier
from ..schemas.queue_jobs import ChunkingJobData, DocumentParsingJobData
from ..services.db_service import db_service
from ..services.office_converter import office_converter
from ..services.storage_service import storage_service
from ..utils.logger import get_logger
from ..utils.temp_manager import TempDirectoryManager

logger = get_logger("parser_consumer")

OFFICE_EXTENSIONS = {".docx", ".pptx", ".xlsx"}
PDF_EXTENSIONS = {".pdf"}


async def process_parsing_job(job: Job, token: str | None = None) -> None:
    """
    BullMQ worker job processor for Stage 2 binary document parsing.
    Flow: Office to PDF (if office) -> Tier-based PDF parse -> Link injection -> S3 upload -> Handoff to Chunking.
    """
    logger.info(f"Received job {job.id} on queue '{settings.DOCUMENT_PARSING_QUEUE}'")

    # 1. Parse and validate job data
    try:
        data = DocumentParsingJobData.model_validate(job.data)
    except Exception as e:
        logger.error(f"Invalid job payload on job {job.id}: {e}")
        raise

    ingestion_id = data.ingestion_id
    ext = data.file_extension.lower()
    tier = data.tier or ParseTier.SMART

    logger.info(
        f"Processing ingestion={ingestion_id} file={data.file_name} "
        f"ext={ext} tier={tier} tenant={data.tenant_id}"
    )

    # 2. Update status in database to 'parsing'
    try:
        await db_service.update_status(ingestion_id, "parsing")
    except Exception as e:
        logger.warning(f"Failed to update status to 'parsing' in database: {e}")

    try:
        with TempDirectoryManager(prefix=f"whimsync_{ingestion_id}_") as temp_dir:
            # 3. Download raw file from MinIO
            downloaded_file = temp_dir / f"raw{ext}"
            storage_service.download_file(data.storage_key, downloaded_file)

            # 4. Office Document Conversion
            converted_pdf_key: str | None = None
            if ext in OFFICE_EXTENSIONS:
                logger.info(
                    f"Converting office document {downloaded_file.name} to PDF via LibreOffice..."
                )
                pdf_path = office_converter.convert_to_pdf(
                    downloaded_file,
                    out_dir=temp_dir / "converted",
                )
                converted_pdf_key = (
                    f"uploads/{data.tenant_id}/{data.namespace}/{ingestion_id}/converted.pdf"
                )
                storage_service.upload_file(
                    pdf_path,
                    converted_pdf_key,
                    content_type="application/pdf",
                )
                # Immediately delete raw office document to minimize disk footprint
                try:
                    downloaded_file.unlink(missing_ok=True)
                    logger.info(
                        f"Unlinked raw office document {downloaded_file.name} to free disk space"
                    )
                except Exception as del_err:
                    logger.warning(f"Failed to unlink temporary office file: {del_err}")
            elif ext in PDF_EXTENSIONS:
                pdf_path = downloaded_file
            else:
                raise ValueError(f"Unsupported binary document extension: '{ext}'")

            # 5. Execute Tier-based Parsing Engine
            parsed_doc = await parsing_engine.parse(
                pdf_path=pdf_path,
                work_dir=temp_dir,
                tier=tier,
            )

            # 6. Upload parsed Markdown to MinIO
            markdown_key = f"uploads/{data.tenant_id}/{data.namespace}/{ingestion_id}/document.md"
            markdown_bytes = parsed_doc.markdown.encode("utf-8")
            storage_service.upload_bytes(
                data=markdown_bytes,
                storage_key=markdown_key,
                content_type="text/markdown; charset=utf-8",
            )

            # 7. Update DB records (markdownStorageKey, convertedPdfStorageKey)
            await db_service.update_parsing_complete(
                ingestion_id=ingestion_id,
                markdown_storage_key=markdown_key,
                converted_pdf_storage_key=converted_pdf_key,
            )

            # 8. Handoff to CHUNKING_QUEUE (BullMQ)
            chunking_queue = Queue(settings.CHUNKING_QUEUE, {"connection": settings.REDIS_URL})
            try:
                chunking_payload = ChunkingJobData(
                    ingestion_id=ingestion_id,
                    source_type="text_file",
                    storage_key=markdown_key,
                    pdf_storage_key=converted_pdf_key or data.storage_key,
                    file_name=f"{Path(data.file_name).stem}.md",
                    file_extension=".md",
                    tenant_id=data.tenant_id,
                    namespace=data.namespace,
                    user_id=data.user_id,
                    entity_key=data.entity_key,
                    session_id=data.session_id,
                )
                await chunking_queue.add(
                    "chunk",
                    chunking_payload.model_dump(by_alias=True, exclude_none=True),
                )
                logger.info(
                    f"Successfully enqueued ingestion {ingestion_id} to '{settings.CHUNKING_QUEUE}'"
                )
            finally:
                await chunking_queue.close()

            logger.info(f"Stage 2 parsing completed successfully for ingestion {ingestion_id}")

    except Exception as e:
        logger.error(
            f"Stage 2 parsing failed for ingestion {ingestion_id}: {e}\n{traceback.format_exc()}"
        )
        try:
            await db_service.update_status(ingestion_id, "failed")
        except Exception as db_err:
            logger.error(f"Failed to set status to 'failed' in DB: {db_err}")
        raise


def create_parser_worker(concurrency: int = 2) -> Worker:
    """Creates a BullMQ Worker instance listening on DOCUMENT_PARSING_QUEUE."""
    logger.info(
        f"Initializing BullMQ Worker on queue '{settings.DOCUMENT_PARSING_QUEUE}' "
        f"with concurrency={concurrency}"
    )
    worker = Worker(
        settings.DOCUMENT_PARSING_QUEUE,
        process_parsing_job,
        {
            "connection": settings.REDIS_URL,
            "concurrency": concurrency,
        },
    )

    worker.on(
        "completed",
        lambda job, result: logger.info(
            f"Job {job.id if job else 'unknown'} completed successfully"
        ),
    )
    worker.on(
        "failed",
        lambda job, err: logger.error(f"Job {job.id if job else 'unknown'} failed: {err}"),
    )
    worker.on(
        "error",
        lambda err: logger.error(f"BullMQ Worker connection/runtime error: {err}"),
    )

    return worker
