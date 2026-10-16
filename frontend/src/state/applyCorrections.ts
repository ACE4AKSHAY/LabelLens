// Scan-local corrections preserve the provider's source evidence and section
// states. Editing never clears review_required; an explicit photo check does.

import type {
  AllergenStatements,
  EvidenceItem,
  Extraction,
  IngredientRow,
  ReviewablePhrase,
} from "@shared/contracts";

export type AllergenBucket = keyof AllergenStatements;

export function allergenCorrectionId(
  bucket: AllergenBucket,
  index: number,
): string {
  return "allergen:" + bucket + ":" + index;
}

function applyPhraseCorrection(
  row: ReviewablePhrase,
  id: string,
  corrections: Record<string, string>,
  rowChecked: Record<string, boolean>,
): ReviewablePhrase {
  const correctedText = corrections[id];
  const edited = correctedText !== undefined && correctedText !== row.label_text;
  const checked = rowChecked[id] === true;
  if (!edited && !checked) return row;

  return {
    ...row,
    ...(edited ? { label_text: correctedText } : {}),
    ...(checked ? { review_required: false, review_reason: null } : {}),
  };
}

export function applyCorrections(
  extraction: Extraction,
  corrections: Record<string, string>,
  rowChecked: Record<string, boolean>,
  rowRestored: Record<string, boolean>,
): Extraction {
  const ingredients: IngredientRow[] = extraction.ingredients.map((row) => {
    const corrected = applyPhraseCorrection(
      row,
      row.id,
      corrections,
      rowChecked,
    ) as IngredientRow;
    const edited =
      corrections[row.id] !== undefined &&
      corrections[row.id] !== row.label_text;
    if (rowRestored[row.id]) return { ...corrected, edited_by_user: false };
    if (edited) return { ...corrected, edited_by_user: true };
    return corrected;
  });

  const allergen_statements = {
    ...extraction.allergen_statements,
    contains: extraction.allergen_statements.contains.map((row, index) =>
      applyPhraseCorrection(
        row,
        allergenCorrectionId("contains", index),
        corrections,
        rowChecked,
      ),
    ),
    may_contain: extraction.allergen_statements.may_contain.map((row, index) =>
      applyPhraseCorrection(
        row,
        allergenCorrectionId("may_contain", index),
        corrections,
        rowChecked,
      ),
    ),
    other: extraction.allergen_statements.other.map((row, index) =>
      applyPhraseCorrection(
        row,
        allergenCorrectionId("other", index),
        corrections,
        rowChecked,
      ),
    ),
  };

  return { ...extraction, ingredients, allergen_statements };
}

type TextEvidenceIdentity = Pick<
  EvidenceItem,
  "section" | "evidence_quote" | "image_index" | "label_text"
>;

export function editedEvidenceKey(evidence: TextEvidenceIdentity): string {
  return JSON.stringify([
    evidence.section,
    evidence.evidence_quote,
    evidence.image_index,
    evidence.label_text,
  ]);
}

export function collectEditedEvidence(
  extraction: Extraction,
  corrections: Record<string, string>,
): Map<string, string> {
  const edited = new Map<string, string>();
  const add = (
    section: "ingredients" | "allergen_statement",
    row: ReviewablePhrase,
    id: string,
  ) => {
    const correctedText = corrections[id];
    if (correctedText === undefined || correctedText === row.label_text) return;
    edited.set(
      editedEvidenceKey({
        section,
        evidence_quote: row.evidence_quote,
        image_index: row.image_index,
        label_text: correctedText,
      }),
      correctedText,
    );
  };

  for (const row of extraction.ingredients) add("ingredients", row, row.id);
  for (const bucket of ["contains", "may_contain", "other"] as const) {
    extraction.allergen_statements[bucket].forEach((row, index) =>
      add("allergen_statement", row, allergenCorrectionId(bucket, index)),
    );
  }
  return edited;
}
