# Mission 4 — Test 3: Ambiguous wording, incomplete nutrition, and conflicting interpretations

## Scope

This evaluation ran local frozen fixtures through the deterministic comparison
rules. It does not evaluate live OCR, vision-model accuracy, or real product
labels.

## Results

| Subcase and input | Expected result | Actual result and exact source evidence | Verdict and issue |
| --- | --- | --- | --- |
| **Ambiguous wording — G14.** `g14_emulsifier_ambiguous_soy.json`; profile: soy, peanut, milk, tree nut, vegetarian; ingredient and allergen confirmations true. | Soy is `possible_conflict/R3`; the remaining profile items are `no_match_found/R6` with the required safety disclaimer. | Soy: `possible_conflict/R3`, reason: `"Emulsifier" is an ambiguous term; the printed source is not stated, so it may involve Soy.` Evidence: `label_text` and `evidence_quote` are both `Emulsifier`, `image_index: 0`, `section: ingredients`, `kind: ingredient`, `match_type: ambiguous_term`, `mapped_to: soy`. Peanut, milk, tree nut, and vegetarian each returned `no_match_found/R6` with `This is not a safety check.` | **PASS.** The fixture's nutrition section is `not_uploaded`; it is not required by the dietary no-match gate. False positives / missed information: **not evaluated**. |
| **Partial ingredients and incomplete nutrition — G5.** `g5_ingredients_partial_no_hits.json`; ingredients are `readable_partial`; nutrition is `readable_partial`; ingredient confirmation false. | All dietary items remain `unknown/R7`; Protein remains unknown rather than becoming zero. | Peanut, milk, tree nut, and vegetarian each returned `unknown/R7`: `Not enough readable information: the ingredients panel was only partly readable.` Nutrition `nut-2`: `label_text: Protein`, `evidence_quote: Protein ...`, `amount_text: null`, `unit: null`, `basis: null`, `image_index: 1`, review reason: `Value partly covered by the crop; not read. Unknown is kept distinct from zero.` `NutritionTable` branches on `amount_text === null` to show `couldn't read the value`, preserves the quote and reason, and does not score nutrition. | **PASS** by deterministic execution and static UI inspection. Frontend rendering harness was unavailable locally. False positives / missed information: **not evaluated**. |
| **Correction retains source quote — X5.** `x5_mik_correction_needs_check.json`; milk profile; ingredient row `ing-2` begins as `Mik` and needs review. | Uncorrected is `unknown/R7`; edited `Milk` without a photo check is `possible_conflict/R3`; edited `Milk` with a photo check is `conflict/R1`; quote remains `Mik`. | Uncorrected: `unknown/R7`, `1 printed line still needs review`. Edited unchecked: `possible_conflict/R3`, evidence `label_text: Milk`, `evidence_quote: Mik`, `image_index: 0`, `match_type: exact`, `mapped_to: milk`; the row remains `review_required: true`. Edited checked: `conflict/R1` with the same evidence quote and image index; only then is `review_required` cleared. | **PASS.** False positives / missed information: **not evaluated**. |
| **Correction on a partial panel — G5.** Correct `ing-3` to `Sunflower Oil` and mark it checked. | The section stays partial and cannot produce `no_match_found`. | Ingredient status stayed `readable_partial`; peanut result stayed `unknown/R7`, never `no_match_found`. | **PASS.** False positives / missed information: **not evaluated**. |
| **Printed wording versus model suggestion.** Mission 3 transition case: printed `Wheat`, quote `Wheat`, image `0`; model suggestion `soy`; profile: soy and wheat/gluten. | Both profile items are review-gated `possible_conflict/R9`. | Soy and wheat/gluten each returned `possible_conflict/R9`, asking the user to check the phrase against the photo. Soy evidence: `match_type: unverified_suggestion`, `mapped_to: soy`; wheat/gluten evidence: `match_type: exact`, `mapped_to: wheat_gluten`; both retain quote `Wheat` and image `0`. | **PASS.** False positives / missed information: **not evaluated**. |
| **Allergen bucket mismatch.** Mission 3 transition case: `May contain traces of tree nuts.` placed in the direct `contains` bucket. | `possible_conflict/R9`, preserving the quoted wording for review. | Tree nut returned `possible_conflict/R9`; evidence: `label_text: tree nuts`, `evidence_quote: May contain traces of tree nuts.`, `image_index: 0`, `section: allergen_statement`, `kind: contains`, `match_type: exact`, `mapped_to: tree_nut`. | **PASS.** False positives / missed information: **not evaluated**. |
| **Conflicting dietary marks.** Mission 3 transition case: a non-vegetarian mark `brown dot inside a brown square` and a vegetarian mark `green vegetarian dot`; vegetarian profile. | `possible_conflict/R9`, retaining both mark descriptions and requesting photo review. | Vegetarian result returned `possible_conflict/R9` with both visual descriptions and the unresolved-review reason. | **PASS, with issue:** the result repeats the non-vegetarian evidence item, producing three evidence entries rather than one entry per mark. It does not create a definitive safety claim. False positives / missed information: **not evaluated**. |

## Checks run

- `npm run check:rules` — **PASS**: 21/21 fixtures structurally valid and 23/23 golden, correction, review, and disagreement cases passed.
- `npm run test:a` — **not run**: the local frontend dependencies are absent and `tsx` is not recognized.
- `npm run validate:fixtures` — **not run**: Python cannot import `pydantic` in this checkout.

## Conclusion

Ambiguous terms, incomplete panels, unconfirmed corrections, and conflicting
interpretations remain review-gated. The comparison rules preserve original
source evidence and do not turn missing or partial information into a safety
claim.
