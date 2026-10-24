# Whimsync Worker — Agent Coding Rules (`apps/worker`)

Instructions for AI coding agents developing the BullMQ background worker, chunkers, cognitive extractors, and mutation engine in `apps/worker`.
For architectural rationale and setup instructions, see [README.md](./README.md).

---

## 1. Commands (Run from `apps/worker/` or Repository Root)

```bash
# Testing (run from apps/worker/)
bun test                                                  # Run all worker tests
bun test src/__tests__/chunkerService.test.ts             # Run a single test file
bun test src/__tests__/extractor.test.ts                  # Run extractor tests

# Type Checking & Linting (run from repo root)
bun run typecheck                                         # Verify TypeScript types
bun run lint                                              # Lint with Biome
```

---

## 2. Process Lifecycle & Graceful Shutdown
- **Runtime:** TypeScript running natively on Bun.
- **Graceful Shutdown:** All worker instances (`chunkerWorker`, `episodeWorker`) and database connections must be cleanly closed inside `gracefulShutdown()` in `src/index.ts`. Never exit without closing BullMQ workers.

---

## 3. Chunker Pipeline Rules (`src/chunking/`)
- **Syntax Routing:** Use `chunkerEngine.ts` to inspect file extensions and content heuristics:
  - Markdown: Split by headers while preserving hierarchical `# Heading` paths.
  - Code: Split by language AST function and class boundaries.
  - JSON: Split along top-level object/array boundaries.
  - Plain Text: Split along paragraph and sentence boundaries.
- **Monotonic Offsets:** `calculateChunkOffsets()` must guarantee forward-only character progression (`chunkStartOffset`, `chunkEndOffset`). Chunk offsets must never leap backwards.
- **Atomic Batch Insert:** Chunks must be batch-persisted to the `episodes` table inside a single database transaction (`chunkerRepository.ts`).

---

## 4. Cognitive Extraction Rules (`src/cognitive/`)
- **Candidate Prior Retrieval:** Retrieve active candidate claims using PostgreSQL cosine distance (`<=>` operator on `vectors.embedding`) combined with recency ordering (`desc(recordedAt)`), filtered strictly by `tenant_id` and `namespace`.
- **Single-Call Inference:** Prompts `gemini-2.5-flash` with candidate claims and episode text using `responseSchema: zodToJsonSchema(CognitiveExtractionResultSchema)`. Never split claim generation and mutation proposals into separate LLM calls.
- **Pending Review Invariant:** Every extracted claim must be durably written to `memory_claims` with `status = 'pending_review'` along with its vector embedding in `vectors` before mutation evaluation runs. `pending_review` claims must never be retrievable in query endpoints.

---

## 5. Atomic Mutation Engine (`src/mutations/`)
All mutations, deduplications, and status transitions must resolve within a **single database transaction (`db.transaction`)**:
1. **Mutations:** Claims marked `delete` or `update` transition to `status = 'superseded'`. Updates create replacement claims with an `UPDATES` relationship edge.
2. **Deduplication:** Check for active claims matching SHA-256 `contentHash`. If a duplicate exists, delete the `pending_review` row & vector, and remap relationship pointers to the existing active claim ID.
3. **Status Transition:** Atomically flip remaining new claims from `pending_review` -> `active`.
4. **Evidence Citations:** Insert character offset ranges (`startOffset`, `endOffset`, `excerpt`) into the `evidence` table linking active claims to the episode.
5. **Knowledge Graph:** Insert relationship edges into `memory_relationships` and entity quintuplets into `entity_relationships`.
