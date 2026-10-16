# LabelLens backend

The backend receives label images and returns the shared `Extraction` contract. Dietary profiles remain in the browser and are never accepted by this API.

## Local setup (PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The checked-in `.env.example` uses mock mode and contains no credential. `EXTRACT_MODE=mock` returns the fictional shared fixture and makes no Google API call. Its response warning says that the content was not extracted from the uploaded image.

## Environment

- `EXTRACT_MODE=mock|live` — defaults to `mock`.
- `VISION_PROVIDER=gemini|glm` — defaults to `gemini`; set to `glm` to use Z.AI.
- `GEMINI_API_KEY` — required only in live mode; set it in `backend/.env` or the backend process environment.
- `GEMINI_MODEL` — defaults to `gemini-3.5-flash-lite`; select another model supporting image input and structured output here. One local check with a supplied label photo returned a schema-valid extraction in 13.7 seconds; the extracted text was not independently scored, and one request is not a latency benchmark.
- `GEMINI_FALLBACK_MODEL` — defaults to `gemini-3.8-flash`. When the primary model is unavailable, rate limited, rejects the schema, or returns invalid extraction data, LabelLens tries this model. Invalid output gets one same-model retry before switching.
- `GLM_API_KEY` (or `ZAI_API_KEY`) — required for live mode when `VISION_PROVIDER=glm`.
- `GLM_MODEL` — defaults to `glm-5.3-flash`, Z.AI's multimodal GLM-5.3 Flash model.
- `GLM_API_URL` — defaults to the Z.AI chat-completions endpoint.
- `MAX_IMAGE_BYTES` — default 10 MiB per image.
- `MAX_TOTAL_IMAGE_BYTES` — default and maximum 14 MiB per request; lower values are supported.

Before any live call, provide the provider disclosure described in `docs/API_CONTRACT.md`. Review the selected provider's current API terms and account limits before sending real package photos. Public shopper-facing use remains unresolved for LabelLens; keep mock mode for demos until that is confirmed. Never claim provider-side deletion.

## Run and record an extraction

From `backend/`, start the API with `uvicorn app.main:app --reload --port 8000`. Then:

```powershell
python -m app.extraction.cli C:\path\to\label.jpg --out ..\work\label-extraction.json
```

The CLI uses the same mock/live setting as the API. In live mode it sends the image to the configured vision provider and writes only the locally validated JSON response to the requested path. GLM output is schema-guided and then validated locally; the Z.AI vision endpoint does not document structured JSON mode for vision models.

## Request logs and troubleshooting

Each API response includes an `X-Request-ID`. The backend writes provider/model attempts, fallback decisions, HTTP status, elapsed time, and extraction row counts to the terminal and `backend/logs/labellens.log` (rotated at 2 MiB, three backups). It never logs API keys, photos, profile data, or extracted label text. A fallback makes another provider request and can add latency and usage. Give the request ID to the developer when reporting an error.

Z.AI states that GLM Coding Plan quota is restricted to officially supported tools and is unavailable for API calls outside the plan. Its `/api/anthropic` route uses the Anthropic Messages protocol (documented for Claude Code and Goose), while `/api/coding/paas/v4` is for other supported tools; LabelLens is a custom app and cannot use this subscription. The backend rejects those plan endpoints locally and falls back to Gemini. For direct GLM calls from LabelLens, use a separate general Z.AI API key with the OpenAI-compatible `https://api.z.ai/api/paas/v4/chat/completions` endpoint; check the account's API billing and vision access.

## API

- `GET /api/health`
- `POST /api/extract` with 1–3 repeated multipart files named `images` (JPEG, PNG, WebP, HEIC, or HEIF)

The upload limits, response fields, evidence validation, errors, and privacy boundary are specified in `docs/API_CONTRACT.md` and implemented in `app/schemas.py`.
