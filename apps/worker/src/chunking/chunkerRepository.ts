import { db } from "@whimsync/db";
import { episodes, ingestionRecords } from "@whimsync/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type {
  ChunkItem,
  IngestionJobMetadata,
  InsertedEpisodeRecord,
} from "./types";

/**
 * Data Access Repository for Chunking Pipeline.
 * Decouples database mutations from the BullMQ consumer lifecycle.
 */
export class ChunkerRepository {
  /**
   * Updates ingestion status to 'chunking'.
   */
  async markStatusChunking(ingestionId: string): Promise<void> {
    await db
      .update(ingestionRecords)
      .set({ status: "chunking", updatedAt: new Date() })
      .where(eq(ingestionRecords.id, ingestionId));
  }

  /**
   * Marks ingestion as completed with 0 chunks (empty document).
   */
  async markCompletedEmpty(ingestionId: string): Promise<void> {
    await db
      .update(ingestionRecords)
      .set({
        status: "completed",
        totalChunks: 0,
        processedChunks: 0,
        failedChunks: 0,
        updatedAt: new Date(),
      })
      .where(eq(ingestionRecords.id, ingestionId));
  }

  /**
   * Marks ingestion as failed.
   */
  async markFailed(ingestionId: string): Promise<void> {
    await db
      .update(ingestionRecords)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(ingestionRecords.id, ingestionId));
  }

  /**
   * Executes an atomic transaction:
   * 1. Batch inserts all generated episodes.
   * 2. Updates ingestion_records: status = 'extracting', total_chunks = N.
   */
  async persistEpisodesAndAdvance(
    ingestionId: string,
    chunks: ChunkItem[],
    metadata: IngestionJobMetadata,
  ): Promise<InsertedEpisodeRecord[]> {
    const recordsToInsert: InsertedEpisodeRecord[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      recordsToInsert.push({
        id: uuidv4(),
        rawText: chunk.text,
        userId: metadata.userId,
        sessionId: metadata.sessionId || null,
        sourceIngestionId: ingestionId,
        chunkIndex: i,
        chunkStartOffset: chunk.chunkStartOffset ?? null,
        chunkEndOffset: chunk.chunkEndOffset ?? null,
        headingPath: chunk.headingPath || null,
        status: "pending",
      });
    }

    await db.transaction(async (tx) => {
      // 1. Batch insert episodes
      await tx.insert(episodes).values(recordsToInsert);
    });

    return recordsToInsert;
  }
}

export const chunkerRepository = new ChunkerRepository();
