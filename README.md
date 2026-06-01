# Tube Checker

A single-file, offline web app that reads a pathology request form (photo, scan, or
manual entry) and tells you which **blood collection tubes** you need, using AU/NZ
colour-top conventions.

- **Privacy-first:** all OCR runs locally in the browser (Tesseract.js). No data is
  saved and no network calls are made after the page loads.
- **No build step:** `index.html` is the entire app. Open it in a browser to run.

## Run it

Just open `index.html` in any modern browser. For camera capture you'll need to serve
it over `https://` or `localhost` (browsers block `getUserMedia` on `file://`):

```sh
# from the project root
python -m http.server 8000
# then visit http://localhost:8000
```

## How it works

1. **Input** — upload an image, capture via camera, or type tests manually.
2. **OCR** — Tesseract.js extracts text from the image.
3. **Match** — the extracted text is run against an ordered list of regex `RULES`,
   each mapping a set of test keywords to a tube colour (`TUBES`).
4. **Render** — matched tubes are shown as cards; unrecognised lines are flagged for
   manual review.

The matching logic lives entirely in the `<script>` block of `index.html`:
`TUBES` (tube database), `RULES` (keyword → tube regexes), and `matchTests()`.

## Status & known issues

This is an early prototype. Tracked items live in [TODO.md](TODO.md). Highlights:

- **Clinical accuracy needs review.** Several rules are ambiguous or conflicting
  (e.g. `ESR` maps to both purple and gold; `lithium` only matches the gold drug-level
  rule). The full rule set should be audited against an authoritative AU/NZ tube guide.
- **No order-of-draw guidance** is shown.
- **OCR robustness** — the unmatched-line heuristic is fragile and form-layout dependent.

## ⚠️ Disclaimer

This is a decision-support aid, **not** a clinical authority. Always verify tube
requirements against your local laboratory's collection manual before drawing blood.
