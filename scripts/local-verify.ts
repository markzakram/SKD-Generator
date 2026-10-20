import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {LOCAL_MODELS,LOCAL_RECIPES,makeLocal,renderLocal,localRecipes,replaceLocalQuestion} from '../lib/local';
import {rng} from '../lib/rng';
import {DEFAULT_SETTINGS} from '../lib/config';
import {generate,fingerprint,normalizeSettings} from '../lib/generate';
import {auditQuestion,auditPackages} from '../lib/validate';
import {ACCEPTED_BANK} from '../lib/bank';
import {createWorkspace,editQuestion,setReview,qualitySummary} from '../lib/quality';
import {readBackup} from '../lib/backup';
import {profileCoverage} from '../lib/mapping';
import {takeSections,sectionsText} from '../lib/take';
import type {Question,Settings} from '../lib/types';
import {EXTRA_TKP} from '../lib/local/expanded';
import {SOCIAL_MODELS} from '../lib/local/expanded-social';
import {DIGITAL_MODELS} from '../lib/local/expanded-digital';
let checks=0;
const check=(ok:unknown,note:string)=>{assert.ok(ok,note);checks++;};
const originalStems=new Set(ACCEPTED_BANK.map(q=>q.stem));
const unique=new Set<string>();
const newStates=[...EXTRA_TKP,...SOCIAL_MODELS,...DIGITAL_MODELS].flatMap(m=>m.states.map(s=>({scores:s.scores,actions:s.actions??m.actions})));
const longest=newStates.filter(s=>{const lengths=s.actions.map(a=>a.split(/\s+/).length),key=s.scores.indexOf(5);return lengths[key]>Math.max(...lengths.filter((_,i)=>i!==key));}).length;
check(longest/newStates.length<=0.5,'Pilihan terbaik bukan pilihan terpanjang pada mayoritas kasus tambahan');
for(const recipe of LOCAL_RECIPES){
  for(let seed=0;seed<8;seed++){
    const q=makeLocal(recipe,rng('local-'+seed));
    check(auditQuestion(q).length===0,recipe.key+': '+auditQuestion(q).join(';'));
    check(!originalStems.has(q.stem),'Tidak mengambil stimulus bank diterima');
    check(!/[{}]/.test(q.stem+q.explanation+q.options.map(o=>o.text+o.reason).join('')),'Semua parameter konteks terisi');
    check(!q.provenance&&q.source.includes('Soal baru'),'Asal tidak diklaim sebagai contoh diterima');
    if(q.subtest==='TKP')check(q.options.map(o=>o.score).sort().join(',')==='1,2,3,4,5','Peringkat TKP lengkap dan tunggal');
    const bad=structuredClone(q);bad.binding=undefined;bad.options[0].reason+=' Makna diubah.';
    check(auditQuestion(bad).some(e=>e.includes('model lokal')),'Alasan yang berubah tidak lolos pemeriksaan rekonstruksi');
    if(seed===0){check(!unique.has(fingerprint(q)),'Tidak ada variasi yang hanya beda ID');unique.add(fingerprint(q));}
  }
}
for(const model of LOCAL_MODELS.filter(m=>m.states.length>1)){
  const best=model.states.map(s=>s.scores.indexOf(5));
  check(new Set(best).size===model.states.length,'Fakta penentu mengubah pilihan terbaik: '+model.id);
}
// Hand-authored expected outcomes: these do not derive their expected answer from model scores.
for(const [model,state,expected] of [
  ['layanan-aduan',0,'Memeriksa nomor'],['layanan-aduan',1,'Melakukan koreksi'],['layanan-aduan',2,'Meneruskan bukti'],
  ['anti-konten',0,'Menanggapi substansi kritik'],['anti-konten',1,'Memeriksa sumber'],['anti-konten',2,'Meminta penghentian'],
  ['tik-belajar',0,'Mendampingi rekan'],['tik-belajar',1,'Menyusun latihan'],['tik-belajar',2,'Mencatat langkah'],
  ['nas-kebutuhan',0,'Membagi perangkat belajar dalam jumlah sama'],['nas-kebutuhan',1,'Membagi perangkat belajar menurut kesenjangan'],
  ['integritas-konflik',0,'meminta pengalihan penilaian'],['integritas-konflik',1,'tugas administratif terbuka'],
] as const){
  const q=renderLocal({kind:'local',version:1,model,context:0,state,order:[4,1,3,0,2]});
  check(q.options[q.answer].text.includes(expected),'Anchor keputusan '+model+'/'+state);
}
let total=0;
for(const profile of ['free','tryout-2027'] as const)for(let seed=0;seed<6;seed++){
  const settings:Settings={...DEFAULT_SETTINGS,profile,twkSource:'new',tkpSource:'new',packages:3,seed:'new-cases-'+seed};
  const packs=generate(settings);total+=packs.flatMap(p=>p.questions).length;
  check(auditPackages(packs,settings).ok,'Tiga paket lolos semua kuota');
  const cases=packs.flatMap(p=>p.questions).filter(q=>q.subtest!=='TIU');
  check(cases.length===225&&cases.every(q=>q.proof.kind==='local'),'Semua 225 TWK/TKP dari model baru');
  check(new Set(cases.map(fingerprint)).size===225,'Tidak ada duplikasi isi antarpaket');
  if(profile==='tryout-2027')for(const p of packs)check(profileCoverage(p.questions,settings).every(row=>row.actual===row.count),'Kuota mapping tepat');
  if(seed===0)assert.deepEqual(packs,generate(settings));
}
for(const subtest of ['TWK','TKP'] as const)for(const level of ['mudah','sedang','sulit'] as const){
  if(!localRecipes(subtest,[],level).length)continue;
  const s={...DEFAULT_SETTINGS,mode:subtest,count:3,difficulty:level,twkSource:'new' as const,tkpSource:'new' as const};
  check(generate(s)[0].questions.every(q=>q.difficulty===level),'Tingkat tidak dinaikkan secara kosmetik');
}
const settings:Settings={...DEFAULT_SETTINGS,profile:'tryout-2027',twkSource:'new',tkpSource:'new',packages:1};
const packages=generate(settings),ws=createWorkspace({settings,packages,audit:auditPackages(packages,settings),elapsed:0});
const q=ws.result.packages[0].questions.find(q=>q.subtest==='TKP')!;
check(q.review?.status==='draft','Soal baru dimulai sebagai draf');
assert.throws(()=>setReview(q,'approved','','Penyusun'),/catatan/);checks++;
const approved=setReview(q,'approved','Konteks, kewenangan, dan urutan poin telah ditelaah.','Penyusun');
check(approved.review?.status==='approved','Persetujuan substansi dapat dicatat');
const edited=editQuestion(approved,{...approved,stem:approved.stem+' Perhatikan batas kewenangan.'});
check(edited.proof.kind==='manual'&&edited.review?.status==='revision','Suntingan membatalkan bukti model dan persetujuan');
check(qualitySummary([q]).verified===0,'Model lokal tidak diklaim sebagai solver akademik independen');
const next=replaceLocalQuestion(q,packages[0].questions.filter(x=>x.id!==q.id),rng('replacement'));
check(next.proof.kind==='local'&&next.subtopic===q.subtopic&&next.difficulty===q.difficulty&&fingerprint(next)!==fingerprint(q),'Penggantian tetap soal baru sejenis');
check(sectionsText(takeSections(q,['pembahasan'],false)).includes('Pembeda 5 dan 4 poin'),'Pembedaan peringkat ikut disalin');
check(readBackup(JSON.stringify(ws)).result.packages[0].questions.some(q=>q.proof.kind==='local'),'Cadangan memulihkan model dan audit');
assert.throws(()=>normalizeSettings({twkSource:'something' as never}),/Sumber TWK/);checks++;
assert.throws(()=>generate({...settings,mode:'TWK',count:30,packages:5}),/Variasi lokal/);checks++;
check(generate({...settings,mode:'TKP',count:45,packages:4}).length===4,'Empat paket TKP unik tersedia dengan model tambahan');
check(generate({...settings,packages:4,uniqueAcross:false}).length===4,'Pemakaian ulang antarpaket dapat diizinkan');
const mixed=generate({...settings,tkpSource:'accepted'});
check(mixed[0].questions.filter(q=>q.subtest==='TWK').every(q=>q.proof.kind==='local')&&mixed[0].questions.filter(q=>q.subtest==='TKP').every(q=>q.provenance?.status==='accepted-example'),'Sumber tiap subtes independen');
mkdirSync('test-results',{recursive:true});
const report={status:'PASS',checks,models:LOCAL_MODELS.length,twk:LOCAL_RECIPES.filter(r=>r.subtest==='TWK').length,tkp:LOCAL_RECIPES.filter(r=>r.subtest==='TKP').length,generated:total};
writeFileSync('test-results/local-generator-report.json',JSON.stringify(report,null,2));
writeFileSync('test-results/local-generator-sample.json',JSON.stringify(ws,null,2));
writeFileSync('test-results/local-generator-editorial.txt',LOCAL_MODELS.map(m=>m.states.map((_,state)=>{const q=renderLocal({kind:'local',version:1,model:m.id,context:0,state,order:[0,1,2,3,4]});return [m.id+'/'+state,q.stem,...q.options.map((o,i)=>String.fromCharCode(65+i)+' ['+o.score+'] '+o.text+' — '+o.reason),q.explanation].join('\n');}).join('\n\n')).join('\n\n---\n\n'));
console.log(JSON.stringify(report));
