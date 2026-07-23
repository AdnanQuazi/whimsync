import { getAiClient } from "./aiClient";

async function executeEmbedContent(contents: string | string[]) {
  const ai = getAiClient();
  return ai.models.embedContent({
    model: process.env.EMBEDDING_MODEL as string,
    contents,
    config: {
      outputDimensionality: 768,
    },
  });
}

export async function generateTextEmbedding(text: string): Promise<number[]> {
  const response = await executeEmbedContent(text);

  // @ts-expect-error Compatibility with different versions of @google/genai EmbedContentResponse
  const values = response.embedding?.values || response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Failed to generate embedding vector from Gemini API.");
  }
  return values;
}

export async function generateTextEmbeddingsBatch(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings = await Promise.all(
    texts.map((text) => generateTextEmbedding(text)),
  );

  return embeddings;
}
