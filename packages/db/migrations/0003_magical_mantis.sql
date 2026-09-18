CREATE TYPE "public"."episode_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('pending', 'preprocessing', 'extracting', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('text_fast', 'text_full', 'file');--> statement-breakpoint
CREATE TABLE "ingestion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"entity_key" text,
	"session_id" text,
	"source_type" "source_type" NOT NULL,
	"storage_key" text,
	"raw_text_inline" text,
	"status" "ingestion_status" DEFAULT 'pending' NOT NULL,
	"document_summary" text,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"processed_chunks" integer DEFAULT 0 NOT NULL,
	"failed_chunks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "source_ingestion_id" uuid;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "chunk_index" integer;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "status" "episode_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "episodes" ADD COLUMN "heading_path" text;--> statement-breakpoint
CREATE INDEX "ingestion_records_tenant_ns_status_idx" ON "ingestion_records" USING btree ("tenant_id","namespace","status");--> statement-breakpoint
CREATE INDEX "ingestion_records_tenant_id_idx" ON "ingestion_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "ingestion_records_user_id_idx" ON "ingestion_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ingestion_records_session_id_idx" ON "ingestion_records" USING btree ("session_id");--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_source_ingestion_id_ingestion_records_id_fk" FOREIGN KEY ("source_ingestion_id") REFERENCES "public"."ingestion_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episodes_ingestion_id_idx" ON "episodes" USING btree ("source_ingestion_id");--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_ingestion_chunk_idx" UNIQUE("source_ingestion_id","chunk_index");
