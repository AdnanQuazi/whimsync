import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ==========================================
// 2. Memory & Attribution Models
// ==========================================

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawText: text("raw_text").notNull(),
    userId: text("user_id").notNull(),
    sessionId: text("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("episodes_user_id_idx").on(table.userId),
    index("episodes_session_id_idx").on(table.sessionId),
  ],
);

export const memoryClaims = pgTable(
  "memory_claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Flat Schema Contract: tenant_id, namespace, user_id (not null)
    tenantId: text("tenant_id").notNull(),
    namespace: text("namespace").notNull().default("default"),
    userId: text("user_id").notNull(),
    // Nullable scoping/lifecycle tags
    entityKey: text("entity_key"),
    sessionId: text("session_id"),

    content: text("content").notNull(),
    kind: text("kind").notNull(), // e.g., 'fact', 'preference', 'decision', 'goal'
    status: text("status").notNull().default("pending_review"), // 'pending_review' | 'active' | 'superseded' | 'deleted'
    confidence: real("confidence").notNull().default(1.0),
    categories: text("categories").array(),
    contentHash: text("content_hash").notNull(),
    metadata: jsonb("metadata").default({}),

    // Three distinct timestamps
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("memory_claims_tenant_ns_status_idx").on(
      table.tenantId,
      table.namespace,
      table.status,
    ),
    index("memory_claims_tenant_id_idx").on(table.tenantId),
    index("memory_claims_namespace_idx").on(table.namespace),
    index("memory_claims_user_id_idx").on(table.userId),
    index("memory_claims_entity_key_idx").on(table.entityKey),
    index("memory_claims_session_id_idx").on(table.sessionId),
    index("memory_claims_status_idx").on(table.status),
    index("memory_claims_content_hash_idx").on(table.contentHash),
  ],
);

export const memoryRelationships = pgTable(
  "memory_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceClaimId: uuid("source_claim_id")
      .notNull()
      .references(() => memoryClaims.id, { onDelete: "cascade" }),
    targetClaimId: uuid("target_claim_id")
      .notNull()
      .references(() => memoryClaims.id, { onDelete: "cascade" }),
    // Relation: 'UPDATES' | 'EXTENDS' | 'SUPPORTS' | 'CONTRADICTS' | 'DERIVES' | 'MENTIONS'
    relation: text("relation").notNull(),
    confidence: real("confidence").notNull().default(1.0),
    reason: text("reason"),

    // Denormalized access boundaries
    tenantId: text("tenant_id").notNull(),
    namespace: text("namespace").notNull().default("default"),

    // Bitemporal pairs
    validAt: timestamp("valid_at", { withTimezone: true }),
    invalidAt: timestamp("invalid_at", { withTimezone: true }),
    txCreatedAt: timestamp("tx_created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    txExpiredAt: timestamp("tx_expired_at", { withTimezone: true }),
  },
  (table) => [
    index("memory_rel_source_idx").on(table.sourceClaimId),
    index("memory_rel_target_idx").on(table.targetClaimId),
    index("memory_rel_tenant_ns_idx").on(table.tenantId, table.namespace),
  ],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    claimId: uuid("claim_id")
      .notNull()
      .references(() => memoryClaims.id, { onDelete: "cascade" }),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    excerpt: text("excerpt"),
    confidence: real("confidence").notNull().default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("evidence_claim_id_idx").on(table.claimId),
    index("evidence_episode_id_idx").on(table.episodeId),
  ],
);
