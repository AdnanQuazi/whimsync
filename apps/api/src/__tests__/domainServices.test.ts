import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, schema } from "@whimsync/db";
import { eq } from "drizzle-orm";
import { tenantService } from "../services/tenantService";
import { userService } from "../services/userService";

const testClerkId = `clerk-test-user-${crypto.randomUUID()}`;
const testMemberClerkId = `clerk-member-user-${crypto.randomUUID()}`;

describe("UserService & TenantService Domain Integration Tests", () => {
  beforeAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, testClerkId));
    await db.delete(schema.users).where(eq(schema.users.id, testMemberClerkId));
  });

  afterAll(async () => {
    await db
      .delete(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, testClerkId));
    await db
      .delete(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, testMemberClerkId));
    await db.delete(schema.users).where(eq(schema.users.id, testClerkId));
    await db.delete(schema.users).where(eq(schema.users.id, testMemberClerkId));
  });

  test("findOrProvisionUser should auto-provision brand-new user, personal org, owner membership, and default namespace", async () => {
    const user = await userService.findOrProvisionUser({
      id: testClerkId,
      name: "Domain Test User",
      email: `domain-${testClerkId}@whimsync.test`,
      image: "https://avatar.test/1.png",
    });

    expect(user.id).toBe(testClerkId);
    expect(user.name).toBe("Domain Test User");

    const orgs = await tenantService.getUserOrgs(testClerkId);
    expect(orgs.length).toBeGreaterThanOrEqual(1);
    expect(orgs[0].name).toBe("Domain Test User's Org");
    expect(orgs[0].role).toBe("owner");

    // Check default namespace created
    const [ns] = await db
      .select()
      .from(schema.namespaces)
      .where(eq(schema.namespaces.orgId, orgs[0].id));
    expect(ns.name).toBe("default");
  });

  test("findOrProvisionUser should opportunistically sync profile fields if changed", async () => {
    const updated = await userService.findOrProvisionUser({
      id: testClerkId,
      name: "Updated Domain Name",
      email: `domain-${testClerkId}@whimsync.test`,
      image: "https://avatar.test/new.png",
    });

    expect(updated.name).toBe("Updated Domain Name");
    expect(updated.image).toBe("https://avatar.test/new.png");
  });

  test("resolveActiveTenant should verify membership when x-tenant-id requested, or fallback to personal org", async () => {
    const orgs = await tenantService.getUserOrgs(testClerkId);
    const personalOrgId = orgs[0].id;

    // Fallback without requestedTenantId
    const fallbackContext =
      await tenantService.resolveActiveTenant(testClerkId);
    expect(fallbackContext?.activeTenantId).toBe(personalOrgId);
    expect(fallbackContext?.activeRole).toBe("owner");

    // Explicit valid requestedTenantId
    const explicitContext = await tenantService.resolveActiveTenant(
      testClerkId,
      personalOrgId,
    );
    expect(explicitContext?.activeTenantId).toBe(personalOrgId);

    // Explicit invalid requestedTenantId (not a member)
    const invalidContext = await tenantService.resolveActiveTenant(
      testClerkId,
      crypto.randomUUID(),
    );
    expect(invalidContext).toBeNull();
  });

  test("hasNamespacePermission should allow owner bypass and enforce explicit grants for members", async () => {
    const orgs = await tenantService.getUserOrgs(testClerkId);
    const orgId = orgs[0].id;

    // Owner should bypass
    const ownerCanWrite = await tenantService.hasNamespacePermission(
      orgId,
      "default",
      testClerkId,
      "owner",
      "write",
    );
    expect(ownerCanWrite).toBe(true);

    // Provision member
    await userService.findOrProvisionUser({
      id: testMemberClerkId,
      name: "Member User",
      email: `member-${testMemberClerkId}@whimsync.test`,
    });

    await db.insert(schema.orgMemberships).values({
      orgId,
      userId: testMemberClerkId,
      role: "member",
    });

    await db.insert(schema.namespacePermissions).values({
      orgId,
      namespace: "default",
      userId: testMemberClerkId,
      canRead: true,
      canWrite: false,
    });

    const memberCanRead = await tenantService.hasNamespacePermission(
      orgId,
      "default",
      testMemberClerkId,
      "member",
      "read",
    );
    expect(memberCanRead).toBe(true);

    const memberCanWrite = await tenantService.hasNamespacePermission(
      orgId,
      "default",
      testMemberClerkId,
      "member",
      "write",
    );
    expect(memberCanWrite).toBe(false);
  });
});
