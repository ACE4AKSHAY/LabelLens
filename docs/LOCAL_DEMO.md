# Local recording demo

The `Tedhe Medhe Mast Masala Tadka — local demo photo` fixture is preloaded
manual sample data for a repeatable screen recording. It does not make an OCR,
Gemini, or other live vision request. The results page states this explicitly.

The supplied photo stays on the local machine and is ignored by Git:

1. Copy the supplied image to `frontend/public/local-demo-label.jpeg`.
2. Start the frontend with `npm run dev`.
3. Open the app with `?dev=1` in the URL, for example
   `http://localhost:5173/?dev=1`.
4. Set a profile that includes Soy and Milk, then choose the local demo photo
   fixture in **Dev fixtures**.

The hand-prepared fixture records visible allergen and selected nutrition
evidence. The ingredient and nutrition sections remain partial; unclear dates,
batch details, and small print are not inferred. The image is excluded from the
Git repository, so a fresh clone needs its own local copy at that path to show
the photo. The rest of the app and fixtures work without it.
