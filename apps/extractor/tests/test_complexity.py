import pymupdf

from src.parsing.complexity import analyze_page_complexity


def test_analyze_empty_page():
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=800)

    complexity = analyze_page_complexity(page, page_number=0)

    assert complexity.page_number == 0
    assert complexity.text_length == 0
    assert complexity.full_page_image is False
    assert complexity.is_empty is True
    assert "empty" in complexity.reasons
    assert complexity.needs_ocr is False
    doc.close()


def test_analyze_digital_text_page():
    doc = pymupdf.open()
    page = doc.new_page(width=600, height=800)

    # Insert plenty of digital text across multiple paragraphs
    text = (
        "Whimsync is an agentic memory infrastructure designed for ultra-low latency "
        "retrieval and atomic status transitions. It utilizes PostgreSQL with pgvector, "
        "Redis with BullMQ, and S3-compatible storage. This document serves as a "
        "specification for multi-stage file ingestion and citation bounding box generation."
    )
    for i in range(10):
        page.insert_text(pymupdf.Point(50, 50 + (i * 30)), text)

    complexity = analyze_page_complexity(page, page_number=0)

    assert complexity.page_number == 0
    assert complexity.text_length > 200
    assert complexity.is_garbled is False
    assert complexity.full_page_image is False
    assert complexity.text_coverage > 0.05
    assert "scanned" not in complexity.reasons
    assert complexity.needs_ocr is False
    doc.close()
