// Test harness for the Tube Checker matching engine.
// Extracts TUBES / RULES / matchTests directly from index.html (single source of
// truth — no duplicated logic) and runs assertions. Run: `node tests/match.test.mjs`
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

// Slice the pure (DOM-free) logic block: from the tube DB to just before render.
const start = html.indexOf('const TUBES = {');
const end = html.indexOf('// ─── RENDER');
if (start === -1 || end === -1) throw new Error('Could not locate logic block markers in index.html');
const block = html.slice(start, end);

// Evaluate the block and expose matchTests + TUBES.
const factory = new Function(`${block}\n return { matchTests, TUBES };`);
const { matchTests, TUBES } = factory();

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

// ─── Report ─────────────────────────────────────────────────────────────────
console.log(`\nTube Checker matching tests: ${pass} passed, ${fail} failed\n`);
if (fails.length) { console.log(fails.join('\n\n')); process.exit(1); }
console.log('All good. ✓');
