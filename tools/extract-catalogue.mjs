// ONE-TIME bootstrap: read the current TUBES/TESTS literals out of index.html and
// write them as the initial /data CSVs. After this, the CSVs are the source of
// truth (do not re-run this, it would overwrite manual edits). Run from repo root:
//   node tools/extract-catalogue.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const block = html.slice(html.indexOf('const TUBES = {'), html.indexOf('function renderResults'));
const { TUBES, TESTS } = new Function(`${block}\n return { TUBES, TESTS };`)();

// --- off-site curation (clinical best-effort; verify against the NSW catalogue) ---
// usually = commonly referred to a reference lab; maybe = site-dependent.
const USUALLY = new Set([
  'Haemochromatosis (HFE)', 'Thalassaemia', 'Homocysteine', 'Ciclosporin', 'Tacrolimus',
  'Factor Assay', 'Lupus Anticoagulant',
  'Zinc', 'Copper', 'Manganese', 'Selenium', 'Trace Elements',
  'Chromosome Studies', 'Insulin', 'C-Peptide', 'Protein Electrophoresis',
  'ANA', 'ANCA', 'dsDNA', 'ENA', 'Anti-CCP',
]);
const MAYBE = new Set([
  'Parathyroid Hormone', 'Anti-Xa', 'Procalcitonin', 'Vitamin D',
  'Complement (C3/C4)', 'Immunoglobulins', 'Testosterone', 'Coeliac Serology',
]);
const offsiteOf = name => USUALLY.has(name) ? 'usually' : MAYBE.has(name) ? 'maybe' : 'none';

// --- CSV helpers ---
const cell = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
const toCsv = (header, rows) => [header.join(','), ...rows.map(r => r.map(cell).join(','))].join('\n') + '\n';

mkdirSync('data', { recursive: true });

// tubes.csv
const tubeRows = Object.entries(TUBES).map(([key, t]) =>
  [key, t.name, t.color, t.draw, t.ml, t.maxTests ?? '', t.additive ?? '', t.note ?? '']);
writeFileSync('data/tubes.csv', toCsv(['key', 'name', 'color', 'draw', 'ml', 'maxTests', 'additive', 'note'], tubeRows));

// tests.csv
const testRows = TESTS.map(t =>
  [t.name, t.tube, (t.aliases || []).join('|'), offsiteOf(t.name), '', '', '']);
writeFileSync('data/tests.csv', toCsv(['name', 'tube', 'aliases', 'offsite', 'defaultLab', 'rcpa', 'nsw'], testRows));

const counts = TESTS.reduce((a, t) => (a[offsiteOf(t.name)]++, a), { none: 0, maybe: 0, usually: 0 });
console.log(`Wrote data/tubes.csv (${tubeRows.length}) and data/tests.csv (${testRows.length}).`);
console.log(`offsite: none=${counts.none} maybe=${counts.maybe} usually=${counts.usually}`);
