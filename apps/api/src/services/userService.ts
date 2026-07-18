import { db, schema } from "@whimsync/db";
import { eq } from "drizzle-orm";

import type { ClerkUserIdentity, User } from "../types";

export class UserService {
  /**
   * Atomic opportunistic synchronization and provisioning (`findOrProvisionUser`).
   * Guaranteed invariant: Every authenticated Clerk user in WhimSync exists in `users`
   * and has a personal `org` (`owner`), `"default"` namespace, and full permissions.
   */
  async findOrProvisionUser(clerkUser: ClerkUserIdentity): Promise<User> {
    if (!clerkUser.id) {
      throw new Error("Missing Clerk user ID");
    }

    // Fast primary key lookup
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, clerkUser.id))
      .limit(1);

    if (existing) {
      // Opportunistic sync if profile fields have changed
      const needsUpdate =
        (clerkUser.email !== undefined && clerkUser.email !== existing.email) ||
        (clerkUser.name !== undefined && clerkUser.name !== existing.name) ||
        (clerkUser.image !== undefined && clerkUser.image !== existing.image);

      if (needsUpdate) {
        const [updated] = await db
          .update(schema.users)
          .set({
            ...(clerkUser.email !== undefined
              ? { email: clerkUser.email }
              : {}),
            ...(clerkUser.name !== undefined ? { name: clerkUser.name } : {}),
            ...(clerkUser.image !== undefined
              ? { image: clerkUser.image }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, clerkUser.id))
          .returning();
        return updated || existing;
      }

      return existing;
    }

    // Brand new user: Execute atomic transaction with unique constraints handling
    return await db.transaction(async (tx) => {
      // Re-check within transaction for concurrent request safety
      const [txExisting] = await tx
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, clerkUser.id))
        .limit(1);

      if (txExisting) {
        return txExisting;
      }

      const email = clerkUser.email || `${clerkUser.id}@clerk.local`;
      const name = clerkUser.name || "WhimSync User";
      const image = clerkUser.image || null;

      // Insert User
      const [newUser] = await tx
        .insert(schema.users)
        .values({
          id: clerkUser.id,
          email,
          name,
          image,
        })
        .returning();

      // Create Personal Org
      const orgName = clerkUser.name ? `${clerkUser.name}'s Org` : "My Org";
      const [newOrg] = await tx
        .insert(schema.orgs)
        .values({ name: orgName })
        .returning();

      // Create Owner Membership
      await tx.insert(schema.orgMemberships).values({
        orgId: newOrg.id,
        userId: newUser.id,
        role: "owner",
      });

      // Create Default Namespace
      await tx.insert(schema.namespaces).values({
        orgId: newOrg.id,
        name: "default",
      });

      // Grant Namespace Permissions
      await tx.insert(schema.namespacePermissions).values({
        orgId: newOrg.id,
        namespace: "default",
        userId: newUser.id,
        canRead: true,
        canWrite: true,
      });

      return newUser;
    });
  }

  /**
   * Retrieves a user by their Clerk ID.
   */
  async getUserById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user || null;
  }
}

export const userService = new UserService();
