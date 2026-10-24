# Whimsync Background Worker (`@whimsync/worker`)

Asynchronous BullMQ worker engine running on Bun, orchestrating content chunking, LLM cognitive extraction, and atomic mutation evaluation.

---

## 1. Overview

`apps/worker` offloads heavy and non-deterministic workloads from the API:
1. **Chunking Pipeline:** Splits structured documents and raw text into granular chunks while computing exact character offsets.
2. **Cognitive Extraction & Mutation Engine:** Performs single-call Gemini extraction, buffers pending claims, and commits atomic status transitions against candidate prior claims.

---

## 2. Consumers & Queue Interfaces

### 1. Chunker Consumer (`chunkerConsumer.ts`)
- **Queue:** `chunking`
- **Payload:** `ChunkingJobData` (`ingestionId`, `sourceType`, `storageKey`, `rawTextInline`, `fileExtension`, `tenantId`, `namespace`, `userId`)
- **Workflow:**
  1. Fetches source text (from MinIO or inline).
  2. Routes through `chunkerEngine`:
     - Markdown: Header-aware AST splitting preserving hierarchical `# Heading` paths.
     - Pure Code: AST-aware function/class boundary splitting across languages.
     - JSON: Object/array boundary-aware splitting.
     - Plain Text: Paragraph and sentence fallback splitting.
  3. Computes sequential monotonic character offsets (`chunkStartOffset`, `chunkEndOffset`).
  4. Atomically batch inserts chunks into the `episodes` table.

### 2. Episode Extraction Consumer (`episodeConsumer.ts`)
- **Queue:** `episode-extraction`
- **Payload:** `EpisodeExtractionJobData` (`episodeId`, `rawText`, `tenantId`, `namespace`, `userId`, `chunkIndex`, offsets)
- **Workflow:**
  1. Generates 768-dim query embedding (`text-embedding-004`) for the incoming episode text.
  2. Retrieves active candidate prior claims from PostgreSQL using `pgvector` cosine similarity (`<=>`) and recency.
  3. Executes a single structured call to `gemini-2.5-flash` proposing claims, relationship edges, entity quintuplets, and mutations.
  4. Durably writes proposed claims to `memory_claims` with `status = 'pending_review'` along with their vector embeddings in `vectors`.
  5. Invokes `mutationEngine`:
     - Applies updates/deletes against prior claims (`status = 'superseded'`).
     - Deduplicates against active claims via SHA-256 `contentHash`.
     - Flips new claims from `pending_review` -> `active`.
     - Inserts character offset ranges into `evidence`.
     - Inserts edges into `memory_relationships` and quintuplets into `entity_relationships`.

---

## 3. Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://whimsync:whimsync_dev_pass@localhost:5432/whimsync` |
| `REDIS_URL` | Redis connection string for BullMQ | `redis://localhost:6379` |
| `GEMINI_API_KEY` | Google Gemini API key | Required |
| `LLM_MODEL` | Gemini model for structured extraction | `gemini-2.5-flash` |
| `MINIO_ENDPOINT` | MinIO host | `localhost` |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_USE_SSL` | MinIO SSL flag | `false` |
| `MINIO_ACCESS_KEY` | MinIO access key | `whimsync` |
| `MINIO_SECRET_KEY` | MinIO secret key | `whimsync_dev_pass` |
| `MINIO_BUCKET` | S3 bucket name | `whimsync-cold` |

---

## 4. Development & Testing

```bash
# Run worker process in development mode with hot reload
bun run dev

# Run worker unit tests (chunkers, detectors, extractors)
bun test
```
