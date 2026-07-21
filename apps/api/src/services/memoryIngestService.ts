import type { EpisodeExtractionJobData } from "@whimsync/core";
import { db, schema } from "@whimsync/db";
import { episodeQueue } from "../lib/queue";

export interface IngestEpisodeInput {
  text: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey?: string | null;
  sessionId?: string | null;
}

export class MemoryIngestService {
  /**
   * Fast Ingestion path:
   * 1. Generates deterministic UUID.
   * 2. Persists immutable raw episode row in `episodes` table.
   * 3. Enqueues structured extraction job to BullMQ via Redis with retries.
   */
  async ingestEpisode(input: IngestEpisodeInput): Promise<string> {
    const episodeId = crypto.randomUUID();

    await db.insert(schema.episodes).values({
      id: episodeId,
      rawText: input.text,
      userId: input.userId,
      sessionId: input.sessionId ?? null,
    });

    const jobPayload: EpisodeExtractionJobData = {
      episodeId,
      tenantId: input.tenantId,
      namespace: input.namespace,
      userId: input.userId,
      entityKey: input.entityKey ?? null,
      sessionId: input.sessionId ?? null,
      rawText: input.text,
    };

    await episodeQueue.add("extract", jobPayload, {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });

    return episodeId;
  }
}

export const memoryIngestService = new MemoryIngestService();
