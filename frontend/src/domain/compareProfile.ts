import type {
  AliasMap,
  AliasMapEntry,
  ConfirmState,
  DietTerm,
  EvidenceItem,
  Extraction,
  IngredientRow,
  Profile,
  ProfileResult,
  ResultStatus,
  Results,
} from "../../../shared/contracts";

// Preserve the UI's existing type import from this module.
export type { AliasMap } from "../../../shared/contracts";

/**
 * compareProfile: the deterministic comparison core of LabelLens (Module C).
 * Pure function: no network, no UI, no storage. Displayed label wording is
 * never rewritten; normalization is used for matching only.
 *
 * Rules (spec section 8):
 *  R1  exact term or reviewed alias in a clear ingredient row / contains phrase -> conflict
 *  R2  matching term in a may_contain / other phrase -> possible_conflict
 *  R3  ambiguous map entry, unreviewed alias, review_required row, or unverified
 *      suggested_group -> possible_conflict
 *  R4  diet: clear nonveg_mark -> conflict; unclear or uncertain mark -> possible_conflict;
 *      diet_terms conflict only when reviewed and the row is clear; a veg_mark is
 *      visual evidence only and never upgrades or clears a status
 *  R5  custom_avoid exact phrase only (no alias map) -> conflict / possible_conflict
 *  R6  no hits and every completeness condition holds -> no_match_found
 *  R7  no hits and R6 not satisfied -> unknown, naming what is missing
 *  R8  conflict > possible_conflict > unknown > no_match_found; every hit is listed
 *      as evidence; a hit always wins over missing coverage
 *  R9  explicit disagreement between a structured interpretation and its source
 *      wording -> possible_conflict with both source signals retained for review
 */

const NO_MATCH_REASON = "No match found in readable label text. This is not a safety check.";

const SEVERITY: ResultStatus[] = [
  "conflict",
  "possible_conflict",
  "unknown",
  "no_match_found",
  "not_applicable",
];

const ALLERGEN_LABELS: Record<string, string> = {
  milk: "Milk",
  egg: "Egg",
  peanut: "Peanut",
  tree_nut: "Tree nuts",
  wheat_gluten: "Wheat / gluten",
  soy: "Soy",
  sesame: "Sesame",
  fish: "Fish",
  shellfish: "Shellfish",
};

const ENTRY_KIND_RANK: Record<AliasMapEntry["kind"], number> = { exact: 4, alias: 3, ambiguous: 2 };

interface TextSource {
  label_text: string;
  evidence_quote: string;
  image_index: number | null;
  review_required: boolean;
  bucket: "ingredient" | "contains" | "precautionary";
  kind: EvidenceItem["kind"];
  row: IngredientRow | null;
  statement_mismatch: string | null;
}

interface Hit {
  evidence: EvidenceItem;
  conflict: boolean;
  rule_id: string;
  rank: number;
  order: number;
  flavor: "clear" | "review" | "precautionary" | "unreviewed";
  explanation?: string;
}

/** Normalization for matching only: lowercase, non-alphanumerics become spaces, whole tokens. */
export function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/** Whole-token equality with a trailing "s" tolerance ("tree nuts" matches "tree nut"). */
function tokenEquals(a: string, b: string): boolean {
  return a === b || a === b + "s" || b === a + "s";
}

/** Whole-word / whole-phrase alignment; no substring rules, so "buttermilk" never matches "milk". */
function phraseOccurs(candidate: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || candidate.length < phrase.length) return false;
  for (let start = 0; start + phrase.length <= candidate.length; start++) {
    let matched = true;
    for (let offset = 0; offset < phrase.length; offset++) {
      if (!tokenEquals(candidate[start + offset], phrase[offset])) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function bestEntryForTokens(tokens: string[], entries: AliasMapEntry[]): AliasMapEntry | null {
  let best: AliasMapEntry | null = null;
  for (const entry of entries) {
    if (!phraseOccurs(tokens, normalizeTokens(entry.term))) continue;
    if (best === null || ENTRY_KIND_RANK[entry.kind] > ENTRY_KIND_RANK[best.kind]) best = entry;
  }
  return best;
}

/** A clear text mapping is an exact term or a reviewed alias, never an unreviewed guess. */
function bestCertainEntryForText(text: string, entries: AliasMapEntry[]): AliasMapEntry | null {
  const tokens = normalizeTokens(text);
  const matches = entries.filter(
    (entry) =>
      (entry.kind === "exact" || (entry.kind === "alias" && entry.reviewed)) &&
      phraseOccurs(tokens, normalizeTokens(entry.term)),
  );
  const groups = new Set(matches.map((entry) => entry.group));
  if (groups.size !== 1) return null;
  return matches.sort((a, b) => ENTRY_KIND_RANK[b.kind] - ENTRY_KIND_RANK[a.kind])[0] ?? null;
}

/** Detect only explicit printed wording that conflicts with the model's bucket. */
function statementBucketMismatch(
  bucket: "contains" | "precautionary",
  quote: string,
): string | null {
  const text = quote.toLowerCase();
  const precautionaryWording =
    /\bmay\s+contain\b|\bmight\s+contain\b|\bmay\s+be\s+present\b|\btraces?\s+of\b|\bshared\s+(?:equipment|facility)\b|\bfacility\s+that\s+also\b|\bhandles?\s+\w+/i.test(text);
  const directWording = /\bcontains?\b/i.test(text) && !precautionaryWording;

  if (bucket === "contains" && precautionaryWording) {
    return "The reader classified this as a direct contains statement, but its quoted wording is precautionary.";
  }
  if (bucket === "precautionary" && directWording) {
    return "The reader classified this as precautionary, but its quoted wording says the allergen is contained.";
  }
  return null;
}

function bestDietTermForTokens(tokens: string[], terms: DietTerm[]): DietTerm | null {
  let best: DietTerm | null = null;
  for (const term of terms) {
    if (!phraseOccurs(tokens, normalizeTokens(term.term))) continue;
    if (best === null || normalizeTokens(term.term).length > normalizeTokens(best.term).length) {
      best = term;
    }
  }
  return best;
}

function textEvidence(
  source: TextSource,
  match_type: EvidenceItem["match_type"],
  mapped_to: string | null,
): EvidenceItem {
  return {
    label_text: source.label_text,
    evidence_quote: source.evidence_quote,
    visual_description: null,
    image_index: source.image_index,
    section: source.bucket === "ingredient" ? "ingredients" : "allergen_statement",
    kind: source.kind,
    match_type,
    mapped_to,
  };
}

function markEvidence(mark: Extraction["marks"][number]): EvidenceItem {
  return {
    label_text: null,
    evidence_quote: null,
    visual_description: mark.visual_description,
    image_index: mark.image_index,
    section: "marks",
    kind: "mark",
    match_type: "diet_term",
    mapped_to: null,
  };
}

function collectTextSources(extraction: Extraction): TextSource[] {
  const sources: TextSource[] = [];
  for (const row of extraction.ingredients) {
    sources.push({
      label_text: row.label_text,
      evidence_quote: row.evidence_quote,
      image_index: row.image_index,
      review_required: row.review_required,
      bucket: "ingredient",
      kind: "ingredient",
      row,
      statement_mismatch: null,
    });
  }
  for (const phrase of extraction.allergen_statements.contains) {
    sources.push({
      label_text: phrase.label_text,
      evidence_quote: phrase.evidence_quote,
      image_index: phrase.image_index,
      review_required: phrase.review_required,
      bucket: "contains",
      kind: "contains",
      row: null,
      statement_mismatch: statementBucketMismatch("contains", phrase.evidence_quote),
    });
  }
  for (const phrase of [...extraction.allergen_statements.may_contain, ...extraction.allergen_statements.other]) {
    // The frozen EvidenceItem kind enum has no "other"; precautionary "other" phrases
    // travel as kind "may_contain". Flagged for review with Person 2 (see README).
    sources.push({
      label_text: phrase.label_text,
      evidence_quote: phrase.evidence_quote,
      image_index: phrase.image_index,
      review_required: phrase.review_required,
      bucket: "precautionary",
      kind: "may_contain",
      row: null,
      statement_mismatch: statementBucketMismatch("precautionary", phrase.evidence_quote),
    });
  }
  return sources;
}

/**
 * R6 gate. "No match found" may only be returned when ALL of these hold:
 *  1. sections.ingredients.status === "readable_complete"
 *  2. confirm.ingredients_complete
 *  3. (sections.allergen_statement.status === "readable_complete" AND
 *     confirm.allergen_statement_complete) OR confirm.pack_has_no_allergen_statement
 *  4. no ingredient row and no allergen-statement phrase (contains / may_contain /
 *     other) has review_required: true
 * A missing or unreadable panel can never produce reassurance.
 */
function noMatchGatePassed(extraction: Extraction, confirm: ConfirmState): boolean {
  if (extraction.sections.ingredients.status !== "readable_complete") return false;
  if (!confirm.ingredients_complete) return false;
  const allergenStatementChecked =
    extraction.sections.allergen_statement.status === "readable_complete" &&
    confirm.allergen_statement_complete;
  if (!allergenStatementChecked && !confirm.pack_has_no_allergen_statement) return false;
  const needsReview = (row: { review_required: boolean }) => row.review_required;
  if (extraction.ingredients.some(needsReview)) return false;
  if (extraction.allergen_statements.contains.some(needsReview)) return false;
  if (extraction.allergen_statements.may_contain.some(needsReview)) return false;
  if (extraction.allergen_statements.other.some(needsReview)) return false;
  return true;
}

/** R7 reason: names what is missing, in the priority fixed by the spec. */
function unknownReason(extraction: Extraction, confirm: ConfirmState): string {
  const gaps: string[] = [];
  const ingredients = extraction.sections.ingredients;
  if (ingredients.status === "not_uploaded") gaps.push("the ingredients panel was not uploaded");
  else if (ingredients.status === "unreadable") gaps.push("the ingredients panel could not be read");
  else if (ingredients.status === "readable_partial") gaps.push("the ingredients panel was only partly readable");
  else if (ingredients.status === "ambiguous") gaps.push("the ingredients panel reading was ambiguous");
  else if (!confirm.ingredients_complete) gaps.push("you did not confirm the ingredient list is complete");

  const statement = extraction.sections.allergen_statement;
  const statementChecked = statement.status === "readable_complete" && confirm.allergen_statement_complete;
  if (!statementChecked && !confirm.pack_has_no_allergen_statement) {
    if (statement.status === "not_uploaded") gaps.push("the allergen statement was not uploaded");
    else if (statement.status === "unreadable") gaps.push("the allergen statement could not be read");
    else if (statement.status === "readable_partial") gaps.push("the allergen statement was only partly readable");
    else gaps.push("the allergen statement was not checked");
  }

  const reviewCount =
    extraction.ingredients.filter((row) => row.review_required).length +
    extraction.allergen_statements.contains.filter((row) => row.review_required).length +
    extraction.allergen_statements.may_contain.filter((row) => row.review_required).length +
    extraction.allergen_statements.other.filter((row) => row.review_required).length;
  if (reviewCount > 0) {
    const noun = reviewCount === 1 ? "line" : "lines";
    const verb = reviewCount === 1 ? "needs" : "need";
    gaps.push(`${reviewCount} printed ${noun} still ${verb} review`);
  }
  return `Not enough readable information: ${gaps.join("; ")}.`;
}

function finishItem(
  profile_key: string,
  profile_label: string,
  hits: Hit[],
  reasonFor: (winner: Hit) => string,
  extraEvidence: EvidenceItem[],
  extraction: Extraction,
  confirm: ConfirmState,
): ProfileResult {
  if (hits.length > 0) {
    const ordered = [...hits].sort(
      (a, b) => Number(b.conflict) - Number(a.conflict) || b.rank - a.rank || a.order - b.order,
    );
    const winner = ordered[0];
    const primaryReason = reasonFor(winner);
    const additionalDisagreements = [...new Set(
      ordered
        .map((hit) => hit.explanation)
        .filter((explanation): explanation is string => Boolean(explanation)),
    )].filter((explanation) => explanation !== primaryReason);
    return {
      profile_key,
      profile_label,
      status: winner.conflict ? "conflict" : "possible_conflict",
      rule_id: winner.rule_id,
      reason: [primaryReason, ...additionalDisagreements].join(" "),
      evidence: [...ordered.map((hit) => hit.evidence), ...extraEvidence],
    };
  }
  if (noMatchGatePassed(extraction, confirm)) {
    return {
      profile_key,
      profile_label,
      status: "no_match_found",
      rule_id: "R6",
      reason: NO_MATCH_REASON,
      evidence: [],
    };
  }
  return {
    profile_key,
    profile_label,
    status: "unknown",
    rule_id: "R7",
    reason: unknownReason(extraction, confirm),
    evidence: [],
  };
}

function evaluateAllergen(
  key: string,
  label: string,
  sources: TextSource[],
  entries: AliasMapEntry[],
  allEntries: AliasMapEntry[],
  extraction: Extraction,
  confirm: ConfirmState,
): ProfileResult {
  const hits: Hit[] = [];
  sources.forEach((source, order) => {
    const entry = bestEntryForTokens(normalizeTokens(source.label_text), entries);
    const row = source.row;
    const directEntry = row === null ? null : bestCertainEntryForText(row.label_text, allEntries);
    const suggestion = row?.suggested_group ?? null;
    const modelTextDisagreement =
      directEntry !== null &&
      suggestion !== null &&
      directEntry.group !== suggestion.group &&
      (directEntry.group === key || suggestion.group === key);

    if (modelTextDisagreement && directEntry !== null && suggestion !== null) {
      const suggestionIsMatch = suggestion.group === key;
      const evidence = suggestionIsMatch
        ? textEvidence(source, "unverified_suggestion", suggestion.group)
        : textEvidence(
            source,
            directEntry.kind === "exact" ? "exact" : "alias",
            directEntry.canonical ?? directEntry.group,
          );
      hits.push({
        evidence,
        conflict: false,
        rule_id: "R9",
        rank: 5,
        order,
        flavor: "review",
        explanation: `The printed term maps to ${directEntry.group}, while the model suggested ${suggestion.group}. Check this phrase against the photo; this remains a possible conflict until the disagreement is resolved.`,
      });
      return;
    }

    if (entry !== null && source.statement_mismatch !== null) {
      const matchType: EvidenceItem["match_type"] =
        entry.kind === "exact" ? "exact" : entry.kind === "alias" ? "alias" : "ambiguous_term";
      hits.push({
        evidence: textEvidence(source, matchType, entry.canonical ?? entry.group),
        conflict: false,
        rule_id: "R9",
        rank: 5,
        order,
        flavor: "review",
        explanation: `${source.statement_mismatch} The quoted wording is “${source.evidence_quote}”. Check the statement on the photo; this remains a possible conflict until verified.`,
      });
      return;
    }

    if (entry !== null) {
      const match_type: EvidenceItem["match_type"] =
        entry.kind === "exact" ? "exact" : entry.kind === "alias" ? "alias" : "ambiguous_term";
      let conflict = false;
      let rule_id = "R1";
      let flavor: Hit["flavor"] = "clear";
      if (source.bucket === "precautionary") {
        rule_id = "R2";
        flavor = "precautionary";
      } else if (source.review_required) {
        rule_id = "R3";
        flavor = "review";
      } else if (entry.kind === "ambiguous") {
        rule_id = "R3";
      } else if (entry.kind === "alias" && !entry.reviewed) {
        rule_id = "R3";
        flavor = "unreviewed";
      } else {
        conflict = true;
      }
      hits.push({
        evidence: textEvidence(source, match_type, entry.canonical ?? entry.group),
        conflict,
        rule_id,
        rank: ENTRY_KIND_RANK[entry.kind],
        order,
        flavor,
      });
      return;
    }
    if (row !== null && row.suggested_group && row.suggested_group.group === key) {
      hits.push({
        evidence: textEvidence(source, "unverified_suggestion", row.suggested_group.group),
        conflict: false,
        rule_id: "R3",
        rank: 1,
        order,
        flavor: source.review_required ? "review" : "clear",
      });
    }
  });
  return finishItem(key, label, hits, (winner) => allergenReason(winner, label), [], extraction, confirm);
}

function allergenReason(winner: Hit, label: string): string {
  const quoted = `"${winner.evidence.label_text ?? ""}"`;
  if (winner.rule_id === "R9" && winner.explanation) return winner.explanation;
  if (winner.rule_id === "R2") {
    return `${quoted} appears in a may-contain style statement, so ${label} may be present.`;
  }
  if (winner.conflict) {
    return `Label text matches your restriction: ${quoted}.`;
  }
  if (winner.flavor === "review") {
    return `${quoted} appears to involve ${label}, but this printed line needs your review.`;
  }
  if (winner.evidence.match_type === "unverified_suggestion") {
    return `${quoted} was tentatively grouped with ${label} by the photo reader; this is unverified and needs your review.`;
  }
  if (winner.evidence.match_type === "ambiguous_term") {
    return `${quoted} is an ambiguous term; the printed source is not stated, so it may involve ${label}.`;
  }
  if (winner.flavor === "unreviewed") {
    return `${quoted} may mean ${label}, but this name mapping is not verified yet.`;
  }
  return `${quoted} appears to involve ${label}, but this printed line needs your review.`;
}

function evaluateCustom(
  term: string,
  sources: TextSource[],
  extraction: Extraction,
  confirm: ConfirmState,
): ProfileResult {
  const phrase = normalizeTokens(term);
  const hits: Hit[] = [];
  sources.forEach((source, order) => {
    if (!phraseOccurs(normalizeTokens(source.label_text), phrase)) return;
    let conflict = true;
    let flavor: Hit["flavor"] = "clear";
    if (source.bucket === "precautionary") {
      conflict = false;
      flavor = "precautionary";
    } else if (source.review_required) {
      conflict = false;
      flavor = "review";
    }
    hits.push({
      evidence: textEvidence(source, "exact", null),
      conflict,
      rule_id: "R5",
      rank: 4,
      order,
      flavor,
    });
  });
  return finishItem(
    `custom:${term}`,
    term,
    hits,
    (winner) => customReason(winner, term),
    [],
    extraction,
    confirm,
  );
}

function customReason(winner: Hit, term: string): string {
  const quoted = `"${winner.evidence.label_text ?? ""}"`;
  if (winner.flavor === "precautionary") {
    return `${quoted} appears in a may-contain style statement, so it may match your avoid term "${term}".`;
  }
  if (winner.flavor === "review") {
    return `${quoted} appears to match your avoid term "${term}", but this printed line needs your review.`;
  }
  return `Printed text ${quoted} matches your avoid term "${term}".`;
}

function evaluateDiet(
  diet: "vegetarian" | "vegan",
  extraction: Extraction,
  sources: TextSource[],
  aliasMap: AliasMap,
  confirm: ConfirmState,
): ProfileResult {
  const label = diet === "vegan" ? "Vegan diet" : "Vegetarian diet";
  const key = `diet_${diet}`;
  const terms = aliasMap.diet_terms.filter((term) => term.applies_to.includes(diet));
  const hits: Hit[] = [];
  const contradictoryClearMarks =
    extraction.marks.some((mark) => mark.kind === "veg_mark" && !mark.review_required) &&
    extraction.marks.some((mark) => mark.kind === "nonveg_mark" && !mark.review_required);
  sources.forEach((source, order) => {
    const term = bestDietTermForTokens(normalizeTokens(source.label_text), terms);
    if (term === null) return;
    let conflict = false;
    let rule_id = "R4";
    let flavor: Hit["flavor"] = "clear";
    if (source.bucket === "precautionary") {
      rule_id = "R2";
      flavor = "precautionary";
    } else if (source.review_required) {
      flavor = "review";
    } else if (!term.reviewed) {
      flavor = "unreviewed";
    } else {
      conflict = true;
    }
    hits.push({
      evidence: textEvidence(source, "diet_term", term.term),
      conflict,
      rule_id,
      rank: 3,
      order,
      flavor,
    });
  });
  extraction.marks.forEach((mark, index) => {
    const order = sources.length + index;
    if (mark.kind === "veg_mark") {
      if (mark.review_required) {
        hits.push({ evidence: markEvidence(mark), conflict: false, rule_id: "R4", rank: 2, order, flavor: "review" });
      }
      return;
    }
    if (mark.kind === "nonveg_mark" && !mark.review_required) {
      hits.push({ evidence: markEvidence(mark), conflict: !contradictoryClearMarks, rule_id: contradictoryClearMarks ? "R9" : "R4", rank: 4, order, flavor: contradictoryClearMarks ? "review" : "clear" });
      return;
    }
    // nonveg_mark needing review, or uncertain_diet_mark: the pack's diet status is unclear.
    hits.push({ evidence: markEvidence(mark), conflict: false, rule_id: "R4", rank: 2, order, flavor: "review" });
  });
  const clearVeg = extraction.marks.filter((mark) => mark.kind === "veg_mark" && !mark.review_required);
  const clearNonveg = extraction.marks.filter((mark) => mark.kind === "nonveg_mark" && !mark.review_required);
  if (clearVeg.length > 0 && clearNonveg.length > 0) {
    hits.push({
      evidence: markEvidence(clearNonveg[0]),
      conflict: false,
      rule_id: "R9",
      rank: 6,
      order: sources.length + extraction.marks.length,
      flavor: "review",
      explanation: "The pack has both vegetarian and non-vegetarian mark interpretations. Check both marks on the photo; this disagreement remains unresolved and the dietary result is uncertain.",
    });
  }
  const clearVegMarks = extraction.marks
    .filter((mark) => mark.kind === "veg_mark" && !mark.review_required)
    .map(markEvidence);
  return finishItem(key, label, hits, (winner) => dietReason(winner, label), clearVegMarks, extraction, confirm);
}

function dietReason(winner: Hit, label: string): string {
  if (winner.rule_id === "R9" && winner.explanation) return winner.explanation;
  const isMark = winner.evidence.kind === "mark";
  const quoted = `"${winner.evidence.label_text ?? ""}"`;
  if (winner.conflict) {
    if (isMark) return `The pack shows a non-vegetarian mark, which conflicts with ${label}.`;
    return `Label text matches your restriction: ${quoted}.`;
  }
  if (winner.flavor === "precautionary") {
    return `${quoted} appears in a may-contain style statement, so ${label} may be affected.`;
  }
  if (isMark || winner.flavor === "review") {
    return `The diet information on this pack is unclear, so its fit with ${label} needs your review.`;
  }
  if (winner.flavor === "unreviewed") {
    return `${quoted} is treated as unsuitable for ${label}, but this term mapping is not verified yet.`;
  }
  return `${quoted} appears to be unsuitable for ${label}, but this printed line needs your review.`;
}

function allergenLabel(key: string): string {
  if (ALLERGEN_LABELS[key]) return ALLERGEN_LABELS[key];
  const humanized = key.replace(/_/g, " ");
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/**
 * Compare an Extraction with a local Profile under ConfirmState.
 *
 * "Not detected" is never treated as "not present": an item only reaches
 * no_match_found through the R6 gate (see noMatchGatePassed); everything else
 * lands on unknown with a reason naming what is missing. Never claims a
 * product is safe.
 */
export function compareProfile(
  extraction: Extraction,
  profile: Profile,
  confirm: ConfirmState,
  aliasMap: AliasMap,
): Results {
  const sources = collectTextSources(extraction);
  const items: ProfileResult[] = [];
  for (const key of profile.allergens) {
    const entries = aliasMap.entries.filter((entry) => entry.group === key);
    items.push(evaluateAllergen(key, allergenLabel(key), sources, entries, aliasMap.entries, extraction, confirm));
  }
  for (const term of profile.custom_avoid) {
    items.push(evaluateCustom(term, sources, extraction, confirm));
  }
  if (profile.diet !== "none") {
    items.push(evaluateDiet(profile.diet, extraction, sources, aliasMap, confirm));
  }
  const severityIndex = (status: ResultStatus) => SEVERITY.indexOf(status);
  items.sort((a, b) => severityIndex(a.status) - severityIndex(b.status));
  const summary: Record<ResultStatus, number> = {
    conflict: 0,
    possible_conflict: 0,
    no_match_found: 0,
    unknown: 0,
    not_applicable: 0,
  };
  for (const item of items) summary[item.status] += 1;
  return {
    schema_version: "1",
    items,
    summary,
    coverage: {
      ingredients: extraction.sections.ingredients.status,
      allergen_statement: extraction.sections.allergen_statement.status,
      nutrition: extraction.sections.nutrition.status,
      product_details: extraction.sections.product_details.status,
      ingredients_confirmed: confirm.ingredients_complete,
      allergen_statement_checked:
        confirm.allergen_statement_complete || confirm.pack_has_no_allergen_statement,
    },
  };
}
