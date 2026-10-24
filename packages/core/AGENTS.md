# Whimsync Core — Agent Coding Rules (`packages/core`)

Instructions for AI coding agents developing shared contracts, queue payload types, cognitive Zod schemas, and S3 utilities in `packages/core`.

---

## 1. Responsibilities & Exports
- **Queue Payload Contracts (`src/queue/jobs.ts`):** Authoritative interfaces for BullMQ jobs (`DocumentParsingJobData`, `ChunkingJobData`, `EpisodeExtractionJobData`). Any changes here break cross-service communication (`apps/api`, `apps/worker`, `apps/extractor`).
- **Cognitive Extraction Schemas (`src/cognitive/index.ts`):** Zod schemas (`CognitiveExtractionResultSchema`, `ProposedClaimSchema`, `ProposedMutationSchema`). Must strictly convert to standard JSON Schema via `zod-to-json-schema` for Gemini structured inference.
- **S3 Storage Service (`src/services/storageService.ts`):** Shared Claim Check Pattern client for MinIO/S3.

---

## 2. Invariants & Rules
- **Backward Compatibility:** Never rename or remove fields in queue job interfaces without updating consumers across both Bun (`apps/worker`) and Python (`apps/extractor/src/schemas/queue_jobs.py`).
- **Pure Library:** `packages/core` must not import from `@whimsync/db`, `apps/api`, or `apps/worker`. It is a zero-dependency foundation package.
- **Commands:** Run `bun run typecheck` and `bun run lint` from repository root after editing.
