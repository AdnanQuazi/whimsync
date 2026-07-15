import { index, pgTable, text, uuid, vector } from "drizzle-orm/pg-core";

// ==========================================
// 4. Vector Embeddings (pgvector)
// ==========================================

export const vectors = pgTable(
  "vectors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").notNull(), // 'memory_claim' | 'entity'
    entityId: uuid("entity_id").notNull(),
    // We configured 768 dimensions for Gemini embedding models (`gemini-embedding-2` / `text-embedding-004`)
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (table) => [
    index("vectors_entity_idx").on(table.entityType, table.entityId),
    index("vector_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);
