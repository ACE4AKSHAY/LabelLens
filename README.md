# LabelLens

**Understand a packaged-food label from a photo, with the source evidence and uncertainty kept visible.**

LabelLens extracts ingredient, allergen, nutrition, and package details from label photos. It compares extracted information with preferences stored in the browser and links flags to the wording that supports them. Missing or unreadable information stays **unknown**; it is never treated as proof that something is absent.

## Demo: packaged mango drink

This example uses the supplied label photo and its scan export. The export has been summarized for this README; the raw CSV is not included because it contains dietary profile entries.

The reference label photo is included at [`docs/demo/mango-drink-label.jpeg`](docs/demo/mango-drink-label.jpeg); it is not displayed inline here.

| What LabelLens extracted | Demo result |
| --- | --- |
| Ingredients | Water, mango pulp (11.1%), sugar, acidity regulators (330, 331(iii)), stabilizer (466), antioxidant (300), sweetener (960a), colour (110), and mango flavours. The original wording is retained in the app. |
| Nutrition, per 100 ml | Energy 44 kcal; carbohydrate 11 g; total sugars 10.7 g; added sugars 9 g; total fat 0 g; protein 0 g; sodium 22.1 mg. |
| Package details | Net quantity: 150 ml. The label also states that it contains steviol glycosides. |
| Allergen statement | No allergen row was extracted. This does **not** confirm that allergens are absent. |
| Preference comparison | Results remain **unknown** because the ingredient-list completeness and allergen statement were not confirmed. |

This is a supplied scan export, not an accuracy benchmark. The photo is angled and small print is difficult to inspect; verify extracted values against the package. The result is not a product-safety determination or medical advice.

See the [full sanitized scan summary](docs/demo/scan-result-summary.md) for the source wording, extracted values, and uncertainty notes.

### Screen recordings

The two screen recordings are available in the [LabelLens demo recordings folder on Google Drive](https://drive.google.com/drive/folders/11tJswL4NJnAskwMH4VVf0o9nWkEmd1_l?usp=drive_link).

## Features

- Photo-based label extraction with evidence quotes tied to the source image.
- Structured ingredients, allergen statements, nutrition values, and package details.
- Browser-local dietary preferences and evidence-grounded comparison rules.
- Clear states for conflicts, possible conflicts, no match in confirmed readable text, and unresolved information.
- Review and correction flow for uncertain ingredient and allergen readings.
- Responsive interface with dark and light themes and accessibility controls.
- Mock mode for repeatable demos; optional live extraction through a configured vision provider.

## Run locally

### Windows quick start

1. Clone the repository and open its root folder.
2. Run `install-once.bat` to install dependencies and create local environment files from the example templates.
3. Run `run-mock.bat`.
4. Open <http://localhost:5173>.

Mock mode needs no API key and does not extract text from the uploaded photo. It uses a clearly identified fixture. See [backend setup and live mode](backend/README.md) for manual setup and provider configuration.

### Manual setup

Requirements: Node.js 22.6+ and Python 3.12+.

Start the backend in one PowerShell terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal from the repository root:

```powershell
npm run install:frontend
npm run dev
```

The default is mock mode. To use live extraction, configure the backend provider and key in the ignored `backend/.env`, set `VITE_EXTRACT_MODE=live` in the ignored `frontend/.env`, then restart both processes. See [backend/README.md](backend/README.md) for supported providers, fallback behavior, and exact variables.

## Bring Your Own Key (BYOK)

Live extraction uses the API key supplied by the person operating the local backend. Keep it in `backend/.env`; never place it in frontend code, commit it, or show it in a screenshot or recording. Label photos are sent to the selected vision provider for live extraction. Dietary preferences remain in the browser and are not sent to the backend. The key owner is responsible for provider access, quotas, billing, and current terms. See [API and privacy details](docs/API_CONTRACT.md).

## Architecture

- **Frontend:** React, TypeScript, and Vite.
- **Backend:** FastAPI with a shared, schema-validated extraction contract.
- **Extraction:** Mock fixtures by default; optional Gemini or GLM live provider, with configured fallback behavior.
- **Comparison:** Deterministic browser-side rules; profile data stays client-side.
- **Storage:** Browser `localStorage` for preferences. The MVP has no server-side user profiles or scan-history database.

## Checks

Run from the repository root:

```powershell
npm run test:a
npm run build
npm run check:rules
npm run validate:fixtures
```

The fixture validator requires Python with the backend dependencies installed. See [package scripts](package.json) and [backend setup](backend/README.md).

## Evaluation and limitations

Mission reports and test data are in [`docs/`](docs/):

- [Mission 02: unclear labels and corrections](docs/MISSION_02_VALIDATION.md)
- [Mission 03: evidence-grounded comparison](docs/MISSION_03_VALIDATION.md)
- [Mission 04 test reports](docs/MISSION_04_TEST_02_REPORT.md) and [Test 03](docs/MISSION_04_TEST_03_REPORT.md)
- [API contract, uncertainty, and provider behavior](docs/API_CONTRACT.md)

Fixture checks verify application rules and schema handling; they do not establish real-world OCR accuracy. Quality estimates are uncalibrated. Small, curved, blurry, or obscured print can be misread, and product labels may change by region or batch. Always verify important details on the package. LabelLens does not certify products, infer missing ingredients, or provide medical advice.

## AI and development disclosure

OpenAI Codex and Google Antigravity were used for development assistance, including implementation and fixture/report work. Anthropic Claude was used for UI ideation. Live extraction is an optional backend-only integration with the Google Gemini API; limited local requests are documented in [the API contract](docs/API_CONTRACT.md) and are not an OCR accuracy benchmark. An optional GLM adapter is present but was not relied on for verified live results. Label photos are sent to the configured provider only in live mode; dietary profiles stay in the browser. Live mode is opt-in, and provider suitability for a public shopper-facing deployment remains unresolved.

## Future improvements

- Evaluate transcription and uncertainty handling against consented, human-annotated real-label photos across packaging, languages, and image conditions.
- Calibrate image-quality estimates and improve recovery for curved, small, blurry, and partially obscured text.
- Complete provider policy and operational review before enabling public live scans; add monitoring for latency, quotas, and provider outages.
- Deploy and smoke-test the app, then verify that the demo recordings are accessible to reviewers.
