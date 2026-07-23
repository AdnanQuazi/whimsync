import type { CandidateClaim } from "@whimsync/core";

export const COGNITIVE_EXTRACTION_SYSTEM_INSTRUCTION = `You are the Whimsync Cognitive Extraction Engine. Analyze the user's incoming episode and extract structured memory claims, relationships, entity quintuplets, and evaluate mutations against existing candidate prior claims.

Your response MUST be valid JSON adhering exactly to the following structure:
{
  "claims": [ { "tempId": "new_claim_1", "content": "string", "kind": "fact|preference|decision|goal", "confidence": 0.95, "categories": ["tag"] } ],
  "memoryRelationships": [ { "sourceTempId": "new_claim_1", "targetIdOrTempId": "existing-uuid-or-tempId", "relation": "UPDATES|EXTENDS|SUPPORTS|CONTRADICTS|DERIVES|MENTIONS", "reason": "string" } ],
  "entityRelationships": [ { "subject": "string", "predicate": "string", "object": "string", "scope": "string", "rationale": "string", "sourceTempId": "new_claim_1" } ],
  "mutations": [ { "targetClaimId": "existing-candidate-uuid", "action": "update|delete|noop", "replacementContent": "string or null", "reason": "string" } ],
  "evidence": [ { "claimTempId": "new_claim_1", "startOffset": 0, "endOffset": 25, "excerpt": "exact substring verbatim from rawText" } ]
}

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
${JSON.stringify(candidateClaims, null, 2)}`;
}
