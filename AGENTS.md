# Whimsync — Master Workspace Rules & Architectural Commandments

> **IMPORTANT FOR ALL AI AGENTS & CODING ASSISTANTS:**
> Read [`docs/architecture.md`](docs/architecture.md) **only** when modifying database schemas, queue definitions, multi-tenant scoping, or the extraction/mutation lifecycle. Do NOT load it for isolated tasks, UI fixes, or routine bug fixes.

---

## 1. Essential Commands (Run from Repository Root)

```bash
# Setup & installation
bun run setup             # Installs Bun packages & syncs Python uv virtualenv

# Testing
bun run test:all          # Runs all test suites (API, Worker, Extractor)
bun run test:api          # Runs Hono API tests
bun run test:worker       # Runs BullMQ Worker tests
bun run test:extractor    # Runs Python Extractor tests (pytest)

# Linting & Type Checking
bun run typecheck         # Type checks all TypeScript workspaces
bun run lint              # Lints TypeScript with Biome
bun run lint:extractor    # Lints Python with Ruff
bun run format            # Formats TypeScript & Python

# Database Migrations
bun run db:migrate        # Applies pending Drizzle migrations
bun run db:generate       # Generates SQL migration from schema edits
```

---

## 2. "Never Touch" List (Protected Files)

AI agents must **NEVER** directly modify, overwrite, or delete the following files:
1. **Past SQL Migrations:** `packages/db/migrations/*.sql` (Never edit existing migrations; always run `bun run db:generate` to produce new migration files).
2. **Migration Metadata:** `packages/db/migrations/meta/*` (Managed exclusively by Drizzle kit).
3. **Lockfiles:** `bun.lock` and `apps/extractor/uv.lock` (Managed by package managers; never manually edit).
4. **Generated Caches & Environments:** `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `.next/`, `node_modules/`.

---

## 3. Concrete Quality & Engineering Rules
- **Test Requirement:** Every new API route must have a corresponding integration test in `apps/api/src/__tests__/`.
- **Pre-Completion Checks:** Always run `bun run typecheck` and `bun run lint` before declaring any task complete. Fix any errors introduced by changes.
- **No Placeholder Stubs:** Write functional, typed implementations. Never leave placeholder `// TODO` stubs or fake mocked functions in production code.

---

## 4. Multi-Tenancy & Scoping Commandments
- **Every Account is an Org (`tenant_id`):** Signup auto-provisions a personal org where the user is sole `owner`. There is no separate "personal account" code path.
- **Namespace Isolation (`namespace`):** The `namespace` field (default `"default"`) is the authoritative access control boundary. Never create cross-namespace relationship edges.
- **Flat Schema Contract:** Every memory claim row must explicitly define indexed `tenant_id`, `namespace`, `user_id`, with nullable `entity_key` and `session_id`.

---

## 5. Technology Stack & Language Boundaries
- **Polyglot Monorepo Structure:**
  - **TypeScript on Bun:** For HTTP API ([`apps/api`](apps/api/AGENTS.md)), background workers ([`apps/worker`](apps/worker/AGENTS.md)), database schemas ([`packages/db`](packages/db/AGENTS.md)), and shared contracts ([`packages/core`](packages/core/AGENTS.md)).
  - **Python 3.12 with `uv`:** Exclusively for binary document layout parsing and LibreOffice conversion in [`apps/extractor`](apps/extractor/AGENTS.md).
- **Primary Database:** **PostgreSQL + `pgvector`** for relational facts, evidence citations, entity relationships, and vector embeddings (HNSW 768-dim index). Never introduce SQLite per-space files, Qdrant, Neo4j, or Mongo.
- **Queue Engine:** **Redis + BullMQ** for asynchronous job queues (`document-parsing`, `chunking`, `episode-extraction`). Redis is purely transient queue plumbing and must never store persistent memory data.
- **Object Storage:** **S3-compatible Object Storage** (local MinIO in dev; R2/S3 in cloud) for raw files, converted PDFs, and parsed Markdown following the Claim Check Pattern.

---

## 6. Extraction & Mutation Lifecycle
- **Single LLM Call:** Extraction must run in a single structured Gemini inference call proposing new claims, relationship edges, entity quintuplets, and mutations against candidate prior claims.
- **Pending Review Buffer:** New claims must be durably written with `status = 'pending_review'` before mutation evaluation runs. Never surface `pending_review` claims to live retrieval.
- **Atomic Transition:** Mutation evaluation must resolve in a single atomic database transaction, flipping new claims to `active`, superseded claims to `superseded`, and deduplicating by `contentHash`.
- **Evidence Citations:** `episodes` stores immutable raw input text. `evidence` stores authoritative character offset ranges (`start_offset`, `end_offset`) into episodes supporting specific claims.

---

## 7. Scoped Agent Instruction Guides

For directory-specific coding rules, conventions, and patterns, consult the localized agent instructions:
- **API Gateway Rules:** [`apps/api/AGENTS.md`](apps/api/AGENTS.md)
- **Document Extractor Rules:** [`apps/extractor/AGENTS.md`](apps/extractor/AGENTS.md)
- **Background Worker Rules:** [`apps/worker/AGENTS.md`](apps/worker/AGENTS.md)
- **Database Schema Rules:** [`packages/db/AGENTS.md`](packages/db/AGENTS.md)
- **Shared Core Contracts:** [`packages/core/AGENTS.md`](packages/core/AGENTS.md)
