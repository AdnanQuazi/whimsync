import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHUNK_SIZE, type ChunkItem } from "../types";

/**
 * Splits plain text using LangChain's RecursiveCharacterTextSplitter.
 */
export async function splitPlainText(
  text: string,
  maxChunkSize: number = CHUNK_SIZE,
  chunkOverlap: number = 100,
): Promise<ChunkItem[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: maxChunkSize,
    chunkOverlap,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => ({
    text: doc.pageContent,
    headingPath: null,
  }));
}
