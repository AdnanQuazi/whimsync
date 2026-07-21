import type { Context, ValidationTargets } from "hono";
import type { z } from "zod";
import type { AppVariables } from "./auth";

/**
 * Helper type for Hono controller methods consuming Zod validation targets (`json`, `query`, `param`).
 * Provides full compile-time type safety for `c.req.valid(target)` without `as` casts.
 */
export type ValidatedContext<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
> = Context<
  { Variables: AppVariables },
  string,
  {
    in: { [K in Target]: z.infer<Schema> };
    out: { [K in Target]: z.infer<Schema> };
  }
>;
