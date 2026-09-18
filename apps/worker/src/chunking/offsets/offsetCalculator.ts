import type { ChunkItem } from "../types";

/**
 * Sequential monotonic character offset calculator.
 * Scans forward through sourceText to find chunk boundaries.
 * Guarantees chunkStartOffset and chunkEndOffset never leap backwards.
 */
export function calculateChunkOffsets(
  sourceText: string,
  chunks: ChunkItem[],
): ChunkItem[] {
  let currentSearchIndex = 0;
  let matchedCount = 0;

  const result = chunks.map((chunk) => {
    // 1. Try finding exact chunk text (or CRLF-aligned if sourceText uses \r\n)
    let start = sourceText.indexOf(chunk.text, currentSearchIndex);
    let matchedLength = chunk.text.length;

    if (start === -1 && sourceText.includes("\r\n")) {
      const crlfText = chunk.text.replace(/\r?\n/g, "\r\n");
      start = sourceText.indexOf(crlfText, currentSearchIndex);
      if (start !== -1) {
        matchedLength = crlfText.length;
      }
    }

    // 2. If not found (e.g. AST signature injection or JSON pretty-printing altered indentation),
    // search for first 35 non-whitespace chars
    if (start === -1) {
      const prefix = chunk.text
        .replace(/```[a-zA-Z0-9_-]*\r?\n/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 35);

      if (prefix.length >= 10) {
        start = sourceText.indexOf(prefix, currentSearchIndex);
      }
    }

    if (start !== -1) {
      const end = Math.min(start + matchedLength, sourceText.length);
      currentSearchIndex = start + 1; // Monotonic forward progress
      matchedCount++;
      return {
        ...chunk,
        chunkStartOffset: start,
        chunkEndOffset: end,
      };
    }

    return {
      ...chunk,
      chunkStartOffset: null,
      chunkEndOffset: null,
    };
  });

  if (chunks.length > 0) {
    console.log(
      `[OffsetCalculator] Computed monotonic offsets: ${matchedCount}/${chunks.length} chunks mapped sequentially`,
    );
  }

  return result;
}
