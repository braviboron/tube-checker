// Apply a verified batch of tube/specimen decisions to tests.csv. Adds a `note` column
// (per-test handling note) and sets verified='confirmed' for each. Edit BATCH and re-run
// per batch as we work through the flagged tests.
import { readFileSync, writeFileSync } from 'node:fs';
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};

// name -> { tube, note }
const BATCH = {
  'FIB 4': { tube:'gold', note:'Calculated from AST, ALT, platelets and age; no separate sample (reported from routine bloods).' },
  'GFR estimated': { tube:'gold', note:'Calculated from serum creatinine; reported with the creatinine result.' },
  'Glomerular filtration rate': { tube:'gold', note:'Calculated from serum creatinine.' },
  'Hepatitis C': { tube:'gold', note:'HCV antibody serology (serum); HCV RNA viral load uses EDTA.' },
  'Lymphocyte proliferative response': { tube:'green', note:'Viable lymphocytes, lithium heparin; deliver fresh.' },
  'Measles virus': { tube:'gold', note:'Serology (serum); viral detection is a swab.' },
  'Mumps': { tube:'gold', note:'Serology (serum); viral detection is a swab.' },
  'Mycobacterium tuberculosis IGRA': { tube:'green', note:'IGRA (e.g. QuantiFERON-TB): use the dedicated IGRA collection tubes per local protocol.' },
  'Neutrophil function studies': { tube:'green', note:'Viable neutrophils, lithium heparin; deliver fresh.' },
  'Parvovirus B19': { tube:'gold', note:'Serology (serum).' },
  'Plasma Free Metanephrines': { tube:'purple', note:'EDTA, chilled; patient supine and rested before collection.' },
  'Precipitins (Includes Aspergillus, Avian, Fungal': { tube:'gold', note:'Precipitating antibodies (serum).' },
  'Pyruvate': { tube:'confirm', note:'Discuss with the laboratory. Tourniquet use should be avoided.' },
  'Serotonin platelets': { tube:'purple', note:'Whole-blood EDTA (platelet serotonin).' },
  'Short Synacthen test': { tube:'gold', note:'Dynamic: serum cortisol before and after Synacthen.' },
  'Steroids': { tube:'gold', note:'Serum; a urinary steroid profile is a separate urine test.' },
  'TCA screen': { tube:'gold', note:'Tricyclic antidepressants (serum).' },
  'Tumour markers': { tube:'gold', note:'Umbrella for serum tumour markers (e.g. CEA, CA-125); check the specific marker.' },
  'Varicella zoster': { tube:'gold', note:'Serology (serum); viral detection is a swab.' },
  'Warfarin': { tube:'gold', note:'Warfarin drug level (serum); routine monitoring is by INR (citrate).' },
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
