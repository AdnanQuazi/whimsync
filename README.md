# 🧠 Whimsync

> [!IMPORTANT]
> **Early-Stage Development Notice:** This project is currently in active early-stage development and architectural planning. All documented architectures, data flow topologies, and performance latency targets represent design objectives to be validated through empirical benchmarks.

> **The Stateful Memory & Cognitive Context Engine for AI Assistants & Coding Agents**
> *Sub-15ms edge retrieval targets meet inspectable, human-governed cognitive memory.*

[![Python](https://img.shields.io/badge/Python-3.12%2B-blueviolet.svg)]()
[![Tooling](https://img.shields.io/badge/Package%20Manager-uv-black.svg)]()

---

## ⚡ What is Whimsync?

Whimsync is a persistent, stateful memory and context engine designed as a drop-in API for AI assistants, coding agents, and autonomous workflows. Most existing AI memory architectures fall into one of two traps:
1. **Flat Vector Dumps (Legacy RAG):** They store unstructured text chunks with fast vector lookup, but never synthesize those facts into an inspectable understanding of *who you are* or how your preferences evolve over time.
2. **Academic Multi-Database Labyrinths:** They require operating 6+ independent databases and microservices (vector DBs + graph DBs + relational DBs + document stores + message queues) with heavy synchronous LLM calls on every write.

**Whimsync bridges the gap.** Built as a **Portable Cognitive Monolith**, Whimsync eliminates network round-trips via local SQLite space databases while running heavy ML extraction and reflection in an asynchronous, queue-decoupled background worker.

---

## ✨ Key Features & Architectural Moats

* **Explicit Space Model (`space_id` ULID):** Every user receives a default space named `My Space`. Every memory ingestion request (`POST /v1/memories`) explicitly targets a permanent Space ULID (`01J...`). Space names are human-facing and editable; Space IDs are permanent isolation boundaries.
* **Canonical 6-Stage Cognitive Pipeline:** Memory evolves from raw episodic archives upward through strict corroboration: `Experience (L0) -> Fact (L1) -> Evidence (L2) -> Belief (L3) -> Insight (L4) -> Inspectable Context Projection (L5)`.
* **Sole-Writer Concurrency Architecture:** To prevent SQLite file-lock collisions (`SQLITE_BUSY`), **FastAPI (Process 1)** acts as the sole physical SQLite writer locally (and the Durable Object in Cloudflare mode). The background worker performs read-only ML extraction and sends mutation commands back via Redis Streams.
* **Inspectable Relational Markdown Wiki:** Whimsync compiles its internal graph into modular Markdown pages (`wiki/technical_stack.md`). Humans can inspect, debug, and directly edit beliefs with maximum override authority (`USER_PINNED (Level 6)`).
* **Controlled Model Tiering & Two-Gate Novelty:** Sub-millisecond noise filtering runs via deterministic regex and Gate 1 LSH SimHash indexes. Local RAM GLiNER (`gliner-small-v2.1`) performs zero-shot entity recognition, and SLMs handle atomic extraction—keeping operating cost design targets **<$0.20 per active user/month (to validate via benchmarks)**.

---

## 🏗️ Deployment Topology: From Local to Global Edge

Whimsync is built on a strict **Ports & Adapters** architecture so the exact same cognitive brain runs across three deployment stages:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             WHIMSYNC BASE ENGINE (FAST-CORE API & WORKER)                        │
│  Fast-Path ─► Gate 1 LSH ─► Persist Episode ─► Queue ─► Worker ─► Sole Writer ─► SQLite Space DB │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Stage 1 (Single-Node VPS / Local Dev):** Runs on one machine (e.g., 8 vCPU / 16 GB RAM NVMe SSD) running `whimsync-api` + `whimsync-worker` + `Valkey/Redis` + `/data/spaces/*.db`.
2. **Stage 2 (Split Worker VPS):** Seamless queue-decoupled scale splitting API server (VPS A) from heavy ML extraction worker (VPS B).
3. **Stage 3 (Cloudflare Edge Durable Objects):** Migrates storage to single-threaded Space Durable Objects with embedded SQLite close to global users.

---

## 🚀 Quick Start & Development

We build strictly incrementally using Python 3.12+ and `uv`.

### 1. Prerequisites
Ensure you have [uv](https://docs.astral.sh/uv/) and Docker installed on your system.

### 2. Environment Setup
```bash
# Clone and enter project
git clone https://github.com/AdnanQuazi/whimsync.git
cd whimsync

# Start background Redis/Valkey via Docker Compose
docker compose up -d redis

# Run the full test suite
uv run pytest tests/ -v
```

---

## 📚 Documentation
* **[WHIMSYNC.md](./WHIMSYNC.md):** Master Engineering Blueprint & Architectural Specification.
* **[PROGRESS.md](./PROGRESS.md):** Sequential development roadmap and step-by-step progress tracker.
* **[.agents/AGENTS.md](./.agents/AGENTS.md):** Architectural commandments and AI agent rules.
