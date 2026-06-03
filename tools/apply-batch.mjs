// Apply a verified batch of tube/specimen decisions to tests.csv. Adds a `note` column
// (per-test handling note) and sets verified='confirmed' for each. Edit BATCH and re-run
// per batch as we work through the flagged tests.
import { readFileSync, writeFileSync } from 'node:fs';
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};

// name -> { tube, note }
const BATCH = {
  'Amino acids': { tube:'green', note:'Plasma; collect on ice and deliver promptly (some labs use EDTA).' },
  'Anabolic steroids': { tube:'nonblood', note:'Usually a urine screen; serum only for some confirmatory assays.' },
  'Anion gap': { tube:'gold', note:'Calculated from the electrolytes and collected with the U&E sample.' },
  'Base excess arterial': { tube:'abg', note:'Arterial blood-gas syringe; analyse immediately.' },
  'Blood gas arterial': { tube:'abg', note:'Arterial blood-gas syringe; analyse immediately.' },
  'Carboxyhaemoglobin': { tube:'abg', note:'Measured on a blood-gas analyser (arterial or venous sample).' },
  'Cold agglutinins': { tube:'gold', note:'Collect and transport warm at 37C (pre-warmed tube).' },
  'Copeptin': { tube:'purple', note:'EDTA plasma; send frozen.' },
  'Corticosteroids': { tube:'gold', note:'Serum (blood). Urinary free cortisol is a separate urine test (see RCPA).' },
  'Cryptococcal Ag': { tube:'gold', note:'Serum (blood). Also performed on CSF (see RCPA).' },
};

const raw=parseCsv(readFileSync('data/tests.csv','utf8')).filter(r=>r.some(c=>c.trim()!==''));
let cols=raw[0].map(h=>h.trim());
if(!cols.includes('note')) cols=[...cols,'note'];
const rows=raw.slice(1).map(r=>{const o=Object.fromEntries(raw[0].map((h,i)=>[h.trim(),(r[i]??'').trim()]));if(!('note'in o))o.note='';return o;});
const byName=new Map(rows.map(r=>[r.name.toLowerCase(),r]));

const miss=[]; let n=0;
for(const [name,d] of Object.entries(BATCH)){
  const r=byName.get(name.toLowerCase());
  if(!r){miss.push(name);continue;}
  r.tube=d.tube; r.note=d.note; r.verified='confirmed'; n++;
}
writeFileSync('data/tests.csv',[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');
if(miss.length) console.log('NOT FOUND:',miss.join(' | '));
console.log('Applied',n,'confirmed decisions. Still on confirm:',rows.filter(r=>r.tube==='confirm').length);
