// Golden check cases ~G2/G4/G15/G16: flagged rows, unreviewed alias, flagged
// contains phrase, and an uncertain diet symbol — everything that needs the
// user's eyes, so nothing here may show as a plain conflict.

import type { Extraction, Results } from "@shared/contracts";
import type { FixturePack } from "./types";
import { DEMO_PROFILE } from "./types";

const extraction: Extraction = {
  schema_version: "1",
  analysis_id: "fixture-cheese-crackers-review",
  images: [
    {
      index: 0,
      role: "other",
      quality: "cropped",
      note: "Back panel; bottom edge cut off",
    },
  ],
  product: { name: "Sample Cheese Crackers", brand: null, quantity: "90 g" },
  package_facts: [
    {
      kind: "product_name",
      value_text: "Sample Cheese Crackers",
      label_text: "Sample Cheese Crackers",
      evidence_quote: "Sample Cheese Crackers",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      kind: "quantity",
      value_text: "90 g",
      label_text: "Net Wt. 90 g",
      evidence_quote: "Net Wt. 90 g",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      kind: "best_before",
      value_text: "BEST BEFORE 12 MAR 2027",
      label_text: "BEST BEFORE 12 MAR 2027",
      evidence_quote: "BEST BEFORE 12 MAR 2027",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
  ],
  sections: {
    ingredients: {
      status: "readable_complete",
      text: "Wheat Flour, Palm Oil, Cheese Powder (Milk), Emulsifier (322), Salt, Whey Protein Concentrate",
      image_index: 0,
      reason: null,
    },
    allergen_statement: {
      status: "readable_complete",
      text: "Contains: Wheat, Milk",
      image_index: 0,
      reason: null,
    },
    nutrition: {
      status: "readable_partial",
      text: "Energy 470 kcal per 100 g; Protein 8 g per 100 g; Total Sugars [not readable]",
      image_index: 0,
      reason: "The sugars row is too faint to read",
    },
    product_details: {
      status: "readable_partial",
      text: "Sample Cheese Crackers; Net Wt. 90 g; BEST BEFORE 12 MAR 2027",
      image_index: 0,
      reason: "The brand line is cut off at the fold",
    },
  },
  ingredients: [
    {
      id: "ing-1",
      label_text: "Wheat Flour",
      evidence_quote: "Wheat Flour",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "ing-2",
      label_text: "Palm Oil",
      evidence_quote: "Palm Oil",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "ing-3",
      label_text: "Cheese Powder (Milk)",
      evidence_quote: "Cheese Powder (Milk)",
      image_index: 0,
      review_required: true,
      review_reason: "Printed over a fold — check this reading against the photo",
    },
    {
      id: "ing-4",
      label_text: "Emulsifier (322)",
      evidence_quote: "Emulsifier (322)",
      image_index: 0,
      review_required: true,
      review_reason: "The source of the emulsifier is not stated on the pack",
      suggested_group: {
        group: "soy",
        note: "emulsifier 322 is often soy lecithin, but the source is not printed",
      },
    },
    {
      id: "ing-5",
      label_text: "Salt",
      evidence_quote: "Salt",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "ing-6",
      label_text: "Whey Protein Concentrate",
      evidence_quote: "Whey Protein Concentrate",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
  ],
  allergen_statements: {
    contains: [
      {
        label_text: "Wheat, Milk",
        evidence_quote: "Contains: Wheat, Milk",
        image_index: 0,
        review_required: true,
        review_reason: "Statement printed across the pack seam",
      },
    ],
    may_contain: [],
    other: [],
  },
  marks: [
    {
      kind: "uncertain_diet_mark",
      visual_description:
        "a small dot inside a square; the colour could not be read reliably",
      image_index: 0,
      review_required: true,
      review_reason: "Symbol colour unclear in this photo",
    },
  ],
  nutrition: [
    {
      id: "nut-1",
      nutrient: "Energy",
      amount_text: "470",
      unit: "kcal",
      basis: "per 100 g",
      label_text: "Energy 470 kcal per 100 g",
      evidence_quote: "Energy 470 kcal per 100 g",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "nut-2",
      nutrient: "Protein",
      amount_text: "8",
      unit: "g",
      basis: "per 100 g",
      label_text: "Protein 8 g per 100 g",
      evidence_quote: "Protein 8 g per 100 g",
      image_index: 0,
      review_required: false,
      review_reason: null,
    },
    {
      id: "nut-3",
      nutrient: "Total Sugars",
      amount_text: null,
      unit: "g",
      basis: "per 100 g",
      label_text: "Total Sugars g per 100 g",
      evidence_quote: "Total Sugars [not readable] per 100 g",
      image_index: 0,
      review_required: true,
      review_reason: "The printed value is too faint to read",
    },
  ],
  warnings: [],
};

const expected: Results = {
  schema_version: "1",
  items: [
    {
      profile_key: "milk",
      profile_label: "Milk",
      status: "possible_conflict",
      rule_id: "R3",
      reason:
        "Needs your review: the matching rows are flagged for review or use an unverified alias.",
      evidence: [
        {
          label_text: "Cheese Powder (Milk)",
          evidence_quote: "Cheese Powder (Milk)",
          visual_description: null,
          image_index: 0,
          section: "ingredients",
          kind: "ingredient",
          match_type: "exact",
          mapped_to: "milk",
        },
        {
          label_text: "Whey Protein Concentrate",
          evidence_quote: "Whey Protein Concentrate",
          visual_description: null,
          image_index: 0,
          section: "ingredients",
          kind: "ingredient",
          match_type: "alias",
          mapped_to: "milk",
        },
        {
          label_text: "Wheat, Milk",
          evidence_quote: "Contains: Wheat, Milk",
          visual_description: null,
          image_index: 0,
          section: "allergen_statement",
          kind: "contains",
          match_type: "exact",
          mapped_to: "milk",
        },
      ],
    },
    {
      profile_key: "diet_vegetarian",
      profile_label: "Vegetarian diet",
      status: "possible_conflict",
      rule_id: "R4",
      reason: "Needs your review: the veg / non-veg symbol could not be read clearly.",
      evidence: [
        {
          label_text: null,
          evidence_quote: null,
          visual_description:
            "a small dot inside a square; the colour could not be read reliably",
          image_index: 0,
          section: "marks",
          kind: "mark",
          match_type: "ambiguous_term",
          mapped_to: null,
        },
      ],
    },
    {
      profile_key: "peanut",
      profile_label: "Peanut",
      status: "unknown",
      rule_id: "R7",
      reason:
        "We couldn't check peanut fully — the allergen / may-contain line hasn't been confirmed yet.",
      evidence: [],
    },
    {
      profile_key: "tree_nut",
      profile_label: "Tree nuts",
      status: "unknown",
      rule_id: "R7",
      reason:
        "We couldn't check tree nuts fully — the allergen / may-contain line hasn't been confirmed yet.",
      evidence: [],
    },
  ],
  summary: {
    conflict: 0,
    possible_conflict: 2,
    no_match_found: 0,
    unknown: 2,
    not_applicable: 0,
  },
  coverage: {
    ingredients: "readable_complete",
    allergen_statement: "readable_complete",
    nutrition: "readable_partial",
    product_details: "readable_partial",
    ingredients_confirmed: true,
    allergen_statement_checked: false,
  },
};

export const sampleCheeseCrackers: FixturePack = {
  id: "sample-cheese-crackers",
  title: "Sample Cheese Crackers — rows flagged for review",
  description:
    "Fictional label with rows flagged for review, whey, a contains line split across a seam, and an uncertain diet mark.",
  source: "built-in",
  extraction,
  expected,
  demoProfile: DEMO_PROFILE,
  demoConfirm: {
    ingredients_complete: true,
    allergen_statement_complete: false,
    pack_has_no_allergen_statement: false,
  },
};
