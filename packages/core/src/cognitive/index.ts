import { z } from "zod";

/**
 * Candidate claim passed to the LLM during candidate retrieval (`extractEpisodeClaims`).
 */
export interface CandidateClaim {
  id: string;
  content: string;
  kind: string;
  recordedAt: Date;
}

/**
 * Zod schema for proposed new claims extracted from an episode.
 */
export const ProposedClaimSchema = z.object({
  tempId: z
    .string()
    .describe(
      "A temporary unique ID (e.g., 'claim_1') used inside this extraction result to reference this new claim before insertion.",
    ),
  content: z
    .string()
    .describe(
      "The concise, self-contained factual memory claim extracted from the episode.",
    ),
  kind: z
    .string()
    .describe(
      "The classification of this claim: 'fact', 'preference', 'decision', 'goal', or 'other'.",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence score between 0.0 and 1.0 supporting this extraction.",
    ),
  categories: z
    .array(z.string())
    .describe("List of high-level categories/tags relevant to this claim."),
});
export type ProposedClaim = z.infer<typeof ProposedClaimSchema>;

/**
 * Zod schema for proposed relationships (`memory_relationships`) linking memory claims.
 */
export const ProposedMemoryRelationshipSchema = z.object({
  sourceTempId: z
    .string()
    .describe("The tempId of the newly proposed claim acting as the source."),
  targetIdOrTempId: z
    .string()
    .describe(
      "The UUID (`targetClaimId`) of an existing candidate claim or the `tempId` of another newly proposed claim acting as the target.",
    ),
  relation: z
    .enum([
      "UPDATES",
      "EXTENDS",
      "SUPPORTS",
      "CONTRADICTS",
      "DERIVES",
      "MENTIONS",
    ])
    .describe("The semantic relationship from source to target."),
  reason: z
    .string()
    .describe("Brief justification explaining why this relationship exists."),
});
export type ProposedMemoryRelationship = z.infer<
  typeof ProposedMemoryRelationshipSchema
>;

/**
 * Zod schema for proposed entity quintuplets (`entity_relationships`).
 */
export const ProposedEntityRelationshipSchema = z.object({
  subject: z
    .string()
    .describe(
      "Canonical name of the subject entity (e.g., 'User', 'Bun', 'San Francisco').",
    ),
  predicate: z
    .string()
    .describe(
      "The action or relationship predicate connecting subject to object (e.g., 'uses', 'moved_to', 'likes').",
    ),
  object: z
    .string()
    .describe(
      "The object entity name or literal string (e.g., 'TypeScript', '2026').",
    ),
  scope: z
    .string()
    .describe(
      "The domain or scope where this relationship is valid (e.g., 'engineering', 'personal').",
    ),
  rationale: z
    .string()
    .describe("Why this quintuplet was extracted from the text."),
  sourceTempId: z
    .string()
    .describe(
      "The tempId of the newly proposed claim from which this quintuplet was derived.",
    ),
});
export type ProposedEntityRelationship = z.infer<
  typeof ProposedEntityRelationshipSchema
>;

/**
 * Zod schema for proposed mutations against existing candidate claims (`mutations`).
 */
export const ProposedMutationSchema = z.object({
  targetClaimId: z
    .string()
    .describe(
      "The database UUID of the existing candidate claim from the prompt.",
    ),
  action: z
    .enum(["update", "delete", "noop"])
    .describe("The mutation action to perform against targetClaimId."),
  replacementContent: z
    .string()
    .nullable()
    .optional()
    .describe(
      "If action is 'update', the new updated text content for the replacement claim.",
    ),
  reason: z
    .string()
    .describe(
      "Justification for why this candidate claim should be updated, deleted, or left unchanged.",
    ),
});
export type ProposedMutation = z.infer<typeof ProposedMutationSchema>;

/**
 * Zod schema for evidence character offset ranges into the raw episode text (`evidence`).
 */
export const ProposedEvidenceSchema = z.object({
  claimTempId: z
    .string()
    .describe(
      "The tempId of the newly proposed claim that this excerpt supports.",
    ),
  startOffset: z
    .number()
    .int()
    .min(0)
    .describe("0-indexed start character offset in the episode rawText."),
  endOffset: z
    .number()
    .int()
    .min(0)
    .describe(
      "0-indexed end character offset (exclusive) in the episode rawText.",
    ),
  excerpt: z
    .string()
    .describe(
      "The exact substring verbatim from rawText between startOffset and endOffset.",
    ),
});
export type ProposedEvidence = z.infer<typeof ProposedEvidenceSchema>;

/**
 * Master Zod schema representing the single structured response from `gemini-2.5-flash`.
 */
export const CognitiveExtractionResultSchema = z.object({
  claims: z
    .array(ProposedClaimSchema)
    .describe("List of newly proposed memory claims."),
  memoryRelationships: z
    .array(ProposedMemoryRelationshipSchema)
    .describe("List of relationship edges between claims."),
  entityRelationships: z
    .array(ProposedEntityRelationshipSchema)
    .describe("List of entity quintuplets extracted from the episode."),
  mutations: z
    .array(ProposedMutationSchema)
    .describe("List of evaluated mutations against existing candidate claims."),
  evidence: z
    .array(ProposedEvidenceSchema)
    .describe("List of character offset evidence citations into rawText."),
});
export type CognitiveExtractionResult = z.infer<
  typeof CognitiveExtractionResultSchema
>;

/**
 * Represents a newly extracted claim that has been durably inserted into `memory_claims`
 * (`status = 'pending_review'`) along with its generated embedding and database UUID.
 */
export interface ExtractedClaimWithEmbedding {
  id: string; // Database UUID assigned upon insertion into `memory_claims` (pending_review)
  tempId: string; // Temporary ID proposed by the LLM (`claim_1`)
  content: string;
  kind: string;
  confidence: number;
  categories: string[];
  contentHash: string;
  embedding: number[]; // 768-dim vector embedding (`text-embedding-004`)
}

/**
 * Complete, typed handoff payload produced by Step 6 (`extractEpisodeClaims`) and consumed by
 * Step 7 (`evaluateAndApplyMutations`) inside `apps/worker`.
 */
export interface CognitiveExtractionPayload {
  episodeId: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey: string | null;
  sessionId: string | null;
  rawText: string;
  candidateClaims: CandidateClaim[];
  extractedClaims: ExtractedClaimWithEmbedding[];
  memoryRelationships: ProposedMemoryRelationship[];
  entityRelationships: ProposedEntityRelationship[];
  mutations: ProposedMutation[];
  evidence: ProposedEvidence[];
}
