// Pure helpers that link free-text extraction warnings to the evidence the
// UI already holds. A warning is a plain string in the contract; the exact
// printed phrase or photo it refers to is derived conservatively from the
// extraction itself — nothing is invented, and warnings with no derivable
// link simply render without one.

import type { Extraction, NutritionRow, ReviewablePhrase } from "@shared/contracts";

export interface WarningRowLink {
  /** DOM row id for the inspect action (ingredient id or allergen key). */
  rowId: string;
  sectionLabel: string;
  /** The exact printed wording the warning appears to reference. */
  printedText: string;
  imageIndex: number | null;
}

export interface WarningLinks {
  /** 0-based image index parsed from phrases like "photo 1"; null if absent. */
  photoIndex: number | null;
  rows: WarningRowLink[];
}

const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "was", "were", "are", "not", "did", "does",
  "this", "that", "from", "into", "unto", "until", "user", "text", "wording",
  "photo", "image", "label", "printed", "visible", "source", "recorded",
  "check", "checked", "needs", "review", "required", "reading", "readable",
  "only", "partly", "unclear", "list", "line", "panel", "your", "you",
  "ocr", "mock", "case", "correction",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP_TOKENS.has(t)),
  );
}

/** Parse "photo 2" / "image 2" (1-based, as warnings are written for humans). */
export function photoIndexFromWarning(
  warningText: string,
  imageCount: number,
): number | null {
  const match = warningText.match(/\b(?:photo|image)\s+(\d+)\b/i);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (index < 0 || index >= imageCount) return null;
  return index;
}

function rowLinksFrom(
  warningTokens: Set<string>,
  rows: ReviewablePhrase[] | NutritionRow[],
  rowId: (row: ReviewablePhrase | NutritionRow, index: number) => string,
  sectionLabel: string,
): WarningRowLink[] {
  const links: WarningRowLink[] = [];
  rows.forEach((row, index) => {
    const tokens = tokenize(`${row.label_text} ${row.evidence_quote}`);
    let overlap = 0;
    for (const token of tokens) {
      if (warningTokens.has(token)) overlap++;
    }
    // Require a distinctive overlap (a real mention, not a shared filler word)
    // so unrelated rows are not dragged into the warning.
    if (overlap >= 1 && tokens.size > 0) {
      links.push({
        rowId: rowId(row, index),
        sectionLabel,
        printedText: row.evidence_quote,
        imageIndex: row.image_index,
      });
    }
  });
  return links;
}

export function warningLinks(extraction: Extraction, warningText: string): WarningLinks {
  const warningTokens = tokenize(warningText);
  const allergenRowId = (bucket: string, index: number) =>
    `allergen:${bucket}:${index}`;

  const rows: WarningRowLink[] = [
    ...rowLinksFrom(warningTokens, extraction.ingredients, (row) => (row as { id: string }).id, "Ingredients"),
    ...rowLinksFrom(
      warningTokens,
      extraction.allergen_statements.contains,
      (_row, i) => allergenRowId("contains", i),
      "Contains statement",
    ),
    ...rowLinksFrom(
      warningTokens,
      extraction.allergen_statements.may_contain,
      (_row, i) => allergenRowId("may_contain", i),
      "May-contain statement",
    ),
    ...rowLinksFrom(
      warningTokens,
      extraction.allergen_statements.other,
      (_row, i) => allergenRowId("other", i),
      "Allergen statement",
    ),
  ];

  return {
    photoIndex: photoIndexFromWarning(warningText, extraction.images.length),
    rows: rows.slice(0, 3),
  };
}
