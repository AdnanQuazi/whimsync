# Whimsync — Engineering Blueprint (v1.0)

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

> **The Cognitive Memory & Context Layer for AI**
>
> *Maximize cognitive value and retrieval speed per unit of operational complexity.*

---

## Table of Contents
1. [Executive Summary & Core Thesis](#1-executive-summary--core-thesis)
2. [What Whimsync Is & What It Does](#2-what-whimsync-is--what-it-does)
3. [System Architecture: The Modular Monolith](#3-system-architecture-the-modular-monolith)
4. [Storage Architecture: Space-Scoped DBs & Containers](#4-storage-architecture-space-scoped-dbs--containers)
5. [Concurrency Control & SQLite Lock Defenses](#5-concurrency-control--sqlite-lock-defenses)
6. [Cost Optimization: Model Tiering & Epoch Batching](#6-cost-optimization-model-tiering--epoch-batching)
7. [The Definitive Technology Stack & Rationales](#7-the-definitive-technology-stack--rationales)
8. [The 5-Layer Cognitive Hierarchy](#8-the-5-layer-cognitive-hierarchy)
9. [Deployment & Horizontal Scaling Topology](#9-deployment--horizontal-scaling-topology)
10. [Pragmatic Build Phases (Roadmap)](#10-pragmatic-build-phases-roadmap)
11. [Future Add-Ons Architecture (Connectors & MCP)](#11-future-add-ons-architecture-connectors--mcp)

---

## 1. Executive Summary & Core Thesis

Every existing AI memory system on the market falls into one of two traps:
1. **The Opaque / Un-Editable Memory Trap (Traditional Chunk-Based Stores / External Graph-Vector Tools):** While some existing commercial memory systems feature fast vector-graph retrieval, background clustering, and programmatic JSON profiles, their memory remains *opaque and programmatic*. You cannot inspect their internal understanding as a coherent narrative, users cannot intuitively edit or override beliefs in plain text, and contradiction handling is often reduced to binary flag toggles rather than preserving historical evolution.
2. **The Operationally Impossible Trap (Academic Multi-Database Architectures):** They design brilliant multi-tier cognitive loops, but require operating 6+ independent databases and microservices (vector DBs + graph DBs + relational DBs + document stores + message queues) with heavy LLM calls on every synchronous write. They collapse in production under network latency, lock contention, and cloud infrastructure bills.

### The Whimsync Solution: **Speed of Edge SQLite + Inspectable Wiki Supremacy**
Whimsync is built on a single engineering thesis: **We can achieve sub-15ms retrieval SLAs and deep cognitive abstraction simultaneously by eliminating network round-trips via local SQLite databases while running heavy cognitive synthesis in an asynchronous, scheduled background worker.**

* **Storage systems required to operate:** Exactly **2** (SQLite per space + Redis).
* **p50 Read Latency Target:** **<10ms** (via local in-process SQLite hybrid search + Redis profile cache).
* **p95 Read Latency Target:** **<30ms** (via multi-space parallel local queries).
* **Cognitive Moat:** Human-Readable/Editable Markdown Wiki + Typed Contradiction Timelines + Category-Specific Belief Decay ($\lambda$) + Optimistic Concurrency Control overrides.

---

## 2. What Whimsync Is & What It Does

Whimsync is a persistent, stateful memory and context engine designed as a drop-in API for AI assistants, coding agents, and autonomous workflows.

### What Whimsync Automatically Does Behind the Scenes:
* **Decomposes Experience into Atomic Facts:** Instead of storing verbose, noisy text passages, Whimsync extracts clean, schema-grounded entity-relationship-entity triples (e.g., `[User] -> [prefers] -> [PostgreSQL]`).
* **Filters Noise at the Gate:** An ultra-fast heuristic filter and Locality-Sensitive Hashing (LSH) index intercept trivial chatter and duplicate statements before they ever burn embedding tokens or database writes.
* **Synthesizes Understanding via Epoch Reflection:** On scheduled intervals (or when idle), an asynchronous Reflection Engine examines clusters of accumulated facts. When a pattern meets strict evidence thresholds ($\ge 5$ facts across $\ge 2$ distinct time periods), Whimsync generates high-order **Insight Nodes** (e.g., *"User values operational simplicity over theoretical elegance"*).
* **Manages Evolving Identity & Contradictions:** When beliefs collide (*"Likes Python"* in 2024 vs. *"Hates Python"* in 2026), Whimsync does not blindly overwrite history. It classifies the conflict (preference change vs. context shift vs. direct contradiction), builds an evolutionary timeline, and applies category-specific temporal decay ($\lambda$) so old beliefs gracefully fade unless reinforced.
* **Compiles an Inspectable Markdown Wiki:** Whimsync compiles its internal graph and identity layer into a clean, structured Markdown Wiki. Users and engineers can read exactly what the AI knows, debug bad recommendations in minutes, and directly edit the text.
* **Honors Human Supremacy:** Direct edits to the Wiki are ingested as `user_stated` facts with maximum authority. The machine reflection engine is strictly forbidden from ever overwriting human edits.

---

## 3. System Architecture: The Modular Monolith

To avoid the network latency penalties and deployment nightmares of microservices, Whimsync is designed as a **Modular Monolith** deployed as a **2-Process / 2-State System (The "Fast-Core + Deep-Brain" Pattern)** from a single monorepo codebase.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            WHIMSYNC MONOREPO CODEBASE                            │
│  ├── /src/perception   ├── /src/retrieval   ├── /src/storage   ├── /src/cognitive│
└──────────────────────────────────────────────────────────────────────────────────┘
                                         │
                  Deployed as 2 Independent Processes / Containers
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         ▼                                                               ▼
┌───────────────────────────────────┐                 ┌───────────────────────────────────┐
│  PROCESS 1: The Fast-Core (API)   │                 │  PROCESS 2: The Deep-Brain        │
│  (Synchronous Read/Write Path)    │                 │  (Scheduled Epoch Worker)         │
├───────────────────────────────────┤                 ├───────────────────────────────────┤
│ • Handles HTTP / REST / SSE       │                 │ • Runs on Cron / Epoch intervals  │
│ • Fast-path regex heuristic       │                 │ • Runs Reflection Engine (LLM)    │
│ • LSH duplicate pre-check         │     Redis       │ • Batch Contradiction Classifier  │
│ • Calls Atomic Fact Extractor     │ ───Stream───→   │ • Tier Promotion (Raw→Core)       │
│ • Inserts facts via Write Queue   │   Priority      │ • Compiles Wiki Markdown          │
│ • SQLite Hybrid Search (Target<5ms│    Queue        │ • Updates Identity Belief Decay   │
│ • Reads Redis Profile Cache (<1ms)│                 │ • Recompiles & caches Profile     │
│ • ZERO heavy background compute   │                 │ • ZERO API blocking               │
└─────────────────┬─────────────────┘                 └─────────────────┬─────────────────┘
                  │                                                     │
                  └───────────────────────────┬─────────────────────────┘
                                              ▼
                               ┌─────────────────────────────┐
                               │   EXACTLY 2 STORAGE ENGINES │
                               ├─────────────────────────────┤
                               │ 1. SQLite per-space files   │
                               │    (+ sqlite-vec & FTS5)    │
                               │ 2. Redis 7+ (Valkey RAM)    │
                               │    (T1 Cache + Queue)       │
                               └─────────────────────────────┘
```

### Why This Is the Architecture:
1. **Zero Network Latency:** Process 1 (Fast-Core) directly opens the local SQLite database files on an NVMe SSD. Vector similarity searches, BM25 keyword lookups, and recursive graph traversals execute in local memory/disk, targeting **3–8ms**.
2. **Total API Isolation:** Heavy cognitive synthesis (LLM reflection, multi-doc wiki compilation, graph pruning) runs entirely in Process 2 (Deep-Brain). A massive background reflection job will never add latency to a user's synchronous chat request.
3. **Independent Scalability:** If chat traffic spikes, scale up Process 1 containers. If heavy data ingestion creates a reflection backlog, scale up Process 2 worker pods.
4. **Trivial Local Development:** A single `docker compose up` command launches Redis and spawns both Python processes. No Kubernetes, no service meshes, no mock cloud services.

---

## 4. Storage Architecture: Space-Scoped DBs & Containers

To support both **Memory Containers (`containerTag`)** and **Multi-User / Multi-Agent Shared Memory** without database duplication or network RPCs, Whimsync uses **Space-Scoped SQLite Databases**.

### 1. Space-Scoped Databases (`/data/spaces/{space_id}.db`)
Instead of locking databases to a user ID, storage is partitioned by **Cognitive Spaces**:
* **Personal Space:** `space_usr_arjun.db` (Private to Arjun).
* **Project Space:** `space_proj_whimsync.db` (Shared by Arjun, Sarah, and coding agents).
* **Team/Org Space:** `space_org_engineering.db` (Shared across the department).

When Arjun queries his AI while working on Whimsync, the Fast-Core API checks Redis permissions (`SISMEMBER access:space_proj_whimsync:users "arjun"`), opens both `space_usr_arjun.db` and `space_proj_whimsync.db` locally, and executes hybrid searches **in parallel**. Total multi-space retrieval SLA target: **<15ms**.

### 2. Hierarchical Namespaces
Within every space database, facts and wiki sections carry hierarchical POSIX-style namespace paths:
* `/work/whimsync/architecture`
* `/work/whimsync/bugs`
* `/personal/fitness`

By utilizing SQLite compound B-tree indexes on `(namespace_path, is_latest, confidence DESC)`, an agent can query with pinpoint precision (`WHERE namespace_path = '/work/whimsync/architecture'`) or broad domain reach (`WHERE namespace_path LIKE '/work/%'`) with minimal I/O overhead.

### 3. Inside a Single Space Database (SQL Schema Topology)
Every `{space_id}.db` file contains exactly these core relational tables:
* **`facts`**: Atomic facts, entity-relation triples, `confidence`, `is_latest` flag, `namespace_path`, `insight_tier` (`raw` to `core`), and `provenance`.
* **`fact_embeddings`**: Virtual table powered by **`sqlite-vec`** storing 1536-dimensional vectors for fast cosine distance search.
* **`facts_fts`**: Virtual table powered by **SQLite FTS5** for ultra-fast BM25 keyword matching.
* **`episodes`**: Immutable archive of raw input text, timestamps, and salience scores.
* **`edges`**: Relational adjacency table mapping graph connections (`updates`, `extends`, `derives`, `applies_to`, `contradicts`).
* **`wiki_sections`**: Compiled Markdown sections, version counters, and provenance flags.
* **`identity`**: Synthesized high-level beliefs, decay rates ($\lambda$), and reinforcement timestamps.

---

## 5. Concurrency Control & SQLite Lock Defenses

Because SQLite enforces **file-level locking** (`EXCLUSIVE` lock on the `.db` file during write transactions), simultaneous write attempts from Process 1 (API) and Process 2 (Worker) can trigger `SQLITE_BUSY` contention. Whimsync implements a **4-Layer Defense Protocol** to guarantee lock-free concurrency and data integrity:

### Layer 1: SQLite WAL Mode (Write-Ahead Logging)
Every SQLite database is initialized with `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;`. In WAL mode, **readers do not block writers, and writers do not block readers**. Process 2 can execute a deep graph walk without blocking Process 1 from reading facts.

### Layer 2: The In-Memory Serialized Write Queue (Single-Server Mitigation)
For single-box monolith deployments, to prevent physical file-lock collisions between API writes and background reflection writes, all write operations to `/data/spaces/{space_id}.db` are routed through an async **Serialized Write Queue** in Python. Reads bypass the queue and execute instantly in parallel; writes are serialized per space database, ensuring SQLite never encounters competing write transactions.

### Layer 3: Strict Table Ownership Contracts
To guarantee zero logical write-write data collisions, processes own exclusive write rights to specific tables:

| Table / Rows | Exclusive Write Owner | Purpose |
|---|---|---|
| `episodes` | ⚡ Fast-Core API Only | Append raw user input archives |
| `facts` (*insight_tier = 'raw'*) | ⚡ Fast-Core API Only | Insert newly extracted atomic facts |
| `fact_embeddings` | ⚡ Fast-Core API Only | Insert vector embeddings for new facts |
| `facts` (*insight_tier > 'raw'*) | 🧠 Deep-Brain Worker Only | Promote facts to candidate/established/core |
| `edges` | 🧠 Deep-Brain Worker Only | Connect graph relationships & contradictions |
| `wiki_sections` | 🧠 Deep-Brain + 👤 Human Edits | Compile Markdown wiki summaries |
| `identity` | 🧠 Deep-Brain + 👤 Human Edits | Update synthesized beliefs & decay rates |

### Layer 4: Human Supremacy & Optimistic Concurrency Control (OCC)
When updating the Wiki or Identity layer, the Cognitive Worker must obey two rules:
1. **The Human Supremacy Rule:** If `provenance == 'user_stated'`, the machine worker is strictly forbidden from modifying the text.
2. **Optimistic Version Checking:** When compiling a section, the worker executes:
   ```sql
   UPDATE wiki_sections
   SET content = :new_text, version = version + 1, updated_at = :now
   WHERE section_key = :key AND version = :expected_version AND provenance != 'user_stated';
   ```
   If a human edited the section while the LLM was processing, `affected_rows == 0`. The worker discards its stale compilation and retries on the next cycle.

---

## 6. Cost Optimization: Model Tiering & Epoch Batching

To prevent LLM API token bills from exploding during high-throughput chat sessions, Whimsync rejects continuous stream polling and expensive LLM calls on the write path, enforcing two strict cost-reduction mandates:

### 1. Scheduled Epoch Batching (Cron vs. Continuous Polling)
Instead of firing an LLM reflection call every time 5 facts accumulate, the Deep-Brain Cognitive Worker runs on **Scheduled Epoch Intervals** (e.g., once every 4–6 hours per active space, or triggered only during system idle periods). Raw facts accumulate quietly in SQLite during active chat sessions; reflection, contradiction graph pruning, and Wiki compilation happen in efficient, aggregated batches.

### 2. Strict Model Tiering (Local SLMs vs. Cloud LLMs)
We divide AI tasks by complexity, assigning low-cost/zero-cost models to high-frequency tasks:

| Task Layer | Execution Frequency | Model Assigned | Cost per 1,000 Ops |
|---|---|---|---|
| **Entity Recognition (NER)** | High (Every write) | **GLiNER** (`gliner-small-v2.1` in local RAM) | **$0.00** (Local CPU/RAM) |
| **Novelty Pre-Checking** | High (Every write) | **In-Memory LSH Index** (`datasketch`) | **$0.00** (Local CPU/RAM) |
| **Atomic Fact Extraction** | Medium-High (Novel writes) | **Local SLM** (Qwen-2.5-1.5B / Phi-3-mini in RAM) *OR* Claude 3.5 Haiku fallback | **$0.00** (Local) or **~$0.05** (Haiku API) |
| **Contradiction Classifier** | Medium (Epoch batches) | **Local SLM** / Claude 3.5 Haiku | **~$0.02** |
| **Wiki & Identity Synthesis** | Low (Epoch batches only) | **Claude 3.5 Haiku** (Anthropic API) | **~$0.15** |

By handling 80%+ of daily workload via local regex, LSH, GLiNER, and local Small Language Models (SLMs), Whimsync's operating cost target drops to **<$0.20 per active user/month**.

---

## 7. The Definitive Technology Stack & Rationales

| Component | Technology Choice | Why This Is the Exact Right Choice |
|---|---|---|
| **Language & Runtime** | **Python 3.12+** | 95% of the AI/ML ecosystem (GLiNER, LSH, Numpy, LLM SDKs) is native to Python. With Python 3.12 `asyncio` and Rust-backed tooling, we get sub-millisecond execution without IPC bridge headaches. |
| **Package & Env Manager** | **`uv`** (by Astral) | 10–100x faster than pip/poetry. Guarantees deterministic lockfiles, instant virtual environment creation, and ultra-fast Docker builds. |
| **API Framework** | **FastAPI + Pydantic v2** | Async-native, automatic OpenAPI schema generation, sub-millisecond data validation (Rust-powered Pydantic v2), and native WebSocket/SSE streaming support. |
| **Primary Storage Engine** | **SQLite 3.45+ (`sqlite-vec`)** | Storing data per-space on local NVMe SSDs eliminates network round-trips. `sqlite-vec` runs vector cosine similarity, while FTS5 handles BM25 keyword search. |
| **Working Memory & Queue** | **Redis 7+ (Valkey)** | Powers T1 ephemeral working memory (session TTLs), caches the pre-compiled User Profile JSON for rapid API retrieval, and drives Redis Streams for epoch job queues. |
| **Fast-Path Filter** | **Python Regex + Redis Sets** | Sub-microsecond interception of low-entropy chatter (e.g., *"ok"*, *"thanks"*, *"hello"*), bypassing ML inference entirely for 40–60% of inputs. |
| **Novelty Pre-Check** | **In-Memory LSH (`datasketch`)** | Locality-Sensitive Hashing identifies duplicate or near-duplicate semantic statements in sub-milliseconds without executing disk/vector DB searches. |
| **Entity Extraction (NER)** | **GLiNER** (`gliner-small-v2.1`) | Fast, open-source, zero-shot entity recognition running locally to tag subjects and objects before atomic fact extraction. |
| **Fact Extraction Model** | **Qwen-2.5-1.5B / Phi-3** | Open-source Small Language Models running locally in RAM to extract atomic JSON triples without burning paid API tokens. |
| **Embedding Model** | **`text-embedding-3-small` / Nomic** | OpenAI API for zero-ops cloud deployment; clean abstraction layer allows self-hosters to swap in local Nomic-Embed or Ollama models. |
| **Reflection & Wiki LLM** | **Claude 3.5 Haiku (Anthropic API)** | The industry's fastest, most cost-effective model capable of strict schema-grounded contradiction classification and multi-document synthesis during scheduled Epoch batches. |
| **Observability** | **OpenTelemetry + Grafana** | Mandatory from line 1. Traces every request across API and Worker processes. Provisioned Grafana dashboards monitor queue depth, token budgets, and cost-per-user. |

---

## 8. The 5-Layer Cognitive Hierarchy

Whimsync structures memory into five evolutionary tiers. Facts enter at Level 1 and earn their way upward through corroboration:

```
Level 1: Raw Facts         "User chose async handler for Project A" (Week 1)
 (Episodic Storage)        "User refactored sync code to event-driven" (Week 3)
                           "User said: 'I hate waiting on blocking calls'" (Week 4)
                              │
                              ▼ [Evidence Gate: ≥5 facts across ≥2 time periods]
                              │
Level 2: Insight Nodes     "User has a consistent architectural preference for
 (Reflected Patterns)       non-blocking async patterns over synchronous code."
                           Status: Tier = Candidate | Confidence = 0.82
                              │
                              ▼ [Accumulation: 20+ facts across 4+ time periods]
                              │
Level 3: Identity Layer    "User values reliability, operational clarity, and explicit
 (Synthesized Beliefs)      control over systems. Prefers predictable over 'magic.'"
                           Status: Tier = Established | Confidence = 0.94 | λ = 0.0005
                              │
                              ▼ [Compiled for Human Inspection]
                              │
Level 4: Markdown Wiki     # User Profile: Arjun
 (Inspectable State)       ## Technology Preferences
                           - Strongly prefers async, non-blocking execution [0.94]
                           - Avoids heavy ORMs in favor of explicit SQL [0.88]
```

---

## 9. Deployment & Horizontal Scaling Topology

Whimsync is designed to deploy natively as a self-contained monolith, while providing an edge-native cloud upgrade path without changing SQL schema or query structure:

### 1. Single-Box Monolith (Self-Hosted / Local Dev / SaaS up to 50k Users)
* **Infrastructure:** A single Linux VPS (e.g., Hetzner 4-vCPU / 8GB RAM NVMe SSD) or AWS EC2 instance running Docker Compose.
* **Execution:** Process 1 (FastAPI) and Process 2 (Worker) share local NVMe disk access to `/data/spaces/{space_id}.db` files. Redis Valkey runs in RAM. The In-Memory Serialized Write Queue prevents SQLite file-lock contention.

### 2. Horizontal Cloud Scale (Edge-Native Durable Objects)
When growing beyond 50,000 users or deploying across global edge networks where local NVMe drives cannot be shared across pods, Whimsync migrates its SQLite execution layer to **Cloudflare Durable Objects with Embedded SQLite**:
* Each Cognitive Space (`/spaces/{space_id}`) maps 1-to-1 to a globally unique Durable Object at the nearest Cloudflare edge location.
* Because Durable Objects are strictly **single-threaded**, database lock contention is physically impossible. Process 1 API calls and Process 2 reflection jobs execute sequentially in the DO event loop.
* Built-in embedded SQLite provides local disk read speeds and automatic edge replication without managing cloud relational database clusters.

---

## 10. Pragmatic Build Phases (Roadmap)

We build in three rigorous, production-ready phases:

### Phase 1: The High-Speed Core (Weeks 1–4)
*Goal: Deliver a rock-solid memory engine targeting sub-15ms retrieval SLAs that outperforms traditional chunk-based vector stores on storage, retrieval, and fact extraction.*
* [ ] Monorepo setup with `uv`, FastAPI skeleton, and OpenTelemetry instrumentation.
* [ ] SQLite per-space connection manager with WAL mode initialization, FTS5 tables, `sqlite-vec` vector embeddings, and the In-Memory Serialized Write Queue.
* [ ] Fast-Path regex heuristic filter and in-memory LSH novelty pre-checker.
* [ ] Atomic Fact Extractor (local SLM or Haiku prompt decomposing text into entity-relation triples with `is_latest=1` flags).
* [ ] Single-DB Hybrid Search engine combining vector cosine similarity, BM25 keyword matching, and 2-hop recursive CTE graph walks.
* [ ] Redis T1 working memory and pre-compiled User Profile JSON caching endpoint (`GET /api/v1/profile`).
* [ ] Instant GDPR hard-deletion pipeline (`DELETE /api/v1/space/{id}` removing SQLite file, flushing Redis, and logging receipt).

### Phase 2: The Cognitive Engine (Weeks 5–10)
*Goal: Activate the Deep-Brain Cognitive Worker to generate understanding, resolve contradictions, and compile the human-editable Wiki.*
* [ ] Scheduled Epoch Cron scheduler (`main_worker.py`) aggregating reflection jobs every 4–6 hours.
* [ ] Evidence Gate implementation validating $\ge 5$ supporting facts across $\ge 2$ distinct time periods before promoting facts from `raw` $\rightarrow$ `candidate` $\rightarrow$ `established`.
* [ ] Claude 3.5 Haiku Reflection Engine generating Insight Nodes and pruning superseded facts during scheduled epochs.
* [ ] Batch Contradiction Classifier sorting conflicts into `preference_change`, `context_shift`, `temporal_update`, and `direct_contradiction`.
* [ ] Markdown Wiki compiler converting SQLite sections into human-readable documents (`GET /api/v1/wiki`).
* [ ] Identity Layer with category-specific temporal decay rates ($\lambda$) updating belief confidence over time.
* [ ] Human edit reconciliation endpoint (`PUT /api/v1/wiki`) converting manual text edits into `user_stated` ground-truth facts with OCC version checking.

### Phase 3: Ecosystem Scale & Edge Deployment (Weeks 11–16)
*Goal: Prepare Whimsync for massive scale, edge deployment via Cloudflare Durable Objects, and external ecosystem integration.*
* [ ] Abstraction layer migration supporting **Cloudflare Durable Objects with Embedded SQLite** as a drop-in cloud alternative to local SQLite files.
* [ ] Comprehensive evaluation benchmark suite measuring Long-Context Recall (>96%), Multi-Hop Reasoning (>95%), Contradiction Precision (>90%), and Cost-per-User accuracy against LOCOMO and LongMemEval datasets.
* [ ] Edge ontology schema evolution tooling (justifying new relationship types after 30 days of observation in the `related_to` catch-all bucket).
* [ ] Production Docker Compose and Kubernetes Helm charts with Grafana operational dashboards pre-configured.

---

## 11. Future Add-Ons Architecture (Connectors & MCP)

Because Whimsync is built on a clean, space-scoped storage foundation and a modular ingestion pipeline, future ecosystem add-ons slot cleanly on top of the base engine without touching the core:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             EXTERNAL ECOSYSTEM ADD-ONS                           │
│                                                                                  │
│  ┌─────────────────────────────┐         ┌────────────────────────────────────┐  │
│  │   DATA CONNECTORS           │         │   MODEL CONTEXT PROTOCOL (MCP)     │  │
│  │ • Slack / Discord Bots      │         │ • Claude Desktop / Cursor Server   │  │
│  │ • Notion / GitHub Sync      │         │ • Tools: memory_add, memory_search │  │
│  │ • IDE Extension Watchers    │         │ • Resources: whimsync://wiki/{id}  │  │
│  └──────────────┬──────────────┘         └─────────────────┬──────────────────┘  │
└─────────────────┼──────────────────────────────────────────┼──────────────────┘
                  │ (HTTP POST /memory/add)                  │ (JSON-RPC 2.0 / stdio)
                  ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         WHIMSYNC BASE ENGINE (FAST-CORE API)                     │
│  ├── Fast-Path Filter ──► LSH Pre-Check ──► Fact Extractor ──► SQLite Space DB   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Data Connectors (Slack, Notion, GitHub, IDEs)
Connectors are lightweight external workers or cron jobs. They authenticate via standard API keys and push raw text or diffs directly to `POST /api/v1/memory/add` with appropriate namespace paths (e.g., `namespace_path: "/github/repo_whimsync/pulls"` or `namespace_path: "/slack/engineering_channel"`). The base engine handles fact extraction, deduplication, and reflection automatically.

### 2. Model Context Protocol (MCP) Server
Whimsync will expose a standard **MCP Server** interface (via stdio or SSE) allowing instant integration with Claude Desktop, Cursor, Windsurf, and automated AI coding agents:
* **MCP Tools Provided:** `memory_add`, `memory_search`, `get_user_profile`, `edit_wiki_section`.
* **MCP Resources Provided:** `whimsync://spaces/{space_id}/wiki` (allowing agents to read the compiled Markdown Wiki directly into their context window as a live, evolving instruction system).

---
*Document Version: 1.0 — Master Specification*
*Project Status: Active Development — Phase 1 Foundation*
*Last Updated: July 2026*
