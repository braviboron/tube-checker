// Apply the verification of the 11 unlinked rows against the RCPA Manual source.
import { readFileSync, writeFileSync } from 'node:fs';
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function parseCsv(text){const rows=[];let row=[],f='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const al=s=>(s||'').split('|').map(x=>x.trim()).filter(Boolean);

const raw=parseCsv(readFileSync('data/tests.csv','utf8')).filter(r=>r.some(c=>c.trim()!==''));
const cols=raw[0].map(h=>h.trim());
let rows=raw.slice(1).map(r=>Object.fromEntries(cols.map((h,i)=>[h,(r[i]??'').trim()])));
const find=n=>rows.find(r=>norm(r.name)===norm(n));
const mergeAliases=(row,extra)=>{const s=new Set([...al(row.aliases),...extra].filter(Boolean));s.delete(row.name);row.aliases=[...s].join('|');};

// 1) RENAME to RCPA canonical + add the verified deep link
const RENAME=[
  {from:'Beta-hCG',to:'HCG',rcpa:'https://www.rcpa.edu.au/Manuals/RCPA-Manual/Pathology-Tests/H/HCG',add:['beta hcg','bhcg','hcg','pregnancy test','quantitative hcg','human chorionic gonadotrophin'],short:'Beta-hCG'},
];
for(const r of RENAME){const row=find(r.from);if(!row){console.log('rename miss',r.from);continue;}mergeAliases(row,[row.name,...r.add]);row.name=r.to;row.rcpa=r.rcpa;if(r.short)row.short=r.short;row.verified='estimate';row.source='rcpa';}

// 2) FOLD our shorthand into the existing RCPA row (RCPA name wins, our tube kept)
const FOLD=[
  {from:'dsDNA',to:'DNA Ab',add:['dsdna','anti-dsdna','double stranded dna','anti-dna']},
  {from:'HLA-B27',to:'HLA typing',add:['hla-b27','hlab27','b27']},
  {from:'Malaria',to:'Malaria thick film',add:['malaria','malaria parasites','thick and thin','malaria film']},
  {from:'Immunofixation',to:'Paraprotein typing',add:['immunofixation','ife','immunofixation electrophoresis']},
];
for(const f of FOLD){const s=find(f.from),t=find(f.to);if(!s){console.log('fold src miss',f.from);continue;}if(!t){console.log('fold target miss',f.to);continue;}mergeAliases(t,[s.name,s.short,...al(s.aliases),...f.add]);t.tube=s.tube;if(s.short&&!t.short)t.short=s.short;t.verified='estimate';t.source='rcpa';rows=rows.filter(x=>x!==s);}

// 3) tag confirmed panels/umbrellas as local (no single RCPA entry)
for(const n of ['Thyroid Antibodies','Thalassaemia','Haemochromatosis (HFE)']){const r=find(n);if(r)r.source='local';}

writeFileSync('data/tests.csv',[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');

// 4) availability.csv: dsDNA -> DNA Ab
let av=readFileSync('data/availability.csv','utf8').replace(/^dsDNA,/gm,'DNA Ab,');
writeFileSync('data/availability.csv',av);

const bySrc=rows.reduce((a,r)=>(a[r.source]=(a[r.source]||0)+1,a),{});
const noLink=rows.filter(r=>r.source==='rcpa'&&!r.rcpa).map(r=>r.name);
console.log('Rows now',rows.length,'| by source',bySrc);
console.log('rcpa rows still missing a link:',noLink.join(', '));
