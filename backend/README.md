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

## Bring Your Own Key (BYOK)

For a local live run, the operator supplies their own Gemini or Z.AI API key in `backend/.env`. This is a developer/operator setting, not a key-entry feature for shoppers. Keep the key on the backend; never add it to frontend configuration, source files, Git, screenshots, or demo recordings. The operator is responsible for provider access, free-tier limits, billing, and current terms. When a live scan starts, the uploaded label photos are sent to the selected provider; dietary profile data remains in the browser.

For a Gemini live demo, set these values in `backend/.env`:

```dotenv
EXTRACT_MODE=live
VISION_PROVIDER=gemini
GEMINI_API_KEY=your-own-key
```

Set `VITE_EXTRACT_MODE=live` in the ignored `frontend/.env`, then restart both servers. Keep `VITE_API_BASE=/api`; the key itself must never appear in the frontend. The UI displays a provider disclosure before a live upload. To return to fixture-based demos, set both mode values to `mock` and restart.

## Environment

- `EXTRACT_MODE=mock|live` — defaults to `mock`.
- `VISION_PROVIDER=gemini|glm` — defaults to `gemini`; set to `glm` to use Z.AI.
- `GEMINI_API_KEY` — required only in live mode; set it in `backend/.env` or the backend process environment.
- `GEMINI_API_KEY_2` — optional second Google AI Studio key from another free-tier project/account. When Gemini reports quota (429), 503, or a timeout, the same scan is retried with this key before any other fallback. A second key is the practical way to keep free-tier scans working, because each free project has its own rate limits.
- `GEMINI_MODEL` — defaults to `gemini-3.5-flash`; select another model supporting image input and structured output here. Gemini 3 uses its default temperature; the backend sets low thinking effort to reduce latency for label extraction. One synthetic-label live check on 2026-10-17 returned a schema-valid extraction with correct ingredients, allergen phrases, and evidence quotes; one earlier real-photo check with a flash-tier model returned a schema-valid extraction in 13.7 seconds. Neither is an accuracy or latency benchmark.
- `GEMINI_FALLBACK_MODEL` — defaults to `gemini-3.5-flash-lite`. It is tried for model-specific request or output failures. Quota, transient network, 5xx, and timeout errors go to `GEMINI_API_KEY_2` and then the other provider when their keys are configured. `gemini-3.8-flash` repeatedly timed out or returned 503/504 on the tested free-tier project, which is why the 3.5 generation is the default.
- `GLM_API_KEY` (or `ZAI_API_KEY`) — required when GLM is the primary provider; when Gemini is primary, configuring it enables GLM failover. A general Z.AI API key with API credit is required; GLM Coding Plan subscriptions cannot serve LabelLens requests.
- `GLM_MODEL` — defaults to `glm-5.3-flash`, Z.AI's multimodal GLM-5.3 Flash model.
- `GLM_API_URL` — defaults to the Z.AI chat-completions endpoint.
- `MAX_IMAGE_BYTES` — default 10 MiB per image.
- `MAX_TOTAL_IMAGE_BYTES` — default and maximum 14 MiB per request; lower values are supported.

### Vercel deployment

The Vercel deployment uses the `services` configuration in the repository-root `vercel.json` to route the React app and FastAPI backend on one deployment URL. In Vercel, set the project's Framework Preset to **Services**. Enable **Include source files outside of the Root Directory in the Build Step** so the Vite service can resolve the shared contract from `../shared`.

Vercel Functions limit request bodies to 4.5 MB, so set `MAX_IMAGE_BYTES=4194304` and `MAX_TOTAL_IMAGE_BYTES=4194304` in the Vercel project. The frontend also enforces the 4 MiB aggregate limit. Configure `EXTRACT_MODE=live`, `VISION_PROVIDER=gemini`, and `VITE_EXTRACT_MODE=live`; store `GEMINI_API_KEY` as a server-side Vercel environment variable only. Apply these variables to the Production environment and redeploy after changing them. Never use a `VITE_` prefix for a provider key.

Live mode uses the project's server-side Gemini key for scans. The API endpoint is public and currently has no authentication or request-rate limit, so anyone who can access the deployment could use the project's Gemini quota. For a short judge demo, monitor provider usage and revoke/delete the Google AI Studio key immediately afterward; deleting only the Vercel variable does not invalidate a copied key. To switch back to sample mode, set both extraction mode variables to `mock` and redeploy.

Before any live call, provide the provider disclosure described in `docs/API_CONTRACT.md`. Review the selected provider's current API terms and account limits before sending real package photos. Public shopper-facing use remains unresolved for LabelLens; keep mock mode for demos until that is confirmed. Never claim provider-side deletion.

Gemini requests time out after 30 seconds. Fast 503/overloaded responses may retry with 1- and 2-second backoff; slower overload responses go directly to cross-provider failover. GLM requests time out after 12 seconds. Every provider result, including fallback results, receives evidence validation against the frozen contract.

## Run and record an extraction

From `backend/`, start the API with `uvicorn app.main:app --reload --port 8000`. Then:

```powershell
python -m app.extraction.cli C:\path\to\label.jpg --out ..\work\label-extraction.json
```

The CLI uses the same mock/live setting as the API. In live mode it sends the image to the configured vision provider and writes only the locally validated JSON response to the requested path. GLM output is schema-guided and then validated locally; the Z.AI vision endpoint does not document structured JSON mode for vision models.

## Request logs and troubleshooting

Each API response includes an `X-Request-ID`. Locally, the backend writes provider/model attempts, fallback decisions, HTTP status, elapsed time, and extraction row counts to the terminal and `backend/logs/labellens.log` (rotated at 2 MiB, three backups). On Vercel, logs go to the function's console because its deployment bundle is read-only. It never logs API keys, photos, profile data, or extracted label text. It logs a warning if both ingredient and allergen sections are marked complete but contain no extracted rows. A fallback makes another provider request and can add latency and usage. Give the request ID to the developer when reporting an error.

Gemini is the default primary provider. With `GEMINI_API_KEY_2` configured, quota, 503, and timeout errors retry the same scan with the second Google account's key. With `GLM_API_KEY` also configured, errors that exhaust the Gemini keys fall back to GLM; with `VISION_PROVIDER=glm` and `GEMINI_API_KEY` configured, retryable GLM errors can fall back to Gemini. Credential errors do not trigger fallback; quota errors can fail over only when a secondary key is configured. If every configured provider fails, quota classification is preserved when any failure is a quota error.

Z.AI states that GLM Coding Plan quota is restricted to officially supported tools and is unavailable for API calls outside the plan. Its `/api/anthropic` route uses the Anthropic Messages protocol (documented for Claude Code and Goose), while `/api/coding/paas/v4` is for other supported tools; LabelLens is a custom app and cannot use this subscription. The backend rejects those plan endpoints locally. For direct GLM calls from LabelLens, use a separate general Z.AI API key with the OpenAI-compatible `https://api.z.ai/api/paas/v4/chat/completions` endpoint; check the account's API billing and vision access.

When cross-provider fallback is enabled, LabelLens may send uploaded photos to both providers in sequence. The profile remains in the browser and is not sent to either provider.

## API

- `GET /api/health`
- `POST /api/extract` with 1–3 repeated multipart files named `images` (JPEG, PNG, WebP, HEIC, or HEIF)

The upload limits, response fields, evidence validation, errors, and privacy boundary are specified in `docs/API_CONTRACT.md` and implemented in `app/schemas.py`.
