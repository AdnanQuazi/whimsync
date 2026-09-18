import { CHUNK_SIZE, type ChunkItem } from "../types";
import { splitPlainText } from "./plainTextSplitter";

/**
 * Hierarchical JSON splitter:
 * - Guarantees all emitted chunks are valid serialized JSON.
 * - Measures serialized size (JSON.stringify().length).
 * - Bundles sibling keys up to maxChunkSize.
 * - For deeply nested structures exceeding maxChunkSize, recurses while retaining parent key path
 *   so that nested context is preserved for LLM retrieval.
 */
export class RecursiveJsonSplitter {
  private maxChunkSize: number;

  constructor(maxChunkSize: number = CHUNK_SIZE) {
    this.maxChunkSize = maxChunkSize;
  }

  private jsonSize(obj: unknown): number {
    try {
      return JSON.stringify(obj).length;
    } catch {
      return 0;
    }
  }

  splitJson(data: unknown): string[] {
    if (this.jsonSize(data) <= this.maxChunkSize) {
      return [JSON.stringify(data, null, 2)];
    }

    const chunks: unknown[] = [];
    this.splitRecursive(data, [], chunks);

    if (chunks.length === 0) {
      return [JSON.stringify(data, null, 2)];
    }

    return chunks.map((c) => JSON.stringify(c, null, 2));
  }

  private splitRecursive(
    data: unknown,
    path: string[],
    results: unknown[],
  ): void {
    if (typeof data !== "object" || data === null) {
      this.addResult(results, path, data);
      return;
    }

    if (Array.isArray(data)) {
      let currentBatch: unknown[] = [];

      for (const item of data) {
        const candidate = [...currentBatch, item];
        if (this.jsonSize(candidate) <= this.maxChunkSize) {
          currentBatch.push(item);
        } else {
          if (currentBatch.length > 0) {
            this.addResult(results, path, currentBatch);
            currentBatch = [];
          }
          if (
            this.jsonSize(item) > this.maxChunkSize &&
            typeof item === "object"
          ) {
            this.splitRecursive(item, path, results);
          } else {
            currentBatch.push(item);
          }
        }
      }

      if (currentBatch.length > 0) {
        this.addResult(results, path, currentBatch);
      }
      return;
    }

    // Object / Dictionary
    let currentDict: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const candidate = { ...currentDict, [key]: val };

      if (this.jsonSize(candidate) <= this.maxChunkSize) {
        currentDict[key] = val;
      } else {
        if (Object.keys(currentDict).length > 0) {
          this.addResult(results, path, currentDict);
          currentDict = {};
        }

        if (
          this.jsonSize({ [key]: val }) > this.maxChunkSize &&
          typeof val === "object" &&
          val !== null
        ) {
          this.splitRecursive(val, [...path, key], results);
        } else {
          currentDict[key] = val;
        }
      }
    }

    if (Object.keys(currentDict).length > 0) {
      this.addResult(results, path, currentDict);
    }
  }

  private addResult(results: unknown[], path: string[], value: unknown): void {
    if (path.length === 0) {
      results.push(value);
      return;
    }

    // Reconstruct nested object tree along path to preserve context:
    // e.g., { user: { profile: { ... } } }
    const root: Record<string, unknown> = {};
    let current: Record<string, unknown> = root;

    for (let i = 0; i < path.length - 1; i++) {
      current[path[i]] = {};
      current = current[path[i]] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
    results.push(root);
  }
}

/**
 * Helper function to parse and split JSON text into ChunkItems.
 */
export async function splitJsonContent(
  jsonText: string,
  maxChunkSize: number = CHUNK_SIZE,
): Promise<ChunkItem[]> {
  console.log(
    `[JsonSplitter] Splitting JSON (${jsonText.length} chars) with recursive key path preservation (maxChunkSize=${maxChunkSize})`,
  );
  try {
    const parsed = JSON.parse(jsonText.trim());
    const splitter = new RecursiveJsonSplitter(maxChunkSize);
    const jsonChunks = splitter.splitJson(parsed);
    console.log(
      `[JsonSplitter] Successfully generated ${jsonChunks.length} valid JSON chunk(s)`,
    );
    return jsonChunks.map((chunkStr) => ({
      text: chunkStr,
      headingPath: null,
    }));
  } catch (err) {
    console.warn(
      `[JsonSplitter] JSON.parse failed: ${(err as Error).message}. Falling back to plain text.`,
    );
    return splitPlainText(jsonText, maxChunkSize);
  }
}
