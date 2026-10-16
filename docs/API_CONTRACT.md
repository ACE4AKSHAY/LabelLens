# LabelLens API and shared contract

This is the initial Gate 1 contract for the photo-to-extraction seam. `shared/contracts.ts` is the browser-facing contract and `backend/app/schemas.py` is its Pydantic counterpart. Keep them aligned. The extraction contract follows Section 6 of the project design document.

## Endpoints

### `GET /api/health`

Returns `{"status":"ok"}` when the backend process is serving requests. It does not include provider credentials or user data.

### `POST /api/extract`

- Request: `multipart/form-data`, with 1–3 files under the repeated field name `images`.
- Accepted media types: `image/jpeg`, `image/png`, and `image/webp`.
- Limits: 10 MiB per image and 30 MiB total by default; configured by backend environment variables.
- Response: one `Extraction` JSON object, exactly as defined in `shared/contracts.ts`.
- The request must not contain a dietary profile. The backend rejects form fields other than `images`; profile comparison stays in the browser.
- Image indices in the response are zero-based and refer to upload order.

## Evidence and uncertainty semantics

- Keep `label_text` and `evidence_quote` as transcribed. The server never repairs or normalizes them.
- Every text row's quote is checked against the transcript for its section. Missing transcript or a quote mismatch sets `review_required` and a reason; it does not remove or rewrite the row.
- `marks` contain visual descriptions, not printed quotes. Unclear marks require review.
- `readable_partial`, `unreadable`, `ambiguous`, and `not_uploaded` remain distinct section states. Do not interpret an empty row array as proof that a term is absent or not listed.
- The source contract has no separate `not_detected` enum. A readable section with no extracted rows means no phrase was detected by extraction; the transcript and section status remain available for review. Only the browser's deterministic rules can produce `no_match_found`, and only after the user's completeness confirmations.
- The vision model reports section completeness; it cannot observe the user's confirmation that the full panel is visible.
- Nutrition values, units, serving basis, dates, and batch codes are preserved only when visible. Dates and batch codes are not verified externally.

## Errors

Errors use the design's JSON envelope:

```json
{"error":{"code":"bad_input | quota | provider_error | unreadable_response","message":"plain sentence","retryable":false}}
```

`bad_input` is used for invalid multipart requests, file counts, MIME types, and size limits. Provider quota exhaustion maps to HTTP 429 and `quota`; other provider failures map to `provider_error`; exhausted malformed/invalid model output maps to `unreadable_response`.

## Modes and privacy

- `EXTRACT_MODE=mock` is the default and makes no provider calls.
- `EXTRACT_MODE=live` sends only the uploaded images and a fixed extraction instruction to Gemini from the backend. No profile field is accepted, logged, or sent.
- Store `GEMINI_API_KEY` only in `backend/.env` or the backend process environment. `backend/.env.example` contains placeholders only. Never expose the key to frontend code or commit `.env`.
- The configured default is the stable `gemini-3.8-flash` model as of 16 October 2026; `GEMINI_MODEL` can override it without code changes.
- Before enabling live mode for users, the UI must disclose that their images are sent to Google and link to the current Gemini API terms. Unpaid Gemini API usage may be used to improve Google products and may be reviewed by people; do not send sensitive, confidential, or personal information through unpaid service. Paid service has different data-use terms but retains limited prompt/response logs for safety. Do not claim that Google deletes submitted images.
- Gemini API rate limits are per Google project and vary by model/tier. Check active limits in Google AI Studio; a successful probe verifies access at that time, not a guaranteed quota. The API returns a retryable `quota` error when the provider reports exhaustion.

## Provider references checked on 16 October 2026

- [Gemini 3.8 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) — stable model, image input, and structured outputs supported.
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) — inline image parts and multiple images are supported.
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) — JSON Schema and Pydantic-backed structured output are supported.
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — limits vary by project, model, and tier; inspect active limits in AI Studio.
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) — unpaid and paid data handling terms.