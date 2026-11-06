import assert from 'node:assert/strict';
import { writeFileSync,mkdirSync } from 'node:fs';
import { ACCEPTED_BANK } from '../lib/bank';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate,fingerprint } from '../lib/generate';
import { MAPPING_ROWS,profilePlan,mappingMatch } from '../lib/mapping';
import { VARY_ROWS,replaceMappedQuestion } from '../lib/tryout-profile';
import { makeMappedTiu } from '../lib/tryout-patterns';
import { auditPackages,auditQuestion } from '../lib/validate';
import { createWorkspace,editQuestion } from '../lib/quality';
import { readBackup } from '../lib/backup';
import { questionBlocks } from '../lib/export';
import { takeSections,sectionsText } from '../lib/take';
import { calculate } from '../lib/solver';
import { rng } from '../lib/rng';
import type { Question } from '../lib/types';

let checks=0,generated=0;
const check=(value:unknown,message:string)=>{assert.ok(value,message);checks++;};
assert.equal(ACCEPTED_BANK.length,312);checks++;
assert.deepEqual(Object.fromEntries(['TWK','TIU','TKP'].map((s)=>[s,ACCEPTED_BANK.filter((q)=>q.subtest===s).length])),{TWK:90,TIU:87,TKP:135});checks++;
assert.equal(MAPPING_ROWS.reduce((n,row)=>n+row.count,0),110);checks++;
for(const item of ACCEPTED_BANK){
  const q:Question={...item,no:1,origin:'referensi',family:item.id,proof:{kind:'bank',id:item.id,answerText:item.options[item.answer].text}};
  check(auditQuestion(q).length===0,'Referensi lengkap: '+item.id);
  if(item.subtest==='TKP')check(new Set(item.options.map((o)=>o.score)).size===5,'Lima skor TKP asli: '+item.id);
}
const simple=ACCEPTED_BANK.find((q)=>q.id==='tryout-ref-00-01')!;assert.equal(Number(simple.options[simple.answer].text.replace(',','.')),calculate('3/8+1/8-3/10'));checks++;
const bahasa=ACCEPTED_BANK.find((q)=>q.id==='tryout-ref-02-01')!;
check(bahasa.options[0].reason===bahasa.options[1].reason&&bahasa.options[2].reason!==bahasa.options[0].reason&&bahasa.options[4].reason!==bahasa.options[0].reason,'Alasan gabungan Bahasa Negara dipisah sesuai opsi yang disebut sumber.');
for(const q of ACCEPTED_BANK.filter((q)=>q.provenance?.file.startsWith('Andika - Numerik')&&[4,5,6,7,8,9].includes(q.provenance.question))){
  const correct=q.options.map((o)=>{const [left,right]=o.text.replaceAll('dibandingkan dengan','=').replaceAll('sama dengan','=').replaceAll('×','*').replaceAll('÷','/').split('=');return Math.abs(calculate(left)-calculate(right))<1e-8;});
  check(correct.filter(Boolean).length===1&&correct[q.answer],'Perkalian/pembagian setara asli: '+q.id);
}
let three:ReturnType<typeof generate>=[];
for(const source of ['accepted','variation'] as const)for(let seed=0;seed<8;seed++){
  const settings={...DEFAULT_SETTINGS,profile:'tryout-2027' as const,tiuSource:source,packages:3,seed:'mapping-'+seed};
  const packs=generate(settings); generated+=packs.flatMap((p)=>p.questions).length;
  check(auditPackages(packs,settings).ok,'Audit paket tiga tryout');
  const seen=new Set<string>();
  packs.forEach((pack,p)=>{
    check(pack.questions.length===110,'110 soal tiap paket');
    for(const row of profilePlan(settings)){
      const qs=pack.questions.filter((q)=>q.mappingId===row.id);assert.equal(qs.length,row.count);checks++;
      check(qs.every((q)=>mappingMatch(q,row,p)||q.origin==='pola'&&q.subtopic===row.chapter),'Chapter persis / kelompok sah');
    }
    for(const q of pack.questions){check(!seen.has(fingerprint(q)),'Unik seluruh batch');seen.add(fingerprint(q));if(q.provenance){const original=ACCEPTED_BANK.find((b)=>b.id===q.id)!;assert.deepEqual(q.options,original.options);assert.equal(q.explanation,original.explanation);checks+=2;}}
  });
  if(source==='accepted'&&seed===0){three=packs;assert.deepEqual(packs,generate(settings));checks++;}
}
for(const row of MAPPING_ROWS.filter((r)=>VARY_ROWS.includes(r.row)))for(let i=0;i<35;i++){
  const draft=makeMappedTiu(row,i%2?'sedang':'sulit',rng('mapped-family-'+i)),q={...draft,no:1,id:'fixture-'+i};
  check(auditQuestion(q).length===0,row.chapter+' / '+i+': '+auditQuestion(q).join(';')); generated++;
}
const original=three[0].questions.find((q)=>q.provenance&&q.tip)!;
const edited=editQuestion(original,{...original,stem:original.stem+' Perhatikan konteks kasus.'});
check(edited.provenance?.status==='adapted'&&edited.review?.status==='revision','Adaptasi tidak lagi diberi penanda asli diterima.');
check(sectionsText(takeSections(original,['pembahasan'],false)).includes(original.tip!),'Cara cepat ikut disalin.');
check(questionBlocks(original,'pembahasan',null).tail.some((b)=>b.kind==='text'&&b.text.includes(original.tip!)),'Cara cepat ikut PDF/PNG.');
const settings={...DEFAULT_SETTINGS,profile:'tryout-2027' as const,packages:3};
const workspace=createWorkspace({settings,packages:three,audit:auditPackages(three,settings),elapsed:0});
check(readBackup(JSON.stringify(workspace)).result.packages[0].questions[0].mappingId===three[0].questions[0].mappingId,'Mapping dan asal dipertahankan dalam cadangan.');
const single=generate({...DEFAULT_SETTINGS,profile:'tryout-2027',mode:'TWK',count:6,topics:['Bahasa Negara']});
check(new Set(single[0].questions.map((q)=>q.subtopic)).size===6,'Enam jenis Bahasa Negara');
const next=replaceMappedQuestion(single[0].questions[0],single[0].questions.slice(1),'replace',fingerprint);
check(next.mappingId===single[0].questions[0].mappingId&&next.subtopic===single[0].questions[0].subtopic,'Ganti soal mempertahankan chapter.');
assert.throws(()=>generate({...DEFAULT_SETTINGS,profile:'tryout-2027',packages:4}),/habis|tidak cukup/);checks++;
const bad=structuredClone(three);bad[0].questions[0].mappingId='map-59';check(!auditPackages(bad,settings).ok,'Mapping salah ditolak.');
const report={status:'PASS',checks,generatedQuestions:generated,acceptedExamples:312,mappingChapters:MAPPING_ROWS.length,standardQuotas:profilePlan(DEFAULT_SETTINGS).filter((r)=>r.count).length,threePackages:three.map((p)=>({id:p.id,questions:p.questions.length,accepted:p.questions.filter((q)=>q.provenance).length,generated:p.questions.filter((q)=>!q.provenance).length}))};
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/tryout-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
