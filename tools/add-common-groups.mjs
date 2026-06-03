// Add commonly-ordered panels (EUC, CMP) as GROUPS, with a NSW Health source where one
// exists. Also add the atomic RCPA tests their members need (Urea, Creatinine), which our
// original import folded into the UEC panel instead of importing as standalone rows.
import { readFileSync, writeFileSync } from 'node:fs';
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const load=name=>{const raw=parseCsv(readFileSync(`data/${name}.csv`,'utf8')).filter(r=>r.some(c=>c.trim()!==''));const cols=raw[0].map(h=>h.trim());return {cols,rows:raw.slice(1).map(r=>Object.fromEntries(cols.map((h,i)=>[h,(r[i]??'').trim()])))};};
const save=(name,cols,rows)=>writeFileSync(`data/${name}.csv`,[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');

// --- tests.csv: add atomic rows, remove the old UEC panel row ---
const T=load('tests');
const findT=n=>T.rows.find(r=>norm(r.name)===norm(n));
const NEW=[
  {name:'Urea',tube:'gold',rcpa:'https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/U/Urea'},
  {name:'Creatinine',tube:'gold',rcpa:'https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/C/Creatinine'},
];
for(const n of NEW){
  if(findT(n.name)) continue;
  const row=Object.fromEntries(T.cols.map(c=>[c,'']));
  row.name=n.name; row.tube=n.tube; row.offsite='none'; row.rcpa=n.rcpa; row.verified='estimate'; row.source='rcpa';
  T.rows.push(row);
}
// the old combined panel row becomes the EUC group
T.rows=T.rows.filter(r=>norm(r.name)!==norm('Urea, Electrolytes & Creatinine'));
T.rows.sort((a,b)=>a.name.localeCompare(b.name));
save('tests',T.cols,T.rows);

// --- groups.csv: add a `source` column + the new common panels ---
const G=load('groups');
if(!G.cols.includes('source')) G.cols=[...G.cols,'source'];
for(const r of G.rows) if(!('source'in r)) r.source='';
// backfill a source for Liver Function Tests (RCPA lists it)
const lft=G.rows.find(r=>norm(r.name)===norm('Liver Function Tests'));
if(lft) lft.source='https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/L/Liver-function-tests';
const NOTE='Panel make-up is indicative and varies by laboratory; confirm locally.';
const addGroup=g=>{ if(G.rows.find(r=>norm(r.name)===norm(g.name))) return; G.rows.push({note:NOTE,...g}); };
addGroup({name:'Electrolytes Urea Creatinine',members:'Sodium|Potassium|Chloride|Bicarbonate|Urea|Creatinine',
  aliases:'EUC|UEC|U&E|UE|EUCs|urea electrolytes creatinine|electrolytes urea creatinine|renal function|renal panel',short:'EUC',
  source:'https://pathology.health.nsw.gov.au/test_information/electrolytes-urea-creatinine/',note:NOTE});
addGroup({name:'Calcium Magnesium Phosphate',members:'Calcium|Magnesium|Phosphate',
  aliases:'CMP|calcium magnesium phosphate|bone profile|bone chemistry',short:'CMP',source:'',note:NOTE});

// validate members exist
const names=new Set(T.rows.map(r=>norm(r.name)));
const errs=[];
for(const g of G.rows) for(const m of g.members.split('|').map(s=>s.trim()).filter(Boolean)) if(!names.has(norm(m))) errs.push(`group "${g.name}" member missing: "${m}"`);
if(errs.length){console.error('add-common-groups failed:\n  '+errs.join('\n  '));process.exit(1);}
save('groups',G.cols,G.rows);
console.log(`tests.csv: ${T.rows.length} rows. groups.csv: ${G.rows.length} groups.`);
