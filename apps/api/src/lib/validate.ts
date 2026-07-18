import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema } from "zod";
import { errorResponse } from "./apiResponse";

/**
 * Standardized Zod schema validation middleware (`validate("json", schema)`).
 * Automatically intercepts Zod errors and formats them into our API error envelope.
 */
export const validate = <
  Target extends keyof ValidationTargets,
  Schema extends ZodSchema,
>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return errorResponse(
        c,
        400,
        "VALIDATION_ERROR",
        "Validation failed",
        result.error.issues.map((e) => ({ path: e.path, message: e.message })),
      );
    }
  });
