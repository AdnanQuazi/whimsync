import type {
  CognitiveExtractionPayload,
  EpisodeExtractionJobData,
} from "@whimsync/core";
import { db, eq, schema } from "@whimsync/db";
import {
  fetchCandidateClaims,
  persistPendingClaims,
} from "../services/claimPersistence";
import { generateTextEmbedding } from "../services/embeddingService";
import { executeStructuredExtraction } from "../services/llmService";

/**
 * Single-Call LLM Extraction Engine Seam
 *
 * 1. Verifies episode existence in Postgres.
 * 2. Generates query vector embedding for the incoming \`episode.rawText\`.
 * 3. Retrieves up to 15 active candidate prior claims from Postgres (\`memory_claims\`) using hybrid vector + recency.
 * 4. Executes single structured LLM call (\`gemini-2.5-flash\`) proposing new claims, edges, quintuplets, and mutations.
 * 5. Generates vector embeddings (\`pgvector\`) for each new claim and durably buffers them in Postgres (\`status = pending_review\`).
 */
export async function extractEpisodeClaims(
  data: EpisodeExtractionJobData,
): Promise<CognitiveExtractionPayload> {
  const startTime = Date.now();

  // 1. Verify episode existence in Postgres
  const [episode] = await db
    .select()
    .from(schema.episodes)
    .where(eq(schema.episodes.id, data.episodeId))
    .limit(1);

  if (!episode) {
    throw new Error(
      `Episode not found in Postgres: ${data.episodeId} (tenant: ${data.tenantId}, namespace: ${data.namespace})`,
    );
  }

  // 2. Generate vector embedding for incoming episode query text
  const queryEmbedding = await generateTextEmbedding(data.rawText);

  // 3. Retrieve up to 10 active candidate prior claims using vector recency ordering
  const candidateClaims = await fetchCandidateClaims({
    tenantId: data.tenantId,
    namespace: data.namespace,
    userId: data.userId,
    queryEmbedding,
    limit: 10,
  });

  // 4. Execute single structured LLM call with `gemini-2.5-flash`
  const result = await executeStructuredExtraction(
    data.rawText,
    candidateClaims,
  );

  // 5. Generate vector embeddings for new claims & durably write `pending_review` buffer
  const extractedClaims = await persistPendingClaims({
    tenantId: data.tenantId,
    namespace: data.namespace,
    userId: data.userId,
    entityKey: data.entityKey ?? null,
    sessionId: data.sessionId ?? null,
    claims: result.claims,
  });

  const elapsedMs = Date.now() - startTime;
  console.log(
    `[Extractor Seam] Extracted ${extractedClaims.length} claims and evaluated ${result.mutations.length} mutations for episode ${episode.id} in ${elapsedMs}ms.`,
  );

  // 6. Return typed payload for atomic transaction evaluation
  return {
    episodeId: data.episodeId,
    tenantId: data.tenantId,
    namespace: data.namespace,
    userId: data.userId,
    entityKey: data.entityKey,
    sessionId: data.sessionId,
    rawText: data.rawText,
    candidateClaims,
    extractedClaims,
    memoryRelationships: result.memoryRelationships,
    entityRelationships: result.entityRelationships,
    mutations: result.mutations,
    evidence: result.evidence,
  };
}
