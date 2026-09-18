import { describe, expect, it } from "bun:test";
import {
  calculateChunkOffsets,
  MarkdownHeaderSplitter,
  RecursiveJsonSplitter,
  splitMarkdownContent,
  splitPureCode,
} from "../chunking";

describe("MarkdownHeaderSplitter", () => {
  const splitter = new MarkdownHeaderSplitter();

  it("should split markdown by headers and preserve hierarchy in headingPath", () => {
    const md = `# System Architecture

High-level overview.

## Storage Services

Details about storage.

### PostgreSQL Hot Tier

Claims and entities table.

## Worker Pipeline

BullMQ consumers and ingestion.`;

    const sections = splitter.splitText(md);

    expect(sections.length).toBe(4);
    expect(sections[0].headingPath).toBe("# System Architecture");
    expect(sections[0].content).toContain("High-level overview.");

    expect(sections[1].headingPath).toBe(
      "# System Architecture > ## Storage Services",
    );
    expect(sections[1].content).toContain("Details about storage.");

    expect(sections[2].headingPath).toBe(
      "# System Architecture > ## Storage Services > ### PostgreSQL Hot Tier",
    );

    // Sibling H2 should pop previous H2 and H3
    expect(sections[3].headingPath).toBe(
      "# System Architecture > ## Worker Pipeline",
    );
  });

  it("should ignore # comments inside code blocks", () => {
    const md = `# Python Docs

Code snippet:

\`\`\`python
# This is a comment
def test():
    # Another comment
    return True
\`\`\`

## Next Part
Prose content.`;

    const sections = splitter.splitText(md);

    expect(sections.length).toBe(2);
    expect(sections[0].headingPath).toBe("# Python Docs");
    expect(sections[0].content).toContain("# This is a comment");
    expect(sections[1].headingPath).toBe("# Python Docs > ## Next Part");
  });
});

describe("RecursiveJsonSplitter", () => {
  const splitter = new RecursiveJsonSplitter(300);

  it("should return small JSON without splitting", () => {
    const data = { id: 1, name: "Whimsync", active: true };
    const chunks = splitter.splitJson(data);

    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(chunks[0]);
    expect(parsed.name).toBe("Whimsync");
  });

  it("should recursively split large nested objects while retaining parent context", () => {
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
      const parsed = JSON.parse(chunkStr);
      expect(typeof parsed).toBe("object");
      expect(chunkStr.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("AST Code Splitter & Markdown Rehydration", () => {
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
    const chunks = await splitPureCode(tsCode, "typescript", 600);
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

    const chunks = await splitMarkdownContent(md, 600);
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

    const withOffsets = calculateChunkOffsets(sourceText, chunks);

    expect(withOffsets[0].chunkStartOffset).toBe(0);
    expect(withOffsets[0].chunkEndOffset).toBeGreaterThan(0);
    expect(withOffsets[1].chunkStartOffset).toBeGreaterThanOrEqual(
      withOffsets[0].chunkEndOffset!,
    );
  });

  it("should split CRLF (Windows \\r\\n) markdown documents into hierarchical sections", () => {
    const crlfMd =
      "# Project Chimera\r\n\r\nIntro text\r\n\r\n## 1. Background\r\n\r\nBackground details\r\n\r\n### 1.1 Scope\r\n\r\nScope details\r\n\r\n## 2. Roadmap\r\n\r\nRoadmap details";
    const splitter = new MarkdownHeaderSplitter();
    const sections = splitter.splitText(crlfMd);

    expect(sections.length).toBe(4);
    expect(sections[0].headingPath).toBe("# Project Chimera");
    expect(sections[1].headingPath).toBe(
      "# Project Chimera > ## 1. Background",
    );
    expect(sections[2].headingPath).toBe(
      "# Project Chimera > ## 1. Background > ### 1.1 Scope",
    );
    expect(sections[3].headingPath).toBe("# Project Chimera > ## 2. Roadmap");
  });
});
