// Module C golden-case check: npm run check:rules
// Runs compareProfile over every fixture in shared/fixtures/expected_results.json,
// validates fixture structure, and prints one row per case (expected vs actual, PASS/FAIL).
// The authoritative schema check is scripts/validate_fixtures.py (Pydantic); this file
// mirrors the contract structurally so the check also runs on machines without Python.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compareProfile } from "../frontend/src/domain/compareProfile.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES_DIR = join(ROOT, "shared", "fixtures", "extraction");

const SECTION_STATUSES = new Set(["readable_complete", "readable_partial", "unreadable", "not_uploaded", "ambiguous"]);
const IMAGE_QUALITIES = new Set(["good", "blurry", "cropped", "glare", "unusable"]);
const IMAGE_ROLES = new Set(["ingredients", "allergens", "nutrition", "front", "other", "unknown"]);
const MARK_KINDS = new Set(["veg_mark", "nonveg_mark", "uncertain_diet_mark"]);
const PACKAGE_KINDS = new Set([
  "product_name", "brand", "quantity", "manufacture_date", "best_before", "expiry_date", "batch_code",
]);
const SEVERITY = ["conflict", "possible_conflict", "unknown", "no_match_found", "not_applicable"];

const EXTRACTION_KEYS = [
  "schema_version", "analysis_id", "images", "product", "package_facts", "sections",
  "ingredients", "allergen_statements", "marks", "nutrition", "warnings",
];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringOrNull(value) {
  return typeof value === "string" || value === null;
}

function checkReviewablePhrase(phrase, where, problems) {
  if (!isPlainObject(phrase)) {
    problems.push(`${where}: not an object`);
    return;
  }
  for (const key of ["label_text", "evidence_quote", "review_required"]) {
    if (!(key in phrase)) problems.push(`${where}: missing ${key}`);
  }
  if (typeof phrase.label_text !== "string") problems.push(`${where}: label_text must be a string`);
  if (typeof phrase.evidence_quote !== "string") problems.push(`${where}: evidence_quote must be a string`);
  if (!("image_index" in phrase)) problems.push(`${where}: missing image_index`);
  if (phrase.image_index !== null && !Number.isInteger(phrase.image_index)) problems.push(`${where}: image_index must be a number or null`);
  if (typeof phrase.review_required !== "boolean") problems.push(`${where}: review_required must be a boolean`);
  if (!("review_reason" in phrase)) problems.push(`${where}: missing review_reason`);
  if (!isStringOrNull(phrase.review_reason)) problems.push(`${where}: review_reason must be a string or null`);
}

function checkSection(section, where, problems) {
  if (!isPlainObject(section)) {
    problems.push(`${where}: not an object`);
    return;
  }
  if (!SECTION_STATUSES.has(section.status)) problems.push(`${where}: invalid status ${JSON.stringify(section.status)}`);
  if (!isStringOrNull(section.text)) problems.push(`${where}: text must be a string or null`);
  if (section.image_index !== null && !Number.isInteger(section.image_index)) problems.push(`${where}: image_index must be a number or null`);
  if (!isStringOrNull(section.reason)) problems.push(`${where}: reason must be a string or null`);
}

function validateFixtureShape(extraction, name) {
  const problems = [];
  if (!isPlainObject(extraction)) return [`${name}: not an object`];
  for (const key of EXTRACTION_KEYS) {
    if (!(key in extraction)) problems.push(`${name}: missing top-level key ${key}`);
  }
  for (const key of Object.keys(extraction)) {
    if (!EXTRACTION_KEYS.includes(key)) problems.push(`${name}: unexpected key ${key}`);
  }
  if (extraction.schema_version !== "1") problems.push(`${name}: schema_version must be "1"`);
  if (typeof extraction.analysis_id !== "string") problems.push(`${name}: analysis_id must be a string`);
  if (!Array.isArray(extraction.images)) problems.push(`${name}: images must be an array`);
  else {
    extraction.images.forEach((image, i) => {
      const where = `${name}: images[${i}]`;
      if (!IMAGE_ROLES.has(image.role)) problems.push(`${where}: invalid role`);
      if (!IMAGE_QUALITIES.has(image.quality)) problems.push(`${where}: invalid quality`);
      if (!Number.isInteger(image.index)) problems.push(`${where}: index must be a number`);
      if (!isStringOrNull(image.note)) problems.push(`${where}: note must be a string or null`);
    });
  }
  const product = extraction.product;
  if (!isPlainObject(product) || !isStringOrNull(product.name) || !isStringOrNull(product.brand) || !isStringOrNull(product.quantity)) {
    problems.push(`${name}: product must be {name, brand, quantity} of string or null`);
  }
  if (!Array.isArray(extraction.package_facts)) problems.push(`${name}: package_facts must be an array`);
  else {
    extraction.package_facts.forEach((fact, i) => {
      checkReviewablePhrase(fact, `${name}: package_facts[${i}]`, problems);
      if (!PACKAGE_KINDS.has(fact.kind)) problems.push(`${name}: package_facts[${i}]: invalid kind`);
      if (typeof fact.value_text !== "string") problems.push(`${name}: package_facts[${i}]: value_text must be a string`);
    });
  }
  const sections = extraction.sections;
  if (!isPlainObject(sections)) problems.push(`${name}: sections must be an object`);
  else {
    for (const key of ["ingredients", "allergen_statement", "nutrition", "product_details"]) {
      if (!(key in sections)) problems.push(`${name}: sections missing ${key}`);
      else checkSection(sections[key], `${name}: sections.${key}`, problems);
    }
  }
  if (!Array.isArray(extraction.ingredients)) problems.push(`${name}: ingredients must be an array`);
  else {
    extraction.ingredients.forEach((row, i) => {
      checkReviewablePhrase(row, `${name}: ingredients[${i}]`, problems);
      if (typeof row.id !== "string") problems.push(`${name}: ingredients[${i}]: id must be a string`);
      if ("edited_by_user" in row && typeof row.edited_by_user !== "boolean") {
        problems.push(`${name}: ingredients[${i}]: edited_by_user must be a boolean`);
      }
      if ("suggested_group" in row && row.suggested_group !== null) {
        if (!isPlainObject(row.suggested_group) || typeof row.suggested_group.group !== "string" || typeof row.suggested_group.note !== "string") {
          problems.push(`${name}: ingredients[${i}]: suggested_group must be {group, note} or null`);
        }
      }
    });
  }
  const statements = extraction.allergen_statements;
  if (!isPlainObject(statements)) problems.push(`${name}: allergen_statements must be an object`);
  else {
    for (const key of ["contains", "may_contain", "other"]) {
      if (!Array.isArray(statements[key])) problems.push(`${name}: allergen_statements.${key} must be an array`);
      else statements[key].forEach((phrase, i) => checkReviewablePhrase(phrase, `${name}: allergen_statements.${key}[${i}]`, problems));
    }
  }
  if (!Array.isArray(extraction.marks)) problems.push(`${name}: marks must be an array`);
  else {
    extraction.marks.forEach((mark, i) => {
      const where = `${name}: marks[${i}]`;
      if (!MARK_KINDS.has(mark.kind)) problems.push(`${where}: invalid kind`);
      if (typeof mark.visual_description !== "string") problems.push(`${where}: visual_description must be a string`);
      if (!Number.isInteger(mark.image_index)) problems.push(`${where}: image_index must be a number`);
      if (typeof mark.review_required !== "boolean") problems.push(`${where}: review_required must be a boolean`);
      if (!isStringOrNull(mark.review_reason)) problems.push(`${where}: review_reason must be a string or null`);
    });
  }
  if (!Array.isArray(extraction.nutrition)) problems.push(`${name}: nutrition must be an array`);
  else {
    extraction.nutrition.forEach((row, i) => {
      checkReviewablePhrase(row, `${name}: nutrition[${i}]`, problems);
      if (typeof row.id !== "string") problems.push(`${name}: nutrition[${i}]: id must be a string`);
      for (const key of ["nutrient", "amount_text", "unit", "basis"]) {
        if (!(key in row)) problems.push(`${name}: nutrition[${i}]: missing ${key}`);
        else if (!isStringOrNull(row[key])) problems.push(`${name}: nutrition[${i}]: ${key} must be a string or null`);
      }
    });
  }
  if (!Array.isArray(extraction.warnings) || extraction.warnings.some((w) => typeof w !== "string")) {
    problems.push(`${name}: warnings must be an array of strings`);
  }
  return problems;
}

function buildAliasMap(base, testCase) {
  const map = structuredClone(base);
  for (const term of testCase.reviewed_terms ?? []) {
    const entry = map.entries.find((candidate) => candidate.term === term);
    if (!entry) throw new Error(`Case ${testCase.id}: reviewed term "${term}" is not in the alias map`);
    entry.reviewed = true;
  }
  for (const term of testCase.reviewed_diet_terms ?? []) {
    const dietTerm = map.diet_terms.find((candidate) => candidate.term === term);
    if (!dietTerm) throw new Error(`Case ${testCase.id}: reviewed diet term "${term}" is not in the alias map`);
    dietTerm.reviewed = true;
  }
  return map;
}

// Independent mirror of the R6 gate, used to prove no case reaches no_match_found
// without complete, confirmed, review-free evidence.
function r6Gate(extraction, confirm) {
  if (extraction.sections.ingredients.status !== "readable_complete") return false;
  if (!confirm.ingredients_complete) return false;
  const statementChecked =
    extraction.sections.allergen_statement.status === "readable_complete" && confirm.allergen_statement_complete;
  if (!statementChecked && !confirm.pack_has_no_allergen_statement) return false;
  const rows = [
    ...extraction.ingredients,
    ...extraction.allergen_statements.contains,
    ...extraction.allergen_statements.may_contain,
    ...extraction.allergen_statements.other,
  ];
  return !rows.some((row) => row.review_required);
}

const expected = JSON.parse(readFileSync(join(ROOT, "shared", "fixtures", "expected_results.json"), "utf8"));
const aliasMapBase = JSON.parse(readFileSync(join(ROOT, "frontend", "src", "domain", "aliasMap.json"), "utf8"));

let failed = false;

// 1. Structural validation of every fixture file, used or not.
const fixtureFiles = readdirSync(FIXTURES_DIR).filter((file) => file.endsWith(".json"));
for (const file of fixtureFiles) {
  const extraction = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8"));
  const problems = validateFixtureShape(extraction, file);
  if (problems.length > 0) {
    failed = true;
    console.log(`FIXTURE ${file} FAIL`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
}
if (!failed) console.log(`FIXTURES ${fixtureFiles.length}/${fixtureFiles.length} structurally valid`);

// 2. Golden cases.
let passCount = 0;
for (const testCase of expected.cases) {
  const extraction = JSON.parse(readFileSync(join(FIXTURES_DIR, testCase.fixture), "utf8"));
  const profile = testCase.profile ?? expected.default_profile;
  const confirm = testCase.confirm;
  const aliasMap = buildAliasMap(aliasMapBase, testCase);
  const results = compareProfile(extraction, profile, confirm, aliasMap);

  const problems = [];
  for (const [key, expectation] of Object.entries(testCase.expected)) {
    const item = results.items.find((candidate) => candidate.profile_key === key);
    if (!item) {
      problems.push(`${key}: missing from results`);
      continue;
    }
    if (item.status !== expectation.status) {
      problems.push(`${key}: expected ${expectation.status}, got ${item.status}`);
    }
    if (expectation.rule && item.rule_id !== expectation.rule) {
      problems.push(`${key}: expected rule ${expectation.rule}, got ${item.rule_id}`);
    }
    const reasonIncludes = testCase.expect_reason_includes?.[key];
    if (reasonIncludes && !item.reason.includes(reasonIncludes)) {
      problems.push(`${key}: reason does not include "${reasonIncludes}" (reason: "${item.reason}")`);
    }
    const expectedTexts = testCase.expect_evidence_label_text?.[key];
    if (expectedTexts) {
      const got = item.evidence.map((e) => e.label_text).filter((text) => text !== null);
      for (const text of expectedTexts) {
        if (!got.includes(text)) problems.push(`${key}: evidence is missing label_text "${text}" (got: ${JSON.stringify(got)})`);
      }
    }
  }
  for (const item of results.items) {
    if (!testCase.expected[item.profile_key]) {
      problems.push(`${item.profile_key}: result item has no recorded expectation`);
    }
  }

  if (results.schema_version !== "1") problems.push("results.schema_version must be \"1\"");
  const summaryCheck = { ...results.summary };
  for (const item of results.items) summaryCheck[item.status] -= 1;
  for (const [status, remainder] of Object.entries(summaryCheck)) {
    if (remainder !== 0) problems.push(`summary count for ${status} does not match items`);
  }
  for (let i = 1; i < results.items.length; i++) {
    if (SEVERITY.indexOf(results.items[i - 1].status) > SEVERITY.indexOf(results.items[i].status)) {
      problems.push(`items are not sorted by severity at index ${i}`);
    }
  }
  const expectedCoverage = {
    ingredients: extraction.sections.ingredients.status,
    allergen_statement: extraction.sections.allergen_statement.status,
    nutrition: extraction.sections.nutrition.status,
    product_details: extraction.sections.product_details.status,
    ingredients_confirmed: confirm.ingredients_complete,
    allergen_statement_checked: confirm.allergen_statement_complete || confirm.pack_has_no_allergen_statement,
  };
  for (const [key, value] of Object.entries(expectedCoverage)) {
    if (results.coverage[key] !== value) problems.push(`coverage.${key}: expected ${value}, got ${results.coverage[key]}`);
  }
  for (const item of results.items) {
    if (item.status === "no_match_found" && !r6Gate(extraction, confirm)) {
      problems.push(`${item.profile_key}: returned no_match_found while the R6 gate does not hold`);
    }
  }

  const detail = results.items
    .map((item) => `${item.profile_key}=${item.status}/${item.rule_id}`)
    .join(" ");
  if (problems.length === 0) {
    passCount += 1;
    console.log(`${testCase.id}  PASS  ${detail}`);
  } else {
    failed = true;
    console.log(`${testCase.id}  FAIL  ${detail}`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
}

// The UI correction contract is deliberately small: retain the provider quote,
// store the user wording, and clear review_required only after a photo check.
// These integration checks run that transition before comparing again.
function applyCorrections(extraction, corrections) {
  const corrected = structuredClone(extraction);
  for (const correction of corrections) {
    const row = corrected.ingredients.find((candidate) => candidate.id === correction.id);
    if (!row) throw new Error(`Correction row ${correction.id} was not found`);
    row.label_text = correction.label_text;
    row.edited_by_user = true;
    if (correction.checked_against_photo) {
      row.review_required = false;
      row.review_reason = null;
    }
  }
  return corrected;
}

function checkTransition(label, condition) {
  if (condition) console.log(`${label}  PASS`);
  else {
    failed = true;
    console.log(`${label}  FAIL`);
  }
}

const completeConfirm = {
  ingredients_complete: true,
  allergen_statement_complete: true,
  pack_has_no_allergen_statement: false,
};
function singleResult(extraction, profile) {
  return compareProfile(extraction, profile, completeConfirm, aliasMapBase).items[0];
}

// Correct an uncertain OCR row, explicitly check it against the photo, then
// compare again. The corrected wording drives matching while original evidence
// remains intact for review.
const correctedGroundnutFixture = JSON.parse(
  readFileSync(join(FIXTURES_DIR, "g13_edited_groundnut_row.json"), "utf8"),
);
const uncertainGroundnutFixture = structuredClone(correctedGroundnutFixture);
const uncertainGroundnutRow = uncertainGroundnutFixture.ingredients.find((row) => row.id === "ing-2");
uncertainGroundnutRow.label_text = "Groundnut 0il";
uncertainGroundnutRow.edited_by_user = false;
uncertainGroundnutRow.review_required = true;
uncertainGroundnutRow.review_reason = "OCR read a zero in the word oil; check against the photo.";
const peanutProfile = { schema_version: "1", allergens: ["peanut"], custom_avoid: [], diet: "none" };
const beforeCorrection = singleResult(uncertainGroundnutFixture, peanutProfile);
const afterCorrectionFixture = applyCorrections(uncertainGroundnutFixture, [{
  id: "ing-2",
  label_text: "Groundnut Oil",
  checked_against_photo: true,
}]);
const afterCorrection = singleResult(afterCorrectionFixture, peanutProfile);
checkTransition("CORRECTION uncertain OCR row is conservatively possible_conflict", beforeCorrection.status === "possible_conflict");
checkTransition("CORRECTION checked wording remains possible_conflict", afterCorrection.status === "possible_conflict");
checkTransition(
  "CORRECTION comparison recalculates wording and retains quote",
  beforeCorrection.evidence.some((item) => item.label_text === "Groundnut 0il") &&
    afterCorrection.evidence.some((item) => item.label_text === "Groundnut Oil" && item.evidence_quote === "Groundnut 0il"),
);

// Unlike groundnut, the OCR spelling "Mik" has no milk match. Once the user
// supplies the correct wording, the exact-term path is still review-gated
// until the row is explicitly checked against the photo.
const mikFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "x5_mik_correction_needs_check.json"), "utf8"));
const milkProfile = { schema_version: "1", allergens: ["milk"], custom_avoid: [], diet: "none" };
const beforeMikCorrection = singleResult(mikFixture, milkProfile);
const correctedMikWithoutPhotoCheck = applyCorrections(mikFixture, [{
  id: "ing-2",
  label_text: "Milk",
  checked_against_photo: false,
}]);
const correctedMikWithoutPhotoCheckResult = singleResult(correctedMikWithoutPhotoCheck, milkProfile);
const correctedMikWithPhotoCheck = applyCorrections(mikFixture, [{
  id: "ing-2",
  label_text: "Milk",
  checked_against_photo: true,
}]);
const correctedMikWithPhotoCheckResult = singleResult(correctedMikWithPhotoCheck, milkProfile);
checkTransition("CORRECTION Mik starts unknown", beforeMikCorrection.status === "unknown");
checkTransition(
  "CORRECTION text edit alone keeps review_required and blocks conflict",
  correctedMikWithoutPhotoCheck.ingredients.find((row) => row.id === "ing-2").review_required &&
    correctedMikWithoutPhotoCheckResult.status === "possible_conflict",
);
checkTransition("CORRECTION checked Milk row becomes conflict", correctedMikWithPhotoCheckResult.status === "conflict");
checkTransition(
  "CORRECTION checked Milk evidence keeps the original quote",
  correctedMikWithPhotoCheckResult.evidence.some((item) => item.label_text === "Milk" && item.evidence_quote === "Mik"),
);

// A correction cannot turn a partial label into a complete one, so it cannot
// open the R6 no-match path.
const partialFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "g5_ingredients_partial_no_hits.json"), "utf8"));
const partialCorrectedFixture = applyCorrections(partialFixture, [{
  id: "ing-3",
  label_text: "Sunflower Oil",
  checked_against_photo: true,
}]);
const partialCorrection = singleResult(partialCorrectedFixture, peanutProfile);
checkTransition(
  "CORRECTION partial section status is unchanged",
  partialCorrectedFixture.sections.ingredients.status === "readable_partial",
);
checkTransition(
  "CORRECTION partial ingredients remain unknown",
  partialCorrection.status === "unknown" && partialCorrection.status !== "no_match_found",
);

// A matching row stays review-gated until the user explicitly checks it.
const reviewFixture = JSON.parse(readFileSync(join(FIXTURES_DIR, "g4_milk_solids_row_needs_review.json"), "utf8"));
const reviewProfile = { schema_version: "1", allergens: ["milk"], custom_avoid: [], diet: "none" };
const peanutOnlyProfile = { ...reviewProfile, allergens: ["peanut"] };
const uncheckedMilkStatus = singleResult(reviewFixture, reviewProfile).status;
const uncheckedPeanutStatus = singleResult(reviewFixture, peanutOnlyProfile).status;
const checkedFixture = applyCorrections(reviewFixture, [{
  id: "ing-3",
  label_text: "Milk Solids",
  checked_against_photo: true,
}]);
const checkedMilkStatus = singleResult(checkedFixture, reviewProfile).status;
const checkedPeanutStatus = singleResult(checkedFixture, peanutOnlyProfile).status;
checkTransition("REVIEW milk stays possible_conflict until checked", uncheckedMilkStatus === "possible_conflict");
checkTransition("REVIEW checked milk row may become conflict", checkedMilkStatus === "conflict");
checkTransition("REVIEW unrelated peanut stays unknown until checked", uncheckedPeanutStatus === "unknown");
checkTransition("REVIEW no-match waits for explicit check", checkedPeanutStatus === "no_match_found");
console.log(`\n${passCount}/${expected.cases.length} golden cases passed`);
if (failed) process.exit(1);
