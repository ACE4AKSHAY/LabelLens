#!/usr/bin/env node
// Mission 4 Test 3: focused, read-only checks against an existing LabelLens checkout.
// Run from a repo with tsx available:
//   npx tsx <path-to-this-file> <path-to-LabelLens-repo>
// This script reads project files and does not write to the repository.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2] ?? process.cwd());
const readJson = (relativePath) => JSON.parse(readFileSync(join(root, relativePath), "utf8"));
const expectedFile = readJson("shared/fixtures/expected_results.json");
const aliasMap = readJson("frontend/src/domain/aliasMap.json");
const checkRulesSource = readFileSync(join(root, "scripts/check_rules.mjs"), "utf8");
const nutritionSource = readFileSync(join(root, "frontend/src/components/NutritionTable.tsx"), "utf8");
const contractsSource = readFileSync(join(root, "shared/contracts.ts"), "utf8");
const { compareProfile } = await import(pathToFileURL(join(root, "frontend/src/domain/compareProfile.ts")).href);
const { applyCorrections } = await import(pathToFileURL(join(root, "frontend/src/state/applyCorrections.ts")).href);

let failures = 0;
function report(name, input, expected, actual, evidence, issues = "none observed") {
  const pass = actual.ok === true;
  console.log(`\n${pass ? "PASS" : "FAIL"} — ${name}`);
  console.log(`Input: ${input}`);
  console.log(`Expected: ${expected}`);
  console.log(`Actual: ${actual.description}`);
  console.log(`Source evidence: ${evidence}`);
  console.log(`Issue: ${pass ? issues : (actual.issue ?? "assertion did not match expected behavior")}`);
  if (!pass) failures++;
}
function fixtureExpected(id) {
  const item = expectedFile.cases.find((testCase) => testCase.id === id);
  assert.ok(item, `Missing expected-results case ${id}`);
  return item;
}

// 1. Ambiguous ingredient wording (G14).
{
  const testCase = fixtureExpected("G14");
  const extraction = readJson(`shared/fixtures/extraction/${testCase.fixture}`);
  const actualResults = compareProfile(extraction, testCase.profile, testCase.confirm, aliasMap);
  const soy = actualResults.items.find((item) => item.profile_key === "soy");
  const expected = testCase.expected.soy;
  const ok = soy?.status === expected.status && soy?.rule_id === expected.rule;
  report(
    "Ambiguous term stays uncertain",
    `${testCase.fixture}; ingredient/quote = ${JSON.stringify(extraction.ingredients.find((row) => row.label_text === "Emulsifier")?.label_text)}`,
    `soy ${expected.status} (${expected.rule})`,
    { ok, description: `soy ${soy?.status} (${soy?.rule_id}); evidence quote ${JSON.stringify(soy?.evidence[0]?.evidence_quote)}` },
    `expected_results.json G14: ${testCase.description}; compareProfile.ts R3 handles ambiguous map entries as review-gated possible conflicts.`,
  );
}

// 2. Partial nutrition: retain visible values; do not turn missing values into zero.
{
  const testCase = fixtureExpected("G5");
  const extraction = readJson(`shared/fixtures/extraction/${testCase.fixture}`);
  const actualResults = compareProfile(extraction, expectedFile.default_profile, testCase.confirm, aliasMap);
  const expectedStatuses = Object.entries(testCase.expected).map(([key, value]) => [key, value.status, value.rule]);
  const actualStatuses = expectedStatuses.map(([key]) => {
    const item = actualResults.items.find((result) => result.profile_key === key);
    return [key, item?.status, item?.rule_id];
  });
  const protein = extraction.nutrition.find((row) => row.nutrient === "Protein");
  const energy = extraction.nutrition.find((row) => row.nutrient === "Energy");
  const uiHonest =
    nutritionSource.includes("const readable = row.amount_text !== null") &&
    nutritionSource.includes("couldn't read the value") &&
    nutritionSource.includes("Values are shown exactly as printed") &&
    contractsSource.includes("amount_text: string | null");
  const noInventedZero = protein?.amount_text === null && protein?.unit === null && protein?.basis === null;
  const ok = JSON.stringify(actualStatuses) === JSON.stringify(expectedStatuses) && uiHonest && noInventedZero;
  report(
    "Incomplete nutrition remains unknown, not zero",
    `${testCase.fixture}; nutrition status=${extraction.sections.nutrition.status}; Protein amount/unit/basis=null; Energy=${energy?.amount_text} ${energy?.unit} ${energy?.basis}`,
    `profile items ${JSON.stringify(expectedStatuses)}; Protein remains unknown and UI labels unreadable values`,
    { ok, description: `profile items ${JSON.stringify(actualStatuses)}; Protein amount=${JSON.stringify(protein?.amount_text)}; Energy preserved as ${energy?.amount_text} ${energy?.unit}; UI unknown-value rendering ${uiHonest ? "present" : "missing"}` },
    `G5 fixture review_reason: ${JSON.stringify(protein?.review_reason)}; NutritionTable.tsx renders null amounts as “couldn't read the value” and displays printed values unchanged; contracts.ts permits amount_text null.`,
  );
}

// 3. OCR correction retains the original quote and remains review-gated until photo check.
{
  const testCase = fixtureExpected("X5");
  const extraction = readJson(`shared/fixtures/extraction/${testCase.fixture}`);
  const profile = testCase.profile;
  const before = compareProfile(extraction, profile, testCase.confirm, aliasMap).items[0];
  const editedOnly = applyCorrections(extraction, { "ing-2": "Milk" }, {}, {});
  const afterEdit = compareProfile(editedOnly, profile, testCase.confirm, aliasMap).items[0];
  const checked = applyCorrections(extraction, { "ing-2": "Milk" }, { "ing-2": true }, {});
  const afterCheck = compareProfile(checked, profile, testCase.confirm, aliasMap).items[0];
  const correctedEvidence = afterCheck?.evidence.find((item) => item.label_text === "Milk");
  const ok = before?.status === "unknown" && afterEdit?.status === "possible_conflict" &&
    editedOnly.ingredients.find((row) => row.id === "ing-2")?.review_required === true &&
    afterCheck?.status === "conflict" && correctedEvidence?.evidence_quote === "Mik";
  report(
    "Correction retains source quote and requires photo check",
    `${testCase.fixture}; row “Mik” corrected to “Milk”`,
    `before=unknown; edit-only=possible_conflict/review required; photo-checked=conflict with source quote “Mik”`,
    { ok, description: `before=${before?.status}; edit-only=${afterEdit?.status} (review=${editedOnly.ingredients.find((row) => row.id === "ing-2")?.review_required}); checked=${afterCheck?.status}; evidence label=${JSON.stringify(correctedEvidence?.label_text)}, quote=${JSON.stringify(correctedEvidence?.evidence_quote)}` },
    `check_rules.mjs X5 correction transitions assert original quote retention; moduleAChecks.ts asserts edits preserve evidence_quote and review_required absent explicit photo check.`,
  );
}

// 4. Mission 3 disagreement regressions from check_rules.mjs.
{
  const profile = { schema_version: "1", allergens: ["soy", "wheat_gluten"], custom_avoid: [], diet: "none" };
  const confirm = { ingredients_complete: true, allergen_statement_complete: true, pack_has_no_allergen_statement: false };
  const disagreement = readJson("shared/fixtures/extraction/g4_milk_solids_row_needs_review.json");
  const disagreementRow = disagreement.ingredients.find((row) => row.id === "ing-3");
  Object.assign(disagreementRow, { label_text: "Wheat", evidence_quote: "Wheat", review_required: false, review_reason: null, suggested_group: { group: "soy", note: "synthetic contradiction regression" } });
  disagreement.ingredients = [disagreementRow];
  disagreement.allergen_statements = { contains: [], may_contain: [], other: [] };
  const results = compareProfile(disagreement, profile, confirm, aliasMap).items;
  const ok = results.length === 2 && results.every((item) => item.status === "possible_conflict" && item.rule_id === "R9" && item.reason.includes("Check this phrase against the photo") && item.evidence.some((ev) => ev.evidence_quote === "Wheat" && ev.image_index === 0));
  report(
    "Printed Wheat vs model-suggested soy requests review",
    "Mission 3 disagreement case: printed Wheat; suggested_group soy",
    "soy and wheat_gluten both possible_conflict (R9), with photo-review wording and quote Wheat",
    { ok, description: results.map((item) => `${item.profile_key}=${item.status}/${item.rule_id}, quote=${JSON.stringify(item.evidence[0]?.evidence_quote)}`).join("; ") },
    "check_rules.mjs Mission 3 printed-term/model-group transition; compareProfile.ts R9 retains the printed signal and suggestion disagreement.",
  );
}
{
  const fixture = readJson("shared/fixtures/extraction/g3_may_contain_tree_nut.json");
  fixture.allergen_statements.contains = fixture.allergen_statements.may_contain;
  fixture.allergen_statements.may_contain = [];
  const result = compareProfile(fixture, { schema_version: "1", allergens: ["tree_nut"], custom_avoid: [], diet: "none" }, { ingredients_complete: true, allergen_statement_complete: true, pack_has_no_allergen_statement: false }, aliasMap).items[0];
  const ok = result?.status === "possible_conflict" && result.rule_id === "R9" && result.reason.includes("direct contains statement") && result.evidence[0]?.evidence_quote?.includes("May contain");
  report(
    "May-contain wording mislabeled as contains requests review",
    "Mission 3 disagreement case: may-contain phrase assigned to contains bucket",
    "tree_nut possible_conflict (R9), with original May contain quote",
    { ok, description: `${result?.status}/${result?.rule_id}; quote=${JSON.stringify(result?.evidence[0]?.evidence_quote)}; reason=${result?.reason}` },
    "check_rules.mjs Mission 3 bucket-disagreement transition; compareProfile.ts statementBucketMismatch and R9 preserve quoted wording.",
  );
}
{
  const fixture = readJson("shared/fixtures/extraction/g10_nonveg_mark_clear.json");
  fixture.marks.push({ kind: "veg_mark", visual_description: "green vegetarian dot", image_index: 0, review_required: false, review_reason: null });
  const result = compareProfile(fixture, { schema_version: "1", allergens: [], custom_avoid: [], diet: "vegetarian" }, { ingredients_complete: true, allergen_statement_complete: true, pack_has_no_allergen_statement: false }, aliasMap).items[0];
  const markEvidence = result?.evidence.filter((item) => item.kind === "mark");
  const ok = result?.status === "possible_conflict" && result.rule_id === "R9" && result.reason.includes("both vegetarian and non-vegetarian") && (markEvidence?.length ?? 0) >= 2;
  report(
    "Conflicting diet marks remain unresolved",
    "Mission 3 disagreement case: both vegetarian and non-vegetarian marks extracted",
    "diet_vegetarian possible_conflict (R9), with both visual evidence items",
    { ok, description: `${result?.status}/${result?.rule_id}; visual evidence count=${markEvidence?.length}; reason=${result?.reason}` },
    "check_rules.mjs Mission 3 contradictory-mark transition; compareProfile.ts emits R9 and retains both mark evidence items.",
  );
}

// Confirm the existing rule checker contains the Mission 3 regressions this script mirrors.
const mission3CasesPresent = [
  "MISSION 3 printed Wheat vs model soy disagreement",
  "MISSION 3 may-contain wording mislabeled as contains",
  "MISSION 3 contradictory dietary marks",
].every((snippet) => checkRulesSource.includes(snippet));
report(
  "Mission 3 disagreement regressions are present in existing rule checker",
  "scripts/check_rules.mjs",
  "all three disagreement regressions present",
  { ok: mission3CasesPresent, description: mission3CasesPresent ? "all three named regression checks found" : "one or more expected regression checks missing", issue: "expected assertion text not found" },
  "scripts/check_rules.mjs Mission 3 transition checks.",
);

console.log(`\nMission 4 Test 3: ${failures === 0 ? "PASS" : `FAIL (${failures} failed)`}`);
if (failures > 0) process.exitCode = 1;
