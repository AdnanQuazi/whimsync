import {
  index,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { memoryClaims } from "./memories";

// ==========================================
// 3. Entity & Fact Quintuplet Models
// ==========================================

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    type: text("type").notNull(), // e.g., 'person', 'organization', 'project', 'tool'
    aliases: text("aliases").array(),
    userId: text("user_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    namespace: text("namespace").notNull().default("default"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("entities_tenant_ns_idx").on(table.tenantId, table.namespace),
    index("entities_canonical_name_idx").on(table.canonicalName),
    uniqueIndex("entities_canonical_name_unique_idx").on(
      table.tenantId,
      table.namespace,
      table.canonicalName,
    ),
    index("entities_type_idx").on(table.type),
    index("entities_user_id_idx").on(table.userId),
  ],
);

export const entityRelationships = pgTable(
  "entity_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectEntityId: uuid("subject_entity_id")
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    predicate: text("predicate").notNull(),
    objectEntityId: uuid("object_entity_id").references(() => entities.id, {
      onDelete: "cascade",
    }),
    objectLiteral: text("object_literal"),
    scope: text("scope"),
    rationale: text("rationale"),
    sourceClaimId: uuid("source_claim_id")
      .notNull()
      .references(() => memoryClaims.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull().default(1.0),

    // Bitemporal pairs
    validAt: timestamp("valid_at", { withTimezone: true }),
    invalidAt: timestamp("invalid_at", { withTimezone: true }),
    txCreatedAt: timestamp("tx_created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    txExpiredAt: timestamp("tx_expired_at", { withTimezone: true }),
  },
  (table) => [
    index("entity_rel_subject_idx").on(table.subjectEntityId),
    index("entity_rel_object_idx").on(table.objectEntityId),
    index("entity_rel_source_claim_idx").on(table.sourceClaimId),
  ],
);
