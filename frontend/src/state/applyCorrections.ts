// Pure correction pipeline for the active scan (Section 8 "User corrections"):
// editing a row sets edited_by_user and keeps the original recoverable;
// "I checked this row" clears review_required. Corrections never upgrade a
// section's completeness.

import type { IngredientRow } from "@shared/contracts";

export function applyCorrections(
  ingredients: IngredientRow[],
  corrections: Record<string, string>,
  rowChecked: Record<string, boolean>,
  rowRestored: Record<string, boolean>,
): IngredientRow[] {
  return ingredients.map((row) => {
    let next = row;
    const edited = corrections[row.id];
    if (edited !== undefined && edited !== row.label_text) {
      next = {
        ...next,
        label_text: edited,
        edited_by_user: true,
        review_required: rowChecked[row.id] ? false : next.review_required,
        review_reason: rowChecked[row.id] ? null : next.review_reason,
      };
    } else if (rowChecked[row.id]) {
      next = { ...next, review_required: false, review_reason: null };
    }
    if (rowRestored[row.id]) {
      next = { ...next, edited_by_user: false };
    }
    return next;
  });
}
