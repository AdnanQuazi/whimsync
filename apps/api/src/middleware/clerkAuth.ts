import { clerkMiddleware } from "@clerk/hono";
import { createMiddleware } from "hono/factory";

const clerk = clerkMiddleware();

const isMockAuthEnabled =
  process.env.NODE_ENV === "test" && !process.env.CLERK_SECRET_KEY;

export const clerkAuth = createMiddleware(async (c, next) => {
  if (isMockAuthEnabled) {
    const testUserId = c.req.header("x-test-clerk-user-id") || null;

    c.set("clerkAuth", (() => ({
      userId: testUserId,
      sessionClaims: testUserId
        ? {
            email:
              c.req.header("x-test-clerk-email") ||
              `${testUserId}@whimsync.test`,
            name: c.req.header("x-test-clerk-name") || "Route Test User",
          }
        : undefined,
    })) as any);

    return next();
  }

  return clerk(c, next);
});
