import {
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const episodeQueue = new Queue<EpisodeExtractionJobData, void, string>(
  EPISODE_EXTRACTION_QUEUE,
  {
    // biome-ignore lint/suspicious/noExplicitAny: Required for BullMQ connection options compatibility
    connection: redisConnection as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000, // Starts at 2s -> 4s -> 8s
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000, // Keep at most 1,000 completed jobs
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days for audit/debugging
      },
    },
  },
);
