---
name: whimsync-backend-patterns
description: Core backend development patterns, rules, and code snippets for Whimsync Hono API (apps/api), including authentication, tenant resolution, error handling, Zod validation, and centralized TypeScript typing. Trigger when building routes, controllers, middleware, or services.
---

# Whimsync Backend API Development Patterns (`apps/api`)

When developing endpoints, controllers, services, or middleware in `apps/api`, you MUST follow the architectural patterns and design contracts described below.

## 1. Centralized Type System (`apps/api/src/types/`)
All shared application types, Hono context variables (`AppVariables`), session claims, and domain DTOs are defined centrally in `apps/api/src/types/`.
**Rule:** Never define or re-export `AppVariables` or entity types in service, middleware, or route files. Always import directly from `../types`.

```typescript
import type { AppVariables, User } from "../types";
import type { Context } from "hono";

// Typed Hono context
type AppContext = Context<{ Variables: AppVariables }>;
```

## 2. Layered Authentication & Scope Guards (`middleware/`)
Every authenticated route mounts `clerkAuth` (identity extraction) followed by our domain guards:
1. `authGuard()`: Auto-provisions `users`, personal `org`, and `"default"` namespace on first login (`findOrProvisionUser`), attaching `c.set("user", user)`.
2. `tenantGuard()`: Resolves active tenant from `x-tenant-id` request header (or fallback personal org), verifying membership in Postgres and setting `c.set("tenantId")`, `c.set("orgRole")`, and `c.set("orgMemberships")`.
3. `requireTenantGuard()`: Rejects requests if `tenantId` is null.
4. `namespaceAuthGuard("read" | "write")`: Checks access permissions for non-owners/admins (`namespace_permissions`).

### Route Setup Example:
```typescript
import { Hono } from "hono";
import { authGuard, tenantGuard } from "../middleware/authMiddleware";
import { clerkAuth } from "../middleware/clerkAuth";
import type { AppVariables } from "../types";

const router = new Hono<{ Variables: AppVariables }>();

// Apply identity and tenant scope guards across all routes in this module
router.use("*", clerkAuth, authGuard(), tenantGuard());
```

## 3. Standardized Validation & Error Handling
Never return manual `c.json({ error: ... }, status)` responses. Our global error handler (`errorHandler` mounted via `app.onError(errorHandler)`) catches all thrown exceptions and formats them into the standard envelope:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "Human readable summary",
    "details": [] // Optional field-level details
  }
}
```

### Route Request Validation (`lib/validate.ts`)
Instead of raw `@hono/zod-validator` (`zValidator`), use `validate(target, schema)` from `../lib/validate`. It intercepts Zod errors and outputs the exact `VALIDATION_ERROR` envelope automatically.
```typescript
import { validate } from "../lib/validate";
import { CreateOrgSchema } from "../schemas/org";

router.post("/", validate("json", CreateOrgSchema), (c) => controller.createOrg(c));
```

### Operational Errors inside Controllers & Services (`lib/errors.ts`)
Throw typed operational errors when business rules fail:
```typescript
import { NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError } from "../lib/errors";

export class MyController {
  async getResource(c: Context<{ Variables: AppVariables }>) {
    const user = c.get("user");
    if (!user) throw new UnauthorizedError();

    const resource = await myService.findById(c.req.param("id"));
    if (!resource) throw new NotFoundError("Resource");

    return c.json(resource, 200);
  }
}
```

## 4. Integration Testing with Clerk Bypass (`__tests__/`)
During local `bun test` execution (`NODE_ENV === "test"` and no `CLERK_SECRET_KEY`), `clerkAuth` supports test headers to bypass external Clerk JWKS calls while testing real Postgres auto-provisioning and database operations:
- `x-test-clerk-user-id`: Sets synthetic Clerk user ID.
- `x-test-clerk-name`: Sets user name.
- `x-test-clerk-email`: Sets user email address.
- `x-tenant-id`: Switches active target organization.

```typescript
const res = await app.request("/v1/orgs", {
  method: "GET",
  headers: {
    "x-test-clerk-user-id": "test-clerk-id-123",
  },
});
expect(res.status).toBe(200);
```
