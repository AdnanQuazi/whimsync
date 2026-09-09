# Whimsync — Multi-Stage File Ingestion & Citation Pipeline Plan

> **Tracking Document for Implementation & Multi-Session Progress**
> **Status:** Plan Finalized & Approved via `/grill-me`
> **Branch:** `feat/file-and-chunking`

---

## 1. Executive Summary & Core Architectural Contract

This document specifies the end-to-end architecture for Whimsync's multi-file ingestion, layout parsing, dynamic text chunking, LLM claim generation, and PDF citation bounding box extraction.

### Global Queue Topology

```
                  ┌───────────────────────────────┐
                  │   HTTP POST /v1/memories...   │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │ (Binary: PDF/DOCX/PPT) │ (Text/MD/Code Files)   │ (Plain Text <= 1500 chars)
         ▼                        ▼                        ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Queue 1:         │     │ Queue 2:         │     │ Queue 3:         │
│ Binary Parser    │────►│ Chunker Worker   │────►│ Episode Worker   │
│ (Python/Libre/   │     │ (TS / LangChain  │     │ (LLM Claim Extr. │
│  PyMuPDF4LLM)    │     │  Splitters)      │     │  & Mutations)    │
└──────────────────┘     └──────────────────┘     └────────┬─────────┘
                                                           │
                                                           │ (Binary Ingestions Only)
                                                           ▼
                                                  ┌──────────────────┐
                                                  │ Queue 4:         │
                                                  │ Citation BBox    │
                                                  │ Generator        │
                                                  │ (Python/PyMuPDF) │
                                                  └──────────────────┘
```

### Ingestion Paths

1. **Binary Path (PDF, DOCX, PPTX):**
   `Client Upload` $\rightarrow$ MinIO $\rightarrow$ `Queue 1: Binary Parser (Python)` $\rightarrow$ MinIO (Markdown + Converted PDF) $\rightarrow$ `Queue 2: Chunker (TS)` $\rightarrow$ DB (`episodes`) $\rightarrow$ `Queue 3: Episode Extraction (TS)` $\rightarrow$ `Queue 4: Citation BBox Generator (Python)` $\rightarrow$ Complete.
2. **Text / Markdown / Code Path:**
   `Client Upload` $\rightarrow$ MinIO $\rightarrow$ `Queue 2: Chunker (TS)` $\rightarrow$ DB (`episodes`) $\rightarrow$ `Queue 3: Episode Extraction (TS)` $\rightarrow$ Complete.
3. **Fast Path ($\le 1500$ chars plain text):**
   `Client POST` $\rightarrow$ DB (`episodes`) $\rightarrow$ `Queue 3: Episode Extraction (TS)` $\rightarrow$ Complete.

---

## 2. Queue Contracts & Data Transfer (MinIO + Redis)

Per Whimsync architectural commandments, **Redis is purely transient queue plumbing**; all large payloads and intermediate documents are stored in MinIO using the **Claim Check Pattern**.

### S3 / MinIO Storage Layout
```
uploads/
  └── {tenantId}/
      └── {namespace}/
          └── {ingestionId}/
              ├── raw.{ext}          # Original uploaded file
              ├── converted.pdf      # Normalized PDF (if converted from DOCX/PPTX)
              └── document.md        # Parsed Markdown from PyMuPDF4LLM
```

### Queue Definitions & Payloads (`packages/core/src/queue/`)

#### Queue 1: `document-parsing` (`DOCUMENT_PARSING_QUEUE`)
* **Consumer:** Python Parser Service (`apps/extractor`)
* **Payload Interface:**
  ```typescript
  export interface DocumentParsingJobData {
    ingestionId: string;
    storageKey: string;
    fileName: string;
    fileExtension: string; // ".pdf" | ".docx" | ".pptx"
    tenantId: string;
    namespace: string;
    userId: string;
    entityKey?: string | null;
    sessionId?: string | null;
    tier?: "fast" | "smart" | "max" | null;
  }
  ```

#### Queue 2: `chunking` (`CHUNKING_QUEUE`)
* **Consumer:** TypeScript Worker (`apps/worker`)
* **Payload Interface:**
  ```typescript
  export interface ChunkingJobData {
    ingestionId: string;
    tenantId: string;
    namespace: string;
    userId: string;
    entityKey?: string | null;
    sessionId?: string | null;
    sourceType: "text_file" | "inline_text";
    // For binary output or uploaded text files:
    storageKey?: string;
    // If Office doc converted to PDF, stored for Queue 4:
    pdfStorageKey?: string;
    // For direct large inline text (>1500 chars):
    rawTextInline?: string;
    fileName?: string;
    fileExtension?: string; // ".md" | ".txt" | ".py" | ".ts" etc.
  }
  ```

#### Queue 3: `episode-extraction` (`EPISODE_EXTRACTION_QUEUE`)
* **Consumer:** TypeScript Worker (`apps/worker/src/consumers/episodeConsumer.ts`)
* **Payload Interface:**
  ```typescript
  export interface EpisodeExtractionJobData {
    episodeId: string;
    ingestionId?: string | null;
    tenantId: string;
    namespace: string;
    userId: string;
    entityKey: string | null;
    sessionId: string | null;
    rawText: string;
    chunkIndex: number;
    chunkStartOffset: number;
    chunkEndOffset: number;
    headingPath?: string | null;
    documentSummary?: string | null;
    contextPrefix?: string | null;
  }
  ```

#### Queue 4: `citation-bbox` (`CITATION_BBOX_QUEUE`)
* **Consumer:** Python Citation Service (`apps/extractor`)
* **Payload Interface:**
  ```typescript
  export interface CitationBBoxJobData {
    ingestionId: string;
    tenantId: string;
    namespace: string;
    pdfStorageKey: string;
  }
  ```

---

## 3. Database Schema Changes (`packages/db`)

### 1. `evidence` Table Update (`packages/db/src/schema/memories.ts`)
Add `bboxes` JSONB column and make text character offsets nullable (since binary documents use PDF bounding boxes rather than character offsets):
```typescript
export interface BoundingBox {
  page: number; // 1-indexed page number
  l: number;    // Left coordinate
  t: number;    // Top coordinate
  r: number;    // Right coordinate
  b: number;    // Bottom coordinate
}

// Inside evidence table definition:
startOffset: integer("start_offset"), // nullable for binary documents
endOffset: integer("end_offset"),     // nullable for binary documents
excerpt: text("excerpt").notNull(),   // always populated with verbatim quote
bboxes: jsonb("bboxes").$type<BoundingBox[] | null>(),
```

### 2. `ingestion_records` Table Update (`packages/db/src/schema/ingestionRecords.ts`)
Add semantic `source_type` enum, status values, and intermediate storage keys:
```typescript
export const sourceTypeEnum = pgEnum("source_type", [
  "binary_document",
  "text_file",
  "inline_text",
]);

export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "pending",
  "parsing",
  "chunking",
  "extracting",
  "embedding",
  "indexing",
  "generating_citations",
  "completed",
  "failed",
]);

// Add columns (migrations 0006_chilly_dagger.sql & 0007_eminent_clint_barton.sql):
convertedPdfStorageKey: text("converted_pdf_storage_key"),
markdownStorageKey: text("markdown_storage_key"),
parsingTier: text("parsing_tier").default("smart"),
```

---

## 4. Stage-by-Stage Implementation Details

### Stage 1: API Routing & Ingestion (`apps/api`)
1. **File Type Detection:**
   * Sniff magic bytes using `matchesMagicBytes()` for `.pdf`, `.docx`, `.pptx`.
   * Sniff text-likeness using `isTextLike()` (null byte scan + streaming UTF-8 decode).
2. **Routing Logic:**
   * Binary (`.pdf`, `.docx`, `.pptx`) $\rightarrow$ upload to MinIO $\rightarrow$ enqueue `DOCUMENT_PARSING_QUEUE`.
   * Text/Markdown/Code files $\rightarrow$ upload to MinIO $\rightarrow$ enqueue `CHUNKING_QUEUE`.
   * Text $> 1500$ chars $\rightarrow$ store inline $\rightarrow$ enqueue `CHUNKING_QUEUE`.
   * Text $\le 1500$ chars $\rightarrow$ create episode $\rightarrow$ enqueue `EPISODE_EXTRACTION_QUEUE` (Fast Path).

---

### Stage 2: Binary Parser Worker (Python — `apps/extractor`)

1. **Architecture & Technology Stack:**
   * Modern Python 3.11+ service managed with **`uv`** (PEP 621 `pyproject.toml` + `uv.lock`).
   * BullMQ consumer via official Python `bullmq` package connected to shared Redis/Valkey.
   * Asynchronous PostgreSQL connection pool via `asyncpg`.
   * Object storage operations via `boto3` MinIO client with unified S3 hierarchy.
   * Strict Pydantic v2 schemas (`DocumentParsingJobData`, `ChunkingJobData`, `ParseTier`, `PageComplexity`, `ParsedDocument`) using `alias_generator=to_camel` for 1:1 parity with `@whimsync/core` TypeScript queue contracts.

2. **Headless Office Conversion (`services/office_converter.py`):**
   * Cross-platform headless LibreOffice detection via `shutil.which("soffice")` and configurable `LIBREOFFICE_PATH`.
   * Converts `.docx`, `.pptx`, `.xlsx` into normalized PDF.
   * Uploads converted PDF to MinIO at `uploads/{tenantId}/{namespace}/{ingestionId}/converted.pdf`.
   * Unlinks the temporary raw office file immediately upon conversion to minimize disk footprint.

3. **Multi-Signal Page Complexity Analysis (`parsing/complexity.py`):**
   * Evaluates every page individually across 6 signals:
     * `text_coverage`: Character density relative to page area.
     * `image_coverage`: Embedded image area ratio.
     * `vg_coverage`: Vector graphics / drawing paths (detects vector tables, charts, diagrams).
     * `garble_ratio`: Unprintable / invalid Unicode character ratio (detects corrupted text/OCR).
     * `scanned`: Classified when `full_page_image` (image $\ge 90\%$ page area) and `text_coverage < 0.05`.
     * `is_empty`: Blank page detection (`text_length == 0` and `image_coverage == 0` and `vg_coverage == 0`), completely bypassing OCR and VLM waste.

4. **Tier-Based Parsing Engine (`parsing/strategies/`):**
   * **`Fast` Tier (`FastParsingStrategy`):**
     * 100% local, 0 VLM calls ($0 API cost).
     * Runs `pymupdf4llm` with native Tesseract OCR fallback for scanned pages.
   * **`Smart` Tier (`SmartParsingStrategy`) — Default:**
     * Hybrid routing per page:
       * Clean digital pages routed to native `pymupdf4llm` extraction.
       * Scanned, vector-table, diagram-dense, or garbled pages routed to Google Gemini VLM (`gemini-2.5-flash`).
     * **Image Placeholder Replacement (`image_replacer.py`):** On digital pages, detects embedded image placeholders (`![alt](image.png)`) representing charts/tables and replaces them with VLM-extracted Markdown tables and descriptions.
     * **Inline Link Injection (`link_injector.py`):** Injects inline Markdown links `[text](url)` as the strict final step after image placeholder replacement.
   * **`Max` Tier (`MaxParsingStrategy`):**
     * Vision-first VLM extraction for all non-trivial pages. Digital extraction used only for guaranteed simple 1-column pages.

5. **Rate-Limiting & VLM Pacing (`services/vlm_service.py`):**
   * Concurrency semaphore limiting concurrent calls (`VLM_CONCURRENCY = 3`).
   * Deliberate inter-call pacing delay (`VLM_DELAY_SECONDS = 0.5s`).
   * Exponential backoff retry on HTTP 429 / RESOURCE_EXHAUSTED errors (`VLM_MAX_RETRIES = 3`).

6. **Storage & Worker-Driven State Transition:**
   * Uploads converted Markdown to MinIO at `uploads/{tenantId}/{namespace}/{ingestionId}/document.md`.
   * Updates `ingestion_records` with `markdown_storage_key` and `converted_pdf_storage_key` via `asyncpg`.
   * Follows the **worker-driven state transition model**: Stage 2 sets `status = 'parsing'` upon job pickup and records artifacts upon completion; it does not prematurely set `status = 'chunking'`. The Stage 3 Chunker worker transitions `status = 'chunking'` when it dequeues the job from `CHUNKING_QUEUE`.
   * Enqueues `ChunkingJobData` payload to BullMQ `chunking` queue.


---

### Stage 3: Dynamic Chunker Worker (TypeScript — `apps/worker`)
1. **Fetch & Resolve Source Content:**
   * If `storageKey` is present, stream from MinIO.
   * If `rawTextInline` is present, read directly.
2. **Dynamic Chunking Strategies:**
   * **Markdown (`.md` or parsed binary):**
     Two-step Header $\rightarrow$ Recursive size splitting:
     ```typescript
     const headerSplitter = new MarkdownHeaderTextSplitter({
       headersToSplitOn: [
         ["#", "h1"],
         ["##", "h2"],
         ["###", "h3"],
       ],
     });
     const sections = await headerSplitter.splitText(markdown);
     const chunker = new RecursiveCharacterTextSplitter({
       chunkSize: 1500,
       chunkOverlap: 100,
     });
     const chunks = await chunker.splitDocuments(sections);
     ```
     Extract `headingPath` from section metadata (e.g. `h1 > h2 > h3`).
   * **Code Files (`.ts`, `.py`, `.js`, etc.):**
     ```typescript
     const chunker = RecursiveCharacterTextSplitter.fromLanguage(language, {
       chunkSize: 1500,
       chunkOverlap: 100,
     });
     ```
   * **Plain Text (`.txt`, raw text):**
     ```typescript
     const chunker = new RecursiveCharacterTextSplitter({
       chunkSize: 1500,
       chunkOverlap: 100,
     });
     ```
3. **Database Insertion & Fan-Out:**
   * Batch insert $N$ rows into `episodes` with `status = "pending"`, `chunkIndex`, `chunkStartOffset`, `chunkEndOffset`, `headingPath`.
   * Update `ingestion_records.totalChunks = N` and `status = "extracting"`.
   * Enqueue $N$ individual jobs to `EPISODE_EXTRACTION_QUEUE`.

---

### Stage 4: LLM Memory Generation & Batch Completion (`apps/worker`)
1. **Extraction & Mutations:**
   * `episodeConsumer` executes `extractEpisodeClaims(job.data)`.
   * Extracts claims, confidence, categories, relations, and `evidence` quotes (`excerpt`).
   * Evaluates & applies mutations atomically in PostgreSQL.
2. **Document Completion Coordinator:**
   * Atomically increment `processed_chunks` (or `failed_chunks` if chunk failed).
   * Check if `processed_chunks + failed_chunks >= total_chunks`.
   * If all chunks are processed:
     * **If Binary:** Set status to `"generating_citations"` and enqueue single job to `CITATION_BBOX_QUEUE` with `{ ingestionId, pdfStorageKey }`.
     * **If Text:** Set status to `"completed"`.

---

### Stage 5: Citation BBox Generator (Python — `apps/extractor`)
1. **Fetch Targets:**
   * Download the PDF from MinIO (`pdfStorageKey`).
   * Fetch all `evidence` records associated with episodes belonging to `ingestionId`.
2. **PyMuPDF Search:**
   * Open PDF with `fitz.open(pdf_path)`.
   * For each evidence row:
     ```python
     bboxes = []
     for page_num in range(len(doc)):
         page = doc[page_num]
         # Search for verbatim excerpt
         quads = page.search_for(evidence.excerpt)
         if quads:
             for rect in quads:
                 bboxes.append(
                     {
                         "page": page_num + 1,
                         "l": round(rect.x0, 2),
                         "t": round(rect.y0, 2),
                         "r": round(rect.x1, 2),
                         "b": round(rect.y1, 2),
                     }
                 )
     ```
   * If found: update `evidence.bboxes = bboxes`.
   * If not found (OCR deviation / whitespace wrap): leave `bboxes = null` (graceful fallback).
3. **Finalize Ingestion:**
   * Update `ingestion_records.status = "completed"`.

---

## 5. Execution Roadmap & Checklist

### Phase 1: Core Contracts & Database Schema
- [x] Add `bboxes` JSONB column to `evidence` and make text offsets nullable in `packages/db/src/schema/memories.ts`.
- [x] Add `convertedPdfStorageKey`, `markdownStorageKey`, `parsingTier`, semantic `source_type` enum, and new statuses to `ingestion_records` in `packages/db/src/schema/ingestionRecords.ts`.
- [x] Run `bun run db:generate` and `bun run db:migrate` to produce and apply Drizzle migrations (`0006_chilly_dagger.sql` & `0007_eminent_clint_barton.sql`).
- [x] Define shared queue names (`DOCUMENT_PARSING_QUEUE`, `CHUNKING_QUEUE`, `EPISODE_EXTRACTION_QUEUE`, `CITATION_BBOX_QUEUE`) and payload types (including `tier`) in `packages/core/src/queue/constants.ts` and `jobs.ts`.

### Phase 2: API Ingestion Updates
- [x] Update `apps/api/src/lib/queue.ts` with typed BullMQ queues for `DOCUMENT_PARSING_QUEUE` and `CHUNKING_QUEUE`.
- [x] Refactor `MemoryIngestService`:
  - Route `.pdf`, `.docx`, `.pptx` $\rightarrow$ `DOCUMENT_PARSING_QUEUE`.
  - Route text/code/markdown files $\rightarrow$ `CHUNKING_QUEUE`.
  - Route plain text $>1500$ chars $\rightarrow$ `CHUNKING_QUEUE`.
  - Route plain text $\le 1500$ chars $\rightarrow$ `EPISODE_EXTRACTION_QUEUE` (Fast Path).
- [x] Fix existing test mocks in `extractor.test.ts` and `episodeConsumer.test.ts` to supply `chunkIndex`, `chunkStartOffset`, and `chunkEndOffset`.


### Phase 3: TypeScript Chunker Worker
- [ ] Create `apps/worker/src/consumers/chunkerConsumer.ts` consuming `CHUNKING_QUEUE`.
- [ ] Implement `MarkdownHeaderTextSplitter` + `RecursiveCharacterTextSplitter` pipeline with dynamic header path extraction.
- [ ] Implement language-aware code splitter and plain text splitter.
- [ ] Batch write episodes to DB and fan-out jobs to `EPISODE_EXTRACTION_QUEUE`.

### Phase 4: Episode Consumer Completion Check
- [ ] Update `apps/worker/src/consumers/episodeConsumer.ts`:
  - Increment `processed_chunks` / `failed_chunks`.
  - When `processed_chunks + failed_chunks === total_chunks`: trigger `CITATION_BBOX_QUEUE` (if binary) or mark `"completed"`.

### Phase 5: Python Binary Parser & Citation BBox Generator
- [x] Create `apps/extractor/pyproject.toml` with `uv`, `pymupdf`, `pymupdf4llm`, `google-genai`, `bullmq`, `asyncpg`, `boto3`.
- [x] Implement BullMQ consumer in Python for `DOCUMENT_PARSING_QUEUE`:
  - Headless LibreOffice conversion for `.docx` / `.pptx`.
  - Tier-based parsing engine (`fast`, `smart`, `max`) with `pymupdf4llm` and Gemini VLM.
  - Multi-signal page complexity analysis and inline link injection.
  - S3 upload and handoff to `CHUNKING_QUEUE`.
- [ ] Implement BullMQ consumer in Python for `CITATION_BBOX_QUEUE` (Stage 5):
  - PyMuPDF text coordinate search.
  - Update `evidence.bboxes`.
  - Mark `ingestion_records.status = "completed"`.
