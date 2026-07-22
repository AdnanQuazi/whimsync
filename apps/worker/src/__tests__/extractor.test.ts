import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { EpisodeExtractionJobData } from "@whimsync/core";
import { db, schema } from "@whimsync/db";
import { extractEpisodeClaims } from "../cognitive/extractor";
import { cleanupWorkerTestEpisodes } from "./testUtils";

const testUserId = `worker-test-user-${crypto.randomUUID()}`;

describe("Cognitive Extractor Seam (`extractEpisodeClaims`)", () => {
  beforeAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  afterAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  test("verifies episode presence in Postgres and resolves cleanly", async () => {
    const episodeId = crypto.randomUUID();

    // 1. Insert test episode row directly into Postgres
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText:
        "This is a unit test episode to verify the cognitive extraction seam.",
      userId: testUserId,
      sessionId: "session-unit-test",
    });

    const jobData: EpisodeExtractionJobData = {
      episodeId,
      tenantId: "org_unit_test",
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: "session-unit-test",
      rawText:
        "This is a unit test episode to verify the cognitive extraction seam.",
    };

    // 2. Invoke seam directly without any Redis/BullMQ queue
    await expect(extractEpisodeClaims(jobData));
  });

  test("throws descriptive error when episode ID does not exist in Postgres", async () => {
    const nonExistentEpisodeId = crypto.randomUUID();

    const jobData: EpisodeExtractionJobData = {
      episodeId: nonExistentEpisodeId,
      tenantId: "org_unit_test",
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: null,
      rawText: "Missing episode test.",
    };

    // 3. Verify that the seam throws when episode row is not found
    await expect(extractEpisodeClaims(jobData)).rejects.toThrow(
      `Episode not found in Postgres: ${nonExistentEpisodeId}`,
    );
  });
});
