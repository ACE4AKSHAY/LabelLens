// Module A functional checks — run with: npm run test:a (uses tsx, no extra deps).
// Covers the pure logic the UI depends on: profile helpers, the correction
// pipeline, and contract-shape honesty of every built-in mock fixture pack.
// Component rendering is verified manually against the dev fixture picker.

import type {
  Extraction,
  IngredientRow,
  ResultStatus,
  Results,
  SectionStatus,
} from "@shared/contracts";
import {
  isValidProfile,
  profileHasRestrictions,
  profileSummary,
} from "../state/profileStore";
import {
  applyCorrections,
  allergenCorrectionId,
  collectEditedEvidence,
  editedEvidenceKey,
} from "../state/applyCorrections";
import { compareProfile } from "../domain/compareProfile";
import { buildScanCsv, escapeCsvCell } from "../state/scanExport";
import aliasMapJson from "../domain/aliasMap.json";
import { sampleMasalaBiscuits } from "../api/mocks/sampleMasalaBiscuits";
import { sampleCheeseCrackers } from "../api/mocks/sampleCheeseCrackers";
import { sampleRicePuffs } from "../api/mocks/sampleRicePuffs";
import { sampleChocoBar } from "../api/mocks/sampleChocoBar";
import type { FixturePack } from "../api/mocks/types";

// Node-side script; minimal local declaration so no @types/node is needed.
declare const process: { exit(code?: number): void };

let failures = 0;
let passes = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passes++;
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const SECTION_STATUSES: SectionStatus[] = [
  "readable_complete",
  "readable_partial",
  "unreadable",
  "not_uploaded",
  "ambiguous",
];
const IMAGE_QUALITIES = ["good", "blurry", "cropped", "glare", "unusable"];

const SEVERITY: Record<ResultStatus, number> = {
  conflict: 0,
  possible_conflict: 1,
  unknown: 2,
  no_match_found: 3,
  not_applicable: 4,
};

function validateExtraction(pack: FixturePack) {
  const e = pack.extraction;
  check(
    "image quality uses frozen values and note is text or null",
    e.images.every(
      (img) =>
        IMAGE_QUALITIES.includes(img.quality) &&
        (img.note === null || typeof img.note === "string"),
    ),
  );
  check(`${pack.id}: schema_version "1"`, e.schema_version === "1");
  check(`${pack.id}: analysis_id present`, e.analysis_id.length > 0);
  check(
    `${pack.id}: images non-empty, indices 0..n-1`,
    e.images.length > 0 &&
      e.images.every((img, i) => img.index === i),
  );

  for (const key of ["ingredients", "allergen_statement", "nutrition", "product_details"] as const) {
    check(
      `${pack.id}: section ${key} has valid status`,
      SECTION_STATUSES.includes(e.sections[key].status),
    );
  }

  const imageCount = e.images.length;
  const rowsWithIndex = [
    ...e.ingredients,
    ...e.allergen_statements.contains,
    ...e.allergen_statements.may_contain,
    ...e.allergen_statements.other,
    ...e.nutrition,
    ...e.package_facts,
  ];
  check(
    `${pack.id}: every text row has label_text + evidence_quote`,
    rowsWithIndex.every((r) => r.label_text.length > 0 && r.evidence_quote.length > 0),
  );
  check(
    `${pack.id}: every text row image_index within bounds`,
    rowsWithIndex.every((r) => r.image_index === null || (r.image_index >= 0 && r.image_index < imageCount)),
  );
  check(
    `${pack.id}: marks have visual_description + in-bounds image_index`,
    e.marks.every(
      (m) =>
        m.visual_description.length > 0 &&
        m.image_index >= 0 &&
        m.image_index < imageCount,
    ),
  );

  // Nutrition honesty: value is preserved as text or explicitly unknown —
  // never invented; "0" stays "0".
  check(
    `${pack.id}: nutrition amounts are text or null (never numbers)`,
    e.nutrition.every((r) => r.amount_text === null || typeof r.amount_text === "string"),
  );
}

function validateExpected(pack: FixturePack) {
  const results = pack.expected;
  if (!results) {
    check(`${pack.id}: expected results present`, false);
    return;
  }
  const counts = new Map<ResultStatus, number>();
  for (const item of results.items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }
  check(
    `${pack.id}: summary matches item counts`,
    results.summary.conflict === (counts.get("conflict") ?? 0) &&
      results.summary.possible_conflict === (counts.get("possible_conflict") ?? 0) &&
      results.summary.no_match_found === (counts.get("no_match_found") ?? 0) &&
      results.summary.unknown === (counts.get("unknown") ?? 0),
  );
  check(
    `${pack.id}: items sorted by severity (conflict → possible → unknown → no-match)`,
    results.items.every(
      (item, i) => i === 0 || SEVERITY[results.items[i - 1].status] <= SEVERITY[item.status],
    ),
  );
  for (const item of results.items) {
    if (item.status === "conflict" || item.status === "possible_conflict") {
      check(
        `${pack.id}: ${item.profile_key} (${item.status}) carries evidence`,
        item.evidence.length > 0,
      );
    }
    if (item.status === "no_match_found") {
      check(
        `${pack.id}: ${item.profile_key} no-match wording includes the required caveat`,
        item.reason.includes("No match found in readable label text") &&
          item.reason.includes("not a safety check"),
      );
    }
    for (const ev of item.evidence) {
      if (ev.kind === "mark") {
        check(
          `${pack.id}: mark evidence uses visual description, never a fake quote`,
          ev.visual_description !== null && ev.evidence_quote === null,
        );
      } else {
        check(
          `${pack.id}: text evidence has a quote`,
          ev.evidence_quote !== null && ev.evidence_quote.length > 0,
        );
      }
    }
  }
}

// --- 1. Profile helpers ---------------------------------------------------

console.log("\nProfile helpers");
check("valid profile accepted", isValidProfile({ schema_version: "1", allergens: ["milk"], custom_avoid: [], diet: "vegan" }));
check("missing schema_version rejected", !isValidProfile({ allergens: [], custom_avoid: [], diet: "none" }));
check("wrong diet rejected", !isValidProfile({ schema_version: "1", allergens: [], custom_avoid: [], diet: "pescetarian" }));
check("non-string custom term rejected", !isValidProfile({ schema_version: "1", allergens: [], custom_avoid: [42], diet: "none" }));

check("empty profile has no restrictions", !profileHasRestrictions({ schema_version: "1", allergens: [], custom_avoid: [], diet: "none" }));
check("allergen counts as restriction", profileHasRestrictions({ schema_version: "1", allergens: ["peanut"], custom_avoid: [], diet: "none" }));
check("diet counts as restriction", profileHasRestrictions({ schema_version: "1", allergens: [], custom_avoid: [], diet: "vegetarian" }));

const summary = profileSummary({
  schema_version: "1",
  allergens: ["peanut", "tree_nut"],
  custom_avoid: ["sulphites"],
  diet: "vegetarian",
});
check(
  "profile summary lists presets, custom terms, and diet",
  summary === "Peanut · Tree nuts · sulphites · Vegetarian",
  summary,
);

// --- 2. Correction pipeline ------------------------------------------------

console.log("\nCorrection pipeline");
const baseRows: IngredientRow[] = [
  {
    id: "ing-1",
    label_text: "Groundnut 0il",
    evidence_quote: "Groundnut 0il",
    image_index: 0,
    review_required: true,
    review_reason: "misprint suspected",
  },
  {
    id: "ing-2",
    label_text: "Salt",
    evidence_quote: "Salt",
    image_index: 0,
    review_required: false,
    review_reason: null,
  },
];

const correctionBase: Extraction = {
  ...sampleCheeseCrackers.extraction,
  ingredients: baseRows,
};
const edited = applyCorrections(
  correctionBase,
  { "ing-1": "Groundnut Oil" },
  {},
  {},
);
check("edit rewrites the effective label_text", edited.ingredients[0].label_text === "Groundnut Oil");
check("edit marks the ingredient as user-edited", edited.ingredients[0].edited_by_user === true);
check("edit alone keeps review_required", edited.ingredients[0].review_required === true);
check("edit preserves source quote and image index", edited.ingredients[0].evidence_quote === "Groundnut 0il" && edited.ingredients[0].image_index === 0);
check("edit leaves the source extraction unchanged", correctionBase.ingredients[0].label_text === "Groundnut 0il");
check("untouched ingredient row unchanged", edited.ingredients[1].label_text === "Salt" && !edited.ingredients[1].edited_by_user);

const editedAndChecked = applyCorrections(
  correctionBase,
  { "ing-1": "Groundnut Oil" },
  { "ing-1": true },
  {},
);
check(
  "edit plus explicit photo check clears the row flag",
  editedAndChecked.ingredients[0].review_required === false &&
    editedAndChecked.ingredients[0].review_reason === null,
);

const checkedOnly = applyCorrections(correctionBase, {}, { "ing-1": true }, {});
check(
  "photo check alone clears the flag without editing",
  checkedOnly.ingredients[0].review_required === false &&
    checkedOnly.ingredients[0].label_text === "Groundnut 0il" &&
    checkedOnly.ingredients[0].edited_by_user !== true,
);

const restored = applyCorrections(correctionBase, {}, {}, { "ing-1": true });
check("restore keeps original text and drops the edited flag", restored.ingredients[0].label_text === "Groundnut 0il" && restored.ingredients[0].edited_by_user === false);

const originalAllergen = sampleCheeseCrackers.extraction.allergen_statements.contains[0];
const unclearAllergen: Extraction = {
  ...sampleCheeseCrackers.extraction,
  allergen_statements: {
    ...sampleCheeseCrackers.extraction.allergen_statements,
    contains: [
      {
        ...originalAllergen,
        label_text: "Wheat, Mi1k",
        review_required: true,
        review_reason: "Unclear character in the photo reading.",
      },
    ],
  },
};
const allergenId = allergenCorrectionId("contains", 0);
const allergenCorrection = { [allergenId]: "Wheat, Milk" };
const correctedAllergen = applyCorrections(
  unclearAllergen,
  allergenCorrection,
  {},
  {},
);
const correctedPhrase = correctedAllergen.allergen_statements.contains[0];
check("allergen phrase correction updates the effective text", correctedPhrase.label_text === "Wheat, Milk");
check("allergen edit alone keeps the phrase unresolved", correctedPhrase.review_required && correctedPhrase.review_reason !== null);
check("allergen edit preserves original quote and image index", correctedPhrase.evidence_quote === originalAllergen.evidence_quote && correctedPhrase.image_index === originalAllergen.image_index);
check("allergen edit does not add or remove phrases", correctedAllergen.allergen_statements.contains.length === unclearAllergen.allergen_statements.contains.length);
check("allergen correction leaves source extraction unchanged", unclearAllergen.allergen_statements.contains[0].label_text === "Wheat, Mi1k");
const milkComparison = compareProfile(
  correctedAllergen,
  { schema_version: "1", allergens: ["milk"], custom_avoid: [], diet: "none" },
  { ingredients_complete: false, allergen_statement_complete: false, pack_has_no_allergen_statement: false },
  aliasMapJson as unknown as Parameters<typeof compareProfile>[3],
);
const milkEvidence = milkComparison.items[0]?.evidence.find(
  (item) => item.evidence_quote === originalAllergen.evidence_quote,
);
check("allergen correction recomputes evidence with corrected wording", milkEvidence?.label_text === "Wheat, Milk" && milkEvidence.evidence_quote === originalAllergen.evidence_quote);
const allergenEvidence = collectEditedEvidence(unclearAllergen, allergenCorrection);
const correctedAllergenKey = editedEvidenceKey({
  section: "allergen_statement",
  evidence_quote: originalAllergen.evidence_quote,
  image_index: originalAllergen.image_index,
  label_text: "Wheat, Milk",
});
check("edited evidence lookup includes source quote, image, and corrected phrase", allergenEvidence.get(correctedAllergenKey) === "Wheat, Milk");
const confirmedAllergen = applyCorrections(
  unclearAllergen,
  allergenCorrection,
  { [allergenId]: true },
  {},
).allergen_statements.contains[0];
check("only explicit photo confirmation clears allergen review", !confirmedAllergen.review_required && confirmedAllergen.review_reason === null);

const unclearPartial: Extraction = {
  ...sampleChocoBar.extraction,
  ingredients: sampleChocoBar.extraction.ingredients.map((row, index) =>
    index === 0
      ? {
          ...row,
          label_text: "Suger",
          review_required: true,
          review_reason: "Unclear character in the photo reading.",
        }
      : row,
  ),
};
const partialCorrected = applyCorrections(
  unclearPartial,
  { "ing-1": "Sugar" },
  { "ing-1": true },
  {},
);
check("row correction and confirmation do not upgrade partial section status", partialCorrected.sections.ingredients.status === "readable_partial");
check("unuploaded allergen section stays unresolved after a row correction", partialCorrected.sections.allergen_statement.status === "not_uploaded");
check("partial extraction keeps allergen arrays empty", partialCorrected.allergen_statements.contains.length === 0 && partialCorrected.allergen_statements.may_contain.length === 0 && partialCorrected.allergen_statements.other.length === 0);
const partialResults = compareProfile(
  partialCorrected,
  { schema_version: "1", allergens: ["peanut"], custom_avoid: [], diet: "none" },
  { ingredients_complete: true, allergen_statement_complete: true, pack_has_no_allergen_statement: false },
  aliasMapJson as unknown as Parameters<typeof compareProfile>[3],
);
check("correcting and confirming a row in partial extraction cannot produce no-match", partialResults.items.every((item) => item.status === "unknown"));

// --- 2b. Current-scan export -----------------------------------------------

console.log("\nCurrent-scan export");
const correctedAllergenCsv = buildScanCsv({
  extraction: unclearAllergen,
  results: milkComparison,
  confirm: { ingredients_complete: false, allergen_statement_complete: false, pack_has_no_allergen_statement: false },
  corrections: allergenCorrection,
  rowChecked: {},
  rowRestored: {},
});
check("CSV starts with an Excel-friendly UTF-8 BOM and CRLF rows", correctedAllergenCsv.startsWith("\uFEFF") && correctedAllergenCsv.includes("\r\n"));
check("CSV keeps a corrected allergen value separate from its original evidence", correctedAllergenCsv.includes('"Wheat, Milk","Wheat, Mi1k"') && correctedAllergenCsv.includes(originalAllergen.evidence_quote));
check("CSV carries the comparison status and rule", correctedAllergenCsv.includes("possible_conflict") && correctedAllergenCsv.includes("R3"));
check("CSV labels edited but unconfirmed evidence unresolved", correctedAllergenCsv.includes("user-corrected; unresolved") && correctedAllergenCsv.includes(",true,"));
check("CSV records missing and partial sections without claiming absence", (() => {
  const csv = buildScanCsv({
    extraction: unclearPartial,
    results: partialResults,
    confirm: { ingredients_complete: true, allergen_statement_complete: true, pack_has_no_allergen_statement: false },
    corrections: { "ing-1": "Sugar" },
    rowChecked: { "ing-1": true },
    rowRestored: {},
  });
  return csv.includes("readable_partial") && csv.includes("not_uploaded") &&
    csv.includes("No rows extracted; absence is not confirmed") && !csv.includes("no_match_found");
})());
check("CSV quotes cells and neutralizes formula-like values", escapeCsvCell("a,b\"c") === '"a,b""c"' && escapeCsvCell("=1+1") === "'=1+1");

// --- 3. Mock fixture packs ---------------------------------------------------

console.log("\nMock fixture packs");
const packs = [sampleMasalaBiscuits, sampleCheeseCrackers, sampleRicePuffs, sampleChocoBar];
for (const pack of packs) {
  validateExtraction(pack);
  validateExpected(pack);
}

// Scenario honesty: the blurry/cropped fixture must not contain a no-match.
check(
  "choco-bar (unreadable panels) never claims no-match",
  (sampleChocoBar.expected as Results).items.every((i) => i.status === "unknown"),
);
// Scenario honesty: flagged rows downgrade conflicts to possible (G4/G15/G16).
check(
  "cheese-crackers (flagged rows) has zero plain conflicts",
  (sampleCheeseCrackers.expected as Results).summary.conflict === 0 &&
    (sampleCheeseCrackers.expected as Results).summary.possible_conflict > 0,
);
// Scenario honesty: no-match only where everything is confirmed (G7).
check(
  "rice-puffs no-match only with all confirmations",
  (sampleRicePuffs.expected as Results).summary.no_match_found === 4 &&
    sampleRicePuffs.demoConfirm?.ingredients_complete === true,
);

// --- Result ------------------------------------------------------------------

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
