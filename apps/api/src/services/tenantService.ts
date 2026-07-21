import { db, schema } from "@whimsync/db";
import { and, eq } from "drizzle-orm";

import type { OrgMembershipSummary, OrgWithRole } from "../types";

export class TenantService {
  /**
   * Verifies that the user is a member of the requested organization (`tenantId`),
   * querying directly at the database level using indexed columns (`userId`, `orgId`).
   */
  async verifyTenantMembership(
    userId: string,
    tenantId?: string | null,
  ): Promise<OrgMembershipSummary | null> {
    if (!tenantId) {
      return null;
    }

    const [membership] = await db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.orgId, tenantId),
        ),
      )
      .limit(1);

    if (!membership) {
      return null;
    }

    return {
      orgId: membership.orgId,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  }

  /**
   * Returns all organization memberships joined with organization metadata for a given user.
   */
  async getUserOrgs(userId: string): Promise<OrgWithRole[]> {
    const rows = await db
      .select({
        org: schema.orgs,
        membership: schema.orgMemberships,
      })
      .from(schema.orgMemberships)
      .innerJoin(schema.orgs, eq(schema.orgMemberships.orgId, schema.orgs.id))
      .where(eq(schema.orgMemberships.userId, userId));

    return rows.map(({ org, membership }) => ({
      id: org.id,
      name: org.name,
      role: membership.role,
      createdAt: org.createdAt,
      joinedAt: membership.joinedAt,
    }));
  }

  /**
   * Returns a specific organization by ID if the user is a member.
   */
  async getOrgById(userId: string, orgId: string): Promise<OrgWithRole | null> {
    const rows = await db
      .select({
        org: schema.orgs,
        membership: schema.orgMemberships,
      })
      .from(schema.orgMemberships)
      .innerJoin(schema.orgs, eq(schema.orgMemberships.orgId, schema.orgs.id))
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.orgId, orgId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const { org, membership } = rows[0];
    return {
      id: org.id,
      name: org.name,
      role: membership.role,
      createdAt: org.createdAt,
      joinedAt: membership.joinedAt,
    };
  }

  /**
   * Creates a new team organization, assigns the user as `owner`, and initializes the `default` namespace.
   */
  async createOrg(userId: string, name: string): Promise<OrgWithRole> {
    return await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(schema.orgs)
        .values({ name })
        .returning();

      const [newMembership] = await tx
        .insert(schema.orgMemberships)
        .values({
          orgId: newOrg.id,
          userId,
          role: "owner",
        })
        .returning();

      await tx.insert(schema.namespaces).values({
        orgId: newOrg.id,
        name: "default",
      });

      await tx.insert(schema.namespacePermissions).values({
        orgId: newOrg.id,
        namespace: "default",
        userId,
        canRead: true,
        canWrite: true,
      });

      return {
        id: newOrg.id,
        name: newOrg.name,
        role: newMembership.role,
        createdAt: newOrg.createdAt,
        joinedAt: newMembership.joinedAt,
      };
    });
  }

  /**
   * Checks namespace access (`can_read` / `can_write`).
   * Owners and Admins bypass explicit permission rows. Members require explicit grant.
   */
  async hasNamespacePermission(
    orgId: string,
    namespace: string,
    userId: string,
    role: string,
    requiredPermission: "read" | "write",
  ): Promise<boolean> {
    if (role === "owner" || role === "admin") {
      return true;
    }

    const [perm] = await db
      .select()
      .from(schema.namespacePermissions)
      .where(
        and(
          eq(schema.namespacePermissions.orgId, orgId),
          eq(schema.namespacePermissions.namespace, namespace),
          eq(schema.namespacePermissions.userId, userId),
        ),
      )
      .limit(1);

    if (!perm) {
      return false;
    }

    return requiredPermission === "read" ? perm.canRead : perm.canWrite;
  }
}

export const tenantService = new TenantService();
