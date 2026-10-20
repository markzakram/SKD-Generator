import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'node:fs';
import { mathParts, mathSvg, mathHtml, latexText } from '../lib/math';
import { questionTable } from '../lib/table';
import { ACCEPTED_BANK } from '../lib/bank';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate } from '../lib/generate';
import { LOCAL_MODELS, LOCAL_RECIPES, renderLocal } from '../lib/local';
import { makeFigural } from '../lib/figural';
import { rng } from '../lib/rng';
import { takeSections, sectionsHtml, sectionsText } from '../lib/take';
import QuestionCard from '../components/QuestionCard';
import type { Question } from '../lib/types';
import { createWorkspace, setReview } from '../lib/quality';
import { auditPackages } from '../lib/validate';
let checks=0;const check=(b:unknown,n:string)=>{assert.ok(b,n);checks++;};
for(const [raw,latex] of [
 ['(3)/(8)+(1)/(8)−(3)/(10)',String.raw`\frac{3}{8}+\frac{1}{8}-\frac{3}{10}`],
 ['(16 + (3)/(8))',String.raw`(16 + \frac{3}{8})`],
 ['(3×5)/(8×5)',String.raw`\frac{3\times 5}{8\times 5}`],
 ['2² + 3³ = 31','2^{2} + 3^{3} = 31'],
 ['0,75×(1)/(2)',String.raw`0{,}75\times \frac{1}{2}`],
 ['x=±11',String.raw`x=\pm 11`],
 ['900̶×32',String.raw`90\cancel{0}\times 32`],
 [String.raw`\(\frac{1}{2}+x^2\)`,String.raw`\frac{1}{2}+x^2`],
]){const parts=mathParts(raw);check(parts.length===1&&parts[0].kind==='math'&&parts[0].value===latex,'Konversi utuh '+raw);check(mathSvg(latex).width>0,'Rumus dapat dirender');}
check(mathParts('Tanggal 19/10/2026 dan https://example.test/12/3').every(p=>p.kind==='text'),'Tanggal dan URL tidak menjadi rumus');
check(latexText('Kolom: 2+3; 3+4').includes('; \\('),'Spasi antarrumus dipertahankan');
check(mathParts('A<B.\nA−B=80\n80>0').filter(p=>p.kind==='math').length===3,'Pertidaksamaan lintas baris bukan tag HTML');
check(!mathHtml('<img src=x onerror=alert(1)>').includes('<img'),'HTML teks di-escape');
check(!mathHtml(String.raw`\(\href{javascript:alert(1)}{x}\)`).includes('<a'),'Makro HTML tidak diaktifkan');
const samples:Question[]=ACCEPTED_BANK.filter(q=>q.subtest==='TIU').map(q=>({...q,no:1,family:'reference',origin:'referensi',proof:{kind:'bank',id:q.id,answerText:q.options[q.answer].text}}));
const generated=generate({...DEFAULT_SETTINGS,mode:'TIU',count:40,packages:2,seed:'MATH-ALL'}).flatMap(p=>p.questions);
let formulas=0;
for(const q of [...samples,...generated])for(const text of [q.stem,q.explanation,q.tip??'',...q.options.flatMap(o=>[o.text,o.reason]),...(q.table?[...q.table.headers,...q.table.rows.flat()]:[])]){
 for(const p of mathParts(text))if(p.kind==='math'){check(mathSvg(p.value).height>0,'LaTeX valid '+q.id+': '+p.value);formulas++;}
}
const matrices=samples.filter(q=>q.subtopic==='Matriks Deret');check(matrices.length===6,'Enam matriks referensi diperiksa');
for(const q of matrices){
 const table=questionTable(q)!;check(table.headers.length===0&&table.rows.length===3,'Matriks tidak kehilangan baris pertama');
 assert.deepEqual(table.rows[0],q.table!.headers);checks++;
 const html=renderToStaticMarkup(createElement(QuestionCard,{question:q,showAnswers:true}));
 check(!html.includes('<thead>')&&!html.includes('<th>')&&(html.match(/<td/g)??[]).length===9,'UI matriks hanya sel data');
 const sections=takeSections(q,['soal']);check(!sectionsHtml(sections,{}).includes('<th '),'Clipboard tanpa header');
 check(sectionsText(sections).includes(latexText(q.table!.headers.join(' | '))),'Salin mempertahankan angka baris pertama');
}
const ordinary=samples.find(q=>q.table&&q.subtopic!=='Matriks Deret')!;assert.deepEqual(questionTable(ordinary),ordinary.table);checks++;
for(const family of ['fig-analogi','fig-odd'])for(const level of ['mudah','sedang','sulit'] as const)for(let i=0;i<60;i++){
 const q=makeFigural(family,level,rng('no-lines-'+i));check(!q.visual.rule?.mekanisme.includes('garis'),'Pola garis tidak dihasilkan');
}
const settings={...DEFAULT_SETTINGS,profile:'tryout-2027' as const,twkSource:'new' as const,tkpSource:'new' as const};
for(let seed=0;seed<8;seed++){
 const pack=generate({...settings,seed:'diversity-'+seed})[0];
 for(const topic of [...new Set(LOCAL_MODELS.filter(m=>m.subtest==='TKP').map(m=>m.topic))]){
  const qs=pack.questions.filter(q=>q.subtest==='TKP'&&q.topic===topic);
  check(new Set(qs.map(q=>q.family)).size===qs.length,'Tidak mengulang model TKP '+topic);
 }
 for(const topic of ['Nasionalisme','Integritas','Bela Negara','Pilar Negara']){
  const qs=pack.questions.filter(q=>q.subtest==='TWK'&&q.topic===topic);check(new Set(qs.map(q=>q.family)).size===6,'Enam dilema TWK berbeda '+topic);
 }
}
for(const [id,fragment] of [['prof-serah-terima','Menelusuri alurnya'],['tik-tautan-masuk','portal resmi'],['anti-kritik-sah','bukti anggaran'],['budaya-makanan','privat dan netral'],['jejaring-definisi','mendokumentasikan konversi']] as const){
 const q=renderLocal({kind:'local',version:1,model:id,context:0,state:0,order:[3,4,2,0,1]});check(q.options[q.answer].text.includes(fragment),'Anchor editorial '+id);
}
const report={status:'PASS',checks,formulas,models:LOCAL_MODELS.length,recipes:LOCAL_RECIPES.length,retiredFiguralChecks:360};writeFileSync('test-results/presentation-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
// A private QA workspace for actual browser exports, never shipped as study content.
const fixtureQuestions=[...samples.slice(0,3),...matrices.slice(0,2)].map((q,i)=>setReview({...q,no:i+1,review:{status:'draft',excluded:false,note:'',revision:1,updatedAt:new Date().toISOString()}},'approved','Fixture QA untuk memeriksa tampilan dan ekspor; bukan persetujuan akademik.','QA'));
const fixtureSettings={...DEFAULT_SETTINGS,mode:'TIU' as const,count:5,title:'QA Rumus dan Matriks'};
const fixturePackages=[{id:'QA-MATH',mode:'TIU' as const,duration:10,seed:'presentation',questions:fixtureQuestions}];
writeFileSync('test-results/presentation-workspace.json',JSON.stringify(createWorkspace({settings:fixtureSettings,packages:fixturePackages,audit:auditPackages(fixturePackages,fixtureSettings),elapsed:0}),null,2));
