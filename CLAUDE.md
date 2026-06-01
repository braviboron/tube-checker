# CLAUDE.md — Tube Checker

## What this is
A single-file offline web app (`index.html`) that maps pathology test orders to AU/NZ
blood collection tube colours. OCR via Tesseract.js runs entirely client-side.

## Hard design constraints (do not break without asking)
- **Single file.** The whole app is `index.html` — HTML, CSS, and JS inlined. Keep it
  that way unless the user explicitly opts into a build step. The offline/single-file
  property is a feature, not an accident.
- **Zero network calls, no data persistence.** This is a privacy guarantee shown in the
  UI. Do not add analytics, telemetry, remote APIs, web fonts, CDNs, or localStorage of
  patient data. The app must work fully offline.
- **Tesseract.js is vendored** under `vendor/tesseract/` (library, worker, WASM core,
  and `eng.traineddata.gz`). `runOCR()` points `workerPath`/`corePath`/`langPath` at
  `TESS_VENDOR` — an ABSOLUTE URL built from `document.baseURI` (the blob-URL worker's
  `importScripts` cannot resolve relative paths). Re-fetch via
  `vendor/tesseract/fetch-assets.sh`. The only remaining external URLs are the four
  citation links in the references section, which load only when the user taps them.
- Camera + OCR require serving over `http://localhost` (or https); `file://` blocks
  workers/`getUserMedia`. "Offline" = no internet, not no server.
- **PWA:** `manifest.json` + `sw.js` make it installable and fully offline. `sw.js`
  precaches the app shell + all `vendor/tesseract/` assets + icons. **Bump `CACHE` in
  `sw.js` whenever a precached asset changes** — otherwise the SW serves the stale copy
  (this also bites during local dev; unregister the SW or bump the cache to see edits).
- OCR uses `workerBlobURL:false` so the worker is same-origin and its sub-requests pass
  through the service worker (required for true offline once installed).
- App icons live in `icons/` (192/512/apple-touch). No build tooling — they were drawn
  on a canvas; regenerate similarly if the brand changes.

## Visual design
- **iOS-style "sterile" clinical look** (reference: UCLH directory app): light grouped
  background (`--bg`), white grouped cards (`.group`), hairline separators (`.row::before`,
  inset), uppercase grey section headers (`.group-header`), rounded-square tinted leading
  tiles (`.tile`), chevrons, large bold title, system font, restrained iOS blue (`--blue`).
- **No emoji** — inline line-SVG icons or text only.
- Tube cap-colour tiles ARE meaningful (they represent the physical tube) — keep them
  vivid; they are the one place colour is allowed to be strong.
- Do NOT add fake/non-functional chrome (nav tabs, bottom tab bars) just for looks.

## Code map (all inside `index.html`)
- `TUBES` — tube key → metadata (name, additive, colour, `draw` order, note).
- `RULES` — ordered `{ re, tube }`. **Order matters** — more specific first; the broad
  "gold/biochem" rule is last. Within a rule's alternation, specific multi-token terms
  must precede generic short ones (e.g. `hb\s*a1c` before `\bhb\b`).
- `matchTests(text)` — runs `RULES`, returns `{ tubeMap, unmatched }`.
- `TESTS` — canonical test list `{ name, tube, aliases }` (~99). Powers the add/edit
  **picker** via `searchTests()` (fuzzy: substring + Levenshtein). **Invariant:** every
  canonical `name` must map through `RULES` to its declared `tube` — `tests/match.test.mjs`
  asserts this, so adding a `TESTS` entry whose name the rules don't catch fails CI (fix
  the rule or the name). This is how the picker guarantees correct mapping.
- `selectedTests` (array of strings) is the **source of truth**. Typing/scanning MERGE
  into it (`renderResults`→`mergeTests`). `computeTubes()` maps it → tubes; `update()`
  re-renders chips + tube cards. `detectOrdered()` extracts tests in form order.
- `renderChips()` (editable chips + extracted-text toggle), `renderTubes()`, the picker
  (`openPicker`/`renderPickerList`/`commitPicker`), `buildSummary`/`shareSummary`, and
  OCR/camera handlers follow.
- The bottom **fine print** (`.fineprint`) consolidates disclaimer + privacy + sources.
  No em dashes anywhere on the page (use commas/colons).

## Clinical-safety norms
- This is decision support, not authority. Keep the disclaimer visible.
- When changing `RULES`, be conservative: a wrong tube has real-world consequences.
  Prefer flagging "verify manually" over a confident wrong match. Cite the AU/NZ source
  for any clinical rule change in the commit message.

## Working agreements
- Roadmap and known issues live in `TODO.md`. Update it as items land.
- No package manager / build yet. To run: open `index.html`, or `python -m http.server`
  (camera needs https/localhost).
