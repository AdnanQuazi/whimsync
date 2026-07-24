import { db, inArray, schema } from "@whimsync/db";

/**
 * Cleans up test episodes and any associated records created during worker tests.
 */
export async function cleanupWorkerTestEpisodes(
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;

  const claims = await db
    .select({ id: schema.memoryClaims.id })
    .from(schema.memoryClaims)
    .where(inArray(schema.memoryClaims.userId, userIds));

  const entities = await db
    .select({ id: schema.entities.id })
    .from(schema.entities)
    .where(inArray(schema.entities.userId, userIds));

  const vectorEntityIds = [
    ...claims.map((c) => c.id),
    ...entities.map((e) => e.id),
  ];

  if (vectorEntityIds.length > 0) {
    await db
      .delete(schema.vectors)
      .where(inArray(schema.vectors.entityId, vectorEntityIds));
  }

  await db
    .delete(schema.episodes)
    .where(inArray(schema.episodes.userId, userIds));

  await db
    .delete(schema.memoryClaims)
    .where(inArray(schema.memoryClaims.userId, userIds));

  await db
    .delete(schema.entities)
    .where(inArray(schema.entities.userId, userIds));
}
