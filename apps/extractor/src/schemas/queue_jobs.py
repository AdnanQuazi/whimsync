from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class BaseQueueJob(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class DocumentParsingJobData(BaseQueueJob):
    ingestion_id: str
    storage_key: str
    file_name: str
    file_extension: str
    tenant_id: str
    namespace: str
    user_id: str
    entity_key: str | None = None
    session_id: str | None = None
    tier: Literal["fast", "smart", "max"] | None = "smart"


class ChunkingJobData(BaseQueueJob):
    ingestion_id: str
    source_type: Literal["text_file", "inline_text"] = "text_file"
    storage_key: str | None = None
    pdf_storage_key: str | None = None
    raw_text_inline: str | None = None
    file_name: str | None = None
    file_extension: str | None = ".md"
    tenant_id: str
    namespace: str
    user_id: str
    entity_key: str | None = None
    session_id: str | None = None
