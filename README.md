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

1. **Input** — type the tests, **tap-to-scan** with the camera (no photo is saved), or
   upload an image of the form.
2. **OCR** — Tesseract.js extracts text locally from the image.
3. **Match** — the text is run against an ordered list of regex `RULES`, each mapping
   test keywords to one or more tubes (`TUBES`).
4. **Render** — needed tubes are shown as cards, **sorted by order of draw** and
   numbered, with a tube-count summary; tests sharing a tube are consolidated;
   unrecognised lines are flagged for manual review.

The matching logic lives entirely in the `<script>` block of `index.html`:
`TUBES` (tube database, each with a `draw` order), `RULES` (keyword → tube regexes),
and `matchTests()`.

## Clinical basis

Tube mappings and the order of draw follow **NSW Health Pathology** / **RCPA** /
standard CLSI conventions, cross-referenced against published AU collection charts.
The in-app "Sources & references" section links the primary sources. See
[CLAUDE.md](CLAUDE.md) for the clinical-safety norms applied to rule changes.

## Tests

`tests/match.test.mjs` extracts the live `RULES`/`matchTests` from `index.html` (no
duplicated logic) and asserts key mappings, regressions, and draw order:

```sh
node tests/match.test.mjs
```

## Status

Working prototype with order of draw, tube counts, references and a disclaimer.
Remaining work — chiefly a second-clinician audit of the full rule set and OCR
robustness — is tracked in [TODO.md](TODO.md).

## ⚠️ Disclaimer

This is a decision-support aid, **not** a clinical authority. Always verify tube
requirements against your local laboratory's collection manual before drawing blood.
