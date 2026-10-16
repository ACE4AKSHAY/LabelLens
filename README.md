# LabelLens

LabelLens helps shoppers understand packaged-food labels. A user photographs a product label, reviews the extracted ingredient and nutrition details, and compares visible evidence with their own dietary preferences.

## MVP principles

- Keep the original label photo and source wording visible beside normalized ingredient names and extracted values.
- Explain each match or potential conflict with the exact evidence that supports it.
- Distinguish a detected conflict, a possible conflict, no conflict detected in readable text, and unknown because information is absent, unreadable, or ambiguous.
- Never treat an ingredient that was not detected as proof that it is absent.
- Keep product-catalog results separate from what the photographed label confirms.

## Initial architecture

- Responsive React web UI.
- FastAPI backend for image extraction; API credentials remain on the backend.
- Profile preferences stored in browser `localStorage` for the MVP.
- Active photo and scan held in memory; no server-side scan history or database in the MVP.
- Deterministic profile-comparison rules with evidence-backed results.
- Optional product lookup only after the photo-to-results flow works reliably.

## Team ownership

- Person 1: UI, profile form, upload/camera flow, results and responsive polish.
- Person 2: extraction API, shared contracts, integration lead.
- Person 3: deterministic comparison rules, ingredient aliases and fixtures.

Use the uploaded modular design document in `docs/` as the detailed product and implementation guide. The team ownership above reflects the current kickoff assignment.

## Local setup

The backend runs in mock mode by default. Keep credentials in `backend/.env`; never commit `.env` files or API keys.

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --reload --port 8000
```

From the repository root, run the deterministic rule and fixture checks:

```powershell
npm run check:rules
backend\.venv\Scripts\python.exe scripts\validate_fixtures.py
```

The current integration includes the backend and Module C rules. Person 1's functional UI remains on `feat/a-ui` while its reskin is being decided.

## Module C — deterministic comparison rules (Person 3)

`compareProfile(extraction, profile, confirm, aliasMap) → Results` is a pure function that implements rules R1–R8 of the design document (Section 8). It never rewrites displayed label wording, never sends the profile anywhere, and never says a product is safe: "No match found in readable label text. This is not a safety check." is the strongest wording it can produce, and only through the strict R6 gate (ingredients complete + confirmed, allergen line complete + confirmed or declared absent, and no ingredient/allergen row needing review).

### Files

- `frontend/src/domain/compareProfile.ts` — the rules engine (pure TypeScript; type-only import of `shared/contracts.ts`).
- `frontend/src/domain/aliasMap.json` — India-relevant ingredient aliases and diet terms; every entry ships `reviewed: false` until a teammate verifies it. Unreviewed aliases and ambiguous terms can only ever raise `possible_conflict`.
- `shared/fixtures/extraction/*.json` — hand-written, fictional, schema-shaped fixtures covering clear matches, clear non-matches, ambiguous aliases, unreadable text, missing panels, may-contain lines, diet marks, edited rows, custom-avoid terms, and nutrition values (kept "unknown ≠ zero").
- `shared/fixtures/expected_results.json` — expected status and rule per profile item for golden cases G1–G17 plus G0 (the sample fixture) and X1–X3 (extras).
- `scripts/check_rules.mjs`, `scripts/validate_fixtures.py` — the two checks below.

### Checks

```bash
npm run check:rules            # golden cases G0-X3: expected vs actual per item, PASS/FAIL (needs Node 22.6+)
python scripts/validate_fixtures.py   # validates every fixture against the frozen Pydantic contract (needs Python 3.12+)
```

`check:rules` also mirrors the contract structurally so it runs without Python; the Pydantic script remains the authoritative schema check. Integration verification passed: 21/21 golden cases and 19/19 fixtures against the backend Pydantic contract.

### How the UI uses it (Person 1)

```ts
import { compareProfile } from "../domain/compareProfile";
import aliasMap from "../domain/aliasMap.json";

const results = compareProfile(extraction, profile, confirm, aliasMap);
```

Call it after every extraction, user edit (`edited_by_user` + corrected `label_text`), "I checked this row" (clears `review_required`), and completeness confirmation, then render `results.items` in the given order (already sorted by severity). Evidence items carry the printed wording (`label_text` / `evidence_quote`) or the mark's `visual_description`; `mapped_to` is the canonical term for the "Recognized as" column.

### Decisions recorded on this branch (none change the frozen contract)

1. `other` allergen phrases are compared like may-contain phrases (R2, precautionary) and carry evidence `kind: "may_contain"` because the frozen `EvidenceItem` enum has no `"other"` — flagged to Person 2 for review.
2. Diet terms found in `may_contain`/`other` phrases raise `possible_conflict` via R2; R4's text only names ingredients. `contains` phrases are treated like ingredient rows for diet terms. Flagged to Person 2.
3. An unclear or `review_required` diet mark affects only the diet item (R4); it does not block R6 for allergen items, which per R6's letter gate on ingredient/allergen-statement rows only. Flagged to Person 2.
4. G1 and G11 test the reviewed-alias/reviewed-diet-term paths using per-case `reviewed_terms` / `reviewed_diet_terms` overrides in `expected_results.json`; the shipped `aliasMap.json` stays `reviewed: false` until each entry is verified.
5. Known alias-noise cases (measured, not assumed): the milk alias `butter` also matches "Cocoa Butter" (stays `possible_conflict` because it is unreviewed); the exact token `milk` matches "Coconut Milk" (would be `conflict`); "buttermilk" does not match `milk` because matching is whole-word. Matching is deliberately free of substring rules, so "nutmeg" never matches tree nuts. The team should decide on disambiguation (e.g. negative entries or extended phrases) before reviewing the `butter` entry.
6. `lactose` is kept `ambiguous` (team to decide alias vs ambiguous per Appendix 19.3), and `edible vegetable oil` is mapped `ambiguous → peanut` as an India-relevant example; confirm or drop it to avoid noise.
7. The "Edited by you" badge belongs to the UI (rendered from `IngredientRow.edited_by_user`); `EvidenceItem` has no edited flag, so result-card evidence shows the corrected text with the original quote.

