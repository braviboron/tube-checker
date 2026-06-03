// Fill the `rcpa` column in data/tests.csv with the test's RCPA Manual deep link,
// for any test whose generated URL resolves (HTTP 200). Skips tests that already
// have an rcpa value, and leaves mismatches blank (they fall back to the search
// link until their RCPA canonical name is recorded). Re-runnable. Run from repo root:
//   node tools/populate-rcpa.mjs
import { readFileSync, writeFileSync } from 'node:fs';

function parse(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f||row.length){row.push(f);rows.push(row);}return rows;}
const cell = v => /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;

const path = 'data/tests.csv';
const rows = parse(readFileSync(path,'utf8')).filter(r => r.some(c => c.trim() !== ''));
const hdr = rows[0];
const col = Object.fromEntries(hdr.map((h,i)=>[h.trim(),i]));
const rcpaUrl = n => `https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/${n.trim()[0].toUpperCase()}/${encodeURIComponent(n.trim().replace(/\s+/g,'-'))}`;

const todo = rows.slice(1).filter(r => !(r[col.rcpa]||'').trim());
let filled = 0, miss = 0, idx = 0;
async function worker(){
  while(idx < todo.length){
    const r = todo[idx++];
    const name = r[col.name];
    const u = rcpaUrl(name);
    let code = 0;
    try { code = (await fetch(u,{redirect:'follow'})).status; } catch(e){ code = -1; }
    if (code === 200){ r[col.rcpa] = u; filled++; } else { miss++; }
  }
}
await Promise.all(Array.from({length:5}, worker));

writeFileSync(path, rows.map(r => r.map(c => cell(c ?? '')).join(',')).join('\n') + '\n');
console.log(`RCPA deep links filled: ${filled}; left blank (mismatch, use search): ${miss}.`);
