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
3. [System Architecture: Portable Cognitive Monolith (Ports & Adapters)](#3-system-architecture-portable-cognitive-monolith-ports--adapters)
4. [Storage Architecture: Space-Scoped DBs & Containers](#4-storage-architecture-space-scoped-dbs--containers)
5. [Concurrency Control & SQLite Lock Defenses](#5-concurrency-control--sqlite-lock-defenses)
6. [Cost Optimization: Model Tiering & Epoch Batching](#6-cost-optimization-model-tiering--epoch-batching)
7. [The Definitive Technology Stack & Rationales](#7-the-definitive-technology-stack--rationales)
8. [The 6-Stage Canonical Cognitive Hierarchy (L0–L5)](#8-the-6-stage-canonical-cognitive-hierarchy-l0l5)
9. [Deployment & Horizontal Scaling Topology](#9-deployment--horizontal-scaling-topology)
10. [Pragmatic Build Phases (Roadmap)](#10-pragmatic-build-phases-roadmap)
11. [Future Add-Ons Architecture (Connectors & MCP)](#11-future-add-ons-architecture-connectors--mcp)
12. [The 15 Architecture Principles to Preserve](#12-the-15-architecture-principles-to-preserve)

---

## 1. Executive Summary & Core Thesis

Every existing AI memory system on the market falls into one of two traps:
1. **The Opaque / Un-Editable Memory Trap (Traditional Chunk-Based Stores / External Graph-Vector Tools):** While some existing commercial memory systems feature fast vector-graph retrieval, background clustering, and programmatic JSON profiles, their memory remains *opaque and programmatic*. You cannot inspect their internal understanding as a coherent narrative, users cannot intuitively edit or override beliefs in plain text, and contradiction handling is often reduced to binary flag toggles rather than preserving historical evolution.
2. **The Operationally Impossible Trap (Academic Multi-Database Architectures):** They design brilliant multi-tier cognitive loops, but require operating 6+ independent databases and microservices (vector DBs + graph DBs + relational DBs + document stores + message queues) with heavy LLM calls on every synchronous write. They collapse in production under network latency, lock contention, and cloud infrastructure bills.

### The Whimsync Solution: **Speed of Edge SQLite + Inspectable Wiki Supremacy**
Whimsync is built on a single engineering thesis: **We can achieve sub-15ms retrieval SLAs and deep cognitive abstraction simultaneously by eliminating network round-trips via local SQLite databases while running heavy cognitive synthesis in an asynchronous, scheduled background worker.**

* **Storage systems required to operate:** Exactly **2** (SQLite per space + Redis).
* **p50 Read Latency Target (To Validate via Benchmarks):** **<10ms** (via local in-process SQLite hybrid search + Redis profile cache).
* **p95 Read Latency Target (To Validate via Benchmarks):** **<30ms** (via multi-space parallel local queries).
* **Cognitive Moat:** Human-Readable/Editable Markdown Wiki + Typed Contradiction Timelines + Category-Specific Belief Decay ($\lambda$) + Optimistic Concurrency Control overrides.

---

## 2. What Whimsync Is & What It Does

Whimsync is a persistent, stateful memory and context engine designed as a drop-in API for AI assistants, coding agents, and autonomous workflows.

### What Whimsync Automatically Does Behind the Scenes:
* **Enforces an Explicit Space Model:** Spaces are explicit, user-controlled memory isolation boundaries identified by permanent ULIDs (`01J...`). Every user receives one default space named `My Space`. Every memory ingestion request (`POST /v1/memories`) must explicitly include a `space_id`; Whimsync does not automatically classify memories into spaces in v1. Space names are human-facing and editable.
* **Enforces a 6-Layer Cognitive Hierarchy:** Instead of flat vector dumps, memory progresses through a strict pipeline: `Experience (Event) -> Fact -> Evidence -> Belief -> Insight -> Compiled Context (Wiki / Retrieval)`. This ensures extraction errors never directly contaminate user identity.
* **Decomposes Experience into Qualified Attributed Facts:** Whimsync extracts structured assertions linked to explicit `Evidence` rows containing confidence scores, observation timestamps, and contextual domains (e.g., `[Adnan] -> [prefers] -> [SQLite WAL] (context: local-first)`).
* **Filters Noise at the Gate:** An ultra-fast regex heuristic filter and Gate 1 Locality-Sensitive Hashing (LSH) index intercept trivial chatter and duplicate statements before they ever burn embedding tokens or database writes.
* **Synthesizes Understanding via Event-Driven Reflection:** Governed by a deterministic Event-Driven Thermostat ($\text{NewFacts} \ge N \lor \text{Contradictions} \ge C \lor \text{Age} \ge T$), an asynchronous Reflection Engine examines accumulated facts. When thresholds are met ($\ge 5$ facts across $\ge 2$ distinct time periods), Whimsync generates high-order **Insight Nodes**.
* **Manages Evolving Beliefs & Contradictions:** When preferences evolve (*"Likes MongoDB"* in Jan vs. *"Prefers SQLite"* in June), Whimsync reconciles the trend in its authoritative `Belief` store, marking current truths as `ACTIVE` and past states as `HISTORICAL` with mathematical temporal decay ($\lambda$).
* **Compiles an Inspectable Relational Markdown Wiki:** Whimsync compiles its internal graph into modular, chunked Markdown pages (`wiki/technical_stack.md`, `wiki/diet.md`). The Wiki is a **read-only projection for retrieval**, not a second source of truth.
* **Honors Human Supremacy via Semantic Diffs:** Direct edits to the Markdown Wiki are processed through a Semantic Diff Engine (`ADD_ASSERTION`, `CORRECT_ASSERTION`, etc.) and assigned **`USER_PINNED (Level 6)`** authority on our 6-tier ladder (`SYSTEM_INFERRED < MODEL_EXTRACTED < BEHAVIOR_OBSERVED < USER_STATED < USER_CONFIRMED < USER_PINNED`). The machine reflection engine is architecturally forbidden from ever overwriting pinned human beliefs.

---

## 3. System Architecture: Portable Cognitive Monolith (Ports & Adapters)

Whimsync is built on a strict **Ports & Adapters** architecture so that the exact same cognitive brain and domain logic runs across both a simple **Early-Stage Local/VPS** deployment and a distributed **Cloudflare Edge** deployment.

### 1. Shared Architecture Between Deployments
The cognitive and domain layers are deployment-independent by design (while external worker Python cognition code is shared, Cloudflare Worker Gateway and Durable Object implementations use Cloudflare-specific runtime adapters):
* **Shared Cognitive & Domain Logic:** Space domain model (`ULID`), Episode model, Fact extraction pipeline, Evidence model, Belief reconciliation, Contradiction classification rules, Reflection Engine, Evidence Gate, Insight model, Context Compiler, Wiki compiler, Profile builder, and Pydantic schemas.
* **Infrastructure Adapters (Local/VPS Mode):** SQLite repository (`sqlite-vec`), Redis Streams queue adapter.
* **Infrastructure Adapters (Cloudflare Mode):** Durable Object storage adapter, Cloudflare Queue adapter, Cloud vector retrieval adapter (separate from local `sqlite-vec`).

### 2. Early-Stage Local/VPS Architecture (Stage 1 & Stage 2)

We build the simplest deployable architecture first: **Stage 1 runs on a single VPS** (suggested initial hardware target: 8 vCPU, 16 GB RAM, NVMe storage), with a zero-code-change upgrade path to **Stage 2 (split Worker VPS)** when ML inference scales.

```
Client / Agent
  ──(POST /v1/memories with space_id)──► FastAPI (Sole Physical SQLite Writer)
                                              │                ▲
                                     (Enqueue Job)             │ (Mutation Command)
                                              ▼                │
                                         Redis Streams ────────┘
                                              │
                                       (Async Pull)
                                              ▼
                                      Background Worker
                                 (GLiNER, Extraction, Reflection)
```

* **FastAPI Responsibilities:** Authentication/authorization, space management and ULID resolution, memory ingestion API (`POST /v1/memories`), fast-path noise filtering, lexical novelty filtering (Gate 1 LSH), episode persistence, retrieval/projection APIs (`GET /v1/wiki`, `/v1/profile`), job enqueueing, **sole physical SQLite writer**, and mutation command consumption.
* **Redis/Valkey Responsibilities:** Background job transport (extraction, belief reconciliation, reflection, projection), mutation commands buffer, short-lived working state, and Profile JSON cache.
* **Background Worker Responsibilities:** GLiNER entity recognition, fact extraction, semantic novelty checking (Gate 2), embedding generation, belief reconciliation, ambiguous contradiction classification, reflection & insight generation, and optional natural-language Wiki synthesis.
* **Upgrade Path:**
  * **Stage 1 (Single VPS):** One box running `whimsync-api` + `whimsync-worker` + `Valkey/Redis` + `/data/spaces/*.db`.
  * **Stage 2 (Split Worker VPS):** VPS A (`API + Redis + SQLite`) and VPS B (`Worker`). Communication remains strictly queue-based via Redis Streams.

### 3. Cloudflare Edge Architecture

In Cloudflare, the Durable Object is the authoritative state owner for its Space, while heavy ML inference runs in an external worker container:

```
Client / Agent
  ──(POST /v1/memories)──► Cloudflare Worker Gateway
                                  │
                          (Space Resolution)
                                  ▼
                         Space Durable Object (Embedded SQLite)
                                  │
                           (Cloudflare Queue)
                                  ▼
                          External Worker (GLiNER / ML Extraction)
                                  │
                           (Mutation RPC)
                                  ▼
                         Space Durable Object
```

* **Cloudflare Worker Gateway:** Auth, space resolution, API routing.
* **Space Durable Object:** One logical stateful actor per Space ULID (`01J...`), embedded SQLite storage, concurrency control, authoritative persistence for `episodes, facts, evidence, beliefs, insights, wiki_sections`, FTS retrieval, and applying mutation commands from the external worker.
* **Cloudflare Queue:** Buffer for extraction, belief, reflection, and projection jobs.
* **External Worker:** GLiNER NER, fact extraction, embeddings, semantic novelty, belief reconciliation, reflection, and Wiki synthesis.

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
To support our 6-stage cognitive pipeline without overloading tables or corrupting provenance, every `{space_id}.db` file contains exactly these relational tables:
* **`episodes`**: Immutable archive of raw input text, timestamps, and namespace paths (`id, content, source, occurred_at, namespace`).
* **`facts`**: Extracted atomic entity-relationship triples and assertions (`id, subject_id, predicate, object_id, context, extracted_at, extractor_version`).
* **`evidence`**: Support linkage and observation metadata linking facts to episodes (`id, fact_id, episode_id, confidence, authority_level, observed_at, context`).
* **`beliefs`**: Authoritative temporal identity assertions (`id, subject_id, predicate, object_id, confidence, status, valid_from, valid_to, lambda, authority_level`).
* **`belief_evidence`**: Many-to-many junction mapping evidence rows to beliefs (`belief_id, evidence_id, support_type`).
* **`insights`**: High-order reflected patterns generated by the LLM Reflection Engine (`id, statement, confidence, status, generated_at, invalidated_at, reflection_version`).
* **`insight_support`**: Evidence weighting mapping facts to insights (`insight_id, fact_id, weight`).
* **`fact_embeddings`**: Virtual table powered by **`sqlite-vec`** storing 1536-dimensional vectors for fast cosine similarity search.
* **`facts_fts`**: Virtual table powered by **SQLite FTS5** for ultra-fast BM25 keyword matching.
* **`edges`**: Relational adjacency table mapping graph connections (`updates`, `extends`, `derives`, `applies_to`, `contradicts`).
* **`wiki_sections`**: Compiled Markdown sections, version counters, and provenance flags.

---

## 5. Concurrency Control & SQLite Lock Defenses

Because SQLite enforces **file-level locking** (`EXCLUSIVE` lock on the `.db` file during write transactions), simultaneous write attempts from Process 1 (API) and Process 2 (Worker) can trigger `SQLITE_BUSY` contention. Whimsync implements a **4-Layer Defense Protocol** to guarantee lock-free concurrency and data integrity:

### Layer 1: SQLite WAL Mode (Write-Ahead Logging)
Every SQLite database is initialized with `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;`. In WAL mode, **readers do not block writers, and writers do not block readers**. Process 2 can execute a deep graph walk without blocking Process 1 from reading facts.

### Layer 2: Sole-Writer Architecture (Single-Server Mitigation)
To prevent physical SQLite file-lock collisions (`SQLITE_BUSY`) when running two containers (FastAPI and Worker) locally, **FastAPI (Process 1) is designated as the sole SQLite writer**. Because separate `asyncio.Queue` instances across two Docker containers cannot serialize writes to a shared disk file, the Cognitive Worker (Process 2) performs heavy read-only ML extraction and synthesis, sending all database mutation commands back to FastAPI via Redis Streams or an internal mutation endpoint (`PUT /internal/spaces/{id}/mutate`).

### Layer 3: Strict Domain Mutation Authority Contracts
All physical SQL write statements are executed exclusively by **FastAPI (Sole Writer)** in local/VPS mode and by the **Space Durable Object** in Cloudflare mode. To guarantee zero logical write-write data collisions within the sole writer's command router, services hold exclusive **Domain Mutation Authority** (logical mutation ownership) over specific tables:

| Table / Rows | Domain Mutation Authority | Purpose |
|---|---|---|
| `episodes` | ⚡ Fast-Core API Only | Append raw user input archives |
| `facts` & `evidence` | ⚡ Fast-Core API Only | Insert newly extracted atomic facts and observation linkage |
| `fact_embeddings` | ⚡ Fast-Core API Only | Insert vector embeddings for new facts |
| `beliefs` & `belief_evidence` | 🧠 Deep-Brain Worker + 👤 Human | Manage temporal identity assertions & support |
| `insights` & `insight_support` | 🧠 Deep-Brain Worker Only | Generate high-order reflected patterns |
| `edges` | 🧠 Deep-Brain Worker Only | Connect graph relationships & contradictions |
| `wiki_sections` | 🧠 Deep-Brain + 👤 Human Edits | Compile Markdown wiki summaries |

### Layer 4: Human Supremacy & Optimistic Concurrency Control (OCC)
When updating the Wiki or Beliefs layer, the Cognitive Worker must obey two rules:
1. **Belief-Level Human Supremacy:** Authority belongs to individual assertions/beliefs (`USER_PINNED`, `USER_CONFIRMED`), not whole wiki page rows. When a human edits a section of the Markdown Wiki, our Semantic Diff Engine translates the change into authoritative belief mutations (`USER_PINNED (Level 6)`). The machine worker is architecturally forbidden from overwriting pinned beliefs, but can still update adjacent machine-inferred bullet points in the same wiki section!
2. **Optimistic Version Checking:** When compiling a section, the worker executes:
   ```sql
   UPDATE wiki_sections
   SET content = :new_text, version = version + 1, updated_at = :now
   WHERE section_key = :key AND version = :expected_version;
   ```
   If a human edited the section while the LLM was compiling, `affected_rows == 0`. The worker discards its stale compilation and retries on the next cycle.

---

## 6. Cost Optimization: Model Tiering & Event-Driven Thermostat

To prevent LLM API token bills from exploding during high-throughput chat sessions while ensuring active coding agents receive instant reflection, Whimsync replaces blind continuous polling with two strict cost-reduction mandates:

### 1. Event-Driven Thermostat (Deterministic Eligibility Logic)
Instead of firing an LLM reflection call every time 5 facts accumulate, or waiting blindly for a 4-hour clock timer, the Deep-Brain Cognitive Worker evaluates a clean, deterministic eligibility rule on every batch:
$$\text{Eligible} = (\text{NewFacts} \ge N) \lor (\text{UnresolvedContradictions} \ge C) \lor (\text{OldestUnprocessedFactAge} \ge T)$$

* **Active Threshold:** For Phase 1, we default to $N=5$, $C=1$, $T=4\text{ hours}$. When an active agent generates a burst of novel facts or a contradiction is detected, reflection enqueues immediately!
* **Telemetry & Future Weighting:** After collecting real production distributions, this deterministic gate will evolve into a weighted eligibility score incorporating cluster density and idle ratios.
* **Idle Safety Net:** If an agent is inactive, the system hibernates ($0 cost). A scheduled cron trigger acts as a background safety net to sweep and compile slow-drip memories.

### 2. Strict Model Tiering & Two-Gate Novelty Checking
We divide AI tasks by complexity, assigning zero-cost models to high-frequency tasks:

| Task Layer | Execution Frequency | Model Assigned | Estimated Cost per 1k Ops (To Validate via Benchmarks) |
|---|---|---|---|
| **Gate 1: Cheap Lexical Novelty** | High (Every write) | **In-Memory LSH Index** (`datasketch` SimHash/MinHash) | **$0.00** (Local CPU/RAM) |
| **Entity Recognition (NER)** | High (Novel writes) | **GLiNER** (`gliner-small-v2.1` in local RAM) | **$0.00** (Local CPU/RAM) |
| **Gate 2: Semantic Novelty** | High (Post-NER) | **Vector Embedding & Predicate Comparison** | **$0.00** (Local CPU) |
| **Atomic Fact Extraction** | Medium-High (Novel writes) | **Local SLM** (Qwen-2.5-1.5B / Phi-3-mini) *OR* Claude 3.5 Haiku fallback | **$0.00** (Local) or **~$0.05** (Haiku API target) |
| **Contradiction Classifier** | Medium (Eligible batches) | **Local SLM** / Claude 3.5 Haiku | **~$0.02** (Target) |
| **Wiki & Belief Synthesis** | Low (Eligible batches only) | **Claude 3.5 Haiku** (Anthropic API) | **~$0.15** (Target) |

By handling 80%+ of daily workload via local regex, LSH, GLiNER, and local Small Language Models (SLMs), Whimsync's operating cost design target is **<$0.20 per active user/month (to be validated through benchmarks)**.

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
| **Gate 1: Lexical Novelty** | **In-Memory LSH (`datasketch`)** | SimHash / MinHash Locality-Sensitive Hashing identifies exact or near-lexical duplicate strings in sub-milliseconds without executing disk/vector DB searches. |
| **Entity Extraction (NER)** | **GLiNER** (`gliner-small-v2.1`) | Fast, open-source, zero-shot entity recognition running locally to tag subjects and objects before atomic fact extraction. |
| **Fact Extraction Model** | **Qwen-2.5-1.5B / Phi-3** | Open-source Small Language Models running locally in RAM to extract atomic JSON triples without burning paid API tokens. |
| **Embedding Model** | **`text-embedding-3-small` / Nomic** | OpenAI API for zero-ops cloud deployment; clean abstraction layer allows self-hosters to swap in local Nomic-Embed or Ollama models. |
| **Reflection & Wiki LLM** | **Claude 3.5 Haiku (Anthropic API)** | The industry's fastest, most cost-effective model capable of strict schema-grounded contradiction classification and multi-document synthesis during scheduled batches. |
| **Observability** | **OpenTelemetry + Grafana** | Mandatory from line 1. Traces every request across API and Worker processes. Provisioned Grafana dashboards monitor queue depth, token budgets, and cost-per-user. |

---

## 8. The 6-Stage Canonical Cognitive Hierarchy (L0–L5)

Whimsync structures memory into six evolutionary stages. Memory progresses from raw episodic archives upward through strict corroboration and reflection, ensuring extraction noise never contaminates user identity:

```
L0: Experience / Episode     Raw conversational text, tool output, or event stream.
 (Immutable Storage)         "I refactored the sync database module to async SQLite WAL today."
                                │
                                ▼ [Extraction: NER + SLM Triples]
                                │
L1: Fact                     Atomic entity-relationship assertion.
 (Atomic Triple)             [Adnan] -> [refactored] -> [database module to async SQLite WAL]
                                │
                                ▼ [Support Linkage: Observation Metadata]
                                │
L2: Evidence                 Explicit support row linking Fact to Episode with confidence score.
 (Attribution Linkage)       Confidence: 0.95 | Authority: Level 4 (User Stated) | Time: Week 1
                                │
                                ▼ [Reconciliation & Temporal Decay λ]
                                │
L3: Belief                   Authoritative, deduplicated temporal identity state.
 (Synthesized Truth)         Subject: [Adnan] | Predicate: [prefers] | Object: [async SQLite WAL]
                             Status: ACTIVE | Valid From: Week 1 | Decay Rate λ = 0.0005
                                │
                                ▼ [Evidence Gate: ≥5 facts across ≥2 distinct time periods]
                                │
L4: Insight                  High-order reflected behavioral or architectural pattern.
 (Reflected Pattern)         "Adnan consistently prioritizes non-blocking execution and local-first
                             simplicity over distributed cloud complexity." (Confidence: 0.92)
                                │
                                ▼ [Compilation: Human & Machine Consumption]
                                │
L5: Context Projection       Read-only projections generated from L3 Beliefs & L4 Insights:
 (Inspectable State)         ├── Modular Markdown Wiki (`wiki/technical_stack.md`)
                             ├── Pre-compiled Profile JSON (`GET /v1/profile`)
                             └── Retrieval Context Window (Hybrid Search Injection)
```

### Cognitive Processing Responsibilities & Execution Matrix
Whimsync remains primarily a structured data and cognition system with controlled model calls, not an uncontrolled LLM pipeline:

| Cognitive Responsibility | Execution Engine / Model | Why Controlled / Deterministic |
|---|---|---|
| **Noise Filtering** | **Deterministic Regex** | Sub-millisecond rejection of low-entropy chatter (<1ms). |
| **Lexical Novelty (Gate 1)** | **Deterministic LSH (`datasketch`)** | SimHash / MinHash identifies exact or near-lexical duplicates without DB lookups. |
| **Entity Recognition (NER)** | **GLiNER (`gliner-small-v2.1`)** | Fast, local zero-shot NER in RAM without burning LLM tokens. |
| **Fact Extraction** | **SLM or LLM** | Structured JSON schema extraction (Qwen/Phi locally or Claude 3.5 Haiku API fallback). |
| **Evidence Creation** | **Deterministic** | Explicit support row linking Fact to Episode with observation metadata. |
| **Conflict Candidate Detection** | **Deterministic Graph Query** | SQL/vector comparison detecting predicate/entity overlap. |
| **Simple Belief Reconciliation** | **Deterministic Rules** | Direct temporal override / corroboration logic. |
| **Ambiguous Contradiction Classification** | **LLM (Claude 3.5 Haiku)** | Invoked only when deterministic rules cannot resolve nuanced semantic drift. |
| **Reflection & Insight Generation** | **LLM (Claude 3.5 Haiku)** | High-order pattern synthesis executed during eligible batches ($\text{Score} \ge 10$). |
| **Profile JSON** | **Deterministic Builder** | Fast relational query compiled directly from `ACTIVE` beliefs. |
| **Agent Context Assembly** | **Deterministic Retrieval** | FTS + vector + graph query injection into agent prompt. |
| **Basic Markdown Wiki** | **Deterministic Templates** | Section structured rendering from `wiki_sections` and beliefs. |
| **High-Level Natural Wiki Summaries** | **Optional LLM Synthesis** | Human-readable narrative compilation during eligible reflection batches. |

---

## 9. Deployment & Horizontal Scaling Topology

Whimsync is designed to deploy natively as a self-contained monolith, while providing an edge-native cloud upgrade path without changing SQL schema or query structure:

### 1. Single-Node Deployment: Local Development, Self-Hosted, and Early SaaS
* **Infrastructure:** A single Linux VPS (suggested initial hardware target: 8 vCPU / 16 GB RAM NVMe SSD) or AWS EC2 instance running Docker Compose.
* **Execution:** Process 1 (FastAPI) and Process 2 (Worker) share local NVMe disk access to `/data/spaces/{space_id}.db` files. Redis Valkey runs in RAM. Our **Sole-Writer Architecture** (Process 1 owns SQLite mutations) prevents physical file-lock contention (`SQLITE_BUSY`).

### 2. Horizontal Cloud Scale (Edge-Native Durable Objects)
When deploying across global edge networks where local NVMe drives cannot be shared across pods, Whimsync migrates its execution layer to **Cloudflare Durable Objects with Embedded SQLite**:
* Each Cognitive Space (`/spaces/{space_id}`) maps 1-to-1 to a globally unique Durable Object **geographically provisioned close to where it is initially requested**. Because DOs are strictly **single-threaded**, database lock contention is physically impossible.
* **Retrieval Portability Adapter:** While domain semantics remain 100% portable across cloud and local modes, physical vector search is abstracted behind a `RetrievalPort`. Local deployments use `LocalRetrievalAdapter` (`sqlite-vec` + FTS5 + recursive CTEs), while Cloudflare deployments use `CloudflareRetrievalAdapter` (DO Embedded SQLite + FTS5 + Workers AI or external vector index).

---

## 10. Pragmatic Build Phases (Roadmap)

We build in three rigorous, production-ready phases:

### Phase 1: The High-Speed Core (Weeks 1–4)
*Goal: Deliver a rock-solid memory engine targeting sub-15ms retrieval SLAs with sole-writer concurrency, two-gate novelty checking, and read-your-writes asynchronous ingestion.*
* [ ] Monorepo setup with `uv`, FastAPI skeleton, and OpenTelemetry instrumentation.
* [ ] Sole-writer SQLite connection manager with WAL mode initialization, FTS5 tables, `sqlite-vec` vector embeddings, and our complete 11-table schema (`episodes, facts, evidence, beliefs, belief_evidence, insights, insight_support, edges, fact_embeddings, facts_fts, wiki_sections`).
* [ ] Fast-Path regex heuristic filter and Gate 1 in-memory LSH lexical novelty pre-checker.
* [ ] Atomic Fact Extractor integrating local GLiNER NER and SLM triples with Gate 2 semantic novelty checking.
* [ ] Single-DB Hybrid Search engine combining vector cosine similarity, BM25 keyword matching, and 2-hop recursive CTE graph walks with a "read-your-writes" policy across committed facts and unprocessed episodes.
* [ ] Asynchronous ingestion endpoint (`POST /v1/memories` executing fast-path $\rightarrow$ Gate 1 LSH $\rightarrow$ episode persistence $\rightarrow$ queue push $\rightarrow$ instant `202 Accepted`).
* [ ] Instant GDPR hard-deletion pipeline (`DELETE /v1/space/{id}` removing SQLite file, flushing Redis, and logging receipt).

### Phase 2: The Cognitive Engine (Weeks 5–10)
*Goal: Activate the Deep-Brain Cognitive Worker to generate understanding, resolve contradictions, and compile the human-editable Wiki.*
* [ ] Event-Driven Thermostat (`main_worker.py`) evaluating deterministic eligibility thresholds ($\text{NewFacts} \ge 5 \lor \text{Contradictions} \ge 1 \lor \text{Age} \ge 4\text{h}$) with backup cron sweep.
* [ ] Evidence Gate implementation validating $\ge 5$ supporting facts across $\ge 2$ distinct time periods before promoting facts to high-order insights.
* [ ] Claude 3.5 Haiku Reflection Engine generating Insight Nodes and pruning superseded facts during eligible batches.
* [ ] Batch Contradiction Classifier sorting conflicts into `preference_change`, `context_shift`, `temporal_update`, and `direct_contradiction`.
* [ ] Markdown Wiki compiler converting SQLite sections into human-readable documents (`GET /v1/wiki`).
* [ ] Belief Reconciliation Engine with category-specific temporal decay rates ($\lambda$) updating belief confidence over time.
* [ ] Human edit reconciliation endpoint (`PATCH /v1/wiki`) translating manual text edits into authoritative belief mutations (`USER_PINNED`) with OCC version checking.

### Phase 3: Ecosystem Scale & Edge Deployment (Weeks 11–16)
*Goal: Prepare Whimsync for massive scale, edge deployment via Cloudflare Durable Objects, and external ecosystem integration.*
* [ ] Abstraction layer implementation for `RetrievalPort`, supporting **Cloudflare Durable Objects with Embedded SQLite** as a serverless cloud adapter.
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
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             WHIMSYNC BASE ENGINE (FAST-CORE API & WORKER)                        │
│  Fast-Path ─► Gate 1 LSH ─► Persist Episode ─► Queue ─► Worker ─► Sole Writer ─► SQLite Space DB │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Data Connectors (Slack, Notion, GitHub, IDEs)
Connectors are lightweight external workers or cron jobs. They authenticate via standard API keys and push raw text or diffs directly to `POST /v1/memories` with explicit `space_id` ULID and appropriate namespace paths (e.g., `namespace: "/github/repo_whimsync/pulls"` or `namespace: "/slack/engineering_channel"`). The base engine handles fast-path filtering, episode storage, asynchronous extraction, and reflection automatically.

### 2. Model Context Protocol (MCP) Server
Whimsync will expose a standard **MCP Server** interface (via stdio or SSE) allowing instant integration with Claude Desktop, Cursor, Windsurf, and automated AI coding agents:
* **MCP Tools Provided:** `memory_add`, `memory_search`, `get_user_profile`, `edit_wiki_section`.
* **MCP Resources Provided:** `whimsync://spaces/{space_id}/wiki` (allowing agents to read the compiled Markdown Wiki directly into their context window as a live, evolving instruction system).

---

## 12. The 15 Architecture Principles to Preserve

All developers and AI agents contributing to Whimsync must strictly obey these 15 foundational architecture principles:
1. **Build the simplest deployable architecture first.**
2. **Keep the initial Local/VPS deployment on one machine.**
3. **Separate Fast-Core request handling from slow cognitive processing.**
4. **Keep SQLite as authoritative long-term memory in Local/VPS mode.**
5. **Keep Durable Object SQLite as authoritative Space state in Cloudflare mode.**
6. **Use queues to decouple expensive processing.**
7. **Maintain one physical mutation path per Space storage system.**
8. **Keep cognitive/domain logic independent from infrastructure.**
9. **Do not build automatic Space classification in the initial version.**
10. **Do not introduce microservices prematurely.**
11. **Scale the Worker independently when inference becomes the bottleneck.**
12. **Treat the Wiki, Profile JSON, and Agent Context as projections of authoritative structured memory.**
13. **Keep Space IDs permanent (`ULID`) and Space names editable.**
14. **Every memory ingestion operation must explicitly target a Space (`space_id`).**
15. **Preserve a clean migration path from single-VPS deployment to split Worker deployment and eventually Cloudflare deployment.**

---
*Document Version: 1.1 — Master Specification*
*Project Status: Active Development — Phase 1 Foundation*
*Last Updated: July 2026*
