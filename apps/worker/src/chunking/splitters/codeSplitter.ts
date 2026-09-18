import { chunk as codeChunk } from "code-chunk";
import { CHUNK_SIZE, type ChunkItem } from "../types";
import { splitPlainText } from "./plainTextSplitter";

/**
 * Splits pure code files using AST-aware code-chunk with contextualized signatures.
 * Automatically falls back to plain text splitting if AST parsing fails.
 */
export async function splitPureCode(
  codeText: string,
  language: string,
  maxChunkSize: number = CHUNK_SIZE,
): Promise<ChunkItem[]> {
  console.log(
    `[CodeSplitter] Splitting pure code (${codeText.length} chars) as language '${language}' using code-chunk AST (maxChunkSize=${maxChunkSize})`,
  );
  try {
    const astChunks = await codeChunk(`snippet.${language}`, codeText, {
      // biome-ignore lint/suspicious/noExplicitAny: code-chunk language union cast
      language: language as any,
      maxChunkSize,
      contextMode: "full",
      siblingDetail: "signatures",
    });

    if (!astChunks || astChunks.length === 0) {
      console.log(
        `[CodeSplitter] AST returned 0 chunks; retaining code as single chunk`,
      );
      return [{ text: codeText, headingPath: null }];
    }

    console.log(
      `[CodeSplitter] Successfully generated ${astChunks.length} contextualized AST chunk(s)`,
    );

    return astChunks.map(
      (c: { contextualizedText?: string; text: string }) => ({
        text: c.contextualizedText || c.text,
        headingPath: null,
      }),
    );
  } catch (err) {
    console.warn(
      `[CodeSplitter] AST code-chunk failed for ${language}: ${(err as Error).message}. Falling back to plain text.`,
    );
    return splitPlainText(codeText, maxChunkSize);
  }
}
