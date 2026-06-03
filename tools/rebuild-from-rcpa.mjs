// Rebuild data/tests.csv using the RCPA Manual index as the spine.
//
// What it does:
//   1. Reads the full RCPA test list (names + deep links) from docs/rcpa-coverage.md,
//      split into blood-likely and likely-non-blood sections.
//   2. Reads our EXISTING data/tests.csv (the curated rows: correct tubes, aliases,
//      short labels, offsite flags) and keeps every one of them.
//   3. Merges: for each RCPA test, if it matches an existing row (by normalised name /
//      short / alias) it just refreshes that row's RCPA link to the authoritative index
//      URL (dedupe, no new row). Otherwise it is added as a NEW row with:
//        - the RCPA canonical name,
//        - a best-guess tube from a keyword heuristic, or `confirm` when unsure,
//          or `nonblood` for the non-blood section,
//        - the RCPA deep link,
//        - verified = 'rcpa-index' (provenance: name+link authoritative, tube heuristic).
//   4. Writes data/tests.csv back (existing rows first, then new rows A->Z).
//
// Safe to re-run: it is idempotent (re-matching skips rows already present). Then run
// `node tools/build-data.mjs` and `node tests/match.test.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

// --- minimal RFC4180 CSV (same as build-data.mjs) ---
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const csvCell = v => {
  v = (v ?? '').toString();
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};

// --- 1. parse the RCPA index out of the coverage doc ---
const md = readFileSync('docs/rcpa-coverage.md', 'utf8');
const lines = md.split(/\r?\n/);
let section = '';
const rcpa = [];   // { name, url, blood }
for (const ln of lines) {
  if (/^## /.test(ln)) { section = /non-blood/i.test(ln) ? 'nonblood' : (/blood-likely/i.test(ln) ? 'blood' : ''); continue; }
  // Blood-likely rows have a `[ ]` checkbox; non-blood rows are plain links. RCPA URLs
  // (and names) can contain parentheses, so match the name up to `]` and the URL greedily
  // to the final `)`.
  const m = ln.match(/^- (?:\[[ xX]\]\s+)?\[([^\]]+)\]\((https?:\/\/.+)\)\s*$/);
  if (m && section) rcpa.push({ name: m[1].trim(), url: m[2].trim(), blood: section === 'blood' });
}

// --- 2. read existing tests.csv into row objects (preserve column order) ---
const rawRows = parseCsv(readFileSync('data/tests.csv', 'utf8')).filter(r => r.some(c => c.trim() !== ''));
const header = rawRows[0].map(h => h.trim());
const rows = rawRows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));

// index existing rows by every searchable token (name, short, aliases)
const byKey = new Map();
for (const row of rows) {
  const keys = [row.name, row.short, ...((row.aliases || '').split('|'))].filter(Boolean);
  for (const k of keys) if (!byKey.has(norm(k))) byKey.set(norm(k), row);
}

// --- 3. tube heuristic for a NEW RCPA test name (best guess, else 'confirm') ---
function guessTube(name) {
  const n = ' ' + name.toLowerCase() + ' ';
  const any = (...ws) => ws.some(w => n.includes(w));
  // coagulation -> citrate (blue)
  if (any('coagulat', 'clotting', 'prothrombin', 'aptt', 'fibrinogen', 'd-dimer', 'd dimer',
    'factor v', 'factor viii', 'factor ix', 'factor xi', 'factor ii', 'factor x ', 'factor vii',
    'lupus anticoagulant', 'protein c', 'protein s', 'antithrombin', 'von willebrand',
    'anti factor xa', 'anti-factor xa', 'apc resistance', 'thrombin', 'activated clotting',
    'bleeding time', 'platelet function', 'adamts')) return 'blue';
  // molecular / genetic -> EDTA (purple)
  if (any('genetic', 'mutation', 'genotype', ' dna', 'rna ', 'molecular', 'karyotype',
    'chromosom', 'sequencing', 'jak2', 'bcr', 'thalassaemia genetic', 'gene ', 'genomic')) return 'purple';
  // haematology -> EDTA (purple)
  if (any('full blood', 'blood film', 'blood count', 'reticulocyt', 'sedimentation rate',
    'haemoglobin electrophoresis', 'platelet count', 'malaria', 'sickle', 'g6pd',
    'glucose-6-phosphate', 'haematocrit', 'eosinophil count', 'blood picture')) return 'purple';
  // glucose / lactate -> fluoride (grey)
  if ((/ glucose /.test(n) && !n.includes('phosphate')) || (/ lactate /.test(n) && !n.includes('dehydrog'))) return 'grey';
  // blood bank -> pink
  if (any('group and', 'group & ', 'crossmatch', 'cross match', 'antenatal screen',
    'antibody screen', 'blood group', 'antiglobulin', 'red cell antibod', 'rh ', 'kleihauer')) return 'pink';
  // trace elements -> royal blue
  if (any('zinc', 'copper', 'selenium', 'manganese', 'aluminium', 'aluminum', 'trace element',
    'heavy metal', 'mercury', 'arsenic', 'cadmium', ' lead ', 'cobalt', 'chromium')) return 'royalblue';
  // serology / antibodies / immunology -> serum (gold)
  if (any(' ab ', 'antibod', 'serology', 'immunoglobulin', ' igg', ' igm', ' iga', ' ige',
    'complement', 'autoantib', 'virus', 'viral', 'hepatitis', ' hiv', 'rubella', 'syphilis',
    'antinuclear', 'rheumatoid', 'antigen', 'serum ')) return 'gold';
  // hormones / chemistry / drug levels / vitamins / tumour markers -> serum (gold)
  if (any('hormone', 'testosterone', 'oestr', 'estr', 'progesterone', 'cortisol', 'aldosterone',
    'thyroid', ' tsh', 'prolactin', 'vitamin', 'folate', 'ferritin', ' iron', 'lipid',
    'cholesterol', 'triglycerid', 'protein electrophoresis', 'tumour marker', ' psa', ' cea',
    'ca 125', 'ca125', 'ca 19', ' afp', 'enzyme', ' level', 'paracetamol', 'digoxin', 'lithium',
    'phenytoin', 'valproate', 'carbamazepine', 'aminotransferase', 'phosphatase', 'dehydrogenase',
    'amylase', 'lipase', 'bilirubin', 'albumin', 'urate', 'creatinine', 'electrolyte',
    'peptide', 'gastrin', 'insulin', 'cortisol')) return 'gold';
  return 'confirm';
}

// off-site likelihood for a NEW test: specialised categories more likely referred.
function guessOffsite(name, tube) {
  const n = name.toLowerCase();
  if (/genetic|mutation|genotype|molecular|karyotype|sequencing|chromosom/.test(n)) return 'maybe';
  if (tube === 'royalblue' || tube === 'confirm') return 'maybe';
  return 'none';
}

// a search alias expanding RCPA's "Ab" abbreviation to "antibody"
function abAlias(name) {
  if (/\bAb\b/.test(name)) return name.replace(/\bAb\b/g, 'antibody');
  return '';
}

// --- 4. merge ---
let added = 0, refreshed = 0;
const newRows = [];
for (const t of rcpa) {
  const hit = byKey.get(norm(t.name));
  if (hit) { hit.rcpa = t.url; refreshed++; continue; }   // dedupe + refresh authoritative link
  const tube = t.blood ? guessTube(t.name) : 'nonblood';
  const row = {
    name: t.name, tube,
    aliases: abAlias(t.name),
    offsite: t.blood ? guessOffsite(t.name, tube) : 'none',
    defaultLab: '', rcpa: t.url, nsw: '', verified: 'rcpa-index', short: '',
  };
  // register so a later duplicate in the index does not double-add
  byKey.set(norm(t.name), row);
  newRows.push(row); added++;
}

newRows.sort((a, b) => a.name.localeCompare(b.name));
const allRows = [...rows, ...newRows];

// --- write back ---
const out = [header.join(',')].concat(allRows.map(r => header.map(h => csvCell(r[h])).join(','))).join('\n') + '\n';
writeFileSync('data/tests.csv', out);

const tally = {};
for (const r of newRows) tally[r.tube] = (tally[r.tube] || 0) + 1;
console.log(`RCPA index: ${rcpa.length} tests parsed.`);
console.log(`Existing rows: ${rows.length} (kept). Refreshed RCPA link on ${refreshed} match(es).`);
console.log(`Added ${added} new rows. Total now ${allRows.length}.`);
console.log('New rows by tube:', tally);
