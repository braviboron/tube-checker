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
  regions.csv    id,name,state            (a region within a state, e.g. an LHD)
  sites.csv      id,name,state,lab,region (lab = the site's own performing lab)
  availability.csv  test,lab              (which labs perform each test; many-to-many)
  overrides.csv  scope,scopeId,test,field,value      (scope = site|state)
  resources.csv  level,scope,key,label,url (reference links: national|state|regional)
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
- **Phase 1b (done, currently unwired): site/state selection infrastructure.** A site
  picker at the bottom of the page that persists the choice on the device (survives Add
  to Home Screen). Behind `SITE_PICKER_ENABLED` (false for now): the code + data exist but
  the picker is hidden and inert.
- **Phase 2 (BUILT, dormant): multi-lab send-away routing.** `resolveLab(test, site)` and
  `planTubes(tests, site)` in index.html (pure, unit-tested), fed by `availability.csv`
  (test to performing labs) and `sites.csv` `lab`. Local tests consolidate by colour;
  referred tests bucket per destination lab; within a (lab, colour) bucket they stay
  SEPARATE by default (safer) with `couldConsolidate` flagged for a future 'can X and Y go
  to the same lab together?' prompt. Different labs are always separate. NOT wired into the
  live UI yet (the app still uses `tubeGroupsFor` + the manual `referral` Set).
- **Phase 3 (BUILT, dormant): site/state overrides.** `planTubes` applies `overrides.csv`:
  `quantity` (e.g. Nepean Group & Hold x2), `lab` (force routing), `tube` (remap), `remove`
  (hide a test at a site), `add` (offer it locally). State-scope overrides apply to all the
  state's sites.
- **Activation (remaining): wire it up.** Swap the live render from `tubeGroupsFor` to
  `planTubes(selectedTests, currentSite)`, render local + per-lab groups, add the
  consolidation prompt, and set `SITE_PICKER_ENABLED = true`.
- **Phase 1 likelihood (site-independent):** the `offsite` flag already conveys, with no
  site selected, how likely a test is to be referred (`none|maybe|usually`) and drives the
  'Off site?' chip hint. The site-aware routing only refines this once a site is set.

## Off-site flags (important caveat)
The initial `offsite` values are a **clinical best-effort estimate** (which tests are
commonly referred to a reference lab in NSW), NOT a verified per-hospital extract.
They must be checked against the NSW Health Pathology catalogue and local practice.
The whole point of the CSV + `offsite` column is to make that ongoing curation easy.
See the note in the README about an official catalogue feed.
