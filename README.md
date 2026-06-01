# Tube Checker

An offline web app that reads a pathology request form (photo, scan, or manual entry)
and tells you which **blood collection tubes** you need, in what quantity and in what
**order of draw**, using NSW Health / RCPA conventions.

- **Fully offline — zero network calls.** OCR (Tesseract.js) and its language model are
  vendored locally under `vendor/tesseract/`. Nothing is fetched from the internet and
  no image or patient data is stored or transmitted. The only external URLs are the
  citation links in the references section, which open only when tapped.
- **No build step:** the app is `index.html` plus the vendored OCR assets.

## Run it

Serve the folder over `localhost` (the camera and OCR worker need an HTTP origin —
browsers block `getUserMedia` and workers on `file://`):

```sh
# from the project root
python -m http.server 8000
# then visit http://localhost:8000
```

"Offline" means no internet access is required — a local static server is still needed.

## Project layout

```
index.html              the app (UI + matching engine + OCR wiring)
vendor/tesseract/        vendored Tesseract.js — library, worker, WASM core, eng model
  fetch-assets.sh        re-download/upgrade those assets
tests/match.test.mjs     matching-engine tests (run against index.html directly)
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
