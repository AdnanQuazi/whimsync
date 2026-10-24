# Whimsync Database — Agent Coding Rules (`packages/db`)

Instructions for AI coding agents developing PostgreSQL schemas, migrations, and database queries in `packages/db`.
For schema documentation and connection details, see [README.md](./README.md).

---

## 1. Schema Design Commandments
- **Flat Tenant Contract:** Every domain table (`ingestion_records`, `episodes`, `memory_claims`, `memory_relationships`, `entities`) must explicitly define `tenant_id`, `namespace`, and `user_id` as indexed columns.
- **Strict Namespace Isolation:** Never define cross-namespace relationships, foreign keys, or indexes. Relationships only link entities within the identical `(tenant_id, namespace)`.
- **Primary Database Technology:** Use PostgreSQL 16 + `pgvector`. Never introduce SQLite, Neo4j, Qdrant, or MongoDB.
- **Entity Deduplication:** Entities are deduplicated at the database level via a unique compound index on `(tenant_id, namespace, canonical_name)`. Always use `ON CONFLICT DO NOTHING` on entity insertions.

---

## 2. Vectors & HNSW Indexing
- The `vectors` table stores 768-dimensional dense vector embeddings (`vector("embedding", { dimensions: 768 })`).
- Always maintain the HNSW index configured with cosine distance:
  ```typescript
  index("vector_hnsw_idx").using("hnsw", table.embedding.op("vector_cosine_ops"))
  ```

---

## 3. Bitemporal Tracking Contract
When modeling relationship edges (`memory_relationships`, `entity_relationships`), always include bitemporal pairs:
- **Event Time (`valid_at`, `invalid_at`):** Real-world time interval when the relationship was true.
- **Transaction Time (`tx_created_at`, `tx_expired_at`):** System belief interval when the database recorded this relationship.

---

## 4. Migrations Workflow
- Never manually edit generated migration SQL files in `packages/db/migrations/`.
- To generate new migration files after modifying `src/schema/*.ts`:
  ```bash
  bun run db:generate
  ```
- To apply migrations against the database:
  ```bash
  bun run db:migrate
  ```
