// Golden check cases ~G5/G6/G9: blurry, unreadable, and missing panels. No hits,
// no completeness confirmations — every item must stay Unknown, and the UI
// must point at exactly which panel to retake.

import type { Extraction, Results } from "@shared/contracts";
import type { FixturePack } from "./types";
import { DEMO_PROFILE } from "./types";

const extraction: Extraction = {
  schema_version: "1",
  analysis_id: "fixture-choco-bar-partial",
  images: [
    {
      index: 0,
      role: "ingredients",
      quality: "blurry",
      note: "Camera moved while shooting",
    },
    {
      index: 1,
      role: "nutrition",
      quality: "glare",
      note: "Flash glare over the values",
    },
  ],
  product: { name: "Sample Choco Bar", brand: null, quantity: null },
  package_facts: [
    {
      kind: "product_name",
      value_text: "Sample Choco Bar",
      label_text: "Sample Choco Bar",
      evidence_quote: "Sample Choco Bar",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
  ],
  sections: {
    ingredients: {
      status: "readable_partial",
      text: "Sugar, Cocoa Mass, Cocoa Butter",
      image_index: 0,
      reason: "Only the first few lines are readable; the rest of the list is blurred",
    },
    allergen_statement: {
      status: "not_uploaded",
      text: null,
      image_index: null,
      reason: "No allergen line is visible in the uploaded photos",
    },
    nutrition: {
      status: "unreadable",
      text: null,
      image_index: 1,
      reason: "Glare covers the nutrition values",
    },
    product_details: {
      status: "readable_complete",
      text: "Sample Choco Bar",
      image_index: 0,
      reason: null,
    },
  },
  ingredients: [
    {
      id: "ing-1",
      label_text: "Sugar",
      evidence_quote: "Sugar",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "ing-2",
      label_text: "Cocoa Mass",
      evidence_quote: "Cocoa Mass",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "ing-3",
      label_text: "Cocoa Butter",
      evidence_quote: "Cocoa Butter",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
  ],
  allergen_statements: { contains: [], may_contain: [], other: [] },
  marks: [],
  nutrition: [],
  warnings: [
    "The ingredient list is only partly readable in photo 1.",
  ],
};

function unknownItem(profile_key: string, profile_label: string, what: string) {
  return {
    profile_key,
    profile_label,
    status: "unknown" as const,
    rule_id: "R7",
    reason: `We couldn't read enough to check — ${what}`,
    evidence: [],
  };
}

const expected: Results = {
  schema_version: "1",
  items: [
    unknownItem(
      "peanut",
      "Peanut",
      "the ingredient list is only partly readable and the allergen line was not uploaded.",
    ),
    unknownItem(
      "milk",
      "Milk",
      "the ingredient list is only partly readable and the allergen line was not uploaded.",
    ),
    unknownItem(
      "tree_nut",
      "Tree nuts",
      "the ingredient list is only partly readable and the allergen line was not uploaded.",
    ),
    unknownItem(
      "diet_vegetarian",
      "Vegetarian diet",
      "the ingredient list is only partly readable and the allergen line was not uploaded.",
    ),
  ],
  summary: {
    conflict: 0,
    possible_conflict: 0,
    no_match_found: 0,
    unknown: 4,
    not_applicable: 0,
  },
  coverage: {
    ingredients: "readable_partial",
    allergen_statement: "not_uploaded",
    nutrition: "unreadable",
    product_details: "readable_complete",
    ingredients_confirmed: false,
    allergen_statement_checked: false,
  },
};

export const sampleChocoBar: FixturePack = {
  id: "sample-choco-bar",
  title: "Sample Choco Bar — blurry, unreadable, missing panels",
  description:
    "A blurry ingredients photo, a glare-covered nutrition panel, and no allergen line uploaded. Everything stays Unknown and the Couldn't-read panel offers targeted retakes.",
  source: "built-in",
  extraction,
  expected,
  demoProfile: DEMO_PROFILE,
  demoConfirm: {
    ingredients_complete: false,
    allergen_statement_complete: false,
    pack_has_no_allergen_statement: false,
  },
};
