# Test label set — truth data and recorded extractions

Protocol (design document, section 19.5): collect 8–10 real packaged products you can physically check, mostly India-first. For each, record the printed truth here before scanning. Photos live in `testset/images/` (git-ignored; share by cloud drive). Commit only the recorded `Extraction` JSON (`testset/extractions/`) and this file. After each tuning pass, tally: transcription correct, wrong, partly wrong, and **any false clear** (a must-fix). Golden rule fixtures check comparison logic, not OCR accuracy.

## Recorded checks

### S0 — synthetic test label (not a real product)

- **Purpose:** verifies the live pipeline end to end (key, model, schema, evidence validation). It is computer-generated text, so it says nothing about real-photo accuracy.
- **Image:** `testset/images/synthetic-test-label.png` (git-ignored).
- **Recorded:** `testset/extractions/synthetic-test-label.gemini-3.5-flash.json`, 2026-10-17, `gemini-3.5-flash`, live mode via `python -m app.extraction.cli`.
- **Printed truth (as drawn):**
  - Title: SYNTHETIC TEST LABEL
  - INGREDIENTS: WHEAT FLOUR, SUGAR, SALT, PALM OIL
  - CONTAINS: WHEAT
  - MAY CONTAIN: MILK, SOY
  - ENERGY 450 kcal PER 100 g; PROTEIN 7 g PER 100 g
- **Expected profile matches:** wheat → conflict via `contains`; milk, soy → possible conflict via `may_contain`; vegan diet → needs the may-contain milk resolution.
- **Result:** schema-valid; 4/4 ingredient rows with exact evidence quotes, 3/3 allergen phrases (contains WHEAT; may contain MILK, SOY), 2/2 nutrition rows, all four sections `readable_complete`. No false clear.

## Pending real-label entries

Fill one row per real product before scanning it (add rows as sections above, `### R1`, `### R2`, …):

| # | Product | Pack type | Challenge | Allergen line | Recorded |
|---|---------|-----------|-----------|---------------|----------|
| R1 | | clear back panel | baseline | | |
| R2 | | curved / glossy | glare, curvature | | |
| R3 | | small print | dense ingredient list | | |
| R4 | | any | "may contain" line present | | |
| R5 | | any | no allergen line | | |
| R6 | | any | deliberately blurry shot | | |
| R7 | | any | cropped shot | | |
| R8 | | any | | | |

A deliberately blurry or cropped photo must yield `unreadable` / `readable_partial` with no invented text (design section 7, Module B "done when").
