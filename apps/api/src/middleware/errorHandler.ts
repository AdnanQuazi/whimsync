import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { errorResponse } from "../lib/apiResponse";
import { AppError } from "../lib/errors";
import { pgErrorMap } from "../lib/pgErrorMap";
import type { AppVariables } from "../types";

/**
 * Global Error Handler (`app.onError(errorHandler)`).
 * Intercepts Zod validation issues, Postgres driver errors, and operational AppError subclasses.
 */
export const errorHandler: ErrorHandler<{ Variables: AppVariables }> = (
  err,
  c,
) => {
  const requestId = c.get("requestId");

  if (err instanceof ZodError) {
    return errorResponse(
      c,
      400,
      "VALIDATION_ERROR",
      "Validation failed",
      err.issues.map((e) => ({ path: e.path, message: e.message })),
    );
  }

  // Handle Postgres driver errors (e.g. unique constraint, check violation, foreign key)
  const pgErrCode = (err as { code?: string }).code;
  if (pgErrCode && pgErrorMap[pgErrCode]) {
    const { status, code, message } = pgErrorMap[pgErrCode];
    return errorResponse(c, status as ContentfulStatusCode, code, message);
  }

  if (err instanceof AppError) {
    if (!err.isOperational) {
      console.error("Non-operational error:", { err, requestId });
    }
    return errorResponse(
      c,
      err.status as ContentfulStatusCode,
      err.code,
      err.message,
      err.details,
    );
  }

  console.error("Unhandled error:", { err, requestId });
  return errorResponse(
    c,
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred.",
  );
};
