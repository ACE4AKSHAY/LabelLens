# Person 1 README — Module A (The Face / UI)

Status: **integrated and functional in mock mode** · Source branch: `feat/a-ui` · Reskin planned
Owner: Person 1 · Folders owned: `frontend/src/{components, pages, styles, api, state}`

---

## What this is

Module A is the complete responsive web UI of LabelLens: the evidence-first
label reader that takes a user from **dietary profile → label photos →
honest, evidence-backed results**, with correction and retake flows. Mock
fixtures are fictional; the UI runs each extraction through the integrated
backend and deterministic comparison seams:

- **Seam 1** — `src/api/extract.ts`: mock fixtures or `POST /api/extract`
  (photos only; never the profile).
- **Seam 2** — `src/domain/compareProfile` (Person 3's file): the UI calls it
  after every profile/confirmation/correction change and renders whatever
  `Results` it returns.

The UI enforces the project's trust rules in presentation: status is always
text + icon shape + border pattern (never color alone), "No match found" is a
neutral outline (never a checkmark) with the exact wording *"No match found in
readable label text. This is not a safety check."*, evidence quotes are shown
"As printed" with a "From your photo" badge, visual marks show a description
(never a fabricated quote), and nothing anywhere claims a product is safe.

---

## What has been done

### Screens and flows
- **Three-step flow** (Profile → Photos → Results) with a clickable `StepStrip`.
- **Profile form**: 9 allergen presets, custom avoid terms (exact-match, add/remove),
  diet (none / vegetarian / vegan); saved to `localStorage` (survives refresh),
  edit and clear; summary chip shown across the app.
- **Photo capture**: camera capture (`capture="environment"`) where supported plus
  file upload always; 1–3 photos with previews, per-photo retake and remove;
  client-side validation of MIME types and size limits (10 MB / 14 MB total) per
  `docs/API_CONTRACT.md`; live-mode Gemini disclosure with link to Google's terms;
  mock-mode notice that nothing is sent.
- **Results view**: coverage summary (counts + per-section line, no overall
  verdict), ordered result cards, evidence quotes with source badges and
  "Show on photo" focus/highlight, original photos beside results
  (sticky on desktop, collapsible on phone).
- **Ingredient review table**: As printed · Recognized as · Edit. Editing sets
  `edited_by_user` (restorable to the original), "I checked this row against
  the photo" clears `review_required`; every change re-runs `compareProfile`.
  Recognized-as appears only from the alias map; model suggestions are labeled
  "unverified suggestion".
- **Confirm completeness**: "Is this the whole ingredient list?" and the
  allergen-line question (fully visible / pack has none / not sure),
  mutually exclusive states enforced.
- **Nutrition table**: printed value, unit, and basis preserved (per 100 g vs
  per piece distinct); "couldn't read the value" shown separately from a
  printed zero; not-uploaded state invites adding the panel; no thresholds,
  no scores.
- **Package facts**: product, brand, quantity, MFG/best-before/expiry, batch
  code — each with evidence and "Show on photo", always labeled
  read-from-photo, never verified.
- **Couldn't-read panel**: every partial / unreadable / not-uploaded section
  with its reason, targeted retake guidance, and a retake action.
- **States**: loading (aria-live), empty, provider error with retry,
  no-restrictions guard, unreadable photo — plus the persistent safety note.

### Mock / dev tooling
- Four built-in fixture packs (fictional products) covering the main UI
  states: alias conflict + may-contain, flagged rows / uncertain symbol /
  unreviewed alias, clean no-match with rich nutrition, and blurry / cropped /
  missing panels.
- `?dev=1` fixture picker: loads any state instantly (no photo upload needed),
  including a provider-error simulation. Result cards always come from
  `compareProfile` using the current browser profile and confirmations;
  hand-written expected results are used only by fixture checks. Shared
  fixtures under `shared/fixtures/extraction/` are loaded automatically.

### Quality / verification
- `tsc --noEmit` clean; `vite build` passes.
- `npm run test:a` — **88 functional checks** (no new dependencies): profile
  validation/summary, the correction pipeline (edit / restore / check-row),
  and contract honesty of every fixture pack (evidence quotes present,
  image indices in bounds, nutrition values text-or-null, severity ordering,
  no-match wording, unknown-never-no-match on unreadable panels, flagged rows
  never plain conflicts).
- Manually driven in a real browser at ~360 / ~768 / ~1280 px (zero horizontal
  overflow at 360 px) through the full interaction set: profile → photos →
  fixture scan → edit / restore / check-row / confirm → couldn't-read → nutrition.
- Accessibility: skip link, fieldset/legend groups, labeled inputs,
  `aria-current` steps, `aria-live` reading state, visible focus rings,
  ≥44 px touch targets, reduced-motion support, 16 px base text.

### Files (all inside Person 1's folders, except noted)
- `src/App.tsx`, `src/main.tsx`, `index.html`
- `src/components/` — StepStrip, ProfileForm, PhotoCapture, PhotoViewer,
  ResultCard, ResultsList, CoverageSummary, EvidenceQuote, ConfirmCompleteness,
  IngredientTable, NutritionTable, PackageFacts, CouldntReadPanel, SourceBadge,
  StatusBadge, DevFixturePicker, PersistentNote, icons
- `src/pages/` — ProfilePage, ScanPage
- `src/state/` — profileStore (localStorage), scanStore (in-memory scan),
  applyCorrections (pure correction pipeline)
- `src/api/` — extract.ts (mock/live seam + error envelope), mocks/ (4 packs + registry)
- `src/styles/` — tokens.css (Section 9 design system), global.css, app.css
- `src/testing/moduleAChecks.ts` — `npm run test:a`
- **Person 3's integrated module**: `src/domain/compareProfile.ts` (R1–R8)
  and `aliasMap.json` (unreviewed entries remain conservative)
- Scaffold repairs (flagged for Person 2): `tsconfig.json` (jsx flag + working
  path aliases), `vite.config.ts` (aliases + `fs.allow` for `../shared`),
  `package.json` (@types pinned to existing 18.x versions, `test:a` script),
  `.gitignore` (`*.tsbuildinfo`)

---

## How it is done

- **Contract-driven.** Every shared shape is imported from the frozen
  `shared/contracts.ts` via the `@shared` alias. No contract file was edited.
  If the contract changes, only imports/type usage change in the UI.
- **Profile vs scan separation.** The profile lives in `localStorage`
  (`labellens.profile.v1`) through a validated provider; the active scan
  (photos, extraction, confirmations, corrections, results) lives only in
  memory and is fully cleared on reset — per the spec's privacy rules.
- **One comparison path.** Every mutation (confirmation, correction,
  check-row, restore) goes through one `recompute` in `scanStore` that applies
  corrections to the extraction, calls `compareProfile`, and stores the
  results. There is no second code path that could invent a status.
- **Mock honesty.** Mock mode says that no photo is sent and returns a
  fictional sample extraction. All result cards, including dev fixtures, are
  computed by `compareProfile`; expected results are only test references.
- **Styles are isolated for reskinning.** All visuals live in
  `src/styles/*.css` + `tokens.css`; `tokens.css` maps 1:1 to Section 9
  (palette, 8 px spacing steps, radii, one shadow, status colors). Components
  apply status via the `STATUS_META` mapping (text label + icon shape +
  border style), so a reskin should keep the token names and the status
  border/icon conventions intact.

### How to run
```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 — mock mode by default
npm run test:a     # 88 functional checks
npm run build      # tsc + vite build
```
- Add `?dev=1` for the fixture picker (every state without a backend).
- Live mode: set `VITE_EXTRACT_MODE=live` (copy `.env.example` to `.env`)
  and run Person 2's backend on port 8000; Vite proxies `/api`.

---

## What is to be done

### Remaining UI polish
1. **Client-side image downscaling** — spec's risk table asks for it; today
   oversized photos are rejected with guidance instead of resized.
2. **Camera capture verified on a physical phone** (headless browsers can't
   exercise file pickers).
3. **Focus restoration** after edit save/cancel (focus should return to the
   Edit button); one screen-reader pass (NVDA/VoiceOver).
4. Optional: real browser E2E tests (Playwright) — needs team approval for a
   new dev dependency.

### Integration status
- The backend, UI, and deterministic rules are integrated. Mock results use
  the real comparison engine; `npm run check:rules` covers the rules against
  the golden fixtures.
- A live session still needs verified Gemini access, quota/terms review, and
  at least three real labels to measure transcription quality.
- **Demo metrics** (spec §16) — photo-to-result timing and transcription
  tally need real labels.

---

## Recommended things to implement

1. **Image downscaling before upload** (~1600 px long edge via canvas) —
   prevents the most likely real-device failure (phone photos over 10 MB).
2. **Photo panel role tagging** — let the user tag a photo as
   ingredients / allergen / nutrition when adding it; pass roles to the
   backend so retake prompts can name the exact panel.
3. **Keyboard shortcut hints + focus management polish** (focus return after
   edit, focus trap-free but predictable order) — cheap a11y wins.
4. **Playwright E2E suite** behind team approval — the fixture picker makes
   every state scriptable without a backend; would guard the reskin.
5. **Zoom on "Show on photo"** — currently scroll + highlight; a pinch/zoom
   viewer is the spec's first stretch item and is fully UI-side.
6. **Prepare the Module D catalog slot** — a `CatalogPanel` component stub
   with the "From catalog — not your photo" badge already exists in
   `SourceBadge`; build the panel only after Gate 3 and the name-search
   pre-check, per spec.
7. **For the Codex reskin**: keep `tokens.css` variable names and the
   status icon/border conventions (they are the accessibility contract);
   replace everything else freely in `app.css` / `global.css`.
