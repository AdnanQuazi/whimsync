import {
  type CandidateClaim,
  type CognitiveExtractionResult,
  CognitiveExtractionResultSchema,
} from "@whimsync/core";
import {
  buildCognitiveExtractionPrompt,
  COGNITIVE_EXTRACTION_SYSTEM_INSTRUCTION,
} from "../prompts/prompts";
import { getAiClient } from "./aiClient";

export async function executeStructuredExtraction(
  episodeText: string,
  candidateClaims: CandidateClaim[],
): Promise<CognitiveExtractionResult> {
  const ai = getAiClient();
  const promptText = buildCognitiveExtractionPrompt(
    episodeText,
    candidateClaims,
  );

  const response = await ai.models.generateContent({
    model: process.env.LLM_MODEL as string,
    contents: promptText,
    config: {
      systemInstruction: COGNITIVE_EXTRACTION_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const responseText = response.text;
  if (!responseText) {
    throw new Error("Received empty text response from Gemini API.");
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(responseText);
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini structured output as JSON: ${String(err)}`,
    );
  }

  return CognitiveExtractionResultSchema.parse(rawJson);
}
