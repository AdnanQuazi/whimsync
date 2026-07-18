import { getAuth } from "@clerk/hono";
import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import { tenantService } from "../services/tenantService";
import { userService } from "../services/userService";

import type { AppVariables, ClerkSessionClaims } from "../types";

/**
 * Identity Guard (`authGuard`):
 * 1. Checks `getAuth(c)` from Clerk middleware.
 * 2. Runs `findOrProvisionUser()` to ensure user and personal org exist in Postgres.
 * 3. Attaches `c.set("user", user)`.
 */
export const authGuard = () =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const auth = getAuth(c);

    if (!auth?.userId) {
      throw new UnauthorizedError("Unauthorized: Missing authentication token");
    }

    const claims = auth.sessionClaims as ClerkSessionClaims | undefined;
    const email = claims?.email || claims?.email_address;
    const name = claims?.name;
    const image = claims?.image || claims?.picture || claims?.image_url;

    const user = await userService.findOrProvisionUser({
      id: auth.userId,
      email,
      name,
      image,
    });

    c.set("user", user);
    await next();
  });

/**
 * Organization Scope Guard (`tenantGuard`):
 * 1. Resolves active tenant from `x-tenant-id` header or fallback personal org.
 * 2. Verifies the user is actually a member of the requested tenant.
 * 3. Attaches `c.set("tenantId")`, `c.set("orgRole")`, and `c.set("orgMemberships")`.
 */
export const tenantGuard = () =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError(
        "Unauthorized: Identity context required before tenant resolution",
      );
    }

    const requestedTenantId = c.req.header("x-tenant-id");
    const tenantContext = await tenantService.resolveActiveTenant(
      user.id,
      requestedTenantId,
    );

    if (!tenantContext) {
      throw new ForbiddenError(
        "Forbidden: User is not a member of the requested tenant/organization",
      );
    }

    c.set("tenantId", tenantContext.activeTenantId);
    c.set("orgRole", tenantContext.activeRole);
    c.set("orgMemberships", tenantContext.memberships);

    await next();
  });

/**
 * Ensures that `tenantId` is strictly non-null before proceeding.
 */
export const requireTenantGuard = () =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const tenantId = c.get("tenantId");
    if (!tenantId) {
      throw new ForbiddenError(
        "Forbidden: No active organization / tenant found.",
      );
    }
    await next();
  });

/**
 * Namespace access permission check (`can_read` / `can_write`).
 * Owners (`role: owner`) and Admins (`role: admin`) automatically bypass this check.
 */
export const namespaceAuthGuard = (requiredPermission: "read" | "write") =>
  createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const orgRole = c.get("orgRole");

    if (!tenantId || !user || !orgRole) {
      throw new UnauthorizedError("Unauthorized or missing tenant context");
    }

    let namespace = "default";
    const nsParam = c.req.query("namespace") || c.req.param("namespace");
    if (nsParam) {
      namespace = nsParam;
    } else if (c.req.method === "POST" || c.req.method === "PUT") {
      try {
        const clone = c.req.raw.clone();
        const body = await clone.json();
        if (body && typeof body.namespace === "string") {
          namespace = body.namespace;
        }
      } catch {
        // Body is not JSON or has no namespace property
      }
    }

    const hasAccess = await tenantService.hasNamespacePermission(
      tenantId,
      namespace,
      user.id,
      orgRole,
      requiredPermission,
    );

    if (!hasAccess) {
      throw new ForbiddenError(
        `Forbidden: Missing '${requiredPermission}' permission on namespace '${namespace}'`,
      );
    }

    await next();
  });
