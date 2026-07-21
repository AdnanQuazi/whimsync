import { successResponse } from "../lib/apiResponse";
import { UnauthorizedError } from "../lib/errors";
import type { CreateMemorySchema } from "../schemas/memory";
import { memoryIngestService } from "../services/memoryIngestService";
import type { ValidatedContext } from "../types";

export class MemoryController {
  /**
   * Fast ingestion path (`POST /v1/memories`).
   * Returns immediate non-blocking 202 Accepted response.
   */
  async ingestMemory(c: ValidatedContext<"json", typeof CreateMemorySchema>) {
    const user = c.get("user");
    const activeTenantId = c.get("tenantId");

    if (!user || !activeTenantId) {
      throw new UnauthorizedError(
        "Unauthorized: Missing identity or tenant context",
      );
    }

    const body = c.req.valid("json");

    const episodeId = await memoryIngestService.ingestEpisode({
      text: body.text,
      tenantId: activeTenantId,
      namespace: body.namespace,
      userId: user.id,
      entityKey: body.entityKey,
      sessionId: body.sessionId,
    });

    return successResponse(
      c,
      "Episode ingested and queued for extraction",
      {
        episodeId,
        status: "accepted",
      },
      202,
    );
  }
}

export const memoryController = new MemoryController();
