export type SectionStatus =
  | "readable_complete"
  | "readable_partial"
  | "unreadable"
  | "not_uploaded"
  | "ambiguous";
export type ImageQuality = "good" | "blurry" | "cropped" | "glare" | "unusable";
export type ImageRole = "ingredients" | "allergens" | "nutrition" | "front" | "other" | "unknown";

export interface SectionReading {
  status: SectionStatus;
  text: string | null;
  image_index: number | null;
  reason: string | null;
}

export interface SourcePhrase {
  label_text: string;
  evidence_quote: string;
  image_index: number | null;
}

export interface ReviewablePhrase extends SourcePhrase {
  review_required: boolean;
  review_reason: string | null;
}

export interface SuggestedGroup {
  group: string;
  note: string;
}

export interface IngredientRow extends ReviewablePhrase {
  id: string;
  edited_by_user?: boolean;
  suggested_group?: SuggestedGroup | null;
}

export interface Mark {
  kind: "veg_mark" | "nonveg_mark" | "uncertain_diet_mark";
  visual_description: string;
  image_index: number;
  review_required: boolean;
  review_reason: string | null;
}

export interface PackageFact extends ReviewablePhrase {
  kind:
    | "product_name"
    | "brand"
    | "quantity"
    | "manufacture_date"
    | "best_before"
    | "expiry_date"
    | "batch_code";
  value_text: string;
}

export interface NutritionRow extends ReviewablePhrase {
  id: string;
  nutrient: string | null;
  amount_text: string | null;
  unit: string | null;
  basis: string | null;
}

export interface ImageReading {
  index: number;
  role: ImageRole;
  quality: ImageQuality;
  note: string | null;
}

export interface ProductSummary {
  name: string | null;
  brand: string | null;
  quantity: string | null;
}

export interface AllergenStatements {
  contains: ReviewablePhrase[];
  may_contain: ReviewablePhrase[];
  other: ReviewablePhrase[];
}

export interface Extraction {
  schema_version: "1";
  analysis_id: string;
  images: ImageReading[];
  product: ProductSummary;
  package_facts: PackageFact[];
  sections: {
    ingredients: SectionReading;
    allergen_statement: SectionReading;
    nutrition: SectionReading;
    product_details: SectionReading;
  };
  ingredients: IngredientRow[];
  allergen_statements: AllergenStatements;
  marks: Mark[];
  nutrition: NutritionRow[];
  warnings: string[];
}

export type AllergenKey =
  | "milk"
  | "egg"
  | "peanut"
  | "tree_nut"
  | "wheat_gluten"
  | "soy"
  | "sesame"
  | "fish"
  | "shellfish";
export type DietStyle = "none" | "vegetarian" | "vegan";

/** Browser-local data. Never include Profile in an API request. */
export interface Profile {
  schema_version: "1";
  allergens: string[];
  custom_avoid: string[];
  diet: DietStyle;
}

export interface ConfirmState {
  ingredients_complete: boolean;
  allergen_statement_complete: boolean;
  pack_has_no_allergen_statement: boolean;
}

export type ResultStatus =
  | "conflict"
  | "possible_conflict"
  | "no_match_found"
  | "unknown"
  | "not_applicable";

export interface EvidenceItem {
  label_text: string | null;
  evidence_quote: string | null;
  visual_description: string | null;
  image_index: number | null;
  section: "ingredients" | "allergen_statement" | "marks";
  kind: "ingredient" | "contains" | "may_contain" | "mark";
  match_type: "exact" | "alias" | "ambiguous_term" | "unverified_suggestion" | "diet_term";
  mapped_to: string | null;
}

export interface ProfileResult {
  profile_key: string;
  profile_label: string;
  status: ResultStatus;
  rule_id: string;
  reason: string;
  evidence: EvidenceItem[];
}

export interface Results {
  schema_version: "1";
  items: ProfileResult[];
  summary: Record<ResultStatus, number>;
  coverage: {
    ingredients: SectionStatus;
    allergen_statement: SectionStatus;
    nutrition: SectionStatus;
    product_details: SectionStatus;
    ingredients_confirmed: boolean;
    allergen_statement_checked: boolean;
  };
}

export interface AliasMapEntry {
  term: string;
  group: string;
  kind: "exact" | "alias" | "ambiguous";
  canonical: string | null;
  scientific_name: string | null;
  reviewed: boolean;
  source: string;
  note: string;
}

export interface DietTerm {
  term: string;
  applies_to: DietStyle[];
  reviewed: boolean;
  source: string;
}

export interface AliasMap {
  version: number;
  entries: AliasMapEntry[];
  diet_terms: DietTerm[];
}

/** Frozen extension contract; catalog lookup remains out of the current core flow. */
export interface CatalogCandidate {
  source: "Open Food Facts";
  product_name: string | null;
  brand: string | null;
  quantity: string | null;
  identity_score: number;
  identity_band: "strong" | "possible" | "weak";
  matched_fields: string[];
  missing_fields: string[];
  ingredients_text: string | null;
  allergens_text: string | null;
  nutrition_text: string | null;
  last_modified: string | null;
}

export interface CatalogSignal {
  status: "catalog_possible_conflict" | "catalog_unknown";
  profile_key: string;
  matched_catalog_text: string | null;
  message: string;
}

export type ApiErrorCode = "bad_input" | "quota" | "provider_error" | "unreadable_response";
export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
  };
}

export interface HealthResponse {
  status: "ok";
}