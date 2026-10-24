# Whimsync API Gateway (`@whimsync/api`)

The primary HTTP API layer for Whimsync, built on Hono and running natively on Bun.
For coding standards, file placement rules, and validation conventions, see [AGENTS.md](./AGENTS.md).

---

## 1. Overview & Architecture Rationale

`apps/api` handles authentication, multi-tenant organization provisioning, permission enforcement, and memory/document ingestion routing.

### Why Middleware Runs in this Order
1. **Correlation (`requestId`) First:** Every downstream log, error, and database trace can be tagged with the same correlation ID.
2. **CORS:** Allows browser-based dashboards to communicate with the API without pre-flight blocks.
3. **Identity (`clerkAuth` + `authGuard`) Before Tenancy:** You cannot resolve tenant membership without knowing who the caller is. `authGuard` opportunistically provisions a personal organization on the user's first API call.
4. **Tenant Guard (`tenantGuard`) Before Namespace Guard:** A user must belong to an organization before their permissions on an organization's namespace can be evaluated.
5. **Namespace Guard (`namespaceAuthGuard`):** Enforces default-deny access for members while granting automatic bypass for `owner` and `admin` roles.

### Why Ingestion Routes Split by Size & Type
- **Fast Path (Plain text <= `FAST_PATH_CHAR_LIMIT` / 1500 chars):** Short conversational turns are inserted directly into `episodes` and sent straight to `episode-extraction`, skipping the chunking engine and object storage for minimal latency.
- **Full Path (Plain text > 1500 chars):** Long articles or large conversational contexts require AST/syntax chunking and monotonic offset calculation before extraction.
- **Binary Uploads (.pdf, .docx, .pptx):** Handled via MinIO S3 storage using the Claim Check Pattern, avoiding memory exhaustion on the API server and offloading layout parsing to `apps/extractor`.

---

## 2. Endpoints & Required Headers

### Headers Contract
All authenticated endpoints require an authenticated identity and an explicit organization context:
- `x-tenant-id`: **Required.** The UUID of the organization/tenant being queried or modified.
- **Development/Testing Bypass Headers:**
  - `x-test-clerk-user-id`: Simulates an authenticated user ID without an external Clerk call.
  - `x-test-clerk-email`: Simulates user email.
  - `x-test-clerk-name`: Simulates user display name.

### Ingestion (`/v1/memories`)
- `POST /v1/memories`: Ingests plain text.
  - Body: `{ "text": string, "namespace"?: string, "entityKey"?: string, "sessionId"?: string }`
  - Returns `202 Accepted` with `{ ingestionId, episodeId?, status: "accepted" }`.
- `POST /v1/memories/upload`: Accepts `multipart/form-data` with one or more files in the `file` field.
  - Form fields: `file` (files), `namespace`, `entityKey`, `sessionId`, `tier` (`"fast" | "smart" | "max"`).
  - Returns `202 Accepted` with per-file status (`"processing"` or `"existing"` if deduplicated).

### Organizations (`/v1/orgs`)
- `GET /v1/orgs`: Lists all organizations the authenticated user belongs to.
- `POST /v1/orgs`: Creates a new team organization (`{ "name": string }`).
- `GET /v1/orgs/:id`: Returns metadata for a specific organization if the user is a member.

### Users (`/v1/users`)
- `GET /v1/users/me`: Returns the current user's profile and provisioned identity.

---

## 3. Example Request (Local Development)

```bash
# Ingest a memory claim with dev test headers
curl -X POST http://localhost:3001/v1/memories \
  -H "Content-Type: application/json" \
  -H "x-test-clerk-user-id: dev_user_01" \
  -H "x-test-clerk-email: dev@whimsync.test" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000000" \
  -d '{"text": "Alice is the project lead on Whimsync", "namespace": "default"}'
```

---

## 4. Environment Variables

Create `.env` in the repository root (or copy from `.env.example`):

| Variable | Description | Default (Local / Dev only) |
|---|---|---|
| `PORT` | HTTP server port | `3001` |
| `CLERK_SECRET_KEY` | Clerk secret key for token validation | Required in production |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Required |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://whimsync:whimsync_dev_pass@localhost:5432/whimsync` *(dev only)* |
| `REDIS_URL` | Redis connection string for BullMQ | `redis://localhost:6379` *(dev only)* |
| `MINIO_ENDPOINT` | MinIO host | `localhost` |
| `MINIO_PORT` | MinIO port | `9000` |
| `MINIO_USE_SSL` | MinIO SSL flag | `false` |
| `MINIO_ACCESS_KEY` | MinIO access key | `whimsync` *(dev only)* |
| `MINIO_SECRET_KEY` | MinIO secret key | `whimsync_dev_pass` *(dev only)* |
| `MINIO_BUCKET` | S3 bucket name | `whimsync-cold` |

---

## 5. Development & Testing

```bash
# Run in development mode with hot reload
bun run dev

# Run all API tests
bun test

# Run a specific test file
bun test src/__tests__/memoryRoutes.test.ts
```
