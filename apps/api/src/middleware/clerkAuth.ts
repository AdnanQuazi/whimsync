import { createMiddleware } from "hono/factory";
import { clerk } from "../config/clerk";

export const clerkAuth = createMiddleware(async (c, next) => {
  const testUserId = c.req.header("x-test-clerk-user-id") || null;
  const isMockAuthEnabled =
    process.env.NODE_ENV === "test" ||
    (process.env.NODE_ENV !== "production" && Boolean(testUserId));

  if (isMockAuthEnabled) {
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
      // biome-ignore lint/suspicious/noExplicitAny: Hono Context typing bypass for test headers
    })) as any);

    return next();
  }

  return clerk(c, next);
});
