import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import type { EpisodeExtractionJobData } from "@whimsync/core";
import { and, db, eq, schema } from "@whimsync/db";
import { extractEpisodeClaims } from "../cognitive/extractor";
import { cleanupWorkerTestEpisodes } from "./testUtils";

const testUserId = `worker-test-user-${crypto.randomUUID()}`;
const testTenantId = `org_extractor_test_${crypto.randomUUID().slice(0, 8)}`;

describe("Single-Call LLM Extraction Engine (`extractEpisodeClaims`)", () => {
  beforeAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  afterAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  test("extracts claims, buffers in `pending_review` status, and stores 768-dim embedding in `vectors`", async () => {
    const episodeId = crypto.randomUUID();

    // 1. Insert test episode row directly into Postgres
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText:
        "User prefers using Bun and TypeScript for high-performance backend systems.",
      userId: testUserId,
      sessionId: "session-extractor-test",
    });

    const jobData: EpisodeExtractionJobData = {
      episodeId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: "session-extractor-test",
      rawText:
        "User prefers using Bun and TypeScript for high-performance backend systems.",
    };

    // 2. Invoke extractEpisodeClaims directly
    const payload = await extractEpisodeClaims(jobData);

    // 3. Verify returned payload contract
    expect(payload.episodeId).toBe(episodeId);
    expect(payload.extractedClaims.length).toBeGreaterThanOrEqual(1);
    expect(payload.extractedClaims[0].embedding.length).toBe(768);

    // 4. Verify durable `pending_review` buffer in Postgres
    const pendingClaims = await db
      .select()
      .from(schema.memoryClaims)
      .where(
        and(
          eq(schema.memoryClaims.tenantId, testTenantId),
          eq(schema.memoryClaims.userId, testUserId),
          eq(schema.memoryClaims.status, "pending_review"),
        ),
      );

    expect(pendingClaims.length).toBeGreaterThanOrEqual(1);
    expect(pendingClaims[0].status).toBe("pending_review");
    expect(pendingClaims[0].id).toBe(payload.extractedClaims[0].id);

    // 5. Verify vector row existence
    const vectorRows = await db
      .select()
      .from(schema.vectors)
      .where(
        and(
          eq(schema.vectors.entityId, pendingClaims[0].id),
          eq(schema.vectors.entityType, "memory_claim"),
        ),
      );

    expect(vectorRows.length).toBe(1);
    expect(vectorRows[0].entityId).toBe(pendingClaims[0].id);
  }, 30000);

  test("throws descriptive error when episode ID does not exist in Postgres", async () => {
    const nonExistentEpisodeId = crypto.randomUUID();

    const jobData: EpisodeExtractionJobData = {
      episodeId: nonExistentEpisodeId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: null,
      rawText: "Missing episode test.",
    };

    await expect(extractEpisodeClaims(jobData)).rejects.toThrow(
      `Episode not found in Postgres: ${nonExistentEpisodeId}`,
    );
  });
});
