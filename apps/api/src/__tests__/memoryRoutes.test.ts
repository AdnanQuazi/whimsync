import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, schema } from "@whimsync/db";
import { eq } from "drizzle-orm";
import { redisConnection } from "../config/redis";
import { app } from "../index";
import { episodeQueue } from "../lib/queue";
import { tenantService } from "../services/tenantService";
import { userService } from "../services/userService";
import { cleanupStaleTestRows, cleanupUsersAndOrgs } from "./testUtils";

const testClerkId = `memory-test-user-${crypto.randomUUID()}`;
let personalOrgId: string;

describe("Memory Ingestion Routes (`POST /v1/memories`)", () => {
  beforeAll(async () => {
    await cleanupStaleTestRows();
    await cleanupUsersAndOrgs([testClerkId]);

    // Provision user and retrieve personal org for strict header testing
    await userService.findOrProvisionUser({
      id: testClerkId,
      email: `memory-${testClerkId}@whimsync.test`,
      name: "Memory Test User",
    });
    const orgs = await tenantService.getUserOrgs(testClerkId);
    personalOrgId = orgs[0].id;
  });

  afterAll(async () => {
    await cleanupUsersAndOrgs([testClerkId]);
    await episodeQueue.obliterate({ force: true });
    await episodeQueue.close();
    await redisConnection.quit();
  });

  test("POST /v1/memories without auth token/header should return 401 Unauthorized", async () => {
    const res = await app.request("/v1/memories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Test memory" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /v1/memories without x-tenant-id header should return 400 Validation Error", async () => {
    const res = await app.request("/v1/memories", {
      method: "POST",
      headers: {
        "x-test-clerk-user-id": testClerkId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "Valid memory text" }),
    });
    expect(res.status).toBe(400);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toContain("x-tenant-id");
  });

  test("POST /v1/memories with empty text should return 400 Validation Error", async () => {
    const res = await app.request("/v1/memories", {
      method: "POST",
      headers: {
        "x-test-clerk-user-id": testClerkId,
        "x-tenant-id": personalOrgId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "" }),
    });
    expect(res.status).toBe(400);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  test("POST /v1/memories with valid payload should persist episode, enqueue job, and return 202 Accepted", async () => {
    const textContent =
      "We decided to migrate our background worker to Bun and BullMQ.";
    const res = await app.request("/v1/memories", {
      method: "POST",
      headers: {
        "x-test-clerk-user-id": testClerkId,
        "x-tenant-id": personalOrgId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: textContent,
        namespace: "default",
        entityKey: "project:whimsync",
        sessionId: "session-123",
      }),
    });

    expect(res.status).toBe(202);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.message).toBe("Episode ingested and queued for extraction");
    expect(json.data.status).toBe("accepted");
    expect(typeof json.data.episodeId).toBe("string");

    // Verify episode persistence in PostgreSQL using flat/immutable episodes table contract
    const persisted = await db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, json.data.episodeId));

    expect(persisted.length).toBe(1);
    expect(persisted[0].rawText).toBe(textContent);
    expect(persisted[0].userId).toBe(testClerkId);
    expect(persisted[0].sessionId).toBe("session-123");
  });
});
