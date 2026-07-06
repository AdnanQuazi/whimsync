# Whimsync — Progress Tracker

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

---

## 🟡 Phase 1: The High-Speed Core (CURRENT FOCUS)

### Step 1: Tooling & Environment Setup (COMPLETED)
- [x] Initialize Python 3.12+ project using `uv` (`pyproject.toml`).
- [x] Add foundational core dependencies (`fastapi`, `pydantic>=2.0`, `redis`, `sqlite-vec`).
- [x] Create simple `docker-compose.yml` to run background Redis Valkey on port 6379 for local development.
- [x] Verify environment builds and Python can execute cleanly.

### Step 2: Space-Scoped SQLite Manager (`/src/shared/db.py`) (COMPLETED)
- [x] Implement async/sync connection pooler for `/data/spaces/{space_id}.db`.
- [x] Enforce mandatory SQLite PRAGMAs (`journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`).
- [x] Implement automatic schema migrator initializing our core tables (`episodes`, `facts`, `fact_embeddings`, `facts_fts`, `edges`, `wiki_sections`, `identity`).
- [x] Write integration test verifying WAL concurrent read/write behavior and `sqlite-vec` extension loading.

### Step 3: Fast-Path Filter & Novelty Check (`/src/perception/`) (NEXT UP)
- [ ] Implement low-entropy regex bypass filter (`fast_path.py`) to intercept trivial chatter (<1ms target).
- [ ] Implement in-memory Locality-Sensitive Hashing (`lsh_novelty.py` via `datasketch`) for semantic deduplication.
- [ ] Write unit tests verifying immediate rejection of duplicate inputs without touching SQLite.

### Step 4: Atomic Fact Extraction Engine (`/src/perception/fact_extractor.py`)
- [ ] Integrate local GLiNER (`gliner-small-v2.1`) for zero-shot entity recognition.
- [ ] Implement structured Pydantic schema for Entity-Relationship-Entity triples.
- [ ] Implement extraction wrapper supporting both local SLMs (Qwen/Phi) and Claude 3.5 Haiku API fallback.
- [ ] Write test verifying a verbose paragraph decomposes into isolated triples with `is_latest = 1` flags.

### Step 5: Single-DB Hybrid Search (`/src/retrieval/hybrid_search.py`)
- [ ] Implement cosine similarity vector search via `sqlite-vec`.
- [ ] Implement BM25 keyword search via SQLite FTS5 (`facts_fts`).
- [ ] Implement 2-hop recursive CTE graph traversal (`WITH RECURSIVE`).
- [ ] Implement recency $\times$ confidence $\times$ tier reranker combining all three search signals.
- [ ] Verify multi-space parallel query performance (<15ms SLA target).

### Step 6: Fast-Core API Server (`/src/main_api.py`)
- [ ] Build FastAPI server with OpenTelemetry tracing instrumentation.
- [ ] Implement `POST /api/v1/memory/add` (Fast-Path $\rightarrow$ LSH $\rightarrow$ Extractor $\rightarrow$ SQLite insert $\rightarrow$ Redis Stream event).
- [ ] Implement `POST /api/v1/memory/search` (Query Router $\rightarrow$ Parallel Hybrid Search).
- [ ] Implement `GET /api/v1/profile` reading pre-compiled JSON directly from Redis T1 cache (<1ms target).
- [ ] Implement instant GDPR deletion endpoint (`DELETE /api/v1/space/{id}`).

---

## ⚪ Phase 2: The Cognitive Engine (UPCOMING)
- [ ] Step 7: Redis Streams Epoch Scheduler & Token Bucket Rate Limiter (`/src/main_worker.py`).
- [ ] Step 8: Evidence Gate ($\ge 5$ facts across $\ge 2$ distinct time periods).
- [ ] Step 9: Claude 3.5 Haiku Reflection Engine (generating Insight Nodes).
- [ ] Step 10: Batch Contradiction Classifier (`preference_change`, `context_shift`, etc.).
- [ ] Step 11: Markdown Wiki Compiler (`GET /api/v1/wiki`).
- [ ] Step 12: Identity Layer & Category-Specific Belief Decay ($\lambda$).
- [ ] Step 13: Human Edit Reconciliation & OCC Version Checking (`PUT /api/v1/wiki`).

---

## ⚪ Phase 3: Ecosystem Scale & Add-Ons (UPCOMING)
- [ ] Step 14: Cloudflare Durable Objects edge deployment abstraction.
- [ ] Step 15: Evaluation Benchmark Suite (LOCOMO / LongMemEval recall accuracy).
- [ ] Step 16: Model Context Protocol (MCP) Server integration.
- [ ] Step 17: Slack, Notion, and GitHub Data Connectors.
