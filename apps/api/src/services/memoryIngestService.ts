import {
  BINARY_EXTENSIONS,
  CHUNKING_QUEUE,
  type ChunkingJobData,
  DOCUMENT_PARSING_QUEUE,
  type DocumentParsingJobData,
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { db, schema } from "@whimsync/db";
import { and, eq } from "drizzle-orm";
import { FAST_PATH_CHAR_LIMIT } from "../config/constants";
import { getExtension } from "../lib/fileValidation";
import {
  chunkingQueue,
  documentParsingQueue,
  episodeQueue,
} from "../lib/queue";
import { storageService } from "./storageService";

export interface IngestTextInput {
  text: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey?: string | null;
  sessionId?: string | null;
}

export interface IngestFilesInput {
  files: File[];
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey?: string | null;
  sessionId?: string | null;
}

export interface FileIngestResult {
  fileName: string;
  ingestionId: string;
  status: "processing" | "existing";
}

export class MemoryIngestService {
  /**
   * Ingest plain text. Enforces the 1500-character threshold.
   * - <= 1500 chars: fast path (direct to extraction)
   * - > 1500 chars: full path (send directly to chunker)
   */
  async ingestText(input: IngestTextInput): Promise<string> {
    const ingestionId = crypto.randomUUID();

    if (input.text.length <= FAST_PATH_CHAR_LIMIT) {
      // ----------------------------------------
      // FAST PATH: Short text. Skip chunking.
      // ----------------------------------------
      await db.insert(schema.ingestionRecords).values({
        id: ingestionId,
        tenantId: input.tenantId,
        namespace: input.namespace,
        userId: input.userId,
        entityKey: input.entityKey ?? null,
        sessionId: input.sessionId ?? null,
        sourceType: "inline_text",
        rawTextInline: input.text,
        totalChunks: 1,
        status: "extracting",
      });

      const episodeId = crypto.randomUUID();
      await db.insert(schema.episodes).values({
        id: episodeId,
        rawText: input.text,
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        sourceIngestionId: ingestionId,
        chunkIndex: 0,
        chunkStartOffset: 0,
        chunkEndOffset: input.text.length,
        status: "pending",
      });

      const jobPayload: EpisodeExtractionJobData = {
        episodeId,
        ingestionId,
        tenantId: input.tenantId,
        namespace: input.namespace,
        userId: input.userId,
        entityKey: input.entityKey ?? null,
        sessionId: input.sessionId ?? null,
        rawText: input.text,
        chunkIndex: 0,
        chunkStartOffset: 0,
        chunkEndOffset: input.text.length,
        documentSummary: null,
        contextPrefix: null,
        headingPath: null,
      };

      await episodeQueue.add(EPISODE_EXTRACTION_QUEUE, jobPayload);
    } else {
      // ----------------------------------------
      // FULL PATH: Long text. Send to Chunker directly.
      // ----------------------------------------

      // Store in DB directly (No MinIO roundtrip for text)
      await db.insert(schema.ingestionRecords).values({
        id: ingestionId,
        tenantId: input.tenantId,
        namespace: input.namespace,
        userId: input.userId,
        entityKey: input.entityKey ?? null,
        sessionId: input.sessionId ?? null,
        sourceType: "inline_text",
        rawTextInline: input.text,
        totalChunks: 0, // Placeholder, updated by TS worker after chunking finishes
        status: "pending",
      });

      const jobPayload: ChunkingJobData = {
        ingestionId,
        sourceType: "inline_text",
        rawTextInline: input.text,
        fileExtension: ".txt",
        tenantId: input.tenantId,
        namespace: input.namespace,
        userId: input.userId,
        entityKey: input.entityKey ?? null,
        sessionId: input.sessionId ?? null,
      };

      await chunkingQueue.add(CHUNKING_QUEUE, jobPayload);
    }

    return ingestionId;
  }

  /**
   * Ingest multiple file uploads.
   * Calculates SHA-256 hash for deduplication. Uploads novel files to MinIO
   * and enqueues binary files to parsing queue and text/code files directly to chunking queue.
   */
  async ingestFiles(input: IngestFilesInput): Promise<FileIngestResult[]> {
    const results: FileIngestResult[] = [];

    for (const file of input.files) {
      const buffer = await file.arrayBuffer();

      // Calculate SHA-256 for deduplication (Cloudflare / Web Standard compatible)
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Soft Dedup Check
      const existingRecord = await db.query.ingestionRecords.findFirst({
        where: and(
          eq(schema.ingestionRecords.tenantId, input.tenantId),
          eq(schema.ingestionRecords.namespace, input.namespace),
          eq(schema.ingestionRecords.fileHash, fileHash),
        ),
      });

      if (existingRecord) {
        results.push({
          fileName: file.name,
          ingestionId: existingRecord.id,
          status: "existing",
        });
        continue;
      }

      // Novel file processing
      const ingestionId = crypto.randomUUID();
      const storageKey = await storageService.uploadFile(
        Buffer.from(buffer),
        file.name,
      );

      const ext = getExtension(file.name);
      const isBinary = ext in BINARY_EXTENSIONS;
      const sourceType = isBinary ? "binary_document" : "text_file";

      await db.insert(schema.ingestionRecords).values({
        id: ingestionId,
        tenantId: input.tenantId,
        namespace: input.namespace,
        userId: input.userId,
        entityKey: input.entityKey ?? null,
        sessionId: input.sessionId ?? null,
        sourceType,
        storageKey,
        fileHash,
        totalChunks: 0, // Placeholder, updated by TS worker after chunking finishes
        status: "pending",
      });

      if (isBinary) {
        // Binary path: PDF, DOCX, PPTX -> Python Parser
        const jobPayload: DocumentParsingJobData = {
          ingestionId,
          storageKey,
          fileName: file.name,
          fileExtension: ext,
          tenantId: input.tenantId,
          namespace: input.namespace,
          userId: input.userId,
          entityKey: input.entityKey ?? null,
          sessionId: input.sessionId ?? null,
        };

        await documentParsingQueue.add(DOCUMENT_PARSING_QUEUE, jobPayload);
      } else {
        // Text/Code path: .md, .txt, code files -> TS Chunker directly
        const jobPayload: ChunkingJobData = {
          ingestionId,
          sourceType: "text_file",
          storageKey,
          fileName: file.name,
          fileExtension: ext,
          tenantId: input.tenantId,
          namespace: input.namespace,
          userId: input.userId,
          entityKey: input.entityKey ?? null,
          sessionId: input.sessionId ?? null,
        };

        await chunkingQueue.add(CHUNKING_QUEUE, jobPayload);
      }

      results.push({
        fileName: file.name,
        ingestionId,
        status: "processing",
      });
    }

    return results;
  }
}

export const memoryIngestService = new MemoryIngestService();
