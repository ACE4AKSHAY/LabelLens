// Module A mock data. Each pack pairs a fictional Extraction with the
// golden-case Results the rules engine (Module 3) is expected to produce for
// the pack's demo profile + confirm state. These are UI preview data only —
// they never claim to be real readings, and live mode never uses them.

import type {
  ConfirmState,
  Extraction,
  Profile,
  Results,
} from "@shared/contracts";

export interface FixturePack {
  id: string;
  title: string;
  description: string;
  source: "built-in" | "shared";
  extraction: Extraction;
  /** Golden-case preview; rendered only in mock/dev mode, clearly labeled. */
  expected?: Results;
  /** Profile the expected results assume (dev/demo only). */
  demoProfile?: Profile;
  /** ConfirmState the expected results assume. */
  demoConfirm?: ConfirmState;
}

export const DEMO_PROFILE: Profile = {
  schema_version: "1",
  allergens: ["peanut", "milk", "tree_nut"],
  custom_avoid: [],
  diet: "vegetarian",
};

export const DEMO_CONFIRM_ALL: ConfirmState = {
  ingredients_complete: true,
  allergen_statement_complete: true,
  pack_has_no_allergen_statement: false,
};

export const NO_MATCH_REASON =
  "No match found in readable label text. This is not a safety check.";

export const ERROR_SIM_ID = "__simulate_provider_error__";
