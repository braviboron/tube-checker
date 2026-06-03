// Test harness for the Tube Checker matching engine.
// Extracts TUBES / RULES / matchTests directly from index.html (single source of
// truth — no duplicated logic) and runs assertions. Run: `node tests/match.test.mjs`
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Data now lives in catalogue.js (generated from /data/*.csv). The matching logic
// (RULES + functions) stays in index.html. Load both, in that order.
const catalogue = readFileSync(join(__dirname, '..', 'catalogue.js'), 'utf8');
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

// Slice the pure (DOM-free) logic block: from the matching rules to just before render.
const start = html.indexOf('const RULES = [');
const end = html.indexOf('// ─── RENDER');
if (start === -1 || end === -1) throw new Error('Could not locate logic block markers in index.html');
const block = html.slice(start, end);

// Evaluate catalogue + logic together and expose the matcher, tubes, and test list.
const factory = new Function(`${catalogue}\n${block}\n return { matchTests, TUBES, TESTS, searchTests, tubeQty, tubeGroupsFor, isNicheTest, tubesMl, fuzzyCanonical, resolveLab, planTubes, findTest, AVAILABILITY, SITES, GROUPS, searchGroups, findGroup, expandName };`);
const { matchTests, TUBES, TESTS, searchTests, tubeQty, tubeGroupsFor, isNicheTest, tubesMl, fuzzyCanonical, resolveLab, planTubes, findTest, AVAILABILITY, SITES, GROUPS, searchGroups, findGroup, expandName } = factory();

// ─── Assertions ───────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const fails = [];

// Tubes (in order of draw) produced for a given input.
function tubesFor(input) {
  const { tubeMap } = matchTests(input);
  return Object.keys(tubeMap).sort((a, b) => TUBES[a].draw - TUBES[b].draw);
}

// expect the set of tubes to equal exactly `expected` (order-insensitive)
function expectTubes(input, expected, msg) {
  const got = tubesFor(input).sort();
  const want = [...expected].sort();
  const ok = got.length === want.length && got.every((t, i) => t === want[i]);
  if (ok) { pass++; }
  else { fail++; fails.push(`✗ ${msg || input}\n    input: ${JSON.stringify(input)}\n    want:  [${want}]\n    got:   [${got}]`); }
}

// expect `tube` to be among the matched tubes
function expectIncludes(input, tube, msg) {
  const got = tubesFor(input);
  if (got.includes(tube)) { pass++; }
  else { fail++; fails.push(`✗ ${msg || input}\n    want includes: ${tube}\n    got: [${got}]`); }
}

// expect `tube` NOT among matched tubes
function expectExcludes(input, tube, msg) {
  const got = tubesFor(input);
  if (!got.includes(tube)) { pass++; }
  else { fail++; fails.push(`✗ ${msg || input}\n    want excludes: ${tube}\n    got: [${got}]`); }
}

// — Core single-test mappings —
expectTubes('FBC', ['purple'], 'FBC → purple (EDTA)');
expectTubes('UEC', ['gold'], 'UEC → gold (serum)');
expectTubes('EUC', ['gold'], 'EUC → gold (NSW spelling of UEC)');
expectTubes('LFT', ['gold'], 'LFT → gold');
expectTubes('CRP', ['gold'], 'CRP → gold');
expectTubes('coags', ['blue'], 'coags → blue (citrate)');
expectTubes('INR', ['blue'], 'INR → blue');
expectTubes('glucose', ['grey'], 'glucose → grey (fluoride)');
expectTubes('HbA1c', ['purple'], 'HbA1c → purple');
expectTubes('group & hold', ['pink'], 'G&H → pink (blood bank)');
expectTubes('zinc', ['royalblue'], 'zinc → royal blue (trace elements)');
expectTubes('ammonia', ['green'], 'ammonia → green (Li-heparin)');

// — Blood cultures produce BOTH bottles —
expectTubes('blood cultures', ['bc_aerobic', 'bc_anaerobic'], 'blood cultures → aerobic + anaerobic');

// — Regression: specific multi-token terms must win over generic short ones —
// All distinct recognised labels for an input.
function labelsFor(input) {
  const { tubeMap } = matchTests(input);
  return [...new Set(Object.values(tubeMap).flatMap(s => [...s]))];
}
function expectLabelContains(input, substr, msg) {
  const got = labelsFor(input);
  if (got.some(l => l.includes(substr))) { pass++; }
  else { fail++; fails.push(`✗ ${msg || input}\n    want a label containing: ${substr}\n    got labels: [${got}]`); }
}
function expectNoExactLabel(input, label, msg) {
  const got = labelsFor(input);
  if (!got.includes(label)) { pass++; }
  else { fail++; fails.push(`✗ ${msg || input}\n    label must not be exactly: ${label}\n    got labels: [${got}]`); }
}
// "hb a1c" must read as HbA1c, not bare Hb (the reported bug)
expectLabelContains('hb a1c', 'A1C', 'hb a1c → HbA1c label');
expectNoExactLabel('hb a1c', 'HB', 'hb a1c must not collapse to bare HB');
expectLabelContains('HbA1c', 'A1C', 'HbA1c → A1C label');
expectTubes('hb a1c', ['purple'], 'hb a1c → purple (EDTA)');
expectTubes('Hb', ['purple'], 'bare Hb still → purple');
// "ck-mb" must read as CK-MB, not bare CK
expectLabelContains('ck-mb', 'MB', 'ck-mb → CK-MB label');
expectNoExactLabel('ck-mb', 'CK', 'ck-mb must not collapse to bare CK');

// — Regression: ESR must NOT double-map to gold (was a bug) —
expectIncludes('ESR', 'purple', 'ESR → purple');
expectExcludes('ESR', 'gold', 'ESR must NOT map to gold');

// — Lithium drug level stays serum (gold), not green —
expectIncludes('lithium level', 'gold', 'lithium (drug level) → gold');
expectExcludes('lithium level', 'green', 'lithium must NOT map to green');

// — Multi-test consolidation + order of draw —
expectTubes(
  'FBC, UEC, CRP, LFT, coags, group and hold, blood cultures',
  ['bc_aerobic', 'bc_anaerobic', 'blue', 'gold', 'pink', 'purple'],
  'mixed panel consolidates to the right tube set'
);
// verify draw order is correct for that panel
{
  const ordered = tubesFor('FBC, UEC, CRP, LFT, coags, group and hold, blood cultures');
  const expectedOrder = ['bc_aerobic', 'bc_anaerobic', 'blue', 'gold', 'purple', 'pink'];
  const ok = ordered.length === expectedOrder.length && ordered.every((t, i) => t === expectedOrder[i]);
  if (ok) pass++; else { fail++; fails.push(`✗ draw order\n    want: [${expectedOrder}]\n    got:  [${ordered}]`); }
}

// — Many serum tests share ONE gold tube —
expectTubes('UEC, LFT, CRP, calcium, magnesium, TSH, lipids, troponin', ['gold'], 'serum panel → single gold tube');

// — Empty / nonsense —
expectTubes('', [], 'empty input → no tubes');
expectTubes('hello world banana', [], 'non-test text → no tubes');

// — Canonical test list consistency: every canonical NAME must map (via the rules) to
//   its declared tube. Keeps the picker list and the matcher in sync. —
for (const t of TESTS) {
  const keys = tubesFor(t.name);
  const want = String(t.tube).split('|');   // a test may declare more than one tube (e.g. blood culture)
  if (want.every(k => keys.includes(k))) pass++;
  else { fail++; fails.push(`✗ canonical "${t.name}" should map to ${t.tube}\n    got: [${keys}]`); }
}

// — Picker search: alias, acronym, and typo tolerance —
function expectTopHit(query, name, msg) {
  const r = searchTests(query, 5);
  if (r[0] && r[0].name === name) { pass++; }
  else { fail++; fails.push(`✗ ${msg}\n    search(${JSON.stringify(query)})[0] = ${r[0] ? r[0].name : 'none'}, want ${name}`); }
}
expectTopHit('FBE', 'Full Blood Count', 'alias FBE → Full Blood Count');
// EUC / UEC is now a GROUP (panel), not a single test: it expands into its serum members.
{
  const g = searchGroups('EUC')[0];
  expectEq2(g ? g.name : 'none', 'Electrolytes Urea Creatinine', 'acronym EUC → EUC group');
  const expanded = expandName('EUC');
  const tubes = new Set(expanded.flatMap(m => Object.keys(matchTests(m).tubeMap)));
  expectEq2([...tubes].join(','), 'gold', 'EUC expands to serum (gold) members');
}
expectTopHit('magnesum', 'Magnesium', 'typo magnesum → Magnesium');
expectTopHit('troponni', 'Troponin I', 'typo troponni → Troponin I');
expectTopHit('gent', 'Gentamicin', 'partial gent → Gentamicin');

// Every canonical test must be findable as its own top search hit, and names unique.
{
  const seenNames = new Set();
  for (const t of TESTS) {
    const key = t.name.toLowerCase();
    if (seenNames.has(key)) { fail++; fails.push(`✗ duplicate canonical name: ${t.name}`); }
    seenNames.add(key);
    const top = searchTests(t.name, 3)[0];
    if (top && top.name === t.name) pass++;
    else { fail++; fails.push(`✗ searchTests("${t.name}")[0] = ${top ? top.name : 'none'}, want itself`); }
  }
}

// — Fuzzy OCR typo correction (snap a near-miss token to a canonical name) —
function expectFuzzy(input, want, msg) {
  const got = fuzzyCanonical(input);
  if (got === want) pass++;
  else { fail++; fails.push(`✗ ${msg}\n    fuzzyCanonical(${JSON.stringify(input)}) = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
expectFuzzy('Coaqulation Profile', 'Coagulation Profile', 'OCR q->g typo snaps to Coagulation Profile');
expectFuzzy('Magneslum', 'Magnesium', 'OCR i->l typo snaps to Magnesium');
expectFuzzy('Full Blood Count', 'Full Blood Count', 'exact name returns itself');
expectFuzzy('xyzzy', null, 'unrelated token returns null (no false snap)');
expectFuzzy('LFT', null, 'short token (<5) returns null, left to the rules');

// — Multi-tube quantity (volume-limited tubes split for large panels) —
function expectQty(key, n, want, msg) {
  const got = tubeQty(key, n);
  if (got === want) pass++;
  else { fail++; fails.push(`✗ ${msg}\n    tubeQty(${key}, ${n}) = ${got}, want ${want}`); }
}
expectQty('gold', 1, 1, 'gold: 1 test -> 1 tube');
expectQty('gold', 15, 1, 'gold: 15 tests -> 1 tube (cap)');
expectQty('gold', 16, 2, 'gold: 16 tests -> 2 tubes');
expectQty('gold', 31, 3, 'gold: 31 tests -> 3 tubes');
expectQty('blue', 5, 1, 'citrate: 5 coag tests -> 1 tube');
expectQty('blue', 6, 2, 'citrate: 6 coag tests -> 2 tubes (splits sooner)');
expectQty('pink', 50, 1, 'blood bank: always 1 regardless of count');
expectQty('bc_aerobic', 10, 1, 'blood culture: always 1');
expectQty('purple', 0, 1, 'never less than 1');

// — Send-away (referral) tests split a colour into a separate tube —
function groupsFor(tests, refArr) {
  const { groups } = tubeGroupsFor(tests, new Set((refArr || []).map(s => s.toLowerCase())));
  return groups.map(g => `${g.key}${g.referral ? '#ref' : ''}x${g.qty}`);
}
function expectGroups(tests, refArr, want, msg) {
  const got = groupsFor(tests, refArr);
  const ok = got.length === want.length && got.every((g, i) => g === want[i]);
  if (ok) pass++; else { fail++; fails.push(`✗ ${msg}\n    got:  [${got}]\n    want: [${want}]`); }
}
expectGroups(['UEC', 'immunoglobulins'], [], ['goldx1'], 'both local → one gold tube x1');
expectGroups(['UEC', 'immunoglobulins'], ['immunoglobulins'], ['gold#refx2'],
  'send-away → one gold card, qty 2 (local + send-away), not a second row');
expectGroups(['FBC', 'UEC'], ['UEC'], ['gold#refx1', 'purplex1'],
  'send-away only on gold → gold x1 referral, draw order kept');

// — Niche / commonly-referred test auto-flagging —
function expectNiche(s, want, msg) {
  const got = !!isNicheTest(s);
  if (got === want) pass++;
  else { fail++; fails.push(`✗ ${msg}\n    isNicheTest(${JSON.stringify(s)}) = ${got}, want ${want}`); }
}
expectNiche('immunoglobulins', true, 'immunoglobulins is niche');
expectNiche('IgG', true, 'IgG (alias) is niche');
expectNiche('ANCA', true, 'ANCA is niche');
expectNiche('zinc', true, 'zinc is niche');
expectNiche('lupus anticoagulant', true, 'lupus anticoagulant is niche');
expectNiche('UEC', false, 'UEC is not niche');
expectNiche('FBC', false, 'FBC is not niche');
expectNiche('CRP', false, 'CRP is not niche');

// — Total syringe-draw volume (mL) sums tube fill volumes × quantity —
function expectEq(got, want, msg) {
  if (got === want) pass++;
  else { fail++; fails.push(`✗ ${msg}\n    got ${got}, want ${want}`); }
}
function mlFor(tests, refArr) {
  const { groups } = tubeGroupsFor(tests, new Set((refArr || []).map(s => s.toLowerCase())));
  return tubesMl(groups);
}
// FBC (purple 4) + UEC (gold 5) = 9
expectEq(mlFor(['FBC', 'UEC']), 9, 'FBC + UEC = 9 mL');
// blood cultures: aerobic 10 + anaerobic 10 = 20
expectEq(mlFor(['blood cultures']), 20, 'blood cultures = 20 mL (two 10 mL bottles)');
// send-away doubles the gold tube: UEC + immunoglobulins (send-away) -> gold x2 = 10
expectEq(mlFor(['UEC', 'immunoglobulins'], ['immunoglobulins']), 10, 'gold x2 = 10 mL');
expectEq(mlFor([]), 0, 'no tests = 0 mL');

// ─── PHASE 2 + 3 (dormant): site-aware routing + overrides ───────────────────
function expectEq2(got, want, msg) {
  if (got === want) pass++;
  else { fail++; fails.push(`✗ ${msg}\n    got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
}
// Routine tests are local everywhere.
expectEq2(resolveLab('Full Blood Count', 'nepean').dest, 'local', 'FBC is local at Nepean');
// Nepean does not perform Tacrolimus (perf: ICPMR, WESTMEAD) -> referred to ICPMR.
expectEq2(resolveLab('Tacrolimus', 'nepean').dest, 'ICPMR', 'Tacrolimus refers to ICPMR at Nepean');
// Nepean does not perform ANCA (perf: RPA, ICPMR) -> first performing lab RPA.
expectEq2(resolveLab('ANCA', 'nepean').dest, 'RPA', 'ANCA refers to RPA at Nepean');
// Westmead performs Tacrolimus -> local.
expectEq2(resolveLab('Tacrolimus', 'westmead').dest, 'local', 'Tacrolimus is local at Westmead');
// Aliases resolve too.
expectEq2(resolveLab('FK506', 'nepean').dest, 'ICPMR', 'alias FK506 resolves like Tacrolimus');
// The headline scenario: Tacrolimus and ANCA go to DIFFERENT labs => two separate tubes.
{
  const plan = planTubes(['Full Blood Count', 'Tacrolimus', 'ANCA'], 'nepean');
  expectEq2(plan.local.length, 1, 'Nepean plan: 1 local group (FBC)');
  expectEq2(plan.labs.length, 2, 'Nepean plan: 2 send-away tubes (different labs)');
  expectEq2(plan.labs.map(g => g.dest).sort().join(','), 'ICPMR,RPA', 'send-aways go to ICPMR and RPA');
}
// Phase 3: a site quantity override (example: Westmead Crossmatch x2) is applied, and
// carries a human-readable warning/explanation through to the group.
{
  const plan = planTubes(['Crossmatch'], 'westmead');
  const pink = plan.local.find(g => g.key === 'pink');
  expectEq2(pink ? pink.qty : 0, 2, 'Phase 3 override: Crossmatch = 2 pink tubes at the example site');
  expectEq2(pink && pink.warnings && pink.warnings.length === 1 && /confirm/i.test(pink.warnings[0].note), true,
    'Phase 3 override carries a warning + explanation');
  // The same order resolves via an alias (group & hold) to the canonical row.
  const aliasPlan = planTubes(['group and hold'], 'default');
  const pinkA = aliasPlan.local.find(g => g.key === 'pink');
  expectEq2(pinkA ? pinkA.qty : 0, 1, 'no override at the generic site: 1 tube');
}

// ─── Report ─────────────────────────────────────────────────────────────────
console.log(`\nTube Checker matching tests: ${pass} passed, ${fail} failed\n`);
if (fails.length) { console.log(fails.join('\n\n')); process.exit(1); }
console.log('All good. ✓');
