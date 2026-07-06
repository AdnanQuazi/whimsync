# Whimsync — AI Agent Workspace Rules & Architectural Commandments

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

> **IMPORTANT FOR ALL AI AGENTS & CODING ASSISTANTS:**  
> When working in this repository, you must strictly obey the following architectural rules and design contracts established in `WHIMSYNC.md`. Never deviate from these rules without explicit user approval.

---

## 1. Incremental Engineering Philosophy
* **No Empty Stubs:** Never generate dummy folders or empty stub files in advance. Build strictly incrementally. Write one functional, tested module at a time.
* **No Microservices:** This is a **Modular Monolith** deployed as a 2-Process system (Fast-Core API Server + Deep-Brain Cognitive Worker). Do not suggest splitting code into network-separated microservices.
* **Exactly 2 Stateful Storage Engines:** We use **SQLite per-space files** (`/data/spaces/{space_id}.db`) and **Redis (Valkey)**. Never import or suggest Qdrant, Neo4j, PostgreSQL, or Mongo.

---

## 2. SQLite & Database Concurrency Commandments
Because SQLite enforces file-level write locking, you must adhere to our 4-layer concurrency defense:
1. **WAL Mode Mandatory:** Every SQLite connection MUST initialize with:
   ```sql
   PRAGMA journal_mode = WAL;
   PRAGMA synchronous = NORMAL;
   PRAGMA busy_timeout = 5000;
   ```
2. **Table Ownership Contract:** Do not write to tables owned by another process:
   * **Fast-Core API process exclusively owns writes to:** `episodes`, `facts` (*where insight_tier = 'raw'*), and `fact_embeddings`.
   * **Deep-Brain Worker process exclusively owns writes to:** `facts` (*where insight_tier > 'raw'*), `edges`, `wiki_sections`, and `identity`.
3. **Optimistic Concurrency Control (OCC):** When updating `wiki_sections` or `identity`, check versions and never overwrite human edits:
   ```sql
   UPDATE wiki_sections SET content = :val, version = version + 1 
   WHERE section_key = :key AND version = :expected_version AND provenance != 'user_stated';
   ```
4. **Human Supremacy Rule:** If any row has `provenance == 'user_stated'`, automated reflection or LLM jobs are strictly forbidden from modifying its content.

---

## 3. Cost Reduction & Model Tiering Rules
* **No Continuous LLM Polling:** Never design background loops that fire paid LLM API calls on every stream message. Reflection and Wiki compilation must run on **Scheduled Epochs (Cron)** or during system idle periods.
* **Model Hierarchy:**
  * Use **GLiNER** (in local RAM) for Entity Recognition (NER).
  * Use **In-Memory LSH (`datasketch`)** for duplicate/novelty checking.
  * Use **Local SLMs (Qwen-1.5B / Phi-3)** for atomic fact extraction when possible, reserving **Claude 3.5 Haiku** for complex extraction and scheduled Epoch Wiki synthesis.

---

## 4. Coding Standards & Tooling
* **Language:** Python 3.12+ with native `asyncio`.
* **Package Manager:** Use **`uv`** exclusively. Do not use `pip`, `poetry`, or `conda`.
* **Validation & API:** Use **FastAPI** and **Pydantic v2**.
* **Database Driver:** Use standard `sqlite3` (or `aiosqlite` if async wrapping is needed) with the `sqlite-vec` extension loaded.
* **Paths:** Use Windows-compatible forward slashes or `pathlib.Path` for all filesystem paths. Space databases must reside in a configurable data directory (defaulting to `./data/spaces/`).
