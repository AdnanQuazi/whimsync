import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ==========================================
// 1. Scoping & Access Control Models
// ==========================================

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const orgMemberships = pgTable(
  "org_memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    // Roles: 'owner' | 'admin' | 'member'
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId] }),
    index("org_memberships_user_id_idx").on(table.userId),
  ],
);

export const namespaces = pgTable(
  "namespaces",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.name] }),
    index("namespaces_org_id_idx").on(table.orgId),
  ],
);

export const namespacePermissions = pgTable(
  "namespace_permissions",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull(),
    userId: text("user_id").notNull(),
    canRead: boolean("can_read").notNull().default(false),
    canWrite: boolean("can_write").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.namespace, table.userId] }),
    index("namespace_permissions_user_id_idx").on(table.userId),
    index("namespace_permissions_org_ns_idx").on(table.orgId, table.namespace),
  ],
);
