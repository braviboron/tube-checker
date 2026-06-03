// Sweep the `confirm` (unclear) tests: assign a tube ONLY where the specimen is clinically
// unambiguous by RCPA/CLSI convention. Anything genuinely uncertain (arterial gas, dynamic
// tests, special tubes, serology-vs-NAT viruses) is left on `confirm` on purpose.
import { readFileSync, writeFileSync } from 'node:fs';
function parseCsv(t){const rows=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}if(f.length||row.length){row.push(f);rows.push(row);}return rows;}
const cell=v=>{v=(v??'').toString();return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
const raw=parseCsv(readFileSync('data/tests.csv','utf8')).filter(r=>r.some(c=>c.trim()!==''));
const cols=raw[0].map(h=>h.trim());const rows=raw.slice(1).map(r=>Object.fromEntries(cols.map((h,i)=>[h,(r[i]??'').trim()])));

const GOLD=['Acute phase reactants','Alpha 1 antitrypsin','Alpha subunit Glycoprotein','Amiodarone','Androstenedione','Apolipoprotein A I','Apolipoprotein B','Bile Acids','CA 15 3','CA 19 9','Calcitonin','Carbohydrate deficient transferrin','Carnitine','Carotene','Cholinesterase','Chromogranin A','Clonazepam','Cystatin C','Eosinophil cationic protein','Erythropoietin','Free Androgen Index','Fructosamine','Gamma glutamyltransferase','Gonadotrophins','HIV p24 antigen','Holotranscobalamin','Immune complex assays','Lipoprotein (a)','Methotrexate','Neuron specific enolase','Phenobarbitone','Primidone','Prostate specific antigen, free','Soluble transferrin receptor','Total Protein','Very long chain fatty acids','C1 esterase inhibitor','C3 nephritic factor','Beta hydroxybutyrate'];
const PURPLE=['Cell immunophenotyping','Lymphocyte immunophenotyping','Flow cytometry','Haemoglobin','Haemoglobin A2','Haemoglobin F','Haemoglobin H','Haemoglobin M','Haemoglobin S','Haemoglobin variant','Heinz body','Mean cell haemoglobin','Mean cell haemoglobin concentration','Mean cell volume','Red cell distribution width','White cell count differential','Platelet indices','Methaemoglobin','Osmotic fragility','Paroxysmal nocturnal haemoglobinuria','Porphyrin red cell','Pyruvate kinase','Cholinesterase red cell','Unstable haemoglobin screening test','Malaria Ag','Feto maternal haemorrhage estimation','HIV viral load and resistance testing','Phosphatidylethanol','Charcot Marie Tooth disease testing','Duchenne and Becker muscular dystrophy','Fragile X syndrome test','Myotonic dystrophy test','Spinal muscular atrophy test','Familial polyposis coli test','Multiple endocrine neoplasia type 2','Paternity testing','Platelet antigen genotyping','Fluorescence in situ hybridisation','Non Invasive Prenatal Blood Group Genotyping'];
const BLUE=['ADAMTS 13 activity','Collagen binding assay','Dilute Russell viper venom ratio','Plasminogen','Plasminogen activator inhibitor','Platelet aggregometry','Platelet function screen','Reptilase time','Ristocetin cofactor','Ristocetin induced platelet aggregation','von Willebrand factor Ag','Glycoprotein Ib binding assay using recombinant GP','Glycoprotein Ib binding assay using recombinant mu','Glycoprotein Ib binding assays'];
const GREY=['Alcohol'];
const NONBLOOD=['4 hydroxy 3 methoxymandelate','Adenovirus detection','Angiostrongylus detection','Arbovirus detection','Bacterial antigen detection','Bartonella henselae detection','Bence Jones protein','Bordetella pertussis nucleic acid','Calculi biliary tract','Calculi urinary tract','Cervical screening test','Chikungunya detection','Chlamydia trachomatis nucleic acid','Chlamydophila pneumoniae and psittacosis detection','Clostridium difficile detection','Corneal scraping','Cytochemistry','Cytomegalovirus nucleic acid detection','Diphtheria detection','Drugs of abuse screen','Electron microscopy','Filaria','Flavivirus detection','Frozen section','Fungal detection','Gastric cytology','GI brushing cytology including pancreato bile duc','Immunofluorescence','Immunohistochemistry','Influenza virus nucleic acid','Intradermal allergen','Japanese Encephalitis (JEV) detection','Lactase small bowel mucosa','Legionella pneumophila serogroup 1 urinary Ag','Legionella species detection','Leptospiral (leptospirosis)','Liquid based cervical cytology','Lower respiratory tract cytology','Lupus band test','MCS bronchoalveolar lavage','MCS fungal','MCS pus','MIC susceptibility','Mpox detection','Murray Valley Encephalitis (MVE) detection','Mycobacterium ulcerans detection','Mycobacteria testing','Newborn screening','Norovirus Sapovirus detection','Pap smear','Porphobilinogen','Pubic lice (Pediculosis pubis) detection','Q Fever detection','Respiratory syncytial virus detection','Rickettsial infection','SARS CoV 2 nucleic acid','Scabies','Sparganosis detection','Streptococcus agalactiae (group B streptococcus GB','Streptococcus pneumoniae Ag','Syphilis test mucocutaneous ulcer','Trypanosome identification','Tuberculin sensitivity test','Upper respiratory tract virus detection','Virus detection','Vulvar cytology','Zika virus detection','Human epidermal growth factor receptor 2'];

const plan=new Map();
for(const n of GOLD) plan.set(n.toLowerCase(),'gold');
for(const n of PURPLE) plan.set(n.toLowerCase(),'purple');
for(const n of BLUE) plan.set(n.toLowerCase(),'blue');
for(const n of GREY) plan.set(n.toLowerCase(),'grey');
for(const n of NONBLOOD) plan.set(n.toLowerCase(),'nonblood');

const byName=new Map(rows.map(r=>[r.name.toLowerCase(),r]));
const unmatched=[]; let changed=0; const tally={};
for(const [name,tube] of plan){
  const r=byName.get(name);
  if(!r){unmatched.push(name);continue;}
  if(r.tube==='confirm'){r.tube=tube;changed++;tally[tube]=(tally[tube]||0)+1;}
}
writeFileSync('data/tests.csv',[cols.join(',')].concat(rows.map(r=>cols.map(c=>cell(r[c])).join(','))).join('\n')+'\n');
const stillConfirm=rows.filter(r=>r.tube==='confirm').length;
console.log('Reassigned',changed,'confirm tests:',JSON.stringify(tally));
if(unmatched.length) console.log('NOT FOUND (name mismatch):',unmatched.join(' | '));
console.log('Still on confirm:',stillConfirm);
