import crypto from "node:crypto";
import type {
  CandidateClaim,
  CognitiveExtractionResult,
  ExtractedClaimWithEmbedding,
} from "@whimsync/core";
import { and, db, desc, eq, schema, sql } from "@whimsync/db";
import { generateTextEmbeddingsBatch } from "./embeddingService";

export async function fetchCandidateClaims(params: {
  tenantId: string;
  namespace: string;
  userId: string;
  queryEmbedding: number[];
  limit?: number;
}): Promise<CandidateClaim[]> {
  const limit = params.limit ?? 10;

  // Uses pgvector cosine distance (<=>) for vector similarity search.
  // Note: BM25/FTS search is slated for Phase 4 (Hybrid Retrieval).
  const candidateRows = await db
    .select({
      id: schema.memoryClaims.id,
      content: schema.memoryClaims.content,
      kind: schema.memoryClaims.kind,
      recordedAt: schema.memoryClaims.recordedAt,
    })
    .from(schema.memoryClaims)
    .leftJoin(
      schema.vectors,
      and(
        eq(schema.vectors.entityId, schema.memoryClaims.id),
        eq(schema.vectors.entityType, "memory_claim"),
      ),
    )
    .where(
      and(
        eq(schema.memoryClaims.tenantId, params.tenantId),
        eq(schema.memoryClaims.namespace, params.namespace),
        eq(schema.memoryClaims.userId, params.userId),
        eq(schema.memoryClaims.status, "active"),
      ),
    )
    .orderBy(
      sql`COALESCE(${schema.vectors.embedding} <=> ${JSON.stringify(params.queryEmbedding)}::vector, 1.0) ASC`,
      desc(schema.memoryClaims.recordedAt),
    )
    .limit(limit);

  return candidateRows.map((row) => ({
    id: row.id,
    content: row.content,
    kind: row.kind,
    recordedAt: row.recordedAt,
  }));
}

export async function persistPendingClaims(params: {
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey: string | null;
  sessionId: string | null;
  claims: CognitiveExtractionResult["claims"];
}): Promise<ExtractedClaimWithEmbedding[]> {
  const extractedClaims: ExtractedClaimWithEmbedding[] = [];

  // 1. Batch generate vector embeddings for all claims in one API call
  const claimContents = params.claims.map((c) => c.content);
  const embeddings = await generateTextEmbeddingsBatch(claimContents);

  // 2. Iterate through claims and insert them with their pre-fetched embeddings
  for (let i = 0; i < params.claims.length; i++) {
    const claim = params.claims[i];
    const embedding = embeddings[i];
    const claimId = crypto.randomUUID();
    const contentHash = crypto
      .createHash("sha256")
      .update(claim.content.trim().toLowerCase())
      .digest("hex");

    // Write durable `pending_review` claim row
    await db.insert(schema.memoryClaims).values({
      id: claimId,
      tenantId: params.tenantId,
      namespace: params.namespace,
      userId: params.userId,
      entityKey: params.entityKey ?? null,
      sessionId: params.sessionId ?? null,
      content: claim.content,
      kind: claim.kind,
      status: "pending_review",
      confidence: claim.confidence,
      categories: claim.categories,
      contentHash,
      metadata: {},
      occurredAt: new Date(),
    });

    // Save vector row for the new claim
    await db.insert(schema.vectors).values({
      entityType: "memory_claim",
      entityId: claimId,
      embedding,
    });

    extractedClaims.push({
      id: claimId,
      tempId: claim.tempId,
      content: claim.content,
      kind: claim.kind,
      confidence: claim.confidence,
      categories: claim.categories,
      contentHash,
      embedding,
    });
  }

  return extractedClaims;
}
