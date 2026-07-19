import { createMiddleware } from "hono/factory";
import { clerk } from "../config/clerk";

export const clerkAuth = createMiddleware(async (c, next) => {
  const isMockAuthEnabled =
    process.env.NODE_ENV === "test" && !process.env.CLERK_SECRET_KEY;

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
