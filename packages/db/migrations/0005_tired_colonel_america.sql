ALTER TABLE "ingestion_records" ADD COLUMN "file_hash" text;--> statement-breakpoint
ALTER TABLE "ingestion_records" ADD CONSTRAINT "ingestion_records_tenant_ns_hash_idx" UNIQUE("tenant_id","namespace","file_hash");
