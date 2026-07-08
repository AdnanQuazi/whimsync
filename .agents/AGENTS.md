# Whimsync — AI Agent Workspace Rules & Architectural Commandments

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

> **IMPORTANT FOR ALL AI AGENTS & CODING ASSISTANTS:**
> When working in this repository, you must strictly obey the following architectural rules and design contracts established in `WHIMSYNC.md`. Never deviate from these rules without explicit user approval.

---

## 1. Incremental Engineering Philosophy & Space Model
* **No Empty Stubs:** Never generate dummy folders or empty stub files in advance. Build strictly incrementally. Write one functional, tested module at a time.
* **No Microservices:** This is a **Portable Cognitive Monolith** deployed initially on a single VPS (FastAPI Server + Background Worker Container communicating via Redis Streams), with a drop-in adapter path for Cloudflare Edge Durable Objects. Do not suggest splitting code into network-separated microservices.
* **Exactly 2 Stateful Storage Engines:** We use **SQLite per-space files** (`/data/spaces/{space_id}.db`) and **Redis (Valkey)**. Never import or suggest Qdrant, Neo4j, PostgreSQL, or Mongo.
* **Explicit Space Model:** Every new user receives one default space named `My Space`. Every memory ingestion request (`POST /v1/memories`) MUST explicitly include a permanent `space_id` (`ULID`). Whimsync does NOT automatically classify memories into spaces in v1. Space names are human-facing and editable; Space ULIDs are permanent authoritative isolation boundaries.

---

## 2. Sole-Writer Architecture & SQLite Concurrency Commandments
Because SQLite enforces file-level write locking, you must adhere to our concurrency defense:
1. **WAL Mode Mandatory:** Every SQLite connection MUST initialize with:
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA busy_timeout = 5000;
   ```
2. **Sole physical SQLite writer (Local/VPS Mode):** **FastAPI (Process 1) is designated as the sole physical SQLite writer.** The Background Worker (Process 2) performs heavy read-only ML extraction and synthesis, sending all database mutation commands back to FastAPI via Redis Streams or internal mutation endpoint (`PUT /internal/spaces/{id}/mutate`).
3. **Canonical 11-Table Schema:** Every space database (`{space_id}.db`) contains exactly these core tables: `episodes`, `facts`, `evidence`, `beliefs`, `belief_evidence`, `insights`, `insight_support`, `edges`, `fact_embeddings`, `facts_fts`, and `wiki_sections`.
4. **Belief-Level Human Supremacy & Optimistic Concurrency Control (OCC):**
   * Authority belongs to individual assertions/beliefs (`USER_PINNED (Level 6)`), not whole wiki page rows. Automated reflection or LLM jobs are strictly forbidden from overwriting pinned human beliefs.
   * When updating `wiki_sections`, check versions and never overwrite concurrent human edits:
     ```sql
     UPDATE wiki_sections SET content = :val, version = version + 1
     WHERE section_key = :key AND version = :expected_version;
     ```

---

## 3. Cost Reduction & Model Tiering Rules
* **No Continuous LLM Polling:** Never design background loops that fire paid LLM API calls on every stream message. Reflection and Wiki compilation must be governed by our deterministic Event-Driven Thermostat ($\text{NewFacts} \ge 5 \lor \text{Contradictions} \ge 1 \lor \text{Age} \ge 4\text{h}$) or scheduled epoch sweeps.
* **Model Hierarchy & Controlled Calls:**
  * Use **Deterministic Regex** for noise filtering (<1ms).
  * Use **In-Memory LSH (`datasketch` SimHash/MinHash)** for Gate 1 cheap lexical novelty checking.
  * Use **GLiNER (`gliner-small-v2.1`)** in local RAM for zero-shot Entity Recognition (NER).
  * Use **Local SLMs (Qwen-1.5B / Phi-3)** for atomic fact extraction when possible, reserving **Claude 3.5 Haiku** for complex extraction, ambiguous contradiction classification, and scheduled reflection/insight synthesis.

---

## 4. Coding Standards & Tooling
* **Language:** Python 3.12+ with native `asyncio`.
* **Package Manager:** Use **`uv`** exclusively. Do not use `pip`, `poetry`, or `conda`.
* **Validation & API:** Use **FastAPI** and **Pydantic v2**.
* **Database Driver:** Use standard `sqlite3` (or `aiosqlite` if async wrapping is needed) with the `sqlite-vec` extension loaded via our `RetrievalPort` adapter.
* **Paths:** Use Windows-compatible forward slashes or `pathlib.Path` for all filesystem paths. Space databases must reside in a configurable data directory (defaulting to `./data/spaces/`).

---

## 5. The 15 Architecture Principles to Preserve
1. Build the simplest deployable architecture first.
2. Keep the initial Local/VPS deployment on one machine.
3. Separate Fast-Core request handling from slow cognitive processing.
4. Keep SQLite as authoritative long-term memory in Local/VPS mode.
5. Keep Durable Object SQLite as authoritative Space state in Cloudflare mode.
6. Use queues to decouple expensive processing.
7. Maintain one physical mutation path per Space storage system.
8. Keep cognitive/domain logic independent from infrastructure.
9. Do not build automatic Space classification in the initial version.
10. Do not introduce microservices prematurely.
11. Scale the Worker independently when inference becomes the bottleneck.
12. Treat the Wiki, Profile JSON, and Agent Context as projections of authoritative structured memory.
13. Keep Space IDs permanent (`ULID`) and Space names editable.
14. Every memory ingestion operation must explicitly target a Space (`space_id`).
15. Preserve a clean migration path from single-VPS deployment to split Worker deployment and eventually Cloudflare deployment.
