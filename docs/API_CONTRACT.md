# LabelLens API and shared contract

This is the initial Gate 1 contract for the photo-to-extraction seam. `shared/contracts.ts` is the browser-facing contract and `backend/app/schemas.py` is its Pydantic counterpart. Keep them aligned. The extraction contract follows Section 6 of the project design document.

## Endpoints

### `GET /api/health`

Returns `{"status":"ok"}` when the backend process is serving requests. It does not include provider credentials or user data.

### `POST /api/extract`

- Request: `multipart/form-data`, with 1–3 files under the repeated field name `images`.
- Accepted media types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, and `image/heif`.
- Limits: 10 MiB per image and 14 MiB total by default; the total can be lowered with backend environment variables but cannot exceed the safe inline-request cap.
- Response: one `Extraction` JSON object, exactly as defined in `shared/contracts.ts`.
- The request must not contain a dietary profile. The backend rejects form fields other than `images`; profile comparison stays in the browser.
- Image indices in the response are zero-based and refer to upload order.

## Evidence and uncertainty semantics

- Keep `label_text` and `evidence_quote` as transcribed. The server never repairs or normalizes them.
- Every text row's quote is checked against the transcript for its section. Missing transcript or a quote mismatch sets `review_required` and a reason; it does not remove or rewrite the row.
- `marks` contain visual descriptions, not printed quotes. Unclear marks require review.
- `readable_partial`, `unreadable`, `ambiguous`, and `not_uploaded` remain distinct section states. Do not interpret an empty row array as proof that a term is absent or not listed.
- When a section is readable but no rows were extracted, preserve its transcript and use `reason` to say that no matching item was detected in readable text. This is a not-detected observation, never proof of absence.
- The source contract has no separate `not_detected` enum. Only the browser's deterministic rules can produce `no_match_found`, and only after the user's completeness confirmations.
- The vision model reports section completeness; it cannot observe the user's confirmation that the full panel is visible.
- Nutrition values, units, serving basis, dates, and batch codes are preserved only when visible. Dates and batch codes are not verified externally.

## Photo-quality estimates and validation limits

- Image quality uses the frozen values good, blurry, cropped, glare, and unusable. It is a model estimate, not a calibrated photo-quality or OCR-accuracy score.
- The image note may describe a visible reading obstacle such as blur, cropping, glare, curved/folded packaging, or partial obstruction. Do not guess an unseen cause. Image notes and section status are separate; a quality value never upgrades an incomplete section.
- Browser-local corrections can change only an extracted ingredient or allergen phrase. They preserve the original evidence quote and image index, show corrected wording separately, and do not change section status or add rows. Editing leaves review_required set; the explicit “checked against the photo” action may clear only that row's review flag.
- Mission 02 checks use fictional fixtures plus an in-memory OCR-typo case grounded in an existing fixture quote. They do not establish real-photo OCR accuracy. No live Gemini call, physical-camera check, or new manual browser visual review was performed for this mission.

## Errors

Errors use the design's JSON envelope:

```json
{"error":{"code":"bad_input | quota | provider_error | unreadable_response","message":"plain sentence","retryable":false}}
```

`bad_input` is used for invalid multipart requests, file counts, MIME types, and size limits. Provider quota exhaustion maps to HTTP 429 and `quota`; other provider failures map to `provider_error`; exhausted malformed/invalid model output maps to `unreadable_response`.

## Modes and privacy

- `EXTRACT_MODE=mock` is the default and makes no provider calls. It returns the explicitly fictional `shared/fixtures/extraction/clear_peanut_alias.json`; the warning in the response says that it was not derived from the uploaded photo.
- `EXTRACT_MODE=live` sends only the uploaded images and a fixed extraction instruction to the selected provider from the backend. No profile field is accepted, logged, or sent. Select `VISION_PROVIDER=gemini|glm`.
- Store provider keys only in `backend/.env` or the backend process environment. `backend/.env.example` contains placeholders only. Never expose a key to frontend code or commit `.env`.
- Gemini defaults to `gemini-3.8-flash`, with `gemini-3.6-flash` as the configurable same-provider fallback for model-specific failures. Gemini 3 uses its default temperature; the backend sets low thinking effort to reduce latency. Gemini requests time out after 30 seconds. Fast 503/overloaded responses retry with 1- and 2-second exponential backoff; slow overload, network, timeout, and other retryable 5xx errors proceed to cross-provider fallback rather than another Gemini model. GLM requests time out after 12 seconds. `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, and `GLM_MODEL` can be changed without code edits. Gemini structured JSON output is validated against the contract; GLM receives the schema in its instructions and its JSON is validated locally. A one-time local check with a supplied label photo returned a schema-valid extraction in 13.7 seconds. The extracted words were not independently scored against ground truth, and one request is not a latency benchmark.
- Gemini is the default primary provider. If `GLM_API_KEY` is configured, retryable Gemini failures may send the same photo to GLM. If GLM is selected and `GEMINI_API_KEY` is configured, retryable GLM failures may send the photo to Gemini. Credential errors do not trigger fallback. Quota errors remain HTTP 429 when no secondary key is configured and preserve quota classification if both providers fail. Every fallback response is passed through the same evidence validator with `require_each_image=true` before it is returned. The dietary profile remains in the browser and is not sent to either provider.
- Z.AI documents Coding Plan quota as restricted to officially supported tools and unavailable for API calls outside those tools; LabelLens is a custom app. Its `/api/anthropic` route uses an unsupported protocol for this adapter, and the Coding Plan endpoint is rejected locally. For direct GLM calls, use a separate general Z.AI API key with the OpenAI-compatible `https://api.z.ai/api/paas/v4/chat/completions` endpoint, and confirm account billing and vision access first.
- The backend logs request IDs, provider/model attempts, failure categories, elapsed time, and status to its terminal and `backend/logs/labellens.log`. Keys, images, profile data, and label text are not logged. The response header `X-Request-ID` lets the UI show which log lines correspond to an error.
- A fallback is a separate provider request and can add both latency and API usage.
- Before any live call, the UI must disclose that images are sent to the configured external vision provider and link to the applicable provider terms. Check current terms, account limits, and data-handling terms before use; do not send sensitive or personal information. Do not claim provider-side deletion.
- The current terms describe Gemini API use as for professional/business purposes rather than consumer use, prohibit API clients directed toward or likely accessed by under-18 users, and require paid service for users in the EEA, UK, or Switzerland. LabelLens is a shopper-facing app, so public live-mode suitability is unresolved. Keep mock mode for demos and do not deploy live mode to shoppers until the use is confirmed permitted.
- Gemini API rate limits are per Google project and vary by model/tier. Check active limits in Google AI Studio; a successful probe verifies access at that time, not a guaranteed quota. The API returns a retryable `quota` error when the provider reports exhaustion.

## Provider references checked on 17 October 2026

- [Gemini 3.8 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) — stable model, image input, and structured outputs supported.
- [Gemini 3.5 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) — stable model with image input and structured output.
- [GLM-5.3-Flash overview](https://z.ai/blog/glm-5.3-flash) and [Z.AI vision API guide](https://docs.z.ai/guides/vlm/glm-5.3-flash) — GLM-5.3-Flash is described as natively multimodal; vision requests use the chat-completions API. The API reference documents `response_format` for text models only, so LabelLens validates GLM's schema-guided JSON itself.
- [Z.AI API terms](https://docs.z.ai/legal-agreement/terms-of-use) — review current API terms and any Additional Terms before use.
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) — inline image parts and multiple images are supported; inline request data is limited to 20 MB, so the backend defaults to a conservative 14 MiB total raw-image cap after base64 encoding overhead.
- [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output) — JSON Schema and Pydantic-backed structured output are supported.
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) — limits vary by project, model, and tier; inspect active limits in AI Studio.
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) — unpaid and paid data handling terms.
