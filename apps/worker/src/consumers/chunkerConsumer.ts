import {
  CHUNKING_QUEUE,
  type ChunkingJobData,
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { storageService } from "@whimsync/core/services";
import { type Job, Queue, Worker } from "bullmq";
import { type ChunkItem, chunkerEngine, chunkerRepository } from "../chunking";
import { redisConnection } from "../config/redis";

const episodeQueue = new Queue<EpisodeExtractionJobData>(
  EPISODE_EXTRACTION_QUEUE,
  {
    // biome-ignore lint/suspicious/noExplicitAny: BullMQ Redis connection typing
    connection: redisConnection as any,
  },
);

/**
 * BullMQ Job Processor for Stage 3 Chunking Pipeline.
 *
 * Flow:
 * 1. Update status -> 'chunking' via repository.
 * 2. Fetch raw text (MinIO or inline).
 * 3. Route, split, and compute character offsets via chunkerEngine.
 * 4. Atomically persist episodes & update status -> 'extracting' via repository.
 * 5. Optional fan-out to extraction queue (currently paused).
 */
async function processChunking(job: Job<ChunkingJobData>): Promise<void> {
  const {
    ingestionId,
    tenantId,
    userId,
    sessionId,
    sourceType,
    storageKey,
    rawTextInline,
    fileExtension,
  } = job.data;

  console.log(
    `[ChunkerConsumer] Received job ${job.id} | ingestion=${ingestionId} | tenant=${tenantId} | source=${sourceType} | ext=${fileExtension || "none"}`,
  );

  try {
    // 1. Worker-driven state transition: update status to 'chunking'
    await chunkerRepository.markStatusChunking(ingestionId);

    // 2. Fetch Document Content
    let sourceText = "";
    if (sourceType === "inline_text") {
      sourceText = rawTextInline || "";
    } else if (storageKey) {
      sourceText = await storageService.getObjectAsString(storageKey);
    }

    if (!sourceText.trim()) {
      console.log(
        `[ChunkerConsumer] Ingestion ${ingestionId} is empty. Marking completed with 0 chunks.`,
      );
      await chunkerRepository.markCompletedEmpty(ingestionId);
      return;
    }

    console.log(
      `[ChunkerConsumer] Fetched source document for ingestion ${ingestionId} (${sourceText.length} characters)`,
    );

    // 3. Route, split, and compute offsets
    const chunks: ChunkItem[] = await chunkerEngine.process(sourceText, {
      fileExtension,
    });

    console.log(
      `[ChunkerConsumer] Split into ${chunks.length} chunks with offsets for ingestion ${ingestionId}`,
    );

    if (chunks.length === 0) {
      await chunkerRepository.markCompletedEmpty(ingestionId);
      return;
    }

    // 4. Atomically persist episodes
    const insertedEpisodes = await chunkerRepository.persistEpisodesAndAdvance(
      ingestionId,
      chunks,
      { ingestionId, userId, sessionId },
    );

    console.log(
      `[ChunkerConsumer] Atomically persisted ${insertedEpisodes.length} episodes to database for ingestion ${ingestionId}`,
    );

    // 5. Extraction queue dispatch (Disabled for now)
    // Note: Enqueuing chunks to EPISODE_EXTRACTION_QUEUE is paused per configuration.
    /*
    const extractionJobs = insertedEpisodes.map((ep) => ({
      name: "extract",
      data: {
        episodeId: ep.id,
        ingestionId,
        tenantId,
        namespace,
        userId,
        entityKey: entityKey || null,
        sessionId: sessionId || null,
        rawText: ep.rawText,
        chunkIndex: ep.chunkIndex ?? 0,
        chunkStartOffset: ep.chunkStartOffset ?? 0,
        chunkEndOffset: ep.chunkEndOffset ?? 0,
        headingPath: ep.headingPath || null,
      } satisfies EpisodeExtractionJobData,
    }));

    await episodeQueue.addBulk(extractionJobs);
    */

    console.log(
      `[ChunkerConsumer] Ingestion ${ingestionId} chunking completed (${insertedEpisodes.length} episodes saved in DB). Enqueuing to extraction queue is disabled for now.`,
    );
  } catch (err) {
    console.error(
      `[ChunkerConsumer] Chunking failed for ingestion ${ingestionId}:`,
      err,
    );
    await chunkerRepository.markFailed(ingestionId).catch((dbErr) => {
      console.error(
        `[ChunkerConsumer] Failed to update ingestion ${ingestionId} to 'failed':`,
        dbErr,
      );
    });
    throw err;
  }
}

/**
 * BullMQ Worker instance for Chunking Queue.
 */
export const chunkerWorker = new Worker<ChunkingJobData, void, string>(
  CHUNKING_QUEUE,
  processChunking,
  {
    // biome-ignore lint/suspicious/noExplicitAny: BullMQ Redis connection typing
    connection: redisConnection as any,
    concurrency: 5,
  },
);

chunkerWorker.on("active", (job) => {
  console.log(
    `[ChunkerWorker] Job active: ${job.id} (ingestion: ${job.data.ingestionId})`,
  );
});

chunkerWorker.on("completed", (job) => {
  console.log(
    `[ChunkerWorker] Job completed: ${job?.id} (ingestion: ${job?.data?.ingestionId})`,
  );
});

chunkerWorker.on("failed", (job, err) => {
  console.error(
    `[ChunkerWorker] Job failed: ${job?.id} (ingestion: ${job?.data?.ingestionId}):`,
    err,
  );
});

chunkerWorker.on("error", (err) => {
  console.error("[ChunkerWorker] Worker connection error:", err);
});

export async function closeChunkerWorker(): Promise<void> {
  console.log("[ChunkerWorker] Closing worker connection...");
  await chunkerWorker.close();
  await episodeQueue.close();
  console.log("[ChunkerWorker] Worker closed cleanly.");
}
