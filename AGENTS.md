# LabelLens agent rules

- Treat `docs/LabelLens_Modular_Vibe_Coding_Document.md` and `docs/API_CONTRACT.md` as the project specifications.
- Never claim a product is safe. Empty extraction results do not prove that an ingredient is absent.
- Keep dietary profiles in the browser. The extraction API accepts image files only.
- Keep provider credentials in backend environment variables; never commit keys or send them to frontend code.
- Preserve exact label wording and the provider's uncertainty. Mismatched evidence quotes require review; never rewrite source text to force a match.
- Do not let model output decide dietary comparison results. Only the browser-side deterministic rules own that decision.
- Keep the initial contract frozen. Coordinate and review any change to `shared/contracts.ts` or `backend/app/schemas.py` with Persons 1 and 3 before updating it.
- Person 1 owns `frontend/`; Person 2 owns backend extraction/API; Person 3 owns comparison rules and fixtures. Integrate small changes without overwriting another person's work.
- Keep mock mode working, commit small changes, and never force-push shared branches.
