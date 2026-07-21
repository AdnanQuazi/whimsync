import { db, schema } from "@whimsync/db";
import { inArray, like, or } from "drizzle-orm";

/**
 * Cleans up organizations, namespaces, namespace permissions, memberships, and user records
 * associated with the provided user IDs.
 */
export async function cleanupUsersAndOrgs(userIds: string[]) {
  if (userIds.length === 0) return;

  const memberships = await db
    .select({ orgId: schema.orgMemberships.orgId })
    .from(schema.orgMemberships)
    .where(inArray(schema.orgMemberships.userId, userIds));

  const orgIds = Array.from(new Set(memberships.map((m) => m.orgId)));

  if (orgIds.length > 0) {
    await db
      .delete(schema.namespacePermissions)
      .where(inArray(schema.namespacePermissions.orgId, orgIds));
    await db
      .delete(schema.namespaces)
      .where(inArray(schema.namespaces.orgId, orgIds));
    await db
      .delete(schema.orgMemberships)
      .where(inArray(schema.orgMemberships.orgId, orgIds));
    await db.delete(schema.orgs).where(inArray(schema.orgs.id, orgIds));
  }

  await db
    .delete(schema.episodes)
    .where(inArray(schema.episodes.userId, userIds));
  await db
    .delete(schema.namespacePermissions)
    .where(inArray(schema.namespacePermissions.userId, userIds));
  await db
    .delete(schema.orgMemberships)
    .where(inArray(schema.orgMemberships.userId, userIds));
  await db.delete(schema.users).where(inArray(schema.users.id, userIds));
}

/**
 * Cleans up any orphaned test users/orgs from prior test runs matching common test ID prefixes.
 */
export async function cleanupStaleTestRows() {
  const staleUsers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      or(
        like(schema.users.id, "route-test-user-%"),
        like(schema.users.id, "clerk-test-user-%"),
        like(schema.users.id, "clerk-member-user-%"),
        like(schema.users.id, "memory-test-user-%"),
      ),
    );
  const staleIds = staleUsers.map((u) => u.id);
  if (staleIds.length > 0) {
    await cleanupUsersAndOrgs(staleIds);
  }
}
