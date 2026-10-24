# Whimsync — Memory and Content Engine for AI

> **Your AI forgets everything between conversations. Whimsync fixes that.**
> It automatically learns from interactions, extracts facts, builds knowledge graphs, handles updates and contradictions, and delivers the right context at the right time. File processing, fact extraction, multimodal understanding — the entire context stack in one system.

---

## ⚡ Core Capabilities

- **Fact & Relationship Extraction:** Automatically extracts atomic facts, semantic relationship edges (`UPDATES`, `EXTENDS`, `SUPPORTS`, `CONTRADICTS`), and entity knowledge from text and documents.
- **Temporal Memory & Contradiction Resolution:** Detects when new information invalidates or updates prior understanding, marking stale claims as superseded while preserving historical lineage.
- **Multimodal Document Processing:** Ingests complex files—including PDFs, Word documents (`.docx`), slide decks (`.pptx`), markdown, and source code.
- **Tier-Based Parsing for Controlled Cost:** Routes documents across deterministic extraction, multi-signal layout complexity analysis, or visual layout models (VLM) to balance speed, fidelity, and cost.
- **Verifiable Evidence & Citations:** Every extracted claim links directly to immutable character offset ranges in source material for transparent verification.

---

## 🗺️ Monorepo Map

Whimsync is organized as a layered polyglot monorepo. Each component contains its own dedicated guide:

| Component | Runtime / Stack | Description |
|---|---|---|
| [`apps/api`](apps/api/README.md) | Bun, Hono | HTTP gateway, Clerk auth, and ingestion routing |
| [`apps/extractor`](apps/extractor/README.md) | Python 3.12, uv | PDF/Office layout parser and Gemini VLM |
| [`apps/worker`](apps/worker/README.md) | Bun, BullMQ | AST chunker, Gemini extraction, and mutation engine |
| [`packages/db`](packages/db/README.md) | Drizzle, PostgreSQL | Database schema, pgvector HNSW index, and migrations |
| [`packages/core`](packages/core/README.md) | TypeScript | Shared queue contracts, cognitive schemas, and S3 client |
| [`docs/architecture.md`](docs/architecture.md) | Markdown | Master architectural specification and data contracts |

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- [Bun](https://bun.sh/) (>= 1.2)
- [Docker & Docker Compose](https://www.docker.com/)
- [uv](https://docs.astral.sh/uv/) (Python package manager, >= 0.4)
- [LibreOffice](https://www.libreoffice.org/) (system binary; optional, only required if converting Office `.docx`/`.pptx` files to PDF)

### 2. Start Infrastructure & Bootstrap
```bash
# 1. Start local PostgreSQL (pgvector), Redis, and MinIO
docker compose up -d

# 2. Configure environment
cp .env.example .env

# 3. Install dependencies (Bun workspaces + Python uv virtualenv)
bun run setup

# 4. Run database migrations
bun run db:migrate
```

### 3. Start Development Services
Run the services across separate terminals:

```bash
# Terminal 1: HTTP API Gateway (runs on http://localhost:3001)
bun run dev:api

# Terminal 2: BullMQ Worker (AST Chunker & Cognitive Extractor)
bun run dev:worker

# Terminal 3: Python Binary Document Parser
bun run dev:extractor
```
