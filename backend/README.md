# LabelLens backend

The backend receives label images and returns the shared `Extraction` contract. Dietary profiles remain in the browser and are never accepted by this API.

## Local setup (PowerShell)

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The checked-in `.env.example` uses mock mode and contains no credential. `EXTRACT_MODE=mock` returns the fictional shared fixture and makes no Google API call. Its response warning says that the content was not extracted from the uploaded image.

## Environment

- `EXTRACT_MODE=mock|live` — defaults to `mock`.
- `GEMINI_API_KEY` — required only in live mode; set it in `backend/.env` or the backend process environment.
- `GEMINI_MODEL` — defaults to `gemini-3.8-flash`; any model supporting image input and structured output can be selected here.
- `MAX_IMAGE_BYTES` — default 10 MiB per image.
- `MAX_TOTAL_IMAGE_BYTES` — default and maximum 14 MiB per request; lower values are supported.

Before any live call, provide the provider disclosure described in `docs/API_CONTRACT.md`. Google’s unpaid API terms allow submitted content and outputs to be used to improve products and reviewed by people. The current use restrictions also leave public shopper-facing use unresolved for LabelLens; keep mock mode for demos until that is confirmed. Review current terms and account limits before sending real package photos. Never claim provider-side deletion.

## Run and record an extraction

From `backend/`, start the API with `uvicorn app.main:app --reload --port 8000`. Then:

```powershell
python -m app.extraction.cli C:\path\to\label.jpg --out ..\work\label-extraction.json
```

The CLI uses the same mock/live setting as the API. In live mode it sends the image to the configured Gemini model and writes only the validated JSON response to the requested path.

## API

- `GET /api/health`
- `POST /api/extract` with 1–3 repeated multipart files named `images` (JPEG, PNG, WebP, HEIC, or HEIF)

The upload limits, response fields, evidence validation, errors, and privacy boundary are specified in `docs/API_CONTRACT.md` and implemented in `app/schemas.py`.
