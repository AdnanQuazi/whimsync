import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export const successResponse = (
  c: Context,
  message: string,
  data: unknown,
  status: ContentfulStatusCode = 200,
) => c.json({ success: true, message, data }, status);

export const errorResponse = (
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  details?: unknown,
) =>
  c.json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    },
    status,
  );
