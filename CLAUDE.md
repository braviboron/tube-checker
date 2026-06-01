# CLAUDE.md — Tube Checker

## What this is
A single-file offline web app (`index.html`) that maps pathology test orders to AU/NZ
blood collection tube colours. OCR via Tesseract.js runs entirely client-side.

## Hard design constraints (do not break without asking)
- **Single file.** The whole app is `index.html` — HTML, CSS, and JS inlined. Keep it
  that way unless the user explicitly opts into a build step. The offline/single-file
  property is a feature, not an accident.
- **No network calls after load, no data persistence.** This is a privacy guarantee
  shown to the user in the UI ("All processing is local. Nothing leaves your device.").
  Do not add analytics, telemetry, remote APIs, localStorage of patient data, etc.
- The only external resources are the Tesseract.js CDN script and Google Fonts, loaded
  at page load. Prefer not to add more; ideally vendor Tesseract locally eventually.

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
