# 🧠 Whimsync

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets (SLA metrics) represent design objectives and may evolve as implementation progresses.

> **The Cognitive Memory & Context Layer for AI Assistants & Coding Agents**  
> *Maximize cognitive depth and retrieval speed per unit of operational complexity.*

[![Status](https://img.shields.io/badge/Status-v1.0%20Active%20Dev-brightgreen.svg)]()
[![Architecture](https://img.shields.io/badge/Architecture-Modular%20Monolith-blue.svg)]()
[![Storage](https://img.shields.io/badge/Storage-SQLite%20WAL%20+%20Redis-orange.svg)]()
[![Python](https://img.shields.io/badge/Python-3.12%2B-blueviolet.svg)]()
[![Tooling](https://img.shields.io/badge/Package%20Manager-uv-black.svg)]()

---

## ⚡ What is Whimsync?

Whimsync is a persistent, stateful memory and context engine designed as a drop-in API for AI assistants, coding agents, and autonomous workflows. Most existing AI memory architectures fall into one of two traps:
1. **Traditional Chunk-Based Stores (Legacy RAG / Basic Vector DBs):** They accumulate raw text passages with speed, but never synthesize those facts into an inspectable understanding of *who you are* or how your beliefs evolve over time.
2. **Academic Microservice Labyrinths:** They require running 6+ network-separated databases (vector DBs + graph DBs + relational DBs + document stores + message queues) with heavy LLM calls on every synchronous write, collapsing under latency and cloud bills.

**Whimsync bridges the gap.** Designed as an edge-native **Modular Monolith**, Whimsync targets **sub-15ms retrieval SLAs** via local SQLite hybrid databases while running heavy cognitive synthesis in a scheduled, asynchronous background worker.

---

## 🏗️ Core Architecture: The 2-Process Monolith

Whimsync deploys from a single Python monorepo into two specialized execution processes sharing local disk and RAM:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            WHIMSYNC MONOREPO CODEBASE                            │
└──────────────────────────────────────────────────────────────────────────────────┘
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         ▼                                                               ▼
┌───────────────────────────────────┐                 ┌───────────────────────────────────┐
│  PROCESS 1: The Fast-Core (API)   │                 │  PROCESS 2: The Deep-Brain        │
│  (Synchronous Read/Write Path)    │                 │  (Scheduled Epoch Worker)         │
├───────────────────────────────────┤                 ├───────────────────────────────────┤
│ • Handles HTTP / REST / SSE       │                 │ • Runs on Cron / Epoch intervals  │
│ • Fast-path regex heuristic (<1ms)│                 │ • Runs Reflection Engine (LLM)    │
│ • LSH duplicate pre-check (<1ms)  │     Redis       │ • Batch Contradiction Classifier  │
│ • Calls Atomic Fact Extractor     │ ───Stream───→   │ • Tier Promotion (Raw→Core)       │
│ • Serialized Write Queue insert   │   Priority      │ • Compiles Wiki Markdown          │
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

---

## ✨ Key Technical Moats

* **Space-Scoped Databases (`/data/spaces/{space_id}.db`):** Storage is partitioned by cognitive spaces (Personal, Project, Organization). When querying a project, Whimsync queries personal and project databases in parallel in local memory, targeting a **<15ms retrieval SLA**.
* **Hierarchical POSIX Namespaces:** Instead of flat tags, facts reside in compound B-tree indexed paths (`/work/whimsync/architecture`), enabling sub-millisecond container isolation.
* **4-Layer Concurrency Defense:** We eliminate SQLite file-lock contention via **WAL Mode**, an **In-Memory Serialized Write Queue**, strict **Table Ownership Contracts**, and **Optimistic Concurrency Control (OCC)**.
* **Inspectable Markdown Wiki:** Whimsync compiles its internal graph and identity layer into a structured, human-readable Markdown Wiki. Humans can inspect, debug, and directly edit beliefs with maximum override authority (`user_stated`).
* **Strict Model Tiering:** 80%+ of daily workload runs locally for **$0.00** via **GLiNER** (NER), **LSH** (deduplication), and local **SLMs** (Qwen/Phi for fact extraction). We reserve **Claude 3.5 Haiku** strictly for low-frequency Epoch Wiki compilation—targeting an operating cost of **<$0.20/user/month**.

---

## 🛠️ Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| **Runtime & Tooling** | **Python 3.12+ / `uv`** | Async-native execution with `uv` package management for 100x faster builds and deterministic lockfiles. |
| **API & Validation** | **FastAPI + Pydantic v2** | Automatic OpenAPI schema generation and Rust-powered Pydantic v2 sub-millisecond data validation. |
| **Storage Engine** | **SQLite 3.45+ (`sqlite-vec`)** | Local NVMe disk reads eliminate network round-trips. `sqlite-vec` handles vector math; FTS5 handles BM25 keywords. |
| **Working Memory** | **Redis 7+ (Valkey)** | Powers T1 session caches, pre-compiled User Profile JSON caching (<1ms reads), and priority event streams. |
| **Local AI Tools** | **GLiNER + `datasketch`** | In-memory zero-shot entity recognition and Locality-Sensitive Hashing for instant deduplication. |
| **Cloud Scaling Target** | **Cloudflare Durable Objects** | 1-to-1 mapping of Spaces to edge-native single-threaded objects with embedded SQLite for horizontal scale. |

---

## 🚀 Quick Start & Development

We build strictly incrementally. No empty dummy folders or stub files.

### 1. Prerequisites
Ensure you have [uv](https://docs.astral.sh/uv/) and Docker installed on your system.

### 2. Environment Setup (Phase 1)
```bash
# Clone and initialize project
git clone https://github.com/your-username/whimsync.git
cd whimsync

# Start background Redis Valkey via Docker Compose
docker compose up -d redis

# Run test suite
uv run pytest tests/ -v
```

---

## 📚 Documentation & Progress
* **[WHIMSYNC.md](./WHIMSYNC.md):** The official v1.0 Launch-Ready Engineering Blueprint.
* **[PROGRESS.md](./PROGRESS.md):** Sequential, step-by-step development tracker.
* **[.agents/AGENTS.md](./.agents/AGENTS.md):** Architectural commandments and AI workspace rules.

---
