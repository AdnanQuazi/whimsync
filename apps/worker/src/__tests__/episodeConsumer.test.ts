import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  EPISODE_EXTRACTION_QUEUE,
  type EpisodeExtractionJobData,
} from "@whimsync/core";
import { db, schema } from "@whimsync/db";
import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import {
  closeEpisodeWorker,
  episodeWorker,
} from "../consumers/episodeConsumer";
import { cleanupWorkerTestEpisodes } from "./testUtils";

const testUserId = `worker-queue-user-${crypto.randomUUID()}`;
let testProducerQueue: Queue<EpisodeExtractionJobData, void, string>;

describe("BullMQ Consumer Integration (`episodeConsumer`)", () => {
  beforeAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
    await episodeWorker.pause();
    testProducerQueue = new Queue<EpisodeExtractionJobData, void, string>(
      EPISODE_EXTRACTION_QUEUE,
      {
        // biome-ignore lint/suspicious/noExplicitAny: Required for BullMQ connection options compatibility
        connection: redisConnection as any,
      },
    );
    await testProducerQueue.obliterate({ force: true });
    await episodeWorker.resume();
  });

  afterAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
    await testProducerQueue.close();
    await closeEpisodeWorker();
    await redisConnection.quit();
  });

  test("dequeues job from Redis and triggers completed event after verification", async () => {
    const episodeId = crypto.randomUUID();

    // 1. Insert test episode row into Postgres
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText: "Integration test memory episode for BullMQ queue worker.",
      userId: testUserId,
      sessionId: "session-queue-test",
    });

    const jobPayload: EpisodeExtractionJobData = {
      episodeId,
      tenantId: "org_queue_test",
      namespace: "default",
      userId: testUserId,
      entityKey: "test:consumer",
      sessionId: "session-queue-test",
      rawText: "Integration test memory episode for BullMQ queue worker.",
    };

    // 2. Setup promise to listen for episodeWorker "completed" event matching this episodeId
    const completedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error(
            `Timeout waiting for BullMQ completed event for ${episodeId}`,
          ),
        );
      }, 10000);

      episodeWorker.on("completed", (job) => {
        if (job.data.episodeId === episodeId) {
          clearTimeout(timeout);
          resolve(job);
        }
      });

      episodeWorker.on("failed", (job, err) => {
        if (job?.data?.episodeId === episodeId) {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });

    // 3. Enqueue job into Redis via test producer
    await testProducerQueue.add("extract", jobPayload);

    // 4. Await worker completion
    const completedJob = await completedPromise;
    expect(completedJob).toBeDefined();
  });
});
