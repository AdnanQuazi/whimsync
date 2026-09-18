import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { chunk as codeChunk } from "code-chunk";
import { detectPureCodeLanguage } from "../detectors/languageDetector";
import { CHUNK_SIZE, type ChunkItem, type HeaderSplitSection } from "../types";

/**
 * Structural line-by-line state machine for Markdown documents:
 * - Scans lines tracking code fence boundaries (``` or ~~~) so comments (# python) are never mistaken for headers.
 * - Hierarchically tracks #, ##, ###, #### headers, automatically popping deeper/sibling headers.
 * - Retains original markdown header text and symbols in content.
 */
export class MarkdownHeaderSplitter {
  splitText(markdown: string): HeaderSplitSection[] {
    const lines = markdown.split(/\r?\n/);
    const sections: HeaderSplitSection[] = [];

    // Header stack stores current hierarchical path: { level, heading }
    let headerStack: Array<{ level: number; heading: string }> = [];
    let currentLines: string[] = [];
    let inCodeFence = false;

    const flushSection = () => {
      if (currentLines.length > 0) {
        const text = currentLines.join("\n").trim();
        if (text) {
          sections.push({
            content: text,
            headingPath:
              headerStack.length > 0
                ? headerStack.map((h) => h.heading).join(" > ")
                : null,
          });
        }
        currentLines = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Toggle code fence boundary (``` or ~~~)
      if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
        inCodeFence = !inCodeFence;
        currentLines.push(line);
        continue;
      }

      // If inside code fence, line is code/comment, not a markdown header
      if (inCodeFence) {
        currentLines.push(line);
        continue;
      }

      // Match ATX headers (# to ######)
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const headingText = trimmed;

        flushSection();

        // Pop headers at same or deeper level
        headerStack = headerStack.filter((h) => h.level < level);
        headerStack.push({ level, heading: headingText });

        // Retain header line in section content for citation fidelity
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }

    flushSection();
    return sections;
  }
}

interface FenceInfo {
  placeholder: string;
  lang: string;
  code: string;
  astChunks: string[];
}

/**
 * Merges orphaned tail chunks produced by RecursiveCharacterTextSplitter.
 *
 * When a large prose section is character-split, the final fragment is often a
 * tiny orphan (e.g. a single sentence like "incident.") that got severed from
 * the previous chunk. This post-processes the raw chunk list and absorbs any
 * fragment shorter than `MIN_ORPHAN_CHARS` into its predecessor if they share
 * the same headingPath and the merged result would not exceed `maxChunkSize * 1.5`.
 *
 * Code chunks (those beginning with a triple-backtick fence) are never merged
 * since they carry AST context and have clearly defined boundaries.
 */
function mergeOrphanedChunks(
  chunks: ChunkItem[],
  maxChunkSize: number,
): ChunkItem[] {
  const MIN_ORPHAN_CHARS = 100;
  const MAX_MERGED_SIZE = Math.floor(maxChunkSize * 1.5);

  const result: ChunkItem[] = [];

  for (const chunk of chunks) {
    if (result.length === 0) {
      result.push({ ...chunk });
      continue;
    }

    const prev = result[result.length - 1];
    const prevIsOrphan = prev.text.length < MIN_ORPHAN_CHARS;
    const curIsOrphan = chunk.text.length < MIN_ORPHAN_CHARS;
    const sameSection = prev.headingPath === chunk.headingPath;
    const isCodeChunk =
      chunk.text.startsWith("```") || prev.text.startsWith("```");
    const mergedSize = prev.text.length + 2 + chunk.text.length;
    const withinBudget = mergedSize <= MAX_MERGED_SIZE;

    // Merge if either the tail of the previous chunk or the head of the current
    // chunk is a tiny orphan, they share the same headingPath, neither is a code
    // fence, and the combined size stays within 1.5× maxChunkSize.
    if (
      (prevIsOrphan || curIsOrphan) &&
      sameSection &&
      !isCodeChunk &&
      withinBudget
    ) {
      prev.text = `${prev.text}\n\n${chunk.text}`;
    } else {
      result.push({ ...chunk });
    }
  }

  return result;
}

/**
 * Splits Markdown text:
 * 1. Extracts all code fences (```lang ... ```).
 * 2. Runs each extracted code fence through code-chunk AST with contextualized signatures.
 * 3. Runs MarkdownHeaderSplitter along #, ## ... preserving hierarchical header paths.
 * 4. For each section, sub-chunks large prose via RecursiveCharacterTextSplitter.
 * 5. Re-hydrates AST code chunks into the section while keeping chunk size <= maxChunkSize.
 * 6. Merges orphaned tail fragments from character splitting.
 */
export async function splitMarkdownContent(
  markdownText: string,
  maxChunkSize: number = CHUNK_SIZE,
): Promise<ChunkItem[]> {
  // 1. Extract all code fences into placeholders
  const fences: FenceInfo[] = [];
  let processedText = markdownText;
  const fenceRegex = /```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g;

  processedText = processedText.replace(fenceRegex, (_match, rawLang, code) => {
    const placeholder = `[[WHIMSYNC_CODE_BLOCK_${fences.length}]]`;
    let lang = rawLang?.trim()?.toLowerCase();
    if (!lang) {
      lang = detectPureCodeLanguage(code) || "javascript";
      console.log(
        `[MarkdownSplitter] Fence #${fences.length + 1} had no language tag; detected '${lang}' from code`,
      );
    }
    fences.push({
      placeholder,
      lang,
      code: code.trim(),
      astChunks: [],
    });
    return placeholder;
  });

  if (fences.length > 0) {
    console.log(
      `[MarkdownSplitter] Extracted ${fences.length} code fence(s) for AST processing`,
    );
  }

  // 2. Process all code fences through code-chunk AST with signatures
  for (let i = 0; i < fences.length; i++) {
    const fence = fences[i];
    try {
      const chunks = await codeChunk(`snippet.${fence.lang}`, fence.code, {
        // biome-ignore lint/suspicious/noExplicitAny: code-chunk language union cast
        language: fence.lang as any,
        maxChunkSize,
        contextMode: "full",
        siblingDetail: "signatures",
      });

      fence.astChunks = chunks.map(
        (c: { contextualizedText?: string; text: string }) =>
          `\`\`\`${fence.lang}\n${c.contextualizedText || c.text}\n\`\`\``,
      );
      console.log(
        `[MarkdownSplitter] Fence #${i + 1} (${fence.lang}): AST generated ${fence.astChunks.length} chunk(s)`,
      );
    } catch {
      console.warn(
        `[MarkdownSplitter] Fence #${i + 1} (${fence.lang}) AST failed. Using raw fence.`,
      );
      fence.astChunks = [`\`\`\`${fence.lang}\n${fence.code}\n\`\`\``];
    }
  }

  // 3. Split Markdown structure using MarkdownHeaderSplitter
  const headerSplitter = new MarkdownHeaderSplitter();
  const sections = headerSplitter.splitText(processedText);
  console.log(
    `[MarkdownSplitter] Split markdown into ${sections.length} header section(s)`,
  );
  const rawChunks: ChunkItem[] = [];

  const proseSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: maxChunkSize,
    chunkOverlap: 0,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  // 4. Process each header section
  for (const section of sections) {
    const sectionPath = section.headingPath;
    const sectionContent = section.content;

    // Check which fences belong to this section
    const presentFences = fences.filter((f) =>
      sectionContent.includes(f.placeholder),
    );

    if (presentFences.length === 0) {
      // Pure prose section: split with RecursiveCharacterTextSplitter if exceeding limit
      if (sectionContent.length <= maxChunkSize) {
        rawChunks.push({ text: sectionContent, headingPath: sectionPath });
      } else {
        const docs = await proseSplitter.createDocuments([sectionContent]);
        for (const doc of docs) {
          if (doc.pageContent.trim()) {
            rawChunks.push({
              text: doc.pageContent,
              headingPath: sectionPath,
            });
          }
        }
      }
      continue;
    }

    // Section has embedded code fences:
    // Split section content by placeholders and rehydrate with AST code chunks
    let currentSectionText = sectionContent;

    for (const fence of presentFences) {
      const parts = currentSectionText.split(fence.placeholder);
      const before = parts[0] || "";
      const after = parts.slice(1).join(fence.placeholder);

      // Emit prose before code fence
      if (before.trim()) {
        if (before.length <= maxChunkSize) {
          rawChunks.push({ text: before.trim(), headingPath: sectionPath });
        } else {
          const docs = await proseSplitter.createDocuments([before]);
          for (const d of docs) {
            if (d.pageContent.trim()) {
              rawChunks.push({
                text: d.pageContent,
                headingPath: sectionPath,
              });
            }
          }
        }
      }

      // Emit each AST contextualized code chunk from code-chunk
      for (const astCode of fence.astChunks) {
        if (astCode.trim()) {
          rawChunks.push({ text: astCode.trim(), headingPath: sectionPath });
        }
      }

      currentSectionText = after;
    }

    // Emit any remaining prose after the last code block in this section
    if (currentSectionText.trim()) {
      if (currentSectionText.length <= maxChunkSize) {
        rawChunks.push({
          text: currentSectionText.trim(),
          headingPath: sectionPath,
        });
      } else {
        const docs = await proseSplitter.createDocuments([currentSectionText]);
        for (const d of docs) {
          if (d.pageContent.trim()) {
            rawChunks.push({ text: d.pageContent, headingPath: sectionPath });
          }
        }
      }
    }
  }

  // 5. Absorb orphaned tail fragments from character splitting
  const finalChunks = mergeOrphanedChunks(rawChunks, maxChunkSize);

  const orphansMerged = rawChunks.length - finalChunks.length;
  console.log(
    `[MarkdownSplitter] Assembled ${finalChunks.length} final chunk(s) across ${sections.length} header section(s)${orphansMerged > 0 ? ` (merged ${orphansMerged} orphaned fragment(s))` : ""}`,
  );
  return finalChunks;
}
