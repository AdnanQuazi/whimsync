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

## 🟡 Phase 2: Authentication & Synchronous Hono API (`apps/api`) (CURRENT FOCUS)

### Step 3: Clerk Authentication, Scope Guards & Error Handling Architecture (COMPLETED)
- [x] Configure `@clerk/hono` (`clerkAuth`) identity verification across Web, Mobile, and Extension clients with local test header bypass (`x-test-clerk-user-id`).
- [x] Implement atomic auto-provisioning (`findOrProvisionUser`): on first request, provision `users` row, personal `org` (`<Name>'s Org`), `role: owner` membership, and `"default"` namespace.
- [x] Build layered authorization middleware (`authGuard`, `tenantGuard` resolving `x-tenant-id`, `requireTenantGuard`, `namespaceAuthGuard`).
- [x] Build centralized type contract system in `apps/api/src/types/` (single source of truth for `AppVariables` and domain DTOs).
- [x] Implement enterprise error handling & validation architecture:
  - `lib/errors.ts`: Operational class hierarchy (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ValidationError`, `ConflictError`).
  - `lib/pgErrorMap.ts`: Automated translation of Postgres constraint errors (e.g. `23505` unique violation) to clean `409 Conflict` responses.
  - `lib/validate.ts`: Standardized route schema validation wrapper (`validate("json", Schema)`) returning field-level issue details.
  - `middleware/errorHandler.ts`: Global error middleware (`app.onError(errorHandler)`) with `requestId()` correlation tracking.

### Step 4: Fast Ingestion Endpoint (`POST /v1/memories`)
- [ ] Validate incoming request body against schema (`tenant_id`, `namespace`, text).
- [ ] Persist immutable `episode` row in Postgres (`packages/db`).
- [ ] Enqueue asynchronous extraction job to BullMQ via Redis.
- [ ] Return immediate non-blocking response (`202 Accepted`).

### Step 5: Hybrid Retrieval & Projections (`POST /v1/memories/search`, `GET /v1/wiki`)
- [ ] Enforce namespace access permissions (`can_read`).
- [ ] Implement hybrid search combining `pgvector` vector similarity, full-text keyword search, and recency/confidence scoring.
- [ ] Implement inspectable context projection endpoints (`GET /v1/wiki`, `GET /v1/profile`).

---

## ⚪ Phase 3: Asynchronous Extraction & Mutation Worker (`apps/worker`)

### Step 6: BullMQ Consumer Setup
- [ ] Initialize standalone Bun worker process (`apps/worker`) consuming jobs from Redis queue.
- [ ] Build error handling, retries, and job status observability.

### Step 7: Single-Call LLM Extraction Engine
- [ ] Fetch candidate prior claims from Postgres for the incoming episode.
- [ ] Execute single structured LLM call proposing new claims (`status = pending_review`), relationship edges (`memory_relationships`), entity quintuplets (`entity_relationships`), and mutations against candidate prior claims.
- [ ] Generate vector embeddings for newly extracted claims.

### Step 8: Mutation Evaluation & Atomic Status Transition
- [ ] Execute single atomic database transaction applying proposed mutations.
- [ ] Flip new claims from `pending_review` to `active` and superseded claims to `superseded`.
- [ ] Link authoritative character offset ranges in `evidence`.

### Step 9: Cold Storage Archiving Sweeps
- [ ] Implement background sweep exporting superseded/deleted historical claims out of Postgres into cold S3-compatible storage (MinIO / R2).
- [ ] Build on-demand rehydration utility for deep historical audit queries.

---

## ⚪ Phase 4: Frontend Dashboard & Cloud Scaling (`apps/web`)

### Step 10: Next.js Dashboard & Memory Explorer
- [ ] Build Google Sign-In authentication and onboarding UI in `apps/web`.
- [ ] Build Org/Tenant & Namespace management interface (invites, roles, permissions).
- [ ] Build inspectable Memory Explorer and Wiki viewer.

### Step 11: Production & Cloud Deployment Configurations
- [ ] Build multi-stage production Dockerfile for running Hono API (`apps/api`) and BullMQ worker (`apps/worker`).
- [ ] Configure Phase 1 cloud infrastructure deployment manifests (AWS ECS Express Mode + Neon DB + Amazon SQS).
