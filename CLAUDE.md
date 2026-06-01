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
- `TUBES` — object: tube key → display metadata (name, additive, colour).
- `RULES` — ordered array of `{ re, tube, label }`. **Order matters** — more specific
  rules first; the broad "gold/biochem" rule is intentionally last.
- `matchTests(text)` — runs `RULES` over text, returns `{ tubeMap, unmatched }`.
- `renderResults(text)` — renders tube cards + unmatched warnings.
- OCR, manual-entry, camera, and raw-text-toggle handlers follow.

## Clinical-safety norms
- This is decision support, not authority. Keep the disclaimer visible.
- When changing `RULES`, be conservative: a wrong tube has real-world consequences.
  Prefer flagging "verify manually" over a confident wrong match. Cite the AU/NZ source
  for any clinical rule change in the commit message.

## Working agreements
- Roadmap and known issues live in `TODO.md`. Update it as items land.
- No package manager / build yet. To run: open `index.html`, or `python -m http.server`
  (camera needs https/localhost).
