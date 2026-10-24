# Whimsync Document Parser — Agent Coding Rules (`apps/extractor`)

Instructions for AI coding agents developing the Python document layout extraction service in `apps/extractor`.
For architectural rationale, strategy details, and environment variables, see [README.md](./README.md).

---

## 1. Commands (Run from `apps/extractor/` or Repository Root)

```bash
# Testing (run from apps/extractor/)
uv run pytest                                             # Run all pytest test suites
uv run pytest tests/test_complexity.py                    # Run a single test file
uv run pytest -k "test_fast"                              # Run tests matching a name pattern

# Linting & Formatting (run from apps/extractor/)
uv run ruff check .                                       # Lint Python code with Ruff
uv run ruff check --fix .                                 # Auto-fix linting issues
uv run ruff format .                                      # Format Python code
```

---

## 2. Toolchain & Environment
- **Runtime:** Python `>= 3.11` managed strictly with **`uv`**.
- **Package Management:** Use `uv add <package>` and `uv sync --extra dev`. Do not introduce `pip` or Poetry.
- **Linting & Formatting:** Use **Ruff** exclusively.

---

## 3. Queue Contract & TypeScript Interoperability
- **BullMQ Integration:** Consumes `document-parsing` and produces jobs to `chunking`.
- **CamelCase Serialization:** All Pydantic job models in `src/schemas/queue_jobs.py` must use `alias_generator=to_camel` and `serialize_by_alias=True` so serialized JSON fields match TypeScript camelCase naming conventions (`ingestionId`, `storageKey`, `tenantId`).
- **Database Status Tracking:** Use `db_service.py` to update `ingestion_records` status (`parsing` -> `chunking` or `failed`).

---

## 4. Parsing Pipeline & Memory Management
1. **Office Document Conversion (`services/office_converter.py`):**
   - Invokes headless LibreOffice (`soffice --headless --convert-to pdf`).
   - Persists `converted.pdf` to MinIO (`uploads/{tenantId}/{namespace}/{ingestionId}/converted.pdf`).
   - Immediately `unlink()` temporary raw office files to minimize disk footprint.
2. **Strategy Tiers (`src/parsing/strategies/`):**
   - **`Fast`:** Deterministic PyMuPDF4LLM extraction with inline link injection.
   - **`Smart`:** Multi-signal complexity analyzer (`complexity.py`). Digital pages use PyMuPDF4LLM; complex, scanned, or vector table pages route to Gemini VLM. Charts in digital pages are enriched via VLM.
   - **`Max`:** Vision-dominant layout parsing routing non-trivial pages to Gemini VLM.
3. **VLM Concurrency & Rate Limiting (`services/vlm_service.py`):**
   - Governed by `asyncio.Semaphore(settings.VLM_CONCURRENCY)`.
   - Automatic exponential backoff on `429` / `RESOURCE_EXHAUSTED` errors.
4. **Link Injection (`parsing/link_injector.py`):**
   - Extracts link annotations from PDF pages and injects them as Markdown links. Must always be executed as the final step before persisting Markdown.
