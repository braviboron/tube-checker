# CLAUDE.md — Tube Checker

## What this is
A single-file offline web app (`index.html`) that maps pathology test orders to AU/NZ
blood collection tube colours. Tests are entered by typing, pasting a list, or using the
phone's built-in text scanner (iPhone Scan Text / Android keyboard scan) into the picker.

## Hard design constraints (do not break without asking)
- **App logic in `index.html`; clinical data in CSVs.** HTML/CSS/JS (incl. the regex
  `RULES`) stay inlined in `index.html`. The catalogue DATA (`TUBES`, `TESTS`, `LABS`,
  `STATES`, `SITES`, `OVERRIDES`) lives in `/data/*.csv`, compiled by
  `node tools/build-data.mjs` into `catalogue.js`, which `index.html` loads via
  `<script src>` (no fetch, still offline). **Edit the CSVs, never `catalogue.js`**, then
  rebuild. See `PLAN.md` for the layered Base->State->Site model and roadmap.
- **Zero network calls, no patient-data persistence.** This is a privacy guarantee shown
  in the UI. Do not add analytics, telemetry, remote APIs, web fonts, CDNs, or
  localStorage of patient data. (Config-only localStorage is fine: the install-dismiss
  flag and the chosen site `tc-site`.) The app must work fully offline.
- **No in-app OCR.** The bundled Tesseract.js image reader was removed (v84) — it was
  too inaccurate on real ward forms to be usable. Image-to-text now relies entirely on
  the phone's native text scanner (iPhone Scan Text / Android keyboard scan) used inside
  the picker text box, which is on-device and far more accurate. Do NOT reintroduce a
  bundled OCR engine, a camera/upload pipeline, or any cloud OCR API. The only external
  URLs are the citation links in the references section, which load only when tapped.
- **PWA:** `manifest.json` + `sw.js` make it installable and fully offline. `sw.js`
  precaches the app shell + `catalogue.js` + icons. **Bump `CACHE` in
  `sw.js` whenever a precached asset changes** — otherwise the SW serves the stale copy
  (this also bites during local dev; unregister the SW or bump the cache to see edits).
- App icons live in `icons/` (192/512/apple-touch). No build tooling — they were drawn
  on a canvas; regenerate similarly if the brand changes.

## Visual design
- **Copy / formatting rules live in `FORMATTING.md`** (no em dashes, no curly quotes, no
  ellipsis char, no emoji, no double quotes in visible text, Australian spelling). Read it
  before writing any user-visible text.
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
- `selectedTests` (array of strings) is the **source of truth**. Typing/pasting MERGE
  into it (`bulkAdd`→`mergeTests`). `computeTubes()` maps it → tubes; `update()`
  re-renders chips + tube cards. `detectOrdered()` extracts tests in form order.
- `renderChips()` (editable chips + extracted-text toggle), `renderTubes()`, the picker
  (`openPicker`/`renderPickerList`/`commitPicker`), and `buildSummary`/`shareSummary`
  follow.
- The bottom **fine print** (`.fineprint`) consolidates disclaimer + privacy + sources.
  No em dashes anywhere on the page (use commas/colons); see `FORMATTING.md`.
- **Site picker is LIVE** (`SITE_PICKER_ENABLED = true`): the footer offers only sites
  flagged `selectable=yes` in `sites.csv` (currently default + Orange Hospital); the choice
  saves to `localStorage` `tc-site`. The live app still routes TUBES via `tubeGroupsFor` +
  the manual `referral` Set, but now also surfaces per-site HANDLING rules via
  `renderSiteRules()` (e.g. Orange requires handwritten group & hold labels), read from
  `OVERRIDES` `field=handling`.
- **DORMANT next-gen routing** (built, NOT wired): `resolveLab(test, site)` and
  `planTubes(tests, site)` do site-aware local-vs-referred routing (Phase 2) and apply the
  quantity/tube/lab `OVERRIDES` (Phase 3), fed by `AVAILABILITY`/`SITES.lab`. Not yet the
  live tube source. Activation plan: see `PLAN.md`.

## Clinical-safety norms
- This is decision support, not authority. Keep the disclaimer visible.
- When changing `RULES`, be conservative: a wrong tube has real-world consequences.
  Prefer flagging "verify manually" over a confident wrong match. Cite the AU/NZ source
  for any clinical rule change in the commit message.

## Working agreements
- Roadmap and known issues live in `TODO.md`. Update it as items land.
- No package manager. Data build: `node tools/build-data.mjs` after editing `data/*.csv`.
  To run: open `index.html`, or `python -m http.server`.
