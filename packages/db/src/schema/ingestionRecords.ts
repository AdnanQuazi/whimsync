import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "binary_document",
  "text_file",
  "inline_text",
]);
export const ingestionStatusEnum = pgEnum("ingestion_status", [
  "pending",
  "parsing",
  "chunking",
  "extracting",
  "embedding",
  "indexing",
  "generating_citations",
  "completed",
  "failed",
]);

export const ingestionRecords = pgTable(
  "ingestion_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: text("tenant_id").notNull(),
    namespace: text("namespace").notNull().default("default"),
    userId: text("user_id").notNull(),

    // Optional scoping parameters (matches memory_claims)
    entityKey: text("entity_key"),
    sessionId: text("session_id"),

    sourceType: sourceTypeEnum("source_type").notNull(),

    // null for inline_text; stores original uploaded file key in MinIO
    storageKey: text("storage_key"),

    // Stores normalized PDF key if converted from DOCX/PPTX
    convertedPdfStorageKey: text("converted_pdf_storage_key"),

    // Stores parsed Markdown key from PyMuPDF4LLM
    markdownStorageKey: text("markdown_storage_key"),

    // SHA-256 hash of raw uploaded file bytes for deduplication
    fileHash: text("file_hash"),

    // populated only for inline_text (avoids MinIO round-trip for direct text)
    rawTextInline: text("raw_text_inline"),

    status: ingestionStatusEnum("status").notNull().default("pending"),
    parsingTier: text("parsing_tier").default("smart"),

    // populated after summarization (if generated)
    documentSummary: text("document_summary"),

    totalChunks: integer("total_chunks").notNull().default(0),
    processedChunks: integer("processed_chunks").notNull().default(0),
    failedChunks: integer("failed_chunks").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ingestion_records_tenant_ns_status_idx").on(
      table.tenantId,
      table.namespace,
      table.status,
    ),
    index("ingestion_records_tenant_id_idx").on(table.tenantId),
    index("ingestion_records_user_id_idx").on(table.userId),
    index("ingestion_records_session_id_idx").on(table.sessionId),
    unique("ingestion_records_tenant_ns_hash_idx").on(
      table.tenantId,
      table.namespace,
      table.fileHash,
    ),
  ],
);
