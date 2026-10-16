// LabelLens — Day-0 STUB for Seam 2 (design doc Section 5 / Prompt 0, item 3).
//
// OWNED BY PERSON 3 (Judge). Module A only imports it; A must never edit the
// rules logic. Person 3 replaces this file with the real rules engine
// (R1–R8, Section 8) — the import path and signature stay identical, so no UI
// change is needed at integration time.
//
// Stub behaviour: returns EVERY profile item as "unknown". It implements none
// of the matching rules; coverage fields are filled mechanically from the
// extraction and confirm state so the UI can render them.

import type {
  AliasMap,
  ConfirmState,
  Extraction,
  Profile,
  ProfileResult,
  Results,
} from "@shared/contracts";

const DIET_LABELS: Record<Exclude<Profile["diet"], "none">, string> = {
  vegetarian: "Vegetarian diet",
  vegan: "Vegan diet",
};

function humanizeKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stubItem(profile_key: string, profile_label: string): ProfileResult {
  return {
    profile_key,
    profile_label,
    status: "unknown",
    rule_id: "R7",
    reason:
      "Rules engine not connected yet (Module 3 stub) — we could not check this item. Unknown is never reassurance.",
    evidence: [],
  };
}

export function compareProfile(
  extraction: Extraction,
  profile: Profile,
  confirm: ConfirmState,
  _aliasMap: AliasMap,
): Results {
  const items: ProfileResult[] = [
    ...profile.allergens.map((key) => stubItem(key, humanizeKey(key))),
    ...profile.custom_avoid.map((term) => stubItem(`custom:${term}`, term)),
  ];
  if (profile.diet !== "none") {
    items.push(stubItem(`diet_${profile.diet}`, DIET_LABELS[profile.diet]));
  }

  return {
    schema_version: "1",
    items,
    summary: {
      conflict: 0,
      possible_conflict: 0,
      no_match_found: 0,
      unknown: items.length,
      not_applicable: 0,
    },
    coverage: {
      ingredients: extraction.sections.ingredients.status,
      allergen_statement: extraction.sections.allergen_statement.status,
      nutrition: extraction.sections.nutrition.status,
      product_details: extraction.sections.product_details.status,
      ingredients_confirmed: confirm.ingredients_complete,
      allergen_statement_checked:
        confirm.allergen_statement_complete ||
        confirm.pack_has_no_allergen_statement,
    },
  };
}
