# Mission 4 — Test 2: Blurry, obscured, or partly unreadable label

## Scope

Fixture-based verification of the existing unreadable and curved/obscured label
cases. These checks validate extraction-state handling and the UI messages
defined by the components; they do not test live photo OCR or real-photo
accuracy.

## Results

| Fixture | Expected behavior | Verified status and UI behavior | Clearer photo / confirmation | Verdict |
| --- | --- | --- | --- | --- |
| `x3_ingredients_unreadable.json` | Blurry, unreadable ingredient and allergen sections remain unknown. Missing rows are not evidence of absence. | Fixture quality is `unusable`; its note says `Photo too blurry to transcribe.` Ingredients and allergen statement are `unreadable` with no extracted rows. `npm run check:rules` returns `unknown/R7` for peanut, milk, and tree nut. Component logic labels affected sections `couldn't be read`, displays their reasons, and offers `Retake this panel` with section-specific guidance. | Yes. Retake actions are offered. `ConfirmCompleteness` also asks the user to confirm whether the full ingredient list and allergen line are visible. | **PASS** for fixture, rules, and component logic. Browser-rendered display was not observed. |
| `x4_curved_obscured_partial.json` | Preserve only visible text as partial. Curved or obscured ingredients and unuploaded allergen information remain unknown. | Fixture quality is `unusable`; its note says the ingredients panel curves around the package edge and is partly obscured. Ingredients stay `readable_partial` with only `Sugar`; the reason says the curved and obscured text is not inferred. Allergen statement, nutrition, and product details are `not_uploaded`. `npm run check:rules` returns `unknown/R7` for peanut, milk, and tree nut. Component logic labels ingredients `only partly readable`, missing panels `not in your photos`, and offers `Retake this panel` for each. | Yes. The UI offers retake guidance and asks the user to confirm completeness. Missing allergen information stays unresolved. | **PASS** for fixture, rules, and component logic. Browser-rendered display was not observed. |

## Checks

- `npm run check:rules` — **PASS**: 26/26 fixtures structurally valid, 30/30
  golden cases passed, and the unreadable/partial cases remained `unknown/R7`.
- `npm run validate:fixtures` — **PASS**: 26/26 fixtures valid against the
  Pydantic extraction schema.
- `CouldntReadPanel.tsx`, `ConfirmCompleteness.tsx`, `CoverageSummary.tsx`,
  `PhotoViewer.tsx`, and `compareProfile.ts` — inspected for the corresponding
  status labels, retake prompts, photo quality note, and unknown gating.

## Limitations

Browser automation was unavailable in this run, so the messages above are
confirmed from fixture values and component logic rather than an observed
screen. No screenshot was captured. No live extraction, real-photo OCR
accuracy, or calibrated image-quality detection was tested. The image-quality
value is an estimate; partial or unreadable output remains unknown and is not
proof that an ingredient or allergen is absent.
