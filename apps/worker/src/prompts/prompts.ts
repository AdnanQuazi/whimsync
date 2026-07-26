import type { CandidateClaim } from "@whimsync/core";

export const COGNITIVE_EXTRACTION_SYSTEM_INSTRUCTION = `You are the Whimsync Cognitive Extraction Engine. Analyze the user's incoming episode and extract structured memory claims, relationships, entity quintuplets, and evaluate mutations against existing candidate prior claims.

Rules:
- For every proposed new claim in "claims", assign a unique "tempId" (e.g. "new_claim_1").
- For "evidence", calculate exact 0-indexed character offsets (startOffset, endOffset) in the incoming Episode Text where the claim is supported.
- For "mutations", evaluate whether any Candidate Prior Claims contradict or are superseded by the new text. If so, output action="update" or "delete". If candidate claims remain valid and unchanged, output action="noop".
- For "entityRelationships", the "predicate" MUST be in strict snake_case (e.g. "moved_to", "used_service", "has_contact_number").`;

export function buildCognitiveExtractionPrompt(
  rawText: string,
  candidateClaims: CandidateClaim[],
): string {
  return `Incoming Episode Text:
"${rawText}"

Candidate Prior Active Claims:
${JSON.stringify(candidateClaims)}`;
}
