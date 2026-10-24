# Whimsync Database Package (`@whimsync/db`)

Authoritative PostgreSQL database models, pgvector indices, and Drizzle ORM migrations shared across `apps/api` and `apps/worker`.

---

## 1. Overview

`packages/db` defines the flat multi-tenant schema, relationship graphs, character offset evidence links, and vector embeddings for Whimsync.

---

## 2. Table Schemas (`src/schema/`)

- **`auth.ts` (`users`):** Authenticated user profiles provisioned from Clerk.
- **`orgs.ts`:**
  - `orgs`: Tenant organization records (`id`, `name`, `created_at`).
  - `org_memberships`: User memberships (`role: 'owner' | 'admin' | 'member'`).
  - `namespaces`: Isolation units within an organization (`org_id`, `name`).
  - `namespace_permissions`: Granular member permissions (`can_read`, `can_write`).
- **`ingestionRecords.ts` (`ingestion_records`):** Tracking records for files and text ingestions (`source_type`, `storage_key`, `file_hash`, `status`, `parsing_tier`, `total_chunks`).
- **`memories.ts`:**
  - `episodes`: Raw, immutable input text chunks (`chunk_index`, character offsets, `heading_path`).
  - `memory_claims`: Extracted atomic facts, preferences, decisions, and goals (`tenant_id`, `namespace`, `user_id`, `content`, `kind`, `status`, `confidence`, `categories`, `content_hash`).
  - `memory_relationships`: Semantic edges between claims (`UPDATES`, `EXTENDS`, `SUPPORTS`, `CONTRADICTS`, `DERIVES`, `MENTIONS`).
  - `evidence`: Authoritative character offset citations (`start_offset`, `end_offset`, `excerpt`, `bboxes`).
- **`entities.ts`:**
  - `entities`: Canonical semantic entities deduplicated via unique index on `(tenant_id, namespace, canonical_name)`.
  - `entity_relationships`: Subject-predicate-object-scope quintuplets.
- **`vectors.ts` (`vectors`):** Dense 768-dimensional embeddings indexed using `pgvector` HNSW cosine similarity (`vector_cosine_ops`).

---

## 3. Database Commands

Run these commands from the repository root:

```bash
# Generate SQL migrations from schema changes
bun run db:generate

# Execute pending migrations against target database
bun run db:migrate

# Push schema directly to database (development prototyping)
bun run db:push

# Launch Drizzle Studio web GUI
bun run db:studio
```

---

## 4. Connection Configuration

Configured via `DATABASE_URL` in root `.env`:
```env
DATABASE_URL=postgres://whimsync:whimsync_dev_pass@localhost:5432/whimsync
```
The Docker Postgres container automatically enables the `vector` extension (`pgvector/pgvector:pg16`).
