# Mission 02 validation

## Covered regression scenarios

- An uncertain `Groundnut 0il` ingredient row is corrected to `Groundnut Oil`, then explicitly checked against the photo before comparison runs again. Both results are conservatively `possible_conflict` because the shipped unreviewed `groundnut` alias matches both wordings; the returned evidence changes to the corrected label wording and retains the original `Groundnut 0il` quote.
- A complete, confirmed label with a review-required OCR row reading `Mik` starts `unknown` for a milk profile. Editing the text to `Milk` alone preserves `review_required` and produces `possible_conflict`; after an explicit photo check it becomes `conflict`, with evidence `label_text` `Milk` and original `evidence_quote` `Mik`.
- An explicitly checked correction on a `readable_partial` ingredient section keeps that section `readable_partial` and remains `unknown`. A correction does not change section completeness and cannot unlock `no_match_found`.
- A matching ingredient row marked `review_required` stays `possible_conflict`, while unrelated profile items remain `unknown`. Only an explicit photo check can allow the matching row to become a plain `conflict` and unrelated items to reach `no_match_found` when the remaining R6 conditions hold.
- A mock curved, partly obscured ingredient label uses existing contract values: image quality `unusable`, ingredients status `readable_partial`, and only the visible text `Sugar`. Its comparison results remain `unknown`.

## Checks run

- `npm run check:rules` — passed: 21/21 fixtures structurally valid, 23/23 golden cases passed, and all 13 correction and review-transition checks passed.
- `npm run validate:fixtures` — not run: `python` is not installed in this checkout environment.
- `py -3 scripts/validate_fixtures.py` — not run: the Windows Python launcher found no installed Python 3 runtime.

## Scope and limits

These are mock fixtures that verify deterministic downstream uncertainty behavior. They do not evaluate vision-model accuracy. Image quality is model-reported and uncalibrated; the contract has no image bounding boxes; and real-photo detection accuracy remains unverified because no permitted real-photo evaluation was performed. No live Gemini calls were made, and mock mode remains intact.
