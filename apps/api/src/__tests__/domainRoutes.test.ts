import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { app } from "../index";
import { cleanupStaleTestRows, cleanupUsersAndOrgs } from "./testUtils";

const testClerkId = `route-test-user-${crypto.randomUUID()}`;

describe("Domain Routes HTTP Integration Tests (`/v1/users` & `/v1/orgs`)", () => {
  beforeAll(async () => {
    await cleanupStaleTestRows();
    await cleanupUsersAndOrgs([testClerkId]);
  });

  afterAll(async () => {
    await cleanupUsersAndOrgs([testClerkId]);
  });

  test("GET /v1/users/me without auth token/header should return 401 Unauthorized", async () => {
    const res = await app.request("/v1/users/me", {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  test("GET /v1/users/me with test Clerk identity should auto-provision user and return pure identity", async () => {
    const res = await app.request("/v1/users/me", {
      method: "GET",
      headers: {
        "x-test-clerk-user-id": testClerkId,
        "x-test-clerk-name": "Route Test User",
        "x-test-clerk-email": `route-${testClerkId}@whimsync.test`,
      },
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(json.id).toBe(testClerkId);
    expect(json.name).toBe("Route Test User");
    expect(json.email).toBe(`route-${testClerkId}@whimsync.test`);
  });

  test("GET /v1/orgs should return user's memberships including auto-provisioned personal org", async () => {
    const res = await app.request("/v1/orgs", {
      method: "GET",
      headers: {
        "x-test-clerk-user-id": testClerkId,
      },
    });

    expect(res.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThanOrEqual(1);
    expect(json[0].name).toBe("Route Test User's Org");
    expect(json[0].role).toBe("owner");
  });

  test("POST /v1/orgs should create additional team org and assign creator as owner", async () => {
    const res = await app.request("/v1/orgs", {
      method: "POST",
      headers: {
        "x-test-clerk-user-id": testClerkId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "New Team Org" }),
    });

    expect(res.status).toBe(201);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const json = (await res.json()) as any;
    expect(json.name).toBe("New Team Org");
    expect(json.role).toBe("owner");

    // Verify retrieval by ID
    const getRes = await app.request(`/v1/orgs/${json.id}`, {
      method: "GET",
      headers: {
        "x-test-clerk-user-id": testClerkId,
      },
    });
    expect(getRes.status).toBe(200);
    // biome-ignore lint/suspicious/noExplicitAny: Test JSON payload inspection
    const getJson = (await getRes.json()) as any;
    expect(getJson.id).toBe(json.id);
  });
});
