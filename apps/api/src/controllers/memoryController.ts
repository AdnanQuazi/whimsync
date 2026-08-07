import { successResponse } from "../lib/apiResponse";
import { UnauthorizedError } from "../lib/errors";
import type { CreateMemorySchema, UploadMemorySchema } from "../schemas/memory";
import { memoryIngestService } from "../services/memoryIngestService";
import type { ValidatedContext } from "../types";

export class MemoryController {
  /**
   * Plain text ingestion path (`POST /v1/memories`).
   * Routes to fast-path or chunking pipeline based on token count.
   */
  async ingestText(c: ValidatedContext<"json", typeof CreateMemorySchema>) {
    const user = c.get("user");
    const activeTenantId = c.get("tenantId");

    if (!user || !activeTenantId) {
      throw new UnauthorizedError(
        "Unauthorized: Missing identity or tenant context",
      );
    }

    const body = c.req.valid("json");

    const ingestionId = await memoryIngestService.ingestText({
      text: body.text,
      tenantId: activeTenantId,
      namespace: body.namespace,
      userId: user.id,
      entityKey: body.entityKey,
      sessionId: body.sessionId,
    });

    return successResponse(
      c,
      "Text ingestion started",
      {
        ingestionId,
        status: "processing",
      },
      202,
    );
  }

  /**
   * File upload path (`POST /v1/memories/upload`).
   * Accepts multipart/form-data with a 'file' field (can be multiple).
   */
  async ingestFiles(c: ValidatedContext<"form", typeof UploadMemorySchema>) {
    const user = c.get("user");
    const activeTenantId = c.get("tenantId");

    if (!user || !activeTenantId) {
      throw new UnauthorizedError(
        "Unauthorized: Missing identity or tenant context",
      );
    }

    const body = c.req.valid("form");

    const results = await memoryIngestService.ingestFiles({
      files: body.file,
      tenantId: activeTenantId,
      namespace: body.namespace,
      userId: user.id,
      entityKey: body.entityKey ?? null,
      sessionId: body.sessionId ?? null,
    });

    return successResponse(c, "Files processed successfully", { results }, 202);
  }
}

export const memoryController = new MemoryController();
