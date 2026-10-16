// Module A mock data. Packs contain fictional extractions and optional golden
// expectations for checks. User-facing result cards always come from
// compareProfile using the current browser profile and confirmations.

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
  /** Golden expectation used by fixture checks; never rendered as a result. */
  expected?: Results;
  /** Profile the expected results assume (dev/demo only). */
  demoProfile?: Profile;
  /** ConfirmState the expected results assume. */
  demoConfirm?: ConfirmState;
  /** Optional local-only photo path for recording a preloaded demo fixture. */
  demoPhotoPath?: string;
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
