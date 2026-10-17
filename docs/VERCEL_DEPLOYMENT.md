# Deploy LabelLens to Vercel

LabelLens is a monorepo: React/Vite is in `frontend/` and FastAPI is in `backend/`. The root `vercel.json` uses Vercel Services to expose both on one origin: `/` serves the frontend and `/api/*` reaches FastAPI. This avoids browser CORS configuration and keeps the Gemini key on the server.

## 1. Import the repository

1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository `ACE4AKSHAY/LabelLens`.
3. Keep the project Root Directory at the repository root (`.`), not `frontend/` or `backend/`.
4. In **Build and Deployment**, set **Framework Preset** to **Services**. The repository's `vercel.json` defines the service roots and routing.
5. Enable **Include source files outside of the Root Directory in the Build Step** if Vercel presents that option. The frontend imports the frozen shared contract from `shared/`.

Vercel Services is currently in beta. If **Services** is not available in the Framework Preset for this account, the one-project frontend + backend configuration cannot deploy there yet; do not revert to the static-only Vercel config, because that would leave live mode without an API. Use two Vercel projects or host the backend on a Python service instead.

## 2. Configure live mode

Open **Project → Settings → Environment Variables**. Add these variables for **Production** (add Preview only if you intentionally want live calls from preview links):

| Name | Value |
| --- | --- |
| `EXTRACT_MODE` | `live` |
| `VISION_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | The Google AI Studio key; enter it directly in Vercel's value field |
| `VITE_EXTRACT_MODE` | `live` |
| `MAX_IMAGE_BYTES` | `4194304` |
| `MAX_TOTAL_IMAGE_BYTES` | `4194304` |

Do not set `GEMINI_API_KEY` as `VITE_GEMINI_API_KEY` or any other `VITE_` variable. Vite variables are embedded in browser-delivered JavaScript. The backend reads `GEMINI_API_KEY` at runtime, so the browser receives only scan results, never the provider key. `GEMINI_MODEL` is optional; the backend defaults to `gemini-3.5-flash`.

The 4 MiB upload cap is intentional: Vercel Functions have a 4.5 MB request-body limit, including multipart overhead. Users can submit up to three images as long as their combined size is at most 4 MiB.

## 3. Deploy and verify

1. Save the environment variables and deploy the Production branch (`main`). Changing variables does not update existing deployments; it requires a new deployment.
2. Open the deployment URL and confirm the LabelLens page loads.
3. Open `https://<your-deployment-domain>/api/health`; expect a healthy JSON response.
4. Select live mode in the UI, accept its provider disclosure, and scan one small, clear label image. Check that the result includes evidence quotes and the source image index. The image is sent to Google for extraction; the dietary profile stays in the browser.
5. Check Vercel function logs and Google AI Studio usage if the scan fails or consumes unexpected quota. Do not paste keys or label photos into logs or issue reports.

## 4. After the judge demo

1. In Vercel, change both `EXTRACT_MODE` and `VITE_EXTRACT_MODE` to `mock`, save, and redeploy if you want the public URL to return to fixture mode.
2. In Vercel, remove `GEMINI_API_KEY` from the project environment variables.
3. In Google AI Studio, delete/revoke the key. Removing it from Vercel alone does not invalidate a key that may have been copied.
4. Verify the live call no longer works and mock samples still load.

## Public demo risk

The current extraction endpoint has no user authentication or request-rate limit. While `EXTRACT_MODE=live` and the Gemini key is configured, anyone who can reach the deployed site can call the endpoint and consume the project's API quota. Keep the live window short, monitor usage, and revoke the key after judging. This configuration is suitable for a controlled hackathon demonstration, not a public production launch.
