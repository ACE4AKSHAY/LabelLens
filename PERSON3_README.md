# PERSON 3 README — Module C, "The Judge"

> Welcome, next Person 3. This file tells you what this module is, what has already been done,
> how it works, what is still open, and what we recommend you build next. Read this top to
> bottom once and you are productive in ~10 minutes.

---

## 1. What is this?

LabelLens is a hackathon web app (team of 3) where a shopper photographs a packaged-food label,
an AI reads it, and **deterministic rules** compare the reading against the shopper's dietary
profile. Three people, three modules:

| Person | Module | Job |
|---|---|---|
| Person 1 | A — The Face | UI: profile form, photo upload, result cards |
| Person 2 | B — The Reader | Vision/OCR backend that turns photos into structured JSON |
| **Person 3 (you)** | **C — The Judge** | **The rules brain: comparison logic, alias map, fixtures, checks** |

Your module is the part that **decides**. The AI is only allowed to read and doubt;
**only your rules plus the user's own confirmations can ever clear a product.**

The one sentence to tattoo on your brain:

> **"Not detected" is never "not present."** A missing, blurry, or partial panel can never
> produce reassurance. The strongest wording the engine can ever output is
> *"No match found in readable label text. This is not a safety check."*

---

## 2. What has already been done (branch `feat/c-rules`)

Everything below is committed and pushed. Do not rebuild it — read it, then extend it.

- `frontend/src/domain/compareProfile.ts` — the complete rules engine (rules R1–R8 from the
  design doc, Section 8). Pure function: no network, no UI, no storage.
- `frontend/src/domain/aliasMap.json` — 48 ingredient aliases + 11 diet terms, India-relevant
  (groundnut, maida, atta, suji, rava, til, gingelly, paneer, ghee, curd...). **Every entry ships
  `reviewed: false`.**
- `shared/fixtures/extraction/*.json` — 19 hand-written fictional label fixtures (the sample
  `clear_peanut_alias.json` from Person 2 plus 18 new ones).
- `shared/fixtures/expected_results.json` — expected status + rule for every profile item for
  every case (golden cases G0–G17 from the spec, plus extras X1–X3).
- `scripts/check_rules.mjs` + root `package.json` → `npm run check:rules` — the golden-case
  harness. Currently **21/21 PASS**, and it independently re-verifies the R6 safety gate.
- `scripts/validate_fixtures.py` — validates all fixtures against Person 2's frozen Pydantic
  contract. Written, **but never run** (the build machine had no Python).
- `README.md` — section "Module C" with usage and recorded decisions.

Status of checks at push time:

```text
npm run check:rules                -> 21/21 golden cases passed
fixture structural validation      -> 19/19 valid
tsc --noEmit --strict (types)      -> clean
python scripts/validate_fixtures.py -> NOT RUN (no Python on the build machine)
```

---

## 3. How it is done (how the engine works)

### The function you own

```ts
compareProfile(extraction, profile, confirm, aliasMap): Results
```

- `extraction` — what Person 2's vision model read from the photos (ingredients, allergen
  statements, marks, section statuses). Never trust it blindly; rows carry
  `review_required` flags exactly for this reason.
- `profile` — the user's restrictions (allergens, custom avoid terms, diet). Stays in the
  browser; never sent anywhere.
- `confirm` — what the user swore to: "yes, this is the whole ingredient list", "yes, the
  allergen line is fully visible" (or "this pack has no allergen line").
- `aliasMap` — your nickname dictionary, passed in so it can be swapped/tested.

It returns `Results`: one card per profile item with `status`, `rule_id`, a one-sentence
`reason`, and `evidence` — the exact printed words (or the mark's visual description) that
support the call. UI just renders it; it is pre-sorted by severity.

### The four states, and when each fires

| Status | Fires when | Example |
|---|---|---|
| `conflict` | Exact term or **reviewed** alias, in a clear ingredient/contains row | "Groundnut Oil" with groundnut verified |
| `possible_conflict` | May-contain lines, unreviewed aliases, ambiguous terms, any row needing review, unverified model suggestions | "May contain traces of tree nuts" |
| `unknown` | No hits, and coverage/completeness/review conditions are not all met | Blurry photo, unconfirmed list, one unreadable row |
| `no_match_found` | **Only** through the R6 gate — see below | Clean label + everything confirmed |

### The R6 gate (the safety core)

`no_match_found` requires ALL of:

1. ingredients section `readable_complete`
2. user confirmed the ingredient list is complete
3. allergen statement `readable_complete` + confirmed, **or** user says the pack has none
4. **zero** ingredient/allergen rows with `review_required: true`

Fail any one → `unknown`, and the reason names exactly what is missing, in priority order
(ingredients not uploaded / unreadable / partial / unconfirmed → allergen line not checked →
rows needing review). The check harness recomputes this gate independently, so nobody can
accidentally weaken it.

### Matching rules (why matches are trustworthy)

- Normalization (for matching only, never for display): lowercase, punctuation → spaces,
  whole tokens.
- **Whole-word / whole-phrase matching.** No substring rules. So "nutmeg" never matches
  "tree nut", and "buttermilk" never matches "milk".
- Trailing "s" tolerance: "tree nuts" matches "tree nut".
- A match in a may-contain line, an unreviewed alias, an ambiguous term, or a row flagged
  `review_required` can **only** produce `possible_conflict`, never `conflict`.
- Diet marks: a clear non-veg mark = conflict for vegetarian/vegan; an unclear mark =
  possible conflict; a veg mark is evidence only and never clears anything.

### The alias map and its honesty mechanism

Every entry has `kind` (`exact` / `alias` / `ambiguous`) and `reviewed`. Only `reviewed: true`
entries can produce a **conflict** through an alias. This is deliberate: the map ships
entirely unreviewed, so it is conservative out of the box. Golden cases G1/G11 test the
reviewed path using per-case `reviewed_terms` overrides in `expected_results.json` — the
shipped map stays clean until a human verifies entries.

### Running the checks

```bash
npm run check:rules                       # golden cases, PASS/FAIL per case (Node 22.6+)
python scripts/validate_fixtures.py       # Pydantic contract validation (Python 3.12+)
```

To add a case: write a fixture in `shared/fixtures/extraction/`, add a case to
`shared/fixtures/expected_results.json` (fixture, confirm state, expected status/rule per
profile item), run `npm run check:rules`. Green = done.

---

## 4. What still needs to be done (open items)

### Yours to do, roughly in order

1. **Run `python scripts/validate_fixtures.py` on any machine with Python 3.12** and confirm
   19/19. It is the authoritative schema check and has never been executed.
2. **Verify alias entries and flip `reviewed: true`** one by one against a reliable source
   (start with the obvious India hits: groundnut=peanut, maida/atta=wheat, til=sesame,
   ghee/paneer/curd=milk). Until then the map is honest but timid — everything is only
   "possible conflict".
3. **Add the three missing test cases** (recommended below).
4. **Get the team's decision on the flagged contract questions** (next section) and either
   record them as final or open a contract-change PR (one PR touching `contracts.ts` +
   `schemas.py` + fixtures together — never edit the contract alone).

### Decisions already flagged for Person 2 / the team

1. `other` allergen phrases carry evidence `kind: "may_contain"` (the frozen enum has no
   `"other"`). Fine to keep, or change the contract.
2. Diet terms found in may-contain/`other` phrases raise `possible_conflict` via R2; R4's
   text only names ingredients. Team should confirm.
3. An unclear diet mark affects only the diet item, not R6 for allergens (per R6's letter).
4. `lactose` kept `ambiguous` — alias or ambiguous? Decide.
5. `edible vegetable oil → peanut` (ambiguous) is India-relevant but noisy — confirm or drop.
6. Known alias-noise traps (measured, not guessed): alias `butter` matches "Cocoa Butter";
   exact token `milk` matches "Coconut Milk". See recommendations.

---

## 5. Recommended things to implement next

### Quick wins (about an hour total, high value)

1. **Vegan diet golden cases.** The vegan path (honey, egg, milk, whey, casein as diet terms)
   is implemented but has zero test coverage — every current case uses vegetarian. One fixture
   with "Honey" + vegan profile expecting `possible_conflict` (unreviewed) is enough to lock it.
2. **A `suggested_group` case.** R3's fourth clause (unverified model suggestion →
   `possible_conflict` only) is implemented but untested. Give an ingredient a
   `suggested_group: {group: "soy", note: "..."}` and assert soy stays at `possible_conflict`.
3. **An `ambiguous` section-status case.** The enum value exists; no fixture proves it degrades
   to `unknown` gracefully instead of crashing or over-clearing.

### Design work worth doing when there is time

4. **Negative entries in the alias map.** The cleanest fix for the "Cocoa Butter" / "Coconut
   Milk" traps: allow entries like `{term: "cocoa butter", excludes: "milk"}` so whole-word
   matches inside clearly-non-dairy phrases are suppressed. Needs a contract decision first —
   coordinate, do not freelance.
5. **More real aliases once verification starts**: buttermilk, khoya/mawa (milk), besan is
   NOT wheat (chickpea — worth an explicit "never map" note), jaggery is fine (no allergen).
6. **Pronoun/dialect sweep of real Indian labels**: collect 10 real backs-of-packs and grep
   your fixtures' vocabulary against them; add missing aliases as `reviewed: false`.

### Beyond Module C (so the hackathon actually demos)

7. **Person 1 must scaffold the frontend** (`npm create vite@latest frontend -- --template
   react-ts`) — careful: `frontend/src/domain/` already exists; scaffold around it, do not
   overwrite. Until then nothing is demoable.
8. **Person 2's real-label test set** (`testset/` + `EXPECTED.md`) — fixtures prove the rules,
   real photos prove the pipeline.
9. **Integration run**: mock mode end-to-end (fixture picker → compareProfile → cards), then
   live mode on one real photo. The README's Module C section has the exact import snippet
   Person 1 needs.

---

## 6. Ground rules (from AGENTS.md, the parts that matter most here)

- Never say or imply a product is safe. Never let AI output clear a product.
- Never edit `shared/contracts.ts` or `backend/app/schemas.py` alone — contract changes are a
  team PR.
- Preserve exact label wording (`label_text` / `evidence_quote`); normalization is for
  matching only.
- Commit small, `feat:`/`fix:`/`docs:` prefixes, push often, never force-push shared branches.

*Questions? Everything above is also in the main `README.md` under "Module C". When in doubt,
run `npm run check:rules` — if it's green, the safety invariants are holding.*
