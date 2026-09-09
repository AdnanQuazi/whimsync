# Whimsync — Binary Parser Worker (`apps/extractor`)

Stage 2 of the Whimsync Multi-Stage File Ingestion Pipeline.

## Overview

The `apps/extractor` service is an asynchronous worker responsible for converting binary documents (PDF, DOCX, PPTX) into clean, high-fidelity Markdown, normalizing layout, extracting links, and enqueuing the result to the TypeScript Chunker Worker (`CHUNKING_QUEUE`).

### Core Features

1. **Office to PDF Conversion:**
   - Converts `.docx`, `.pptx`, `.xlsx` to normalized PDF via headless LibreOffice (`soffice --headless --convert-to pdf`).
   - Persists normalized PDF as `converted.pdf` in S3 / MinIO for downstream citation alignment.
2. **Tier-Based Parsing Strategy:**
   - **`Fast`**: PyMuPDF4LLM extraction with native OCR and inline link injection. (Zero LLM cost, sub-second).
   - **`Smart`** *(Default)*: Multi-signal complexity analyzer (`text_coverage`, `image_coverage`, `vg_coverage`, `is_garbled`, `full_page_image`). Digital pages are parsed with PyMuPDF4LLM; scanned, garbled, or vector grid table pages are routed to Google Gemini VLM with structured GFM table prompts.
   - **`Max`**: Vision-dominant layout parsing. Dispatches all non-trivial pages to Gemini VLM.
3. **Queue Plumbing:**
   - Consumes `document-parsing` from BullMQ (Redis) using the native Python `bullmq` package.
   - Updates `ingestion_records` status in PostgreSQL (`parsing` -> `chunking`).
   - Produces job to `chunking` queue for Stage 3 (`apps/worker`).

## Setup & Running

### Requirements
- Python `>= 3.11`
- `uv` (recommended) or `pip`
- LibreOffice (for Office document conversions)

### Install Dependencies
```bash
uv sync --extra dev
```

### Run Tests
```bash
uv run pytest
```

### Run Worker
```bash
uv run python -m src.main
```
