import {
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { Queue } from "bullmq";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  lazyConnect: true, // Connect only when commands are issued to avoid eager connection errors during boot/tests
});

export const episodeQueue = new Queue<EpisodeExtractionJobData, void, string>(
  EPISODE_EXTRACTION_QUEUE,
  {
    // biome-ignore lint/suspicious/noExplicitAny: Required for BullMQ connection options compatibility
    connection: redisConnection as any,
  },
);
