# Mission 05 submission readiness

Status note for the final submission. This is a checklist, not a claim that the
remaining items have been verified.

## Still pending

- **Deployment:** the owner is preparing a Vercel deployment and will provide
  its URL. Smoke-test the URL and add it to the README after it is received.
- **Mission 4 Test 1:** no report or test artifact was found in the current
  repository during this review. Do not claim it passed without its evidence.
- **Demo access:** the README links to the Google Drive recordings folder, but
  its sharing permissions were not verified. Confirm access from a reviewer
  account or request an explicit access check.
- **Public live extraction:** suitability of Gemini's current terms for a
  shopper-facing app remains unresolved. Keep live extraction out of a public
  deployment until this is reviewed; use mock mode for a public demo meanwhile.

## Team explanation outline

- **Person 1 — frontend:** React/Vite scan flow, photo and result presentation,
  evidence review, browser-local profile and accessibility controls.
- **Person 2 — backend/integration:** FastAPI extraction endpoint, provider
  configuration and fallback, schema/evidence validation, request diagnostics,
  and integration of the shared contract.
- **Person 3 — comparison:** deterministic profile matching, uncertainty and
  review gates, aliases, fixtures, and regression validation.

Explain that a fixture pass validates the supplied structured cases and
deterministic rules; it does not establish real-world OCR accuracy. Missing or
unreadable label text remains unknown, and LabelLens does not certify product
safety or provide medical advice.
