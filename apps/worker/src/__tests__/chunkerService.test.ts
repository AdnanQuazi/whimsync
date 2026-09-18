import { describe, expect, it } from "bun:test";
import {
  chunkerEngine as chunkerService,
  MarkdownHeaderSplitter,
  RecursiveJsonSplitter,
} from "../chunking";

describe("MarkdownHeaderSplitter", () => {
  const splitter = new MarkdownHeaderSplitter();

  it("should split markdown by headers and generate correct headingPath", () => {
    const md = `# Whimsync Architecture

Intro text here.

## Storage Layer

Postgres and MinIO details.

### Hot Tier

Fast database claims.

## Cognitive Layer

LLM extraction details.`;

    const sections = splitter.splitText(md);

    expect(sections.length).toBe(4);
    expect(sections[0].headingPath).toBe("# Whimsync Architecture");
    expect(sections[0].content).toContain("Intro text here.");

    expect(sections[1].headingPath).toBe(
      "# Whimsync Architecture > ## Storage Layer",
    );
    expect(sections[1].content).toContain("Postgres and MinIO details.");

    expect(sections[2].headingPath).toBe(
      "# Whimsync Architecture > ## Storage Layer > ### Hot Tier",
    );
    expect(sections[2].content).toContain("Fast database claims.");

    // ## Cognitive Layer should pop ## Storage Layer and ### Hot Tier
    expect(sections[3].headingPath).toBe(
      "# Whimsync Architecture > ## Cognitive Layer",
    );
    expect(sections[3].content).toContain("LLM extraction details.");
  });

  it("should NOT treat comments inside code fences as markdown headers", () => {
    const md = `# Python Guide

Here is some python code:

\`\`\`python
# This is a comment, not a header!
def hello():
    # Another comment inside
    return "world"
\`\`\`

## Next Section
More prose.`;

    const sections = splitter.splitText(md);

    // Should only split on # Python Guide and ## Next Section
    expect(sections.length).toBe(2);
    expect(sections[0].headingPath).toBe("# Python Guide");
    expect(sections[0].content).toContain("# This is a comment, not a header!");
    expect(sections[1].headingPath).toBe("# Python Guide > ## Next Section");
  });
});

describe("RecursiveJsonSplitter", () => {
  const splitter = new RecursiveJsonSplitter(300);

  it("should return small JSON objects as a single chunk", () => {
    const data = { id: 1, name: "Whimsync", active: true };
    const chunks = splitter.splitJson(data);

    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.name).toBe("Whimsync");
  });

  it("should recursively split large objects while retaining parent key path", () => {
    const data = {
      tenantId: "org_12345",
      config: {
        theme: "dark",
        features: {
          enableVectorSearch: true,
          enableLiveSync: true,
          maxTokensPerClaim: 4096,
          allowedOrigins: [
            "https://app.whimsync.io",
            "https://api.whimsync.io",
          ],
        },
      },
      metadata: {
        description:
          "This is a long description designed to push the serialized character count well beyond the 300 character maximum limit for our recursive JSON splitter test.",
        tags: ["memory", "agentic", "cognitive", "postgres", "vector"],
      },
    };

    const chunks = splitter.splitJson(data);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunkStr of chunks) {
      // Must be valid JSON
      const parsed = JSON.parse(chunkStr);
      expect(typeof parsed).toBe("object");
      expect(chunkStr.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("ChunkerService Router & Code AST", () => {
  it("should detect JSON content accurately", () => {
    expect(chunkerService.isJson('{"key": "value"}')).toBe(true);
    expect(chunkerService.isJson("[1, 2, 3]")).toBe(true);
    expect(chunkerService.isJson("# Header\nNot json")).toBe(false);
  });

  it("should detect Markdown content accurately", () => {
    expect(chunkerService.isMarkdown("# Title\n\nSome text")).toBe(true);
    expect(chunkerService.isMarkdown("```js\nconsole.log(1)\n```")).toBe(true);
    expect(chunkerService.isMarkdown("Just regular plain text.")).toBe(false);
  });

  it("should detect pure code language using regex heuristics", () => {
    const pythonCode = `import os
import sys

def calculate_total(items):
    return sum(item.price for item in items)
`;
    expect(chunkerService.detectPureCodeLanguage(pythonCode)).toBe("python");

    const tsCode = `export interface UserProfile {
  id: string;
  name: string;
}

export function getUser(): UserProfile {
  return { id: "1", name: "Test" };
}
`;
    expect(chunkerService.detectPureCodeLanguage(tsCode)).toBe("typescript");
  });

  it("should split pure code using code-chunk AST", async () => {
    const tsCode = `export class MemoryManager {
  private cache = new Map<string, any>();

  async getMemory(id: string): Promise<any> {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    return null;
  }

  async saveMemory(id: string, value: any): Promise<void> {
    this.cache.set(id, value);
  }
}
`;
    const chunks = await chunkerService.splitCode(tsCode, "typescript");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].text).toContain("MemoryManager");
  });

  it("should split markdown with embedded code fences and rehydrate code-chunk AST", async () => {
    const md = `# Overview

Here is our primary service:

\`\`\`typescript
export class DataService {
  async fetchData(id: string): Promise<string> {
    return "data_" + id;
  }
}
\`\`\`

## Summary
Done!`;

    const chunks = await chunkerService.splitMarkdown(md);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const hasCodeChunk = chunks.some(
      (c) => c.text.includes("DataService") && c.text.includes("fetchData"),
    );
    expect(hasCodeChunk).toBe(true);
  });

  it("should calculate monotonically increasing character offsets", () => {
    const sourceText = `# Title

Paragraph one is here.

Paragraph two is here.`;

    const chunks = [
      { text: "# Title\n\nParagraph one is here.", headingPath: "# Title" },
      { text: "Paragraph two is here.", headingPath: "# Title" },
    ];

    const withOffsets = chunkerService.calculateOffsets(sourceText, chunks);

    expect(withOffsets[0].chunkStartOffset).toBe(0);
    expect(withOffsets[0].chunkEndOffset).toBeGreaterThan(0);
    expect(withOffsets[1].chunkStartOffset).toBeGreaterThanOrEqual(
      withOffsets[0].chunkEndOffset!,
    );
  });

  it("should process end-to-end markdown with python code fence and hierarchical headers", async () => {
    const markdown = `# Sorting Algorithms Guide

Welcome to the algorithms guide.

## Quick Sort Implementation

Here is the quick sort in Python:

\`\`\`python
def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

if __name__ == "__main__":
    data = [34, 7, 23, 32, 5, 62]
    print(quick_sort(data))
\`\`\`

## Performance Considerations

Quick Sort has an average time complexity of O(n log n).
`;

    const chunks = await chunkerService.process(markdown, {
      fileExtension: ".md",
    });

    expect(chunks.length).toBeGreaterThanOrEqual(3);

    // Verify heading paths are preserved
    const codeChunk = chunks.find((c) => c.text.includes("quick_sort"));
    expect(codeChunk).toBeDefined();
    expect(codeChunk?.headingPath).toContain("Quick Sort Implementation");

    const perfChunk = chunks.find((c) =>
      c.text.includes("Performance Considerations"),
    );
    expect(perfChunk).toBeDefined();
    expect(perfChunk?.headingPath).toBe(
      "# Sorting Algorithms Guide > ## Performance Considerations",
    );

    // Verify monotonic character offsets
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].chunkStartOffset !== null) {
        expect(chunks[i].chunkStartOffset).toBeGreaterThanOrEqual(0);
        expect(chunks[i].chunkEndOffset).toBeGreaterThan(
          chunks[i].chunkStartOffset!,
        );
      }
    }
  });
});
