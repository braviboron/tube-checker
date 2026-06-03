// One-time restructure so the catalogue is one-for-one with the RCPA index:
//   - our clinical shorthand rows that duplicate an RCPA entry are FOLDED into that
//     entry (RCPA name becomes the row, our name/aliases are kept as aliases),
//   - genuine clinical PANELS that have no single RCPA entry are tagged source=local,
//   - everything else is source=rcpa,
//   - imported (heuristic) rows are re-classified with a more conservative tube guess
//     so e.g. virus 'detection' tests are not assumed to be serum.
// Adds a `source` column for audit. Re-run safe-ish (idempotent for already-folded rows).
import { readFileSync, writeFileSync } from 'node:fs';

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c; }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const cell = v => { v = (v ?? '').toString(); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const aliasList = s => (s || '').split('|').map(x => x.trim()).filter(Boolean);

// --- conservative tube guess for an RCPA name (used only on imported rows) ---
function classify(name) {
  const n = ` ${name.toLowerCase()} `;
  const re = (...r) => r.some(x => x.test(n));
  // clear non-blood specimen named in the test
  if (re(/urine|faece|faecal|stool|cerebrospinal|\bcsf\b|sputum|swab|aspirate|nasophar|throat|genital|biopsy|tissue|\bfluid\b|semen|saliva|breath|sweat|\bhair\b|\bnail\b|calculus|\bstone\b|amniotic|washings|meconium|\bskin\b|wound|pleural|ascit|synovial|peritoneal|seminal|stone\b/)) return 'nonblood';
  // serology / antibodies are serum even when a virus is named
  if (re(/ ab | antibod| serology|immunoglob| ig[gma]\b| ige\b|autoantib/)) return 'gold';
  // detection / antigen / nucleic acid: specimen varies, do not guess a tube
  if (re(/detection|nucleic acid| pcr |\bculture\b|antigen|\bag\b|genotyping/)) return 'confirm';
  if (re(/coagulat|prothromb|aptt|fibrinogen|d-dimer|d dimer|factor v|factor viii|factor ix|factor xi|factor ii|factor x |lupus anticoag|protein c\b|protein s\b|antithromb|von willebrand|anti factor xa|apc resist|thrombin|clotting|bleeding time/)) return 'blue';
  if (re(/genetic|mutation|genotyp|karyotyp|chromosom|sequencing|\bdna\b|\brna\b|molecular|genomic/)) return 'purple';
  if (re(/full blood|blood film|blood count|reticulocyt|sedimentation rate|haemoglobin electroph|platelet count|\bsickle|g6pd|glucose-6-phosphate|blood picture|haematocrit|eosinophil count/)) return 'purple';
  if (re(/ glucose | lactate /) && !re(/dehydrog|phosphate/)) return 'grey';
  if (re(/group and|crossmatch|antiglobulin|blood group|antenatal screen|kleihauer|red cell antib/)) return 'pink';
  if (re(/\bzinc\b|copper|selenium|manganese|aluminium|mercury|arsenic|cadmium|cobalt|chromium|trace element|heavy metal/)) return 'royalblue';
  if (re(/hormone|testosterone|oestr|estr|progesterone|cortisol|aldosterone|thyroid| tsh\b|prolactin|vitamin|folate|ferritin| iron\b|lipid|cholesterol|triglycerid|electrophoresis| psa\b| cea\b| afp\b|enzyme| level\b|paracetamol|digoxin|lithium|phenytoin|valproate|carbamazepine|aminotransferase|phosphatase|dehydrogenase|amylase|lipase|bilirubin|albumin|urate|creatinine|electrolyte|peptide|gastrin|insulin|globulin|complement/)) return 'gold';
  return 'confirm';
}

// --- load ---
const raw = parseCsv(readFileSync('data/tests.csv', 'utf8')).filter(r => r.some(c => c.trim() !== ''));
const header = raw[0].map(h => h.trim());
const cols = ['name', 'tube', 'aliases', 'offsite', 'defaultLab', 'rcpa', 'nsw', 'verified', 'short', 'source'];
let rows = raw.slice(1).map(r => { const o = Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])); for (const c of cols) if (!(c in o)) o[c] = ''; return o; });
const find = name => rows.find(r => norm(r.name) === norm(name));

// --- 1. re-classify imported (heuristic) rows conservatively ---
let reclassified = 0;
for (const r of rows) if (r.verified === 'rcpa-index') { const t = classify(r.name); if (t !== r.tube) reclassified++; r.tube = t; }

// --- 2. RENAME our blood-bank screen row to the RCPA canonical, gathering synonyms ---
const gs = find('Group & Screen');
if (gs) {
  gs.name = 'Blood group and antibody screen';
  gs.tube = 'pink';
  gs.rcpa = 'https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/B/Blood-group-and-antibody-screen';
}

// --- 3. FOLD: remove our shorthand row, merge it into the RCPA row (RCPA name wins,
//        but our curated tube/aliases are kept). ---
const FOLD = {
  'Group & Hold': 'Blood group and antibody screen',
  'Antibody Screen': 'Blood group and antibody screen',
  'Anti-Xa': 'Anti factor Xa',
  'Complement (C3/C4)': 'Complement C3 and Complement C4',
  'CMV Serology': 'Cytomegalovirus Ab',
  'Anticardiolipin Antibodies': 'Cardiolipin Ab',
  'SHBG': 'SHBG Sex Hormone Binding Globulin',
  'DHEAS': 'Dehydroepiandrosterone sulfate',
  'Lactate': 'L Lactate',
  'Chromosome Studies': 'Karyotype analysis',
};
const folded = [], foldMiss = [];
for (const [src, tgtName] of Object.entries(FOLD)) {
  const s = find(src), t = find(tgtName);
  if (!s) continue;
  if (!t) { foldMiss.push(`${src} -> ${tgtName} (target missing)`); continue; }
  const merged = new Set([...aliasList(t.aliases), ...aliasList(s.aliases), s.name, s.short].filter(Boolean));
  merged.delete(t.name);
  t.aliases = [...merged].join('|');
  t.tube = s.tube;                                   // curated tube is more reliable than the heuristic
  if (s.short && !t.short) t.short = s.short;
  if ((t.offsite === 'none' || !t.offsite) && s.offsite && s.offsite !== 'none') t.offsite = s.offsite;
  t.verified = s.verified === 'rcpa-index' ? 'estimate' : (s.verified || 'estimate');
  rows = rows.filter(r => r !== s);
  folded.push(`${src} -> ${tgtName}`);
}

// --- 4. tag genuine clinical PANELS (no single RCPA entry) as source=local ---
const LOCAL = new Set(['Factor Assay', 'Trace Elements', 'Urea, Electrolytes & Creatinine',
  'Thyroid Function', 'CK-MB', 'Coeliac Serology', 'Hepatitis Serology', 'eGFR',
  'Oral Glucose Tolerance Test'].map(norm));

// --- 5. set source for every surviving row ---
for (const r of rows) r.source = LOCAL.has(norm(r.name)) ? 'local' : 'rcpa';

// --- write ---
const out = [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r[c])).join(','))).join('\n') + '\n';
writeFileSync('data/tests.csv', out);

// --- update overrides.csv name reference (Group & Hold was folded) ---
let ov = readFileSync('data/overrides.csv', 'utf8');
ov = ov.replace(/,Group & Hold,/g, ',Blood group and antibody screen,');
writeFileSync('data/overrides.csv', ov);

const bySrc = rows.reduce((a, r) => (a[r.source] = (a[r.source] || 0) + 1, a), {});
console.log(`Reclassified ${reclassified} imported tube guesses.`);
console.log(`Folded ${folded.length}:`, folded.join('; '));
if (foldMiss.length) console.log('FOLD TARGET MISSING:', foldMiss.join('; '));
console.log(`Rows now ${rows.length}. By source:`, bySrc);
console.log('Local (audit):', rows.filter(r => r.source === 'local').map(r => r.name).join(', '));
