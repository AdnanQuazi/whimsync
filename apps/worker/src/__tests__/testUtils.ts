import { db, inArray, schema } from "@whimsync/db";

/**
 * Cleans up test episodes and any associated records created during worker tests.
 */
export async function cleanupWorkerTestEpisodes(
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  await db
    .delete(schema.episodes)
    .where(inArray(schema.episodes.userId, userIds));
}
