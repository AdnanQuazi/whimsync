import crypto from "node:crypto";
import type { CognitiveExtractionPayload } from "@whimsync/core";
import { and, db, eq, schema } from "@whimsync/db";
import { generateTextEmbedding } from "../services/embeddingService";

/**
 * Mutation Evaluation & Atomic Status Transition
 *
 * Executes a single atomic database transaction applying proposed mutations against candidate claims,
 * deduplicating new claims against existing active claims by `contentHash`, atomically flipping
 * `pending_review` claims to `active` (and superseded claims to `superseded`), and linking
 * `evidence`, `memory_relationships`, and `entity_relationships`.
 */
export async function evaluateAndApplyMutations(
  payload: CognitiveExtractionPayload,
): Promise<void> {
  // Map linking `tempId` proposed by LLM to the actual Postgres UUID (`memory_claims.id`)
  const tempIdToUUID = new Map<string, string>();
  for (const claim of payload.extractedClaims) {
    tempIdToUUID.set(claim.tempId, claim.id);
  }

  // Also pre-seed known candidate claims so edges between old and new resolve cleanly
  for (const candidate of payload.candidateClaims) {
    tempIdToUUID.set(candidate.id, candidate.id);
  }

  await db.transaction(async (tx) => {
    // 1. Evaluate & Apply Mutations against candidate prior claims
    for (const mutation of payload.mutations) {
      if (mutation.action === "noop") {
        continue;
      }

      if (mutation.action === "delete") {
        // Flip status from 'active' -> 'superseded' to preserve historical audit trail
        await tx
          .update(schema.memoryClaims)
          .set({
            status: "superseded",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.memoryClaims.id, mutation.targetClaimId),
              eq(schema.memoryClaims.tenantId, payload.tenantId),
            ),
          );
      } else if (mutation.action === "update") {
        // Flip old claim to 'superseded'
        await tx
          .update(schema.memoryClaims)
          .set({
            status: "superseded",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.memoryClaims.id, mutation.targetClaimId),
              eq(schema.memoryClaims.tenantId, payload.tenantId),
            ),
          );

        // If replacementContent is specified, check if it's already in our extracted claims or needs insertion
        if (mutation.replacementContent) {
          const replacementText = mutation.replacementContent.trim();
          const replacementHash = crypto
            .createHash("sha256")
            .update(replacementText.toLowerCase())
            .digest("hex");

          // Check if one of our newly extracted claims matches this replacement
          let replacementClaimUUID = payload.extractedClaims.find(
            (c) => c.contentHash === replacementHash,
          )?.id;

          if (!replacementClaimUUID) {
            // Insert replacement active claim right away inside transaction
            replacementClaimUUID = crypto.randomUUID();
            const embedding = await generateTextEmbedding(replacementText);

            await tx.insert(schema.memoryClaims).values({
              id: replacementClaimUUID,
              tenantId: payload.tenantId,
              namespace: payload.namespace,
              userId: payload.userId,
              entityKey: payload.entityKey ?? null,
              sessionId: payload.sessionId ?? null,
              content: replacementText,
              kind: "fact",
              status: "active",
              confidence: 1.0,
              categories: [],
              contentHash: replacementHash,
              metadata: { updateReason: mutation.reason },
              occurredAt: new Date(),
            });

            await tx.insert(schema.vectors).values({
              entityType: "memory_claim",
              entityId: replacementClaimUUID,
              embedding,
            });
          }

          // Link UPDATES relationship (`replacementClaim -> targetClaim`)
          await tx.insert(schema.memoryRelationships).values({
            sourceClaimId: replacementClaimUUID,
            targetClaimId: mutation.targetClaimId,
            relation: "UPDATES",
            confidence: 1.0,
            reason: mutation.reason,
            tenantId: payload.tenantId,
            namespace: payload.namespace,
            validAt: new Date(),
          });
        }
      }
    }

    // 2. Deduplicate and flip new claims (`pending_review` -> `active`)
    for (const extracted of payload.extractedClaims) {
      // Check if an active claim already exists with identical contentHash
      const [existingActive] = await tx
        .select({ id: schema.memoryClaims.id })
        .from(schema.memoryClaims)
        .where(
          and(
            eq(schema.memoryClaims.tenantId, payload.tenantId),
            eq(schema.memoryClaims.namespace, payload.namespace),
            eq(schema.memoryClaims.userId, payload.userId),
            eq(schema.memoryClaims.contentHash, extracted.contentHash),
            eq(schema.memoryClaims.status, "active"),
          ),
        )
        .limit(1);

      if (existingActive) {
        // Redirect tempId map to existing active claim ID
        tempIdToUUID.set(extracted.tempId, existingActive.id);

        // Purge duplicate `pending_review` row & vector
        await tx
          .delete(schema.vectors)
          .where(
            and(
              eq(schema.vectors.entityId, extracted.id),
              eq(schema.vectors.entityType, "memory_claim"),
            ),
          );
        await tx
          .delete(schema.memoryClaims)
          .where(eq(schema.memoryClaims.id, extracted.id));
      } else {
        // Atomically transition status from `pending_review` -> `active`
        await tx
          .update(schema.memoryClaims)
          .set({
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(schema.memoryClaims.id, extracted.id));
      }
    }

    // 3. Insert Evidence offset citations linking active claims to the raw episode
    const evidenceToInsert = [];
    for (const ev of payload.evidence) {
      const targetUUID = tempIdToUUID.get(ev.claimTempId);
      if (targetUUID) {
        evidenceToInsert.push({
          claimId: targetUUID,
          episodeId: payload.episodeId,
          startOffset: ev.startOffset,
          endOffset: ev.endOffset,
          excerpt: ev.excerpt,
          confidence: 1.0,
        });
      }
    }
    if (evidenceToInsert.length > 0) {
      await tx.insert(schema.evidence).values(evidenceToInsert);
    }

    // 4. Insert memory_relationships edges between active claims
    const relsToInsert = [];
    for (const rel of payload.memoryRelationships) {
      const sourceUUID = tempIdToUUID.get(rel.sourceTempId);
      const targetUUID =
        tempIdToUUID.get(rel.targetIdOrTempId) ?? rel.targetIdOrTempId;

      if (sourceUUID && targetUUID) {
        relsToInsert.push({
          sourceClaimId: sourceUUID,
          targetClaimId: targetUUID,
          relation: rel.relation,
          confidence: 1.0,
          reason: rel.reason,
          tenantId: payload.tenantId,
          namespace: payload.namespace,
          validAt: new Date(),
        });
      }
    }
    if (relsToInsert.length > 0) {
      await tx.insert(schema.memoryRelationships).values(relsToInsert);
    }

    // 5. Insert entity_relationships quintuplets
    for (const er of payload.entityRelationships) {
      const sourceUUID = tempIdToUUID.get(er.sourceTempId);
      if (!sourceUUID) {
        continue;
      }

      // Upsert subject entity record
      const [subjectRecord] = await tx
        .insert(schema.entities)
        .values({
          canonicalName: er.subject,
          type: "concept",
          aliases: [],
          userId: payload.userId,
          tenantId: payload.tenantId,
          namespace: payload.namespace,
        })
        .onConflictDoNothing({
          target: [
            schema.entities.tenantId,
            schema.entities.namespace,
            schema.entities.canonicalName,
          ],
        })
        .returning({ id: schema.entities.id });

      let subjectId = subjectRecord?.id;
      if (!subjectId) {
        const [existing] = await tx
          .select({ id: schema.entities.id })
          .from(schema.entities)
          .where(
            and(
              eq(schema.entities.canonicalName, er.subject),
              eq(schema.entities.tenantId, payload.tenantId),
              eq(schema.entities.namespace, payload.namespace),
            ),
          )
          .limit(1);
        if (existing?.id) {
          subjectId = existing.id;
        } else {
          subjectId = crypto.randomUUID();
          await tx.insert(schema.entities).values({
            id: subjectId,
            canonicalName: er.subject,
            type: "concept",
            aliases: [],
            userId: payload.userId,
            tenantId: payload.tenantId,
            namespace: payload.namespace,
          });
        }
      }

      await tx.insert(schema.entityRelationships).values({
        subjectEntityId: subjectId,
        predicate: er.predicate,
        objectEntityId: null,
        objectLiteral: er.object,
        scope: er.scope,
        rationale: er.rationale,
        sourceClaimId: sourceUUID,
        confidence: 1.0,
        validAt: new Date(),
      });
    }
  });

  console.log(
    `[MutationEngine] Successfully committed atomic transaction for episode ${payload.episodeId}.`,
  );
}
