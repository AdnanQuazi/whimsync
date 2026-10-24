# Whimsync Core Shared Package (`@whimsync/core`)

Shared TypeScript contracts, queue definitions, cognitive schemas, and object storage utilities for the Whimsync monorepo.

---

## 1. Overview

`packages/core` provides common types, queue payload contracts, Zod schemas, and S3 utilities consumed across `apps/api` and `apps/worker`.

---

## 2. Modules & Exports

### 1. Queue Contracts (`@whimsync/core/queue` or `@whimsync/core`)
- **Queue Names:**
  - `DOCUMENT_PARSING_QUEUE` (`"document-parsing"`): Dispatched to Python extractor.
  - `CHUNKING_QUEUE` (`"chunking"`): Dispatched to TS chunker.
  - `EPISODE_EXTRACTION_QUEUE` (`"episode-extraction"`): Dispatched to cognitive extractor.
  - `CITATION_BBOX_QUEUE` (`"citation-bbox"`): Reserved for bounding-box citation alignment.
- **Job Payload Interfaces:**
  - `DocumentParsingJobData`
  - `ChunkingJobData`
  - `EpisodeExtractionJobData`
  - `CitationBBoxJobData`
- **File Validation Constants:** `MAX_FILE_SIZE_BYTES` (15 MB), `MAX_FILES_PER_REQUEST` (10), `MAX_TOTAL_BYTES` (150 MB), `BINARY_EXTENSIONS` (`.pdf`, `.docx`, `.pptx`), `BLOCKED_EXTENSIONS`.

### 2. Cognitive Extraction Schemas (`@whimsync/core/cognitive`)
- **Zod Schemas for Structured LLM Extraction:**
  - `ProposedClaimSchema` / `ProposedClaim`
  - `ProposedMemoryRelationshipSchema` / `ProposedMemoryRelationship`
  - `ProposedEntityRelationshipSchema` / `ProposedEntityRelationship`
  - `ProposedMutationSchema` / `ProposedMutation`
  - `ProposedEvidenceSchema` / `ProposedEvidence`
  - `CognitiveExtractionResultSchema` / `CognitiveExtractionResult`
- **Internal Payload Interfaces:**
  - `CognitiveExtractionPayload`
  - `ExtractedClaimWithEmbedding`
  - `CandidateClaim`

### 3. Storage Utilities (`@whimsync/core/services`)
- **`StorageService`:** MinIO / AWS S3 client wrapper for uploading and downloading raw files, parsed Markdown, and converted PDFs following the Claim Check Pattern.
