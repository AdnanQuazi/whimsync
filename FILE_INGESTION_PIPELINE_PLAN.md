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

// Add columns:
convertedPdfStorageKey: text("converted_pdf_storage_key"),
markdownStorageKey: text("markdown_storage_key"),
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
1. **Office to PDF Conversion:**
   * If input is `.docx` or `.pptx`:
     Run headless LibreOffice: `soffice --headless --convert-to pdf --outdir <tmp> <input_file>`
     Upload resulting PDF to MinIO as `converted.pdf` (`convertedPdfStorageKey`).
2. **PDF to Markdown Extraction:**
   * Use **`pymupdf4llm`**:
     ```python
     import pymupdf4llm
     md_text = pymupdf4llm.to_markdown(pdf_path)
     ```
   * Upload `md_text` to MinIO as `document.md` (`markdownStorageKey`).
3. **Queue Handoff:**
   * Update `ingestion_records` status to `"chunking"`.
   * Enqueue job to `CHUNKING_QUEUE` with `{ ingestionId, storageKey: markdownStorageKey, pdfStorageKey, fileExtension: ".md" }`.


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
                 bboxes.append({
                     "page": page_num + 1,
                     "l": round(rect.x0, 2),
                     "t": round(rect.y0, 2),
                     "r": round(rect.x1, 2),
                     "b": round(rect.y1, 2)
                 })
     ```
   * If found: update `evidence.bboxes = bboxes`.
   * If not found (OCR deviation / whitespace wrap): leave `bboxes = null` (graceful fallback).
3. **Finalize Ingestion:**
   * Update `ingestion_records.status = "completed"`.

---

## 5. Execution Roadmap & Checklist

### Phase 1: Core Contracts & Database Schema
- [x] Add `bboxes` JSONB column to `evidence` and make text offsets nullable in `packages/db/src/schema/memories.ts`.
- [x] Add `convertedPdfStorageKey`, `markdownStorageKey`, semantic `source_type` enum, and new statuses to `ingestion_records` in `packages/db/src/schema/ingestionRecords.ts`.
- [x] Run `bun run db:generate` to produce Drizzle migration (`0006_chilly_dagger.sql`).
- [x] Define shared queue names (`DOCUMENT_PARSING_QUEUE`, `CHUNKING_QUEUE`, `EPISODE_EXTRACTION_QUEUE`, `CITATION_BBOX_QUEUE`) and payload types in `packages/core/src/queue/constants.ts` and `jobs.ts`.

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
- [ ] Update `apps/extractor/pyproject.toml` with `pymupdf`, `pymupdf4llm`.
- [ ] Implement BullMQ consumer in Python for `DOCUMENT_PARSING_QUEUE`:
  - Headless LibreOffice conversion for `.docx` / `.pptx`.
  - `pymupdf4llm.to_markdown` conversion for PDF $\rightarrow$ Markdown.
  - S3 upload and handoff to `CHUNKING_QUEUE`.
- [ ] Implement BullMQ consumer in Python for `CITATION_BBOX_QUEUE`:
  - PyMuPDF text coordinate search.
  - Update `evidence.bboxes`.
  - Mark `ingestion_records.status = "completed"`.
