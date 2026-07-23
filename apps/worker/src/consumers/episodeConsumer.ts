import {
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { type Job, Worker } from "bullmq";
import { extractEpisodeClaims } from "../cognitive/extractor";
import { redisConnection } from "../config/redis";
import { evaluateAndApplyMutations } from "../mutations/mutationEngine";

/**
 * Process individual episode extraction jobs dequeued from Redis.
 */
async function processEpisode(
  job: Job<EpisodeExtractionJobData>,
): Promise<void> {
  const { episodeId, tenantId, namespace, userId } = job.data;
  console.log(
    `[EpisodeConsumer] Processing job ${job.id} | episode: ${episodeId} | tenant: ${tenantId} | namespace: ${namespace} | user: ${userId}`,
  );

  const extractionPayload = await extractEpisodeClaims(job.data);
  await evaluateAndApplyMutations(extractionPayload);
}

/**
 * BullMQ Worker instance for Episode Extraction Queue.
 */
export const episodeWorker = new Worker<EpisodeExtractionJobData, void, string>(
  EPISODE_EXTRACTION_QUEUE,
  processEpisode,
  {
    // biome-ignore lint/suspicious/noExplicitAny: Required for BullMQ connection compatibility
    connection: redisConnection as any,
    concurrency: 5, // Balanced for IO-bound LLM tasks across CPU cores
    lockDuration: 60000, // 60-second lock duration budget for extraction processing
  },
);

// Structured Event Listeners for Observability
episodeWorker.on("active", (job) => {
  console.log(
    `[EpisodeWorker] Job active: ${job.id} (episode: ${job.data.episodeId})`,
  );
});

episodeWorker.on("completed", (job) => {
  console.log(
    `[EpisodeWorker] Job completed: ${job.id} (episode: ${job.data.episodeId})`,
  );
});

episodeWorker.on("failed", (job, err) => {
  console.error(
    `[EpisodeWorker] Job failed: ${job?.id} (episode: ${job?.data?.episodeId}):`,
    err,
  );
});

episodeWorker.on("error", (err) => {
  console.error("[EpisodeWorker] Worker connection error:", err);
});

episodeWorker.on("stalled", (jobId) => {
  console.warn(`[EpisodeWorker] Job stalled: ${jobId}`);
});

/**
 * Gracefully close the worker connection during process shutdown.
 */
export async function closeEpisodeWorker(): Promise<void> {
  console.log("[EpisodeWorker] Closing worker connection...");
  await episodeWorker.close();
  console.log("[EpisodeWorker] Worker closed cleanly.");
}
