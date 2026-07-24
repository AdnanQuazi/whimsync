# Whimsync — Development Progress Tracker

> **Engineering Roadmap & Step-by-Step Implementation Tracker for Whimsync Monorepo (Bun / Hono / Next.js / Postgres)**

---

## 🟢 Phase 1: Foundation & Local Self-Hosted Infrastructure (COMPLETED)

### Step 1: Monorepo & Environment Setup (COMPLETED)
- [x] Create `docker-compose.yml` for self-hosted local infrastructure (`postgres` preloaded with `pgvector`, `redis`, `minio`).
- [x] Verify local containers launch cleanly and Bun execution environment is ready.
- [x] Initialize Bun Workspaces monorepo structure (`apps/api` for Hono, `apps/worker` for BullMQ consumer, `apps/web` for Next.js dashboard, `packages/db` for shared database models).
- [x] Configure workspace package names, TypeScript configurations, and root development scripts.

### Step 2: Database Schema & Migrations (`packages/db`) (COMPLETED)
- [x] Configure PostgreSQL connection pool (`postgres` / Drizzle / Kysely) in `packages/db`.
- [x] Create DDL migrations for Scoping & Access Control tables (`orgs`, `org_memberships`, `namespaces`, `namespace_permissions`).
- [x] Create DDL migrations for Memory & Attribution tables (`episodes`, `memory_claims`, `memory_relationships`, `entities`, `entity_relationships`, `evidence`, `vectors`).
- [x] Add compound B-tree indexes (`tenant_id`, `namespace`, `status`) and `pgvector` HNSW index for vector cosine similarity search.

---

## 🟢 Phase 2: Authentication & Synchronous Ingestion API (`apps/api`) (COMPLETED)

### Step 3: Clerk Authentication, Scope Guards & Error Handling Architecture (COMPLETED)
- [x] Configure `@clerk/hono` (`clerkAuth`) identity verification across Web, Mobile, and Extension clients with local test header bypass (`x-test-clerk-user-id`).
- [x] Implement atomic auto-provisioning (`findOrProvisionUser`): on first request, provision `users` row, personal `org` (`<Name>'s Org`), `role: owner` membership, and `"default"` namespace.
- [x] Build layered authorization middleware (`authGuard`, `tenantGuard` strictly requiring and resolving `x-tenant-id`, `namespaceAuthGuard`).
- [x] Build centralized type contract system in `apps/api/src/types/` (single source of truth for `AppVariables`, `ValidatedContext`, and domain DTOs).
- [x] Implement enterprise error handling & validation architecture:
  - `lib/errors.ts`: Operational class hierarchy (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`).
  - `lib/pgErrorMap.ts`: Automated translation of Postgres constraint errors (e.g. `23505` unique violation) to clean `409 Conflict` responses.
  - `lib/validate.ts`: Standardized route schema validation wrapper (`validate("json", Schema)`) returning field-level issue details and integrating with `ValidatedContext`.
  - `middleware/errorHandler.ts`: Global error middleware (`app.onError(errorHandler)`) with `requestId()` correlation tracking.

### Step 4: Fast Ingestion Endpoint (`POST /v1/memories`) (COMPLETED)
- [x] Validate incoming request body against schema (`text`, `namespace`, `entityKey`, `sessionId`) via strongly typed `ValidatedContext`.
- [x] Persist immutable `episode` row in Postgres (`packages/db`).
- [x] Enqueue asynchronous extraction job to BullMQ via Redis (`packages/core`).
- [x] Return immediate non-blocking response (`202 Accepted`).

---

## 🟢 Phase 3: Asynchronous Extraction & Mutation Worker (`apps/worker`) (COMPLETED)

### Step 5: BullMQ Consumer Setup (COMPLETED)
- [x] Initialize standalone Bun worker process (`apps/worker`) consuming jobs from Redis queue.
- [x] Build error handling, retries, and job status observability.

### Step 6: Single-Call LLM Extraction Engine (COMPLETED)
- [x] Fetch candidate prior claims from Postgres (`episodes` & `memory_claims`) for the incoming episode.
- [x] Execute single structured LLM call proposing new claims (`status = pending_review`), relationship edges (`memory_relationships`), entity quintuplets (`entity_relationships`), and mutations against candidate prior claims.
- [x] Generate vector embeddings (`pgvector`) for newly extracted claims.

### Step 7: Mutation Evaluation & Atomic Status Transition (COMPLETED)
- [x] Execute single atomic database transaction applying proposed mutations.
- [x] Flip new claims from `pending_review` to `active` and superseded claims to `superseded`.
- [x] Link authoritative character offset ranges in `evidence`.

---

## 🟡 Phase 4: Hybrid Retrieval API & Storage Sweeps (CURRENT FOCUS)

### Step 8: Hybrid Retrieval API (`POST /v1/memories/search`)
- [ ] Enforce namespace access permissions (`can_read`).
- [ ] Implement hybrid search combining `pgvector` vector similarity, full-text keyword search (`FACTS_FTS`), and recency/confidence scoring over active claims.

### Step 9: Cold Storage Archiving Sweeps
- [ ] Implement background sweep exporting superseded/deleted historical claims out of Postgres into cold S3-compatible storage (MinIO / R2).
- [ ] Build on-demand rehydration utility for deep historical audit queries.

---

## ⚪ Phase 5: Frontend Dashboard & Cloud Scaling (`apps/web`)

### Step 10: Next.js Dashboard & Memory Explorer
- [ ] Build Google Sign-In authentication and onboarding UI in `apps/web`.
- [ ] Build Org/Tenant & Namespace management interface (invites, roles, permissions).
- [ ] Build inspectable Memory Explorer.

### Step 11: Production & Cloud Deployment Configurations
- [ ] Build multi-stage production Dockerfile for running Hono API (`apps/api`) and BullMQ worker (`apps/worker`).
- [ ] Configure Phase 1 cloud infrastructure deployment manifests (AWS ECS Express Mode + Neon DB + Amazon SQS).

---

## ⚪ Phase 6: Deferred Consumer Features & Projections (`WHIMSYNC.md` Section 9)

### Step 12: Context Projection Endpoints & Advanced Consumer Features
- [ ] Implement inspectable context projection endpoints (`GET /v1/wiki`, `GET /v1/profile`).
- [ ] Implement reflection generation, profile/agent context summaries, and automated wiki generation.
- [ ] Implement retrieval traversal strategies (conversational, hierarchical/rollup, graph, tree/lineage).
- [ ] Implement memory decay and automatic expiration policies.
