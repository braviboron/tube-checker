// Move panel definitions OUT of the test list into a separate data/groups.csv.
// A group is a named bundle of RCPA tests (its members) that expands on add; it is NOT
// itself a test row, so tests.csv stays one-to-one with the RCPA index (+ local singles).
import { readFileSync, writeFileSync } from 'node:fs';
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};

const raw=parseCsv(readFileSync('data/tests.csv','utf8')).filter(r=>r.some(c=>c.trim()!==''));
const cols=raw[0].map(h=>h.trim());
const rows=raw.slice(1).map(r=>Object.fromEntries(cols.map((h,i)=>[h,(r[i]??'').trim()])));
const find=n=>rows.find(r=>norm(r.name)===norm(n));

// group name -> ordered member RCPA test names (each must exist as a test row)
const GROUPS={
  'Liver Function Tests':['Bilirubin','Alanine aminotransferase','Aspartate aminotransferase','Alkaline phosphatase','Gamma glutamyltransferase','Albumin'],
  'Coeliac Serology':['Transglutaminase Ab','Gliadin Ab','Endomysial Ab'],
  'Trace Elements':['Zinc','Copper','Selenium'],
  'Hepatitis Serology':['Hepatitis A total Ab','Hepatitis B serology','Hepatitis C'],
};
const NOTE='Panel make-up is indicative and varies by laboratory; confirm locally.';

const errs=[]; const groupRows=[]; const removeNames=new Set();
for(const [g,members] of Object.entries(GROUPS)){
  const row=find(g);
  for(const m of members) if(!find(m)) errs.push(`group "${g}" member not found: "${m}"`);
  groupRows.push({name:g, members:members.join('|'),
    aliases: row ? (row.aliases||'') : '', short: row ? (row.short||'') : '', note: NOTE});
  if(row) removeNames.add(norm(g));
}
if(errs.length){console.error('make-groups failed:\n  '+errs.join('\n  '));process.exit(1);}

// write groups.csv
const gcols=['name','members','aliases','short','note'];
writeFileSync('data/groups.csv',[gcols.join(',')].concat(groupRows.map(r=>gcols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');

// rewrite tests.csv without the group rows (they are groups now, not tests)
const kept=rows.filter(r=>!removeNames.has(norm(r.name)));
writeFileSync('data/tests.csv',[cols.join(',')].concat(kept.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');

console.log(`groups.csv: ${groupRows.length} groups. tests.csv: ${rows.length} -> ${kept.length} rows (removed ${rows.length-kept.length} panel rows).`);
