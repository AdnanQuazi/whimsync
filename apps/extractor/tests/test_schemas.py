from src.schemas.parsing import PageComplexity, ParseTier
from src.schemas.queue_jobs import ChunkingJobData, DocumentParsingJobData


def test_document_parsing_job_data_camel_case_deserialization():
    raw_payload = {
        "ingestionId": "11111111-1111-1111-1111-111111111111",
        "storageKey": "uploads/org_123/default/1111/raw.pdf",
        "fileName": "report.pdf",
        "fileExtension": ".pdf",
        "tenantId": "org_123",
        "namespace": "default",
        "userId": "user_456",
        "entityKey": "customer_999",
        "sessionId": "session_abc",
        "tier": "smart",
    }

    job_data = DocumentParsingJobData.model_validate(raw_payload)

    assert job_data.ingestion_id == "11111111-1111-1111-1111-111111111111"
    assert job_data.storage_key == "uploads/org_123/default/1111/raw.pdf"
    assert job_data.file_name == "report.pdf"
    assert job_data.file_extension == ".pdf"
    assert job_data.tenant_id == "org_123"
    assert job_data.namespace == "default"
    assert job_data.user_id == "user_456"
    assert job_data.entity_key == "customer_999"
    assert job_data.session_id == "session_abc"
    assert job_data.tier == "smart"


def test_chunking_job_data_camel_case_serialization():
    chunking_job = ChunkingJobData(
        ingestion_id="22222222-2222-2222-2222-222222222222",
        source_type="text_file",
        storage_key="uploads/org_123/default/2222/document.md",
        pdf_storage_key="uploads/org_123/default/2222/converted.pdf",
        file_name="document.md",
        file_extension=".md",
        tenant_id="org_123",
        namespace="default",
        user_id="user_456",
    )

    serialized = chunking_job.model_dump(by_alias=True, exclude_none=True)

    assert serialized["ingestionId"] == "22222222-2222-2222-2222-222222222222"
    assert serialized["sourceType"] == "text_file"
    assert serialized["storageKey"] == "uploads/org_123/default/2222/document.md"
    assert serialized["pdfStorageKey"] == "uploads/org_123/default/2222/converted.pdf"
    assert serialized["fileName"] == "document.md"
    assert serialized["fileExtension"] == ".md"
    assert serialized["tenantId"] == "org_123"
    assert serialized["namespace"] == "default"
    assert serialized["userId"] == "user_456"


def test_parse_tier_enum():
    assert ParseTier.FAST == "fast"
    assert ParseTier.SMART == "smart"
    assert ParseTier.MAX == "max"
    assert ParseTier("fast") == ParseTier.FAST
    assert ParseTier("smart") == ParseTier.SMART
    assert ParseTier("max") == ParseTier.MAX


def test_page_complexity_model():
    complexity = PageComplexity(
        page_number=0,
        needs_ocr=True,
        reasons=["scanned"],
        is_garbled=False,
        full_page_image=True,
        text_coverage=0.01,
        image_coverage=0.95,
        vg_coverage=0.0,
        text_length=15,
    )

    assert complexity.needs_ocr is True
    assert "scanned" in complexity.reasons
    assert complexity.full_page_image is True
