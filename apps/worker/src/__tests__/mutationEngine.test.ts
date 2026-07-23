import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import crypto from "node:crypto";
import type { CognitiveExtractionPayload } from "@whimsync/core";
import { and, db, eq, schema } from "@whimsync/db";
import { evaluateAndApplyMutations } from "../mutations/mutationEngine";
import { cleanupWorkerTestEpisodes } from "./testUtils";

const testUserId = `worker-mutation-user-${crypto.randomUUID()}`;
const testTenantId = `org_mutation_test_${crypto.randomUUID().slice(0, 8)}`;

describe("Mutation Evaluation & Atomic Status Transition (`evaluateAndApplyMutations`)", () => {
  beforeAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  afterAll(async () => {
    await cleanupWorkerTestEpisodes([testUserId]);
  });

  test("atomically flips `pending_review` claim to `active` and links `evidence`", async () => {
    const episodeId = crypto.randomUUID();
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText: "User loves Postgres and pgvector.",
      userId: testUserId,
      sessionId: "session-mutation-1",
    });

    const pendingClaimId = crypto.randomUUID();
    const content = "User loves Postgres and pgvector.";
    const contentHash = crypto
      .createHash("sha256")
      .update(content.toLowerCase())
      .digest("hex");

    await db.insert(schema.memoryClaims).values({
      id: pendingClaimId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      content,
      kind: "preference",
      status: "pending_review",
      confidence: 0.99,
      categories: ["tech"],
      contentHash,
      occurredAt: new Date(),
    });

    const payload: CognitiveExtractionPayload = {
      episodeId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: "session-mutation-1",
      rawText: content,
      candidateClaims: [],
      extractedClaims: [
        {
          id: pendingClaimId,
          tempId: "claim_1",
          content,
          kind: "preference",
          confidence: 0.99,
          categories: ["tech"],
          contentHash,
          embedding: Array(768).fill(0.1),
        },
      ],
      memoryRelationships: [],
      entityRelationships: [],
      mutations: [],
      evidence: [
        {
          claimTempId: "claim_1",
          startOffset: 0,
          endOffset: content.length,
          excerpt: content,
        },
      ],
    };

    await evaluateAndApplyMutations(payload);

    const [updatedClaim] = await db
      .select()
      .from(schema.memoryClaims)
      .where(eq(schema.memoryClaims.id, pendingClaimId))
      .limit(1);

    expect(updatedClaim).toBeDefined();
    expect(updatedClaim.status).toBe("active");

    const evidenceRows = await db
      .select()
      .from(schema.evidence)
      .where(eq(schema.evidence.claimId, pendingClaimId));

    expect(evidenceRows.length).toBe(1);
    expect(evidenceRows[0].excerpt).toBe(content);
  });

  test("applies `delete` and `update` mutations against candidate prior claims preserving immutability", async () => {
    const episodeId = crypto.randomUUID();
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText: "User no longer lives in New York, moved to Seattle.",
      userId: testUserId,
      sessionId: "session-mutation-2",
    });

    const oldClaimId = crypto.randomUUID();
    await db.insert(schema.memoryClaims).values({
      id: oldClaimId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      content: "User lives in New York.",
      kind: "fact",
      status: "active",
      confidence: 1.0,
      contentHash: crypto
        .createHash("sha256")
        .update("user lives in new york.")
        .digest("hex"),
      occurredAt: new Date(),
    });

    const payload: CognitiveExtractionPayload = {
      episodeId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: "session-mutation-2",
      rawText: "User no longer lives in New York, moved to Seattle.",
      candidateClaims: [
        {
          id: oldClaimId,
          content: "User lives in New York.",
          kind: "fact",
          recordedAt: new Date(),
        },
      ],
      extractedClaims: [],
      memoryRelationships: [],
      entityRelationships: [],
      mutations: [
        {
          targetClaimId: oldClaimId,
          action: "update",
          replacementContent: "User lives in Seattle.",
          reason: "User moved from New York to Seattle.",
        },
      ],
      evidence: [],
    };

    await evaluateAndApplyMutations(payload);

    // 1. Verify old claim flipped to 'superseded'
    const [supersededClaim] = await db
      .select()
      .from(schema.memoryClaims)
      .where(eq(schema.memoryClaims.id, oldClaimId))
      .limit(1);

    expect(supersededClaim.status).toBe("superseded");

    // 2. Verify new active replacement claim created
    const replacementClaims = await db
      .select()
      .from(schema.memoryClaims)
      .where(
        and(
          eq(schema.memoryClaims.tenantId, testTenantId),
          eq(schema.memoryClaims.content, "User lives in Seattle."),
          eq(schema.memoryClaims.status, "active"),
        ),
      );

    expect(replacementClaims.length).toBe(1);

    // 3. Verify UPDATES relationship edge linking replacement -> oldClaim
    const relRows = await db
      .select()
      .from(schema.memoryRelationships)
      .where(
        and(
          eq(schema.memoryRelationships.sourceClaimId, replacementClaims[0].id),
          eq(schema.memoryRelationships.targetClaimId, oldClaimId),
          eq(schema.memoryRelationships.relation, "UPDATES"),
        ),
      );

    expect(relRows.length).toBe(1);
  });

  test("deduplicates against exact active `contentHash` and cleans up duplicate `pending_review` claim", async () => {
    const episodeId = crypto.randomUUID();
    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText: "User uses Bun.",
      userId: testUserId,
      sessionId: "session-mutation-3",
    });

    const content = "User uses Bun.";
    const contentHash = crypto
      .createHash("sha256")
      .update(content.toLowerCase())
      .digest("hex");

    // 1. Pre-existing active claim with identical contentHash
    const existingActiveId = crypto.randomUUID();
    await db.insert(schema.memoryClaims).values({
      id: existingActiveId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      content,
      kind: "fact",
      status: "active",
      confidence: 1.0,
      contentHash,
      occurredAt: new Date(),
    });

    // 2. New duplicate `pending_review` row inserted during extraction
    const duplicatePendingId = crypto.randomUUID();
    await db.insert(schema.memoryClaims).values({
      id: duplicatePendingId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      content,
      kind: "fact",
      status: "pending_review",
      confidence: 0.95,
      contentHash,
      occurredAt: new Date(),
    });

    await db.insert(schema.vectors).values({
      entityType: "memory_claim",
      entityId: duplicatePendingId,
      embedding: Array(768).fill(0.2),
    });

    const payload: CognitiveExtractionPayload = {
      episodeId,
      tenantId: testTenantId,
      namespace: "default",
      userId: testUserId,
      entityKey: null,
      sessionId: "session-mutation-3",
      rawText: content,
      candidateClaims: [],
      extractedClaims: [
        {
          id: duplicatePendingId,
          tempId: "claim_dup",
          content,
          kind: "fact",
          confidence: 0.95,
          categories: [],
          contentHash,
          embedding: Array(768).fill(0.2),
        },
      ],
      memoryRelationships: [],
      entityRelationships: [],
      mutations: [],
      evidence: [
        {
          claimTempId: "claim_dup",
          startOffset: 0,
          endOffset: content.length,
          excerpt: content,
        },
      ],
    };

    await evaluateAndApplyMutations(payload);

    // Verify duplicate pending row purged
    const [purgedRow] = await db
      .select()
      .from(schema.memoryClaims)
      .where(eq(schema.memoryClaims.id, duplicatePendingId))
      .limit(1);

    expect(purgedRow).toBeUndefined();

    // Verify evidence redirected to existingActiveId
    const evidenceRows = await db
      .select()
      .from(schema.evidence)
      .where(eq(schema.evidence.claimId, existingActiveId));

    expect(evidenceRows.length).toBeGreaterThanOrEqual(1);
    expect(evidenceRows[0].excerpt).toBe(content);
  });
});
