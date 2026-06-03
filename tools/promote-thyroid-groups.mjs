// Promote Thyroid Function + Thyroid Antibodies from local single rows to proper GROUPS.
// Their member tests already exist as RCPA rows (Free T4/T3, TPO Ab, TSH receptor Ab...).
import { readFileSync, writeFileSync } from 'node:fs';
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const load=name=>{const raw=parseCsv(readFileSync(`data/${name}.csv`,'utf8')).filter(r=>r.some(c=>c.trim()!==''));const cols=raw[0].map(h=>h.trim());return {cols,rows:raw.slice(1).map(r=>Object.fromEntries(cols.map((h,i)=>[h,(r[i]??'').trim()])))};};
const save=(name,cols,rows)=>writeFileSync(`data/${name}.csv`,[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');

const T=load('tests'); const find=n=>T.rows.find(r=>norm(r.name)===norm(n));
// Free T4 / Free T3 are serum -> the conservative reclassify had wrongly set them to 'confirm'
for(const n of ['Free T4','Free T3']){const r=find(n); if(r) r.tube='gold';}

const NOTE='Panel make-up is indicative and varies by laboratory; confirm locally.';
const GROUPS=[
  {name:'Thyroid Function', members:['Thyroid stimulating hormone','Free T4','Free T3'],
    aliases:'TFT|TFTs|thyroid function|thyroid function tests|T4|FT4|T3|FT3', short:'TFT', source:''},
  {name:'Thyroid Antibodies', members:['TPO Ab','TSH receptor Ab'],
    aliases:'thyroid antibodies|anti-tpo|tpo antibodies|thyroid peroxidase antibodies|anti-thyroglobulin|trab|tsh receptor antibodies', short:'', source:''},
];
const errs=[];
for(const g of GROUPS) for(const m of g.members) if(!find(m)) errs.push(`group "${g.name}" member not found: "${m}"`);
if(errs.length){console.error('promote-thyroid failed:\n  '+errs.join('\n  '));process.exit(1);}

// remove the old local single rows
const remove=new Set(GROUPS.map(g=>norm(g.name)));
T.rows=T.rows.filter(r=>!remove.has(norm(r.name)));
save('tests',T.cols,T.rows);

// add to groups.csv
const G=load('groups');
for(const g of GROUPS){ if(G.rows.find(r=>norm(r.name)===norm(g.name))) continue;
  G.rows.push({name:g.name, members:g.members.join('|'), aliases:g.aliases, short:g.short, note:NOTE, source:g.source}); }
save('groups',G.cols,G.rows);
console.log(`tests.csv: ${T.rows.length} rows. groups.csv: ${G.rows.length} groups. Promoted: ${GROUPS.map(g=>g.name).join(', ')}`);
