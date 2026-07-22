import type { EpisodeExtractionJobData } from "@whimsync/core";
import { db, eq, schema } from "@whimsync/db";

/**
 * Single-Call LLM Extraction Engine Seam (Step 5 -> Step 6 Transition)
 *
 * In Step 5 (`BullMQ Consumer Setup`), this function verifies that the episode
 * row exists in Postgres (`episodes` table) and establishes the exact cognitive entry
 * point where Step 6 (`Single-Call LLM Extraction Engine`) will execute candidate claim
 * retrieval, structured LLM extraction, and vector embedding generation.
 */
export async function extractEpisodeClaims(
  data: EpisodeExtractionJobData,
): Promise<void> {
  const startTime = Date.now();

  // 1. Verify episode existence in Postgres (shared db client)
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

  const elapsedMs = Date.now() - startTime;
  console.log(
    `[Extractor Seam] Verified episode ${episode.id} in ${elapsedMs}ms. Ready for Step 6 LLM extraction pipeline.`,
  );
}
