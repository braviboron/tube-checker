// Build step: compile /data/*.csv into catalogue.js (embedded in the offline app).
// Run from repo root after editing any CSV:   node tools/build-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';

// --- minimal RFC4180 CSV parser (handles quotes, commas + newlines in fields) ---
function parseCsv(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readTable(name) {
  const rows = parseCsv(readFileSync(`data/${name}.csv`, 'utf8')).filter(r => r.some(c => c.trim() !== ''));
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const num = v => v === '' || v == null ? undefined : Number(v);
const blank = v => (v === '' || v == null) ? undefined : v;

// --- TUBES (object keyed by `key`) ---
const TUBES = {};
for (const t of readTable('tubes')) {
  TUBES[t.key] = { name: t.name, color: t.color, draw: num(t.draw), ml: num(t.ml),
    additive: t.additive || '', note: t.note || '' };
  if (t.maxTests !== '') TUBES[t.key].maxTests = num(t.maxTests);
}

// --- TESTS (array) ---
const TESTS = readTable('tests').map(t => {
  const o = { name: t.name, tube: t.tube,
    aliases: t.aliases ? t.aliases.split('|').map(s => s.trim()).filter(Boolean) : [],
    offsite: t.offsite || 'none' };
  if (blank(t.short)) o.short = t.short;
  if (blank(t.note)) o.note = t.note;
  if (blank(t.defaultLab)) o.defaultLab = t.defaultLab;
  if (blank(t.tube_alts)) o.tubeAlts = t.tube_alts.split('|').map(s => s.trim()).filter(Boolean);
  const sources = {};
  if (blank(t.rcpa)) sources.rcpa = t.rcpa;
  if (blank(t.nsw)) sources.nsw = t.nsw;
  if (Object.keys(sources).length) o.sources = sources;
  return o;
});

// --- supporting tables (arrays of plain rows) ---
const LABS = readTable('labs');
const STATES = readTable('states');
const SITES = readTable('sites');
const OVERRIDES = readTable('overrides');
const AVAILABILITY = readTable('availability');   // test -> lab that performs it (many-to-many)
const REGIONS = readTable('regions');             // a region within a state (e.g. an LHD)
const RESOURCES = readTable('resources');         // reference links, by level national|state|regional
// GROUPS: named bundles of RCPA tests (panels) that expand into their members on add.
// Separate from TESTS so the test list stays one-to-one with the RCPA index.
const GROUPS = readTable('groups').map(g => {
  const o = { name: g.name, members: g.members.split('|').map(s => s.trim()).filter(Boolean),
    aliases: g.aliases ? g.aliases.split('|').map(s => s.trim()).filter(Boolean) : [], note: g.note || '' };
  if (blank(g.short)) o.short = g.short;
  if (blank(g.source)) o.source = g.source;   // a panel-level source link (e.g. NSW Health), optional
  return o;
});

// --- validate references so a bad CSV fails the build, not the app ---
const errs = [];
const tubeKeys = new Set(Object.keys(TUBES));
const labIds = new Set(LABS.map(l => l.id));
const stateIds = new Set(STATES.map(s => s.id));
const testNames = new Set(TESTS.map(t => t.name));
for (const t of TESTS) {
  for (const k of String(t.tube).split('|')) if (!tubeKeys.has(k)) errs.push(`test "${t.name}" -> unknown tube "${k}"`);
  if (t.defaultLab && !labIds.has(t.defaultLab)) errs.push(`test "${t.name}" -> unknown lab "${t.defaultLab}"`);
  if (!['none', 'maybe', 'usually'].includes(t.offsite)) errs.push(`test "${t.name}" -> bad offsite "${t.offsite}"`);
}
const regionIds = new Set(REGIONS.map(r => r.id));
for (const r of REGIONS) if (!stateIds.has(r.state)) errs.push(`region "${r.id}" -> unknown state "${r.state}"`);
for (const s of SITES) {
  if (!stateIds.has(s.state)) errs.push(`site "${s.id}" -> unknown state "${s.state}"`);
  if (s.lab && !labIds.has(s.lab)) errs.push(`site "${s.id}" -> unknown lab "${s.lab}"`);
  if (s.region && !regionIds.has(s.region)) errs.push(`site "${s.id}" -> unknown region "${s.region}"`);
}
for (const r of RESOURCES) {
  if (!['national', 'state', 'regional'].includes(r.level)) errs.push(`resource "${r.label}" -> bad level "${r.level}"`);
  if (r.level === 'state' && !stateIds.has(r.scope)) errs.push(`resource "${r.label}" -> unknown state scope "${r.scope}"`);
  if (r.level === 'regional' && !regionIds.has(r.scope)) errs.push(`resource "${r.label}" -> unknown region scope "${r.scope}"`);
  if (!/\{q\}/.test(r.url)) errs.push(`resource "${r.label}" -> url missing {q} placeholder`);
}
for (const a of AVAILABILITY) {
  if (!testNames.has(a.test)) errs.push(`availability -> unknown test "${a.test}"`);
  if (!labIds.has(a.lab)) errs.push(`availability "${a.test}" -> unknown lab "${a.lab}"`);
}
for (const g of GROUPS) {
  if (!g.members.length) errs.push(`group "${g.name}" -> has no members`);
  for (const m of g.members) if (!testNames.has(m)) errs.push(`group "${g.name}" -> member is not a test: "${m}"`);
}
for (const o of OVERRIDES) {
  // a `handling` rule may target a TUBE key (e.g. all pink transfusion samples) instead of a test
  if (!testNames.has(o.test) && !(o.field === 'handling' && tubeKeys.has(o.test))) errs.push(`override -> unknown test "${o.test}"`);
  if (!['quantity', 'lab', 'tube', 'add', 'remove', 'handling'].includes(o.field)) errs.push(`override "${o.test}" -> bad field "${o.field}"`);
  if (o.field === 'lab' && !labIds.has(o.value)) errs.push(`override "${o.test}" -> unknown lab "${o.value}"`);
  if (o.field === 'tube' && !tubeKeys.has(o.value)) errs.push(`override "${o.test}" -> unknown tube "${o.value}"`);
}
if (errs.length) { console.error('build-data: validation failed:\n  ' + errs.join('\n  ')); process.exit(1); }

// --- emit catalogue.js ---
const j = v => JSON.stringify(v, null, 2);
const out = `/* GENERATED by tools/build-data.mjs from /data/*.csv. DO NOT EDIT BY HAND. */
/* Edit the CSVs in /data, then run: node tools/build-data.mjs */
const TUBES = ${j(TUBES)};
const TESTS = ${j(TESTS)};
const LABS = ${j(LABS)};
const STATES = ${j(STATES)};
const SITES = ${j(SITES)};
const OVERRIDES = ${j(OVERRIDES)};
const AVAILABILITY = ${j(AVAILABILITY)};
const REGIONS = ${j(REGIONS)};
const RESOURCES = ${j(RESOURCES)};
const GROUPS = ${j(GROUPS)};
`;
writeFileSync('catalogue.js', out);
console.log(`catalogue.js written: ${Object.keys(TUBES).length} tubes, ${TESTS.length} tests, ` +
  `${LABS.length} labs, ${STATES.length} states, ${REGIONS.length} regions, ${SITES.length} sites, ` +
  `${OVERRIDES.length} overrides, ${AVAILABILITY.length} availability, ${RESOURCES.length} resources, ${GROUPS.length} groups.`);
