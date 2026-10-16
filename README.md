# LabelLens

LabelLens helps shoppers understand packaged-food labels. A user photographs a product label, reviews the extracted ingredient and nutrition details, and compares visible evidence with their own dietary preferences.

## MVP principles

- Keep the original label photo and source wording visible beside normalized ingredient names and extracted values.
- Explain each match or potential conflict with the exact evidence that supports it.
- Distinguish a detected conflict, a possible conflict, no conflict detected in readable text, and unknown because information is absent, unreadable, or ambiguous.
- Never treat an ingredient that was not detected as proof that it is absent.
- Keep product-catalog results separate from what the photographed label confirms.

## Initial architecture

- Responsive React web UI.
- FastAPI backend for image extraction; API credentials remain on the backend.
- Profile preferences stored in browser `localStorage` for the MVP.
- Active photo and scan held in memory; no server-side scan history or database in the MVP.
- Deterministic profile-comparison rules with evidence-backed results.
- Optional product lookup only after the photo-to-results flow works reliably.

## Team ownership

- Person 1: UI, profile form, upload/camera flow, results and responsive polish.
- Person 2: extraction API, shared contracts, integration lead.
- Person 3: deterministic comparison rules, ingredient aliases and fixtures.

Use the uploaded modular design document in `docs/` as the detailed product and implementation guide. The team ownership above reflects the current kickoff assignment.

## Local setup

Setup commands and environment variables will be added with the first implementation scaffold. Never commit `.env` files or API keys. Use `.env.example` files with placeholders only.
