# /data — the editable catalogue

Edit these CSVs in Excel / Google Sheets, then run `node tools/build-data.mjs` from the
repo root to compile them into `catalogue.js` (which the app loads). The build validates
all cross-references and fails on a bad row, so a mistake never reaches the app. Then run
`node tests/match.test.mjs`, bump `CACHE` in `sw.js`, and deploy.

Do NOT hand-edit `catalogue.js` (generated). See `PLAN.md` for the overall model.

## Files

### tubes.csv  `key,name,color,draw,ml,maxTests,additive,note`
One row per collection tube. `key` is the internal id used elsewhere. `color` is a hex cap
colour. `draw` is the order-of-draw position (lower = drawn first). `ml` is the nominal
fill volume. `maxTests` is a conservative capacity (blank = unlimited / always 1 tube).

### tests.csv  `name,tube,aliases,offsite,defaultLab,rcpa,nsw`
The catalogue. `tube` references a `tubes.csv` key. `aliases` are pipe-separated (`FBC|FBE`).
`offsite` is `none | maybe | usually` (how likely the test is referred to a reference lab;
drives the 'Off site?' hint even with no site selected). `defaultLab` is a `labs.csv` id or
blank. `rcpa` / `nsw` are optional source links (blank `nsw` falls back to a catalogue
search link). **Invariant:** every `name` must map through the app's `RULES` to its `tube`
(a test asserts this).

### labs.csv  `id,name,state`
Reference and hospital laboratories. `state` references `states.csv`.

### states.csv  `id,name,catalogueHome,catalogueSearch`
One row per state/territory profile (NSW for now). The catalogue links follow the selected
state.

### sites.csv  `id,name,state,lab`
Hospitals the user can pick. `lab` is the site's OWN performing laboratory (a `labs.csv` id),
used to decide whether a test is done locally. Blank `lab` = generic / unknown.

### availability.csv  `test,lab`  (many-to-many)
Which labs perform each test. One row per (test, lab) pair. Only specialised / referred
tests need rows here; routine tests are assumed available everywhere. **The current rows are
an illustrative EXAMPLE**, to be replaced by data derived from the NSW Health Pathology
catalogue (with permission). Used by the dormant Phase 2 routing.

### overrides.csv  `scope,scopeId,test,field,value`
Per-site or per-state tweaks. `scope` is `site` or `state`; `scopeId` is the site/state id.
`field` is one of:
- `quantity` - force N tubes for this test (e.g. Nepean Group & Hold = 2).
- `lab` - route this test to a specific `labs.csv` id.
- `tube` - collect this test in a different `tubes.csv` key.
- `remove` - this site does not offer the test.
- `add` - this site offers it locally (overrides an off-site default).

Used by the dormant Phase 3 logic.
