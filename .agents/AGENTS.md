# Whimsync — AI Agent Workspace Rules & Architectural Commandments

> **IMPORTANT FOR ALL AI AGENTS & CODING ASSISTANTS:**
> When working in this repository, you must strictly obey the following architectural rules and design contracts established in `WHIMSYNC.md`. Never deviate from these rules without explicit user approval.

---

## 1. Incremental Engineering Philosophy & Scoping Model
- **No Empty Stubs:** Build strictly incrementally. Write functional, fully typed TypeScript modules tested on Bun.
- **Every Account is an Org (`tenant_id`):** Signup auto-provisions a personal org where the user is sole `admin`. Joining a company means membership in a second org. There is no separate "personal account" code path.
- **Namespace Isolation (`namespace`):** The `namespace` field (default `"default"`) is the authoritative access control and isolation boundary. Never create cross-namespace relationship edges.
- **Flat Schema Contract:** Every memory claim row must explicitly define `tenant_id`, `namespace`, `user_id`, with nullable `entity_key` and `session_id`.

---

## 2. Architectural & Storage Commandments
- **Single Source of Truth:** Read `WHIMSYNC.md` as the master architectural specification.
- **Primary Database:** Use **PostgreSQL + `pgvector`** for both **Hot** and **Warm** tiers (differentiated by status and recency index filters). Never suggest or introduce SQLite per-space files, Qdrant, Neo4j, or Mongo.
- **Queue Plumbing:** Use **Redis + BullMQ** for asynchronous job queues. Redis is purely transient queue plumbing and must never store persistent memory data.
- **Cold Storage:** Use **S3-compatible Object Storage** (local MinIO in self-host; R2 / AWS S3 in cloud) for offline archives and exported audit logs.
- **Self-Hosted Monolith:** Packaging must remain self-contained inside a single `docker-compose.yml` with isolated `app` (Hono API) and `worker` (BullMQ consumer) containers.

---

## 3. Extraction & Mutation Lifecycle
- **Single LLM Call:** Extraction must run in a single structured LLM call proposing new claims, relationship edges (`memory_relationships`), entity quintuplets (`entity_relationships`), and mutations against candidate prior claims.
- **Pending Review Buffer:** New claims must be durably written with `status = pending_review` before mutation evaluation runs. Never surface `pending_review` claims to live retrieval.
- **Atomic Transition:** Mutation evaluation must resolve in a single atomic database transaction, flipping new claims to `active` and superseded claims to `superseded`.
- **Evidence Citations:** `episodes` stores immutable raw input text. `evidence` stores authoritative character offset ranges (`start_offset`, `end_offset`) into episodes supporting specific claims.

---

## 4. Coding Standards & Technology Stack
- **Language & Runtime:** **TypeScript on Bun**.
- **API HTTP Layer:** **Hono**.
- **Frontend Dashboard:** **Next.js (React)**.
- **Authentication:** **Clerk (supporting Google, GitHub, Email/Password across Web, Mobile, and Extensions)**. Hono uses `@clerk/hono` (`clerkMiddleware`) and `authGuard` (`findOrProvisionUser`) to auto-provision an `org` (`tenant_id`), assign `role: owner`, and create the `"default"` namespace on first request.
- **Database Driver:** Async PostgreSQL driver compatible with Bun and `pgvector`.
- **Centralized Type System (`apps/api/src/types/`)**: Never re-export or define shared Hono context variables (`AppVariables`), session claim interfaces, or domain DTOs inside middleware, controllers, or service files. All internal API type definitions (`AppVariables`, `ValidatedContext`, etc.) must be placed in `apps/api/src/types/` and imported directly (`import type { AppVariables, ValidatedContext } from "../types"`).
- **Standardized Error Handling & Validation (`lib/errors.ts` & `lib/validate.ts`)**: Never return manual ad-hoc `c.json({ error: ... }, status)` responses for operational errors or validation failures.
  - Route validation must use `validate("json" | "param" | "query", Schema)` from `apps/api/src/lib/validate.ts` instead of raw `@hono/zod-validator`. Controllers consuming validated input must use `ValidatedContext<Target, typeof Schema>` (`c.req.valid(target)`).
  - Controllers and guards must throw operational subclasses (`throw new UnauthorizedError()`, `throw new ForbiddenError()`, `throw new NotFoundError()`, `throw new ValidationError()`, `throw new ConflictError()`).
  - The modular global error handler (`errorHandler` mounted via `app.onError(errorHandler)`) automatically formats exceptions into `{ success: false, error: { code, message, details? } }`.

---

## 5. Core Architectural Principles to Preserve
1. Maintain one unified codebase in TypeScript running on Bun.
2. Keep the synchronous ingestion path (`POST /v1/memories`) lightweight: store episode $\rightarrow$ enqueue BullMQ job $\rightarrow$ return `202 Accepted`.
3. Keep all heavy cognitive extraction and mutation evaluation in the asynchronous background worker (`worker` container).
4. Enforce tenant isolation via indexed `tenant_id` column filtering (`WHERE tenant_id = ?`).
5. Keep compute, queue, and database co-located within the same region and network to guarantee ultra-low retrieval latency.

---

## 6. Monorepo Folder Structure & Architectural Best Practices

When generating or refactoring code, always organize modules using clear separation of concerns across our Bun workspaces:

### `apps/api/src/` Layout (Hono HTTP Server)
- **`routes/`**: Define HTTP routing paths and attach standardized Zod validation (`validate("json", Schema)` from `../lib/validate`). Routes delegate execution to controllers.
- **`controllers/` (or `handlers/`)**: Request/response adapters. Parse authenticated context (`c.get('user')`) or validated input (`c.req.valid('json')` with `ValidatedContext`), call domain services, and return typed responses or throw operational `AppError` subclasses.
- **`services/`**: Core business and orchestration logic (`userService.ts`, `tenantService.ts`, `memoryIngestService.ts`). Domain services must be pure TypeScript modules independent of Hono HTTP context.
- **`middleware/`**: Cross-cutting HTTP middleware (`clerkAuth.ts`, `authMiddleware.ts` (`authGuard`, `tenantGuard` strictly requiring `x-tenant-id`, `namespaceAuthGuard`), `errorHandler.ts`).
- **`lib/`**: Core utilities and infrastructure constants (`apiResponse.ts`, `errors.ts`, `pgErrorMap.ts`, `validate.ts`).
- **`types/`**: Centralized single source of truth for all Hono context definitions (`AppVariables`), Clerk session claims, and shared contracts (`index.ts`, `auth.ts`).
- **`config/`**: Environment and runtime configuration (`cors.ts`).
- **`schemas/`**: Zod validation schemas for API inputs and responses (`org.ts`, `auth.ts`).

### `apps/worker/src/` Layout (BullMQ Asynchronous Consumer)
- **`consumers/`**: BullMQ queue worker setup and event listeners (`episodeConsumer.ts`).
- **`cognitive/`**: Single-call LLM extraction pipeline, schema definitions, and prompt templates (`extractor.ts`).
- **`mutations/`**: Atomic database transaction execution flipping `pending_review` $\rightarrow$ `active` / `superseded` (`mutationEngine.ts`).

### `packages/db/src/` Layout (Shared Database Layer)
- **`schema/`**: Definitive PostgreSQL + `pgvector` table definitions (`orgs.ts`, `memories.ts`, `entities.ts`, `auth.ts`).
- **`client.ts`**: Singleton PostgreSQL database connection pool exported across `api` and `worker`.
