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

### tests.csv  `name,tube,aliases,offsite,defaultLab,rcpa,nsw,verified,short`
The catalogue. `name` is the **canonical** name (aligned to the RCPA Manual where possible);
it is what is stored, matched, and linked. `tube` references a `tubes.csv` key. `aliases` are
pipe-separated (`FBC|FBE`) and are for SEARCH/DETECTION (the old name is kept here whenever a
test is renamed, so it stays findable). `offsite` is `none | maybe | usually`. `defaultLab` is
a `labs.csv` id or blank. `rcpa` / `nsw` are optional source-link overrides (blank `nsw` falls
back to a catalogue search link; `rcpa` holds a verified RCPA deep link where known).
- `short` is a compact DISPLAY label (e.g. `ESR` for `Erythrocyte sedimentation rate`). It is
  shown in chips, tube cards, the summary and references; the canonical `name` is unchanged
  and is still what links/data use. This is distinct from `aliases` (search only).
- `verified` is provenance: `estimate` (clinical best-effort, the default) up to `official`
  once confirmed against an authoritative extract. Lets a repass target unverified rows.

**Invariant:** every `name` must map through the app's `RULES` to its `tube` (a test asserts
this). Renaming a test therefore usually needs a matching `RULES` term added in index.html.

## Repass / importing from an authoritative source
When an official extract (e.g. an RCPA or NSW Health data feed, with permission) arrives, the
CSV model is built to absorb it:
1. **Match** each incoming row to ours by `name` OR any `aliases` entry (old names are retained
   as aliases on every rename, so prior identities still match).
2. **Update** `tube`, `offsite`, `defaultLab`, `rcpa`/`nsw`, and set `verified` accordingly;
   add any new synonyms to `aliases`. Add brand-new tests as new rows.
3. **Flag conflicts** (e.g. our tube differs from the source's specimen) for clinical review
   rather than auto-overwriting.
4. `node tools/build-data.mjs` re-validates every reference, so a bad merge fails the build,
   not the app. References in `availability.csv` / `overrides.csv` are by test name, so update
   them too if a name changes (the build will flag any that dangle).

### labs.csv  `id,name,state`
Reference and hospital laboratories. `state` references `states.csv`.

### states.csv  `id,name,catalogueHome,catalogueSearch`
One row per state/territory profile (NSW for now). The catalogue links follow the selected
state.

### regions.csv  `id,name,state`
A region within a state (e.g. a Local Health District). `state` references `states.csv`.
Used to scope regional reference resources.

### sites.csv  `id,name,state,lab,region`
Hospitals the user can pick. `lab` is the site's OWN performing laboratory (a `labs.csv` id),
used to decide whether a test is done locally. `region` is a `regions.csv` id (or blank).
Blank `lab`/`region` = generic / unknown.

### resources.csv  `level,scope,key,label,url`
Reference links shown per test (the 'Test references' section). `level` is
`national | state | regional`. `scope` is blank for national, a `states.csv` id for state,
or a `regions.csv` id for regional. `key` is an optional stable id (e.g. `rcpa`, `nsw`) that
lets a test override the link via its `tests.csv` `rcpa`/`nsw` column. `url` is a template
containing `{q}` (replaced by the URL-encoded test name) and optionally `{name}` (raw name).
Resolution for a test at a site = all `national` rows + the `state` rows for the site's state
+ the `regional` rows for the site's region, in that order. Add a level by adding a row.

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
