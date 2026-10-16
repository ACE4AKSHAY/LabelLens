# Mission 03 validation

## Scope and review-finding seam

The comparison remains a pure browser-side function. It reads only the extraction, the local user profile, confirmations, and the existing alias map. It makes no model call and sends no profile data to the extraction service.

Person 1's current UI already consumes Results.items as ProfileResult. Mission 3 keeps that interface as the review finding: status, rule_id, reason, and evidence. An unverified model suggestion is possible_conflict, not a new status or field. unknown continues to mean the evidence or coverage is incomplete. Text findings preserve the extraction's exact quote and image index; mark findings preserve the visual description and image index without inventing a quote. No shared contract or UI changes were needed.

## Scenarios covered

Existing golden and correction regressions remain in the suite:

- G1 verifies a clear match from a reviewed alias; G14 verifies an ambiguous ingredient remains possible_conflict.
- G13 and X5 plus the correction transitions verify edits retain original quotes and image references, edits alone do not clear review, and explicit photo checks do not upgrade partial sections.
- G5–G9, G17, X3, and X4 verify missing, partial, unreadable, unconfirmed, or review-required evidence cannot produce no_match_found.

Mission 3 adds these focused cases:

| Case | Scenario | Expected result |
| --- | --- | --- |
| M3-01 | Printed Peanut Flour conflicts with peanut while the model suggests soy for the same row. | Peanut is a text-backed conflict; soy stays an unverified possible_conflict. |
| M3-02 | Sunflower Oil has a peanut model suggestion but no matching peanut wording. | Peanut is possible_conflict, never a confirmed conflict; the exact quote and image index remain attached. |
| M3-03 | The same complete label is compared against a sesame-only profile. | Sesame reaches no_match_found only through the existing R6 gate. |
| M3-04 | The suggestion-only fixture has a cropped, partial ingredients panel. | Peanut remains possible from the suggestion; unrelated sesame remains unknown, not no-match. |
| M3-05/M3-06 | Vegetarian and non-vegetarian marks appear in separate image records. | Vegetarian and vegan results are review-gated; evidence includes both visual descriptions and their respective image indexes. |
| M3-07 | A clear non-vegetarian mark coexists with an unclear mark. | The result is possible_conflict with both mark references and a review reason. |

check_rules.mjs now checks expected evidence tuples and verifies every returned fixture finding points back to the original text row or mark. It also retains the independent R6 gate check.

## Results

- npm run check:rules — passed: 26/26 fixtures structurally valid, 30/30 golden cases passed, and all 13 correction/review transitions passed.
- .\backend\.venv\Scripts\python.exe scripts\validate_fixtures.py — passed: 26/26 fixtures valid against the Pydantic extraction schema.
- npm run test:a — passed: 112 checks, 0 failed. This is Person 1's current integrated UI/correction/export check summary.
- npm run build — passed: TypeScript check and Vite production build.

No live extraction calls or real product photos were used.

## Limitations and reliability improvements

These fixtures establish deterministic behavior for supplied extraction records; they do not measure the vision model's accuracy or prove that any model suggestion reflects the photographed label. Conflicting marks are conservatively review-gated when present in the extraction, but the rules cannot determine which physical mark is correct. Image quality is still model-reported and uncalibrated.

Keep suggestions review-gated unless matching readable label evidence independently supports the profile item. Continue testing with consented, annotated real-label photos and record transcription, quote, image-reference, and mark disagreements before changing alias review states or loosening uncertainty gates. Any future UI addition can render these findings through the existing ProfileResult fields without changing the frozen shared contract.
