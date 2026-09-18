export interface LanguagePattern {
  lang: string;
  re: RegExp;
  weight?: number;
}

/**
 * Structural syntax regex patterns for language identification.
 * Tested across diverse sample codebases with discriminator weighting.
 */
export const LANGUAGE_PATTERNS: LanguagePattern[] = [
  // Python
  {
    lang: "python",
    re: /^(def\s+\w+\s*\(|class\s+\w+\s*[:(]|from\s+[\w.]+\s+import\s+|import\s+[\w.]+(\s+as\s+\w+)?\s*$|if\s+__name__\s*==\s*['"]__main__['"]|#!.*python)/,
    weight: 2,
  },
  // Go
  {
    lang: "go",
    re: /^(package\s+\w+|func\s+(\(\w+\s+\*?\w+\)\s+)?\w+\s*\(|import\s+\(|import\s+"[\w./]+"|type\s+\w+\s+(struct|interface)\b)/,
    weight: 2,
  },
  // Rust (requires type annotation on constants: const IDENT: Type = ...)
  {
    lang: "rust",
    re: /^(pub(\(\w+\))?\s+)?(fn|struct|enum|trait|mod|impl|static)\s+\w+|^(pub\s+)?const\s+[A-Za-z0-9_]+\s*:\s*|^use\s+[\w:]+|^#!?\[/,
    weight: 2,
  },
  // C#
  {
    lang: "csharp",
    re: /^(using\s+System(\.\w+)*;|namespace\s+[\w.]+;?|public\s+(static\s+)?(class|interface|struct)\s+\w+|Console\.WriteLine)/,
    weight: 2,
  },
  // Java
  {
    lang: "java",
    re: /^(@\w+\s*)*(public|private|protected)?\s*(static\s+)?(final\s+)?(class|interface|enum)\s+\w+|^import\s+java\.|^package\s+[\w.]+;|System\.out\.println/,
    weight: 2,
  },
  // TypeScript (discriminator syntax: interface, type alias, enum, type annotations)
  {
    lang: "typescript",
    re: /^(export\s+)?(interface\s+\w+|type\s+\w+\s*=|enum\s+\w+|declare\s+(module|namespace|global)|abstract\s+class\s+\w+)|:\s*(string|number|boolean|any|void|unknown|never|Record<|Array<)\b/,
    weight: 3,
  },
  // JavaScript
  {
    lang: "javascript",
    re: /^(export\s+)?(default\s+)?(async\s+)?function\s*\*?\s*\w*\s*\(|^(export\s+)?(default\s+)?class\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(?[\w,\s]*\)?\s*=>|require\(['"]|module\.exports|^import\s+.*from\s+['"]/,
    weight: 1,
  },
  // C++
  {
    lang: "cpp",
    re: /^(#include\s*<\w+(\.h)?>|#include\s*"\w+\.h"|std::\w+|using\s+namespace\s+std;|template\s*<)/,
    weight: 2,
  },
  // C
  {
    lang: "c",
    re: /^(#include\s*<\w+\.h>|int\s+main\s*\(\s*(void)?\s*\)|#define\s+\w+)/,
    weight: 2,
  },
  // Ruby
  {
    lang: "ruby",
    re: /^(require\s+['"]|def\s+\w+|class\s+\w+(\s*<\s*\w+)?|module\s+\w+|attr_(accessor|reader|writer)|puts\s+)/,
    weight: 2,
  },
  // PHP
  {
    lang: "php",
    re: /^(<\?php|namespace\s+\w+;|function\s+\w+\s*\(|\$\w+\s*=)/,
    weight: 2,
  },
  // Swift
  {
    lang: "swift",
    re: /^(import\s+(Foundation|SwiftUI|UIKit)|func\s+\w+\s*\(|struct\s+\w+|class\s+\w+|var\s+\w+\s*:\s*\w+|let\s+\w+\s*=)/,
    weight: 2,
  },
  // Kotlin
  {
    lang: "kotlin",
    re: /^(fun\s+\w+\s*\(|val\s+\w+\s*[:=]|var\s+\w+\s*[:=]|class\s+\w+|package\s+[\w.]+|import\s+kotlin\.)/,
    weight: 2,
  },
  // SQL
  {
    lang: "sql",
    re: /^(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW|DATABASE)|ALTER\s+TABLE|DROP\s+(TABLE|INDEX|DATABASE)|WITH\s+\w+\s+AS|MERGE\s+INTO)\s+/i,
    weight: 2,
  },
  // HTML
  {
    lang: "html",
    re: /^(<!DOCTYPE\s+html|<html|<head|<body|<div|<span)/i,
    weight: 2,
  },
  // CSS
  {
    lang: "css",
    re: /^([.#]?[\w-]+\s*\{|@media|@import\s+['"]|:root\s*\{)/,
    weight: 2,
  },
  // Bash
  {
    lang: "bash",
    re: /^(#!\/bin\/(ba)?sh|#!\/usr\/bin\/env\s+(bash|sh)|export\s+\w+=|if\s+\[)/,
    weight: 2,
  },
  // Dockerfile
  {
    lang: "dockerfile",
    re: /^(FROM\s+\w+|RUN\s+|CMD\s+|COPY\s+|WORKDIR\s+|ENV\s+\w+=)/i,
    weight: 2,
  },
  // YAML
  {
    lang: "yaml",
    re: /^(---\s*$|\w[\w-]*:\s*$|\w[\w-]*:\s+\S+|-\s+\w+)/,
    weight: 1,
  },
  // JSON
  {
    lang: "json",
    re: /^\s*[{[]/,
    weight: 1,
  },
  // Markdown
  {
    lang: "markdown",
    re: /^(#{1,6}\s+|\*\s+|-\s+|\d+\.\s+|```)/,
    weight: 1,
  },
];
