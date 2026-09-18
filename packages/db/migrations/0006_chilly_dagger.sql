ALTER TABLE "ingestion_records" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ingestion_records" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."ingestion_status";--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('pending', 'parsing', 'chunking', 'extracting', 'embedding', 'indexing', 'generating_citations', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "ingestion_records" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."ingestion_status";--> statement-breakpoint
ALTER TABLE "ingestion_records" ALTER COLUMN "status" SET DATA TYPE "public"."ingestion_status" USING "status"::"public"."ingestion_status";--> statement-breakpoint
ALTER TABLE "ingestion_records" ALTER COLUMN "source_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."source_type";--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('binary_document', 'text_file', 'inline_text');--> statement-breakpoint
ALTER TABLE "ingestion_records" ALTER COLUMN "source_type" SET DATA TYPE "public"."source_type" USING "source_type"::"public"."source_type";--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "start_offset" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "end_offset" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "excerpt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingestion_records" ADD COLUMN "converted_pdf_storage_key" text;--> statement-breakpoint
ALTER TABLE "ingestion_records" ADD COLUMN "markdown_storage_key" text;--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "bboxes" jsonb;
