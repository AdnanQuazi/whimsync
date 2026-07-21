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
  },
);
