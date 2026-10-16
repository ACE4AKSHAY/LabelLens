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
import { applyCorrections } from "../state/applyCorrections";
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

const SEVERITY: Record<ResultStatus, number> = {
  conflict: 0,
  possible_conflict: 1,
  unknown: 2,
  no_match_found: 3,
  not_applicable: 4,
};

function validateExtraction(pack: FixturePack) {
  const e = pack.extraction;
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

const edited = applyCorrections(baseRows, { "ing-1": "Groundnut Oil" }, {}, {});
check("edit rewrites label_text", edited[0].label_text === "Groundnut Oil");
check("edit sets edited_by_user", edited[0].edited_by_user === true);
check("edit alone keeps review_required", edited[0].review_required === true);
check("untouched row unchanged", edited[1].label_text === "Salt" && !edited[1].edited_by_user);

const editedAndChecked = applyCorrections(baseRows, { "ing-1": "Groundnut Oil" }, { "ing-1": true }, {});
check(
  "edit + I-checked-this-row clears the flag",
  editedAndChecked[0].review_required === false && editedAndChecked[0].review_reason === null,
);

const checkedOnly = applyCorrections(baseRows, {}, { "ing-1": true }, {});
check(
  "I-checked-this-row alone clears the flag without editing",
  checkedOnly[0].review_required === false && checkedOnly[0].label_text === "Groundnut 0il" && checkedOnly[0].edited_by_user !== true,
);

const restored = applyCorrections(edited, {}, {}, { "ing-1": true });
check("restore keeps original text but drops the edited flag", restored[0].label_text === "Groundnut Oil" && restored[0].edited_by_user === false);

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
