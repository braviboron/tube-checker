# Tube Checker

**Live:** https://braviboron.github.io/tube-checker/ — open on a phone and
*Share → Add to Home Screen* to install it.

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

## Install on a phone (PWA — free, no App Store)

Host the folder on any static host (e.g. GitHub Pages / Netlify, free), open the URL on
the phone, then **Share → Add to Home Screen**. It installs like an app: full-screen, its
own icon, and — thanks to the service worker — it caches everything (including the 11 MB
language model) so it then runs **fully offline**. No developer account, no cost.

## Project layout

```
index.html              the app (UI + matching engine + OCR wiring)
manifest.json           PWA manifest (installable, standalone)
sw.js                   service worker — precaches the app for offline use
icons/                  app icons (192 / 512 / apple-touch)
vendor/tesseract/        vendored Tesseract.js — library, worker, WASM core, eng model
  fetch-assets.sh        re-download/upgrade those assets
tests/match.test.mjs     matching-engine tests (run against index.html directly)
```

> **Dev note:** the service worker precaches `index.html`. After editing the app, bump
> `CACHE` in [sw.js](sw.js) (or unregister the SW in devtools) to see changes.

## How it works

1. **Input** — type the tests, scan with the camera, or upload an image. Typing and
   scanning both **add** to one editable list.
2. **OCR** — Tesseract.js extracts text locally (with image pre-processing).
3. **Detected tests** — shown as **editable chips** in form order: tap to edit, × to
   remove, **+** to add via a **searchable picker** (canonical names, alias + typo
   tolerant). Unrecognised tests show as amber chips you can fix.
4. **Tubes** — recomputed live from the chip list and shown **in order of draw**, with
   tests sharing a tube consolidated. A **Share / print summary** button exports it.

Key structures in the `<script>` block of `index.html`:
- `TUBES` — tube database (name, additive, colour, `draw` order, note).
- `RULES` — ordered keyword→tube regexes; `matchTests()` runs them.
- `TESTS` — canonical test list (name + aliases + tube) powering the picker search
  (`searchTests()`, fuzzy). A test asserts every canonical name maps via `RULES` to its
  declared tube, keeping the two in sync.
- `selectedTests` is the source of truth; `computeTubes()` maps it to tubes.

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
