import { LANGUAGE_PATTERNS } from "./languagePatterns";

/**
 * Validates whether string content is a valid, parseable JSON object or array.
 */
export function isJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

/**
 * Validates whether string content contains Markdown headers or code fences.
 */
export function isMarkdown(content: string): boolean {
  return (
    /^#{1,6}\s+.+/m.test(content) || /```[a-zA-Z0-9_-]*\r?\n/m.test(content)
  );
}

/**
 * Matches a single line against syntax regexes to identify language.
 */
export function detectLanguage(trimmedLine: string): string | null {
  for (const { lang, re } of LANGUAGE_PATTERNS) {
    if (re.test(trimmedLine)) {
      return lang;
    }
  }
  return null;
}

/**
 * Collects weighted votes for all matching languages across the first N lines.
 */
export function scoreContentLanguages(
  content: string,
  maxLines: number = 50,
): Map<string, number> {
  const lines = content.split("\n").slice(0, maxLines);
  const scores = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const { lang, re, weight = 1 } of LANGUAGE_PATTERNS) {
      if (re.test(trimmed)) {
        scores.set(lang, (scores.get(lang) || 0) + weight);
      }
    }
  }

  return scores;
}

/**
 * Aggregate voting classifier:
 * - Scans up to 50 lines collecting weighted language votes.
 * - Filters out markup/data formats (which have dedicated splitters).
 * - TypeScript Superset Rule: If TypeScript-exclusive syntax (interface, type, enum, annotations)
 *   scores points, TypeScript wins over generic JavaScript imports/consts.
 * - Returns the language with the highest cumulative score.
 */
export function detectPureCodeLanguage(content: string): string | null {
  const scores = scoreContentLanguages(content, 50);

  // Exclude markup/data formats with dedicated pipelines
  scores.delete("json");
  scores.delete("markdown");
  scores.delete("yaml");
  scores.delete("html");
  scores.delete("css");

  if (scores.size === 0) {
    return null;
  }

  // Superset Rule: TypeScript vs. JavaScript
  // Every TypeScript file contains valid JS syntax (imports, const, function).
  // If ANY TypeScript-exclusive syntax is detected, the file is TypeScript.
  const tsScore = scores.get("typescript") || 0;
  const jsScore = scores.get("javascript") || 0;
  if (tsScore > 0 && jsScore > 0) {
    scores.set("typescript", tsScore + jsScore);
    scores.delete("javascript");
  }

  // Find language with the highest cumulative score
  let bestLang: string | null = null;
  let bestScore = 0;

  for (const [lang, score] of scores.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  if (bestScore > 0 && bestLang) {
    const candidateSummary = Array.from(scores.entries())
      .map(([l, s]) => `${l}=${s}`)
      .join(", ");
    console.log(
      `[LanguageDetector] Candidate scores: [${candidateSummary}] -> Detected language: '${bestLang}'`,
    );
    return bestLang;
  }

  return null;
}
