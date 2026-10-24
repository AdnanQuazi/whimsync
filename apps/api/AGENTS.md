# Whimsync API — Agent Coding Rules & Conventions (`apps/api`)

Instructions for AI coding agents developing routes, middleware, controllers, and services in `apps/api`.
For architectural rationale, design explanations, and curl examples, see [README.md](./README.md).

---

## 1. Commands (Run from `apps/api/` or Repository Root)

```bash
# Testing (run from apps/api/)
bun test                                              # Run all API tests
bun test src/__tests__/memoryRoutes.test.ts          # Run a single test file
bun test -t "ingestText"                             # Run a specific test by name

# Type Checking & Linting (run from repo root)
bun run typecheck                                     # Verify TypeScript types across workspaces
bun run lint                                          # Lint with Biome
```

---

## 2. File Placement Rules (`src/`)

Place code strictly in its designated directory to maintain clean separation of concerns:

| Directory | Responsibility | What Belongs Here |
|---|---|---|
| `src/routes/` | HTTP Route Definitions | URL routing, middleware mounting, and `validate()` bindings. |
| `src/controllers/` | Request/Response Adapters | Reads `c.req.valid()` via `ValidatedContext`, invokes services, formats responses. |
| `src/services/` | Business & Domain Logic | Pure TypeScript services, DB queries (`db.select/insert`), and MinIO calls. |
| `src/schemas/` | Input Validation | Zod schemas for request payloads, query params, and form uploads. |
| `src/middleware/` | Cross-Cutting Middleware | `clerkAuth`, `authGuard`, `tenantGuard`, `namespaceAuthGuard`, `errorHandler`. |
| `src/types/` | Centralized Type System | `AppVariables`, `ValidatedContext`, session claims, and shared domain DTOs. |
| `src/lib/` | Reusable Utilities | Operational error classes (`errors.ts`), `pgErrorMap.ts`, `validate.ts`. |
| `src/config/` | Configuration & Constants | `constants.ts` (e.g. `FAST_PATH_CHAR_LIMIT`), CORS settings, Clerk config. |

---

## 3. Centralized Type System (`src/types/`)
- **Single Source of Truth:** All Hono context variables (`AppVariables`), session claims, and domain DTOs must live in `apps/api/src/types/`.
- **No Scattered Re-exports:** Never re-export or redefine `AppVariables`, `ValidatedContext`, or domain types inside controllers, services, or middleware. Always import directly (`import type { AppVariables, ValidatedContext } from "../types"`).

---

## 4. Validation & Error Handling Architecture
- **Standardized Route Validation (`lib/validate.ts`):** Never use raw `@hono/zod-validator`. Always use `validate("json" | "param" | "form", Schema)` from `../lib/validate`.
- **Controller Type Binding:** Controllers consuming validated input must type the context with `ValidatedContext<Target, typeof Schema>` and access cleaned data via `c.req.valid(target)`.
- **No Manual Error JSON:** Never return manual `c.json({ error: ... }, status)` for operational failures. Throw typed operational subclasses from `../lib/errors`:
  - `throw new UnauthorizedError(message)` -> `401 UNAUTHORIZED`
  - `throw new ForbiddenError(message)` -> `403 FORBIDDEN`
  - `throw new NotFoundError(resource)` -> `404 NOT_FOUND`
  - `throw new ValidationError(message, details)` -> `400 VALIDATION_ERROR`
  - `throw new ConflictError(message)` -> `409 CONFLICT`
- The global error handler (`middleware/errorHandler.ts`) intercepts exceptions and wraps them in `{ success: false, error: { code, message, details? } }`.

---

## 5. Middleware & Security Guards
Every authenticated route must apply the proper guard chain:
1. `clerkAuth`: Verifies Clerk identity or parses mock test headers (`x-test-clerk-user-id`).
2. `authGuard()`: Verifies user exists in PostgreSQL or atomically provisions the user, personal organization, and `"default"` namespace (`findOrProvisionUser`).
3. `tenantGuard()`: Strictly validates `x-tenant-id` header against user memberships. Sets `tenantId` and `orgRole` in context.
4. `namespaceAuthGuard("read" | "write")`: Checks permissions on the target namespace (bypassed for `owner` and `admin`).

---

## 6. Ingestion Routing Rules (`services/memoryIngestService.ts`)
- **Plain Text <= `FAST_PATH_CHAR_LIMIT`** (defined in `apps/api/src/config/constants.ts`, currently 1500 chars): Write directly to `episodes` (`chunkIndex = 0`) and enqueue to `EPISODE_EXTRACTION_QUEUE`.
- **Plain Text > `FAST_PATH_CHAR_LIMIT`**: Write to `ingestion_records` and enqueue to `CHUNKING_QUEUE`.
- **Uploaded Files:** Compute SHA-256 for deduplication. Upload to MinIO (`uploads/{tenantId}/{namespace}/{ingestionId}/raw.{ext}`).
  - Binary documents (`.pdf`, `.docx`, `.pptx`) -> enqueue to `DOCUMENT_PARSING_QUEUE`.
  - Code & text files -> enqueue directly to `CHUNKING_QUEUE`.
- Always return `202 Accepted` immediately with the `ingestionId`.

---

## 7. Testing Conventions (`__tests__/`)
- Unit and integration tests run with `bun test`.
- Use test headers for authenticated requests:
  - `x-test-clerk-user-id: "test_user_id"`
  - `x-test-clerk-email: "test@whimsync.test"`
  - `x-tenant-id: "<org-uuid>"`
