# Tube Checker — data architecture & roadmap

## Goal
Keep the clinical catalogue **editable in spreadsheets**, support **per-state and
per-hospital differences** without forking the data, and support **multiple
reference labs** for send-away tests — while the app stays a fully offline PWA.

## The layered model (resolve in order: Base -> State -> Site)
| Layer | Owns | Example |
|-------|------|---------|
| **Base** (national, RCPA/CLSI) | tubes, test->tube, aliases, order of draw, `offsite` flag, source links | Group & Hold -> pink, x1 |
| **State** (NSW, VIC, ...) | the state pathology catalogue + source links, its reference labs, state-wide deviations | NSW catalogue authority |
| **Site** (a hospital) | thin overrides only | Nepean: Group & Hold x2; ANA -> Lab 2 |

The user picks a **Site** (which knows its **State**); the engine composes
Base -> State -> Site into the effective ruleset. New hospital = a few override
rows. New state = a new state profile, base untouched.

## Source of truth: CSVs in /data  ->  generated catalogue.js
You edit CSVs in Excel/Sheets, then run the build; the app ships the generated
file. Fully offline (a `<script src>`, no fetch).

```
/data/
  tubes.csv      key,name,color,draw,ml,maxTests,note
  tests.csv      name,tube,aliases,offsite,defaultLab,rcpa,nsw
  labs.csv       id,name,state
  states.csv     id,name,catalogueHome,catalogueSearch
  sites.csv      id,name,state
  overrides.csv  scope,scopeId,test,field,value      (scope = site|state)
/tools/
  build-data.mjs        CSV  ->  catalogue.js   (run after editing)
  extract-catalogue.mjs one-time bootstrap (generated the first CSVs from index.html)
catalogue.js     generated, embedded in the app (do NOT hand-edit)
index.html       loads catalogue.js; keeps the regex matching layer (RULES) in code
```

- `tests.csv` columns:
  - `offsite`: `none | maybe | usually` (does it commonly go to a reference lab).
  - `defaultLab`: a `labs.csv` id, or blank (collected locally).
  - `rcpa` / `nsw`: source links; blank `nsw` falls back to a catalogue search link
    built from the selected state.
- `overrides.csv` `field` values: `quantity | lab | tube | add | remove`.
- **RULES stays in `index.html`** (regexes are not spreadsheet-friendly); the
  consistency test still asserts every `tests.csv` row maps through it, so the CSV
  remains the source of truth and a bad edit fails CI.

## To edit the catalogue
1. Edit the relevant CSV in `/data`.
2. `node tools/build-data.mjs`  (regenerates `catalogue.js`).
3. `node tests/match.test.mjs`  (must stay green).
4. Bump `CACHE` in `sw.js`, commit, push.

## Phases
- **Phase 1 (done): editable catalogue.** CSV -> catalogue.js, `offsite` flag + source
  columns. No behaviour change.
- **Phase 1b (done): site/state selection infrastructure.** A site picker at the
  bottom of the page that persists the choice on the device (survives Add to Home
  Screen). Currently INACTIVE — it stores the choice but does not yet change tubes.
- **Phase 2 (next): multi-lab send-away.** Labs + per-lab tube grouping + a safety
  prompt: when 2+ off-site tests could share a tube, ask "can X and Y go to the same
  lab together?" — unsure => separate tubes. Different labs => separate automatically.
- **Phase 3: activate overrides.** Apply the selected site's overrides (quantity,
  lab, tube, add/remove). Nepean Group & Hold x2 becomes one override row.

## Off-site flags (important caveat)
The initial `offsite` values are a **clinical best-effort estimate** (which tests are
commonly referred to a reference lab in NSW), NOT a verified per-hospital extract.
They must be checked against the NSW Health Pathology catalogue and local practice.
The whole point of the CSV + `offsite` column is to make that ongoing curation easy.
See the note in the README about an official catalogue feed.
