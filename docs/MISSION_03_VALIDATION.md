# Mission 03: Evidence and contradiction validation

## What the application does

Dietary comparisons are deterministic and run locally against the extracted label text and the user's local profile. Each warning retains the extracted phrase or mark, image index, section, and normalized match. The result screen links that evidence to the uploaded image. Unverified aliases, ambiguous OCR, partial sections, and model suggestions stay review-gated. The profile is not sent to the vision model.

Mission 03 adds R9 disagreement handling. A disagreement between a clear printed term and the model's suggested group, or between a statement's extracted category and its quoted wording, becomes `possible_conflict` and asks the user to inspect the linked photo. Simultaneous vegetarian and non-vegetarian marks also remain unresolved and link both marks. No result certifies product safety or gives medical advice.

## Evaluation

| Scenario | Expected behavior | Automated check |
|---|---|---|
| Exact matching allergen text | Conflict includes the label phrase and image link | Existing G0-G17 golden fixtures |
| Ambiguous or unreviewed ingredient | Possible conflict; no definitive claim | Existing G2, G4, G14, X4-X5 |
| Model group disagrees with exact printed term | R9 possible conflict; both interpretations disclosed; phrase/image retained | Mission 3 transition check |
| “May contain” text placed in direct `contains` field | R9 possible conflict; quoted statement retained | Mission 3 transition check |
| Vegetarian and non-vegetarian marks both extracted | R9 possible conflict; both visual evidence items retained | Mission 3 transition check |
| Missing or partial OCR | Unknown; absence is not inferred | Existing G5-G9 and X3-X4 |

## Scope and limitations

This is rule-based contradiction detection over extracted structured output, not a second independent vision judgement. The wording checks recognize a small set of English precautionary phrases and may miss unusual or non-English wording. Automated fixtures do not establish accuracy on real packages; OCR/model confidence is not calibrated. Nutrition values are displayed with source evidence but are not compared against medical or personal thresholds. Users must inspect the linked label; results are informational and not medical advice or a safety guarantee.

## Checks

Run `npm run check:rules`, `npm run test:a`, and `npm run build`. Python fixture validation is available with `npm run validate:fixtures` when Python is installed.
