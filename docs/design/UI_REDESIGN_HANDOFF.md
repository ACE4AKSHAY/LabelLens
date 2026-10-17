# LabelLens UI redesign handoff

The redesign reference is [`preview.html`](./preview.html), with implementation guidance in [`DESIGN_SPEC.md`](./DESIGN_SPEC.md). The React UI has been adapted to the existing app rather than copied over as a standalone mockup.

## Product and behavior rules to preserve

- Never say a product is "safe" and never show a safety score. Status uses clear text and shape/border styling as well as color.
- Every conflict or possible conflict must show its supporting label wording and source.
- Unknown, unreadable, and not detected stay distinct. None of them means absent.
- Catalog-derived information stays visibly separate from photo-confirmed information.
- The source photo is not presented as having exact text highlights; there are no OCR coordinates. "Open photo" selects the corresponding full photo and briefly outlines its frame.
- Profiles remain browser-local. Preserve the extraction, comparison, correction, confirmation, export, and demo-fixture behavior already in the repository.
- Do not edit `shared/`, `backend/`, or `frontend/src/{domain,api,state,testing}` for visual work. Do not change component contracts or add packages without a separate decision.
- Keep mock mode for public demos until live-provider eligibility is confirmed. Google's [Gemini API terms](https://ai.google.dev/gemini-api/terms) effective March 23, 2026 state the API is for professional or business developer use, not consumer use; unpaid-service content may be used to improve products and may be reviewed by humans. The live upload disclosure reflects this.

## Design direction

- Warm paper and ink palette, restrained indigo accent, quiet rules instead of a wall of cards, serif display headings, sans-serif controls, and monospaced label wording.
- Light and dark system themes, compact but readable tables, local horizontal scrolling for dense tables, 44px minimum touch controls, and reduced-motion support.
- Print output uses a white page and dark text. The CSS uses the new tokens directly; the old compatibility aliases have been removed.

## Implementation status

| Area | Status |
|---|---|
| Preview, specification, tokens, and base styles | Implemented |
| App shell, step navigation, and profile screen | Implemented |
| Photo capture, reading state, and errors | Implemented; long-wait guidance and local demo-photo loading preserved |
| Results, evidence, status, source badges, coverage, and uncertainty | Implemented |
| Ingredients, nutrition, allergens, package facts, confirmation, corrections, and print | Implemented |
| Photo selection and results layout | Implemented; evidence selects a full source photo, and mobile has persistent Photos / Scan next actions |
| Mobile, dark-mode, high-zoom, and print visual review | Needs a final browser pass |

The original sample-reading disclaimer and extraction warning panel are part of the results view. Warnings remain separate from dietary verdicts and can jump to their source photo or review row.

## Integration and verification

- UI changes are on `feat/a-ui-redesign`; backend, shared contracts, and comparison rules are unchanged.
- Run `npm install` and `npm run build` from `frontend/` before merging.
- No tests were added or run as part of the UI work.
- Browser-based visual review could not be completed in the current Codex Work environment because local browser use is disabled. Review at 360px, 760px, 1024px+, dark mode, and 200% zoom before presenting the UI as visually verified.
- The local demo photograph is intentionally excluded from Git. Follow [`../LOCAL_DEMO.md`](../LOCAL_DEMO.md) to add it to a local checkout; the UI explains when a saved text-only fixture has no image.

## Files

The reference artifacts live here. UI implementation is in `frontend/index.html`, `frontend/src/App.tsx`, `frontend/src/pages/`, `frontend/src/components/`, and `frontend/src/styles/`.
