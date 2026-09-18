import { detectPureCodeLanguage, isJson, isMarkdown } from "./detectors";
import { calculateChunkOffsets } from "./offsets";
import {
  splitJsonContent,
  splitMarkdownContent,
  splitPlainText,
  splitPureCode,
} from "./splitters";
import { CHUNK_SIZE, type ChunkItem } from "./types";

export interface RouteAndChunkOptions {
  fileExtension?: string | null;
  maxChunkSize?: number;
}

/**
 * ChunkerEngine orchestrates content detection, routing, splitting, and offset computation.
 */
export class ChunkerEngine {
  /**
   * Routes content based on extension or dynamic syntax heuristics:
   * 1. Explicit Extension routing (.json, .md, .markdown)
   * 2. Content-based dynamic detection (JSON, Markdown, Pure Code AST)
   * 3. Plain Text Fallback
   */
  async routeAndChunk(
    sourceText: string,
    fileExtension?: string | null,
    maxChunkSize: number = CHUNK_SIZE,
  ): Promise<ChunkItem[]> {
    const ext = fileExtension?.toLowerCase() || "";
    console.log(
      `[ChunkerEngine] Routing document (${sourceText.length} chars) | ext='${ext || "none"}' | maxChunkSize=${maxChunkSize}`,
    );

    // 1. Explicit extension match
    if (ext === ".json") {
      console.log(
        `[ChunkerEngine] Route -> JSON splitter (via explicit extension '${ext}')`,
      );
      return splitJsonContent(sourceText, maxChunkSize);
    }

    if (ext === ".md" || ext === ".markdown") {
      console.log(
        `[ChunkerEngine] Route -> Markdown header & AST splitter (via explicit extension '${ext}')`,
      );
      return splitMarkdownContent(sourceText, maxChunkSize);
    }

    // 2. Content-based dynamic detection (for inline text, extensionless files, or generic .txt)
    console.log(
      `[ChunkerEngine] No explicit .json/.md extension. Evaluating content syntax cascade...`,
    );

    if (isJson(sourceText)) {
      console.log(
        `[ChunkerEngine] Route -> JSON splitter (dynamic syntax match)`,
      );
      return splitJsonContent(sourceText, maxChunkSize);
    }

    if (isMarkdown(sourceText)) {
      console.log(
        `[ChunkerEngine] Route -> Markdown header & AST splitter (dynamic markdown headers/fences detected)`,
      );
      return splitMarkdownContent(sourceText, maxChunkSize);
    }

    // 3. Pure Code via code-chunk AST
    const detectedLang = detectPureCodeLanguage(sourceText);
    if (detectedLang) {
      console.log(
        `[ChunkerEngine] Route -> Pure Code AST splitter (detected language: '${detectedLang}')`,
      );
      return splitPureCode(sourceText, detectedLang, maxChunkSize);
    }

    // 4. Plain Text Fallback
    console.log(`[ChunkerEngine] Route -> Plain Text fallback splitter`);
    return splitPlainText(sourceText, maxChunkSize);
  }

  /**
   * Computes monotonic character offsets for all chunks.
   */
  calculateOffsets(sourceText: string, chunks: ChunkItem[]): ChunkItem[] {
    return calculateChunkOffsets(sourceText, chunks);
  }

  /**
   * Convenience all-in-one method: routes, splits, and computes offsets.
   */
  async process(
    sourceText: string,
    options?: RouteAndChunkOptions,
  ): Promise<ChunkItem[]> {
    const chunks = await this.routeAndChunk(
      sourceText,
      options?.fileExtension,
      options?.maxChunkSize,
    );
    const withOffsets = this.calculateOffsets(sourceText, chunks);
    console.log(
      `[ChunkerEngine] Chunking pipeline finished: ${withOffsets.length} chunk(s) produced`,
    );
    return withOffsets;
  }

  // Backward-compatibility aliases
  isJson(content: string): boolean {
    return isJson(content);
  }

  isMarkdown(content: string): boolean {
    return isMarkdown(content);
  }

  detectPureCodeLanguage(content: string): string | null {
    return detectPureCodeLanguage(content);
  }

  async splitJson(
    jsonText: string,
    maxChunkSize: number = CHUNK_SIZE,
  ): Promise<ChunkItem[]> {
    return splitJsonContent(jsonText, maxChunkSize);
  }

  async splitMarkdown(
    markdownText: string,
    maxChunkSize: number = CHUNK_SIZE,
  ): Promise<ChunkItem[]> {
    return splitMarkdownContent(markdownText, maxChunkSize);
  }

  async splitCode(
    codeText: string,
    language: string,
    maxChunkSize: number = CHUNK_SIZE,
  ): Promise<ChunkItem[]> {
    return splitPureCode(codeText, language, maxChunkSize);
  }

  async splitPlainText(
    text: string,
    maxChunkSize: number = CHUNK_SIZE,
  ): Promise<ChunkItem[]> {
    return splitPlainText(text, maxChunkSize);
  }
}

export const chunkerEngine = new ChunkerEngine();
