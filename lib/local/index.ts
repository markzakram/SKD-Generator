import { EXTRA_TWK, EXTRA_TKP } from './expanded';
import { SOCIAL_MODELS } from './expanded-social';
import { DIGITAL_MODELS } from './expanded-digital';
import { TWK_MODELS } from './twk';
import { TKP_MODELS } from './tkp';
import { BAHASA_MODELS } from './bahasa';
import { fill } from './schema';
import { twkOptionsV2 } from './twk-options';
import { parallelTwkOptions } from '../option-length';
import { MAPPING_ROWS } from '../mapping';
import { validationBinding } from '../binding';
import type { Rng } from '../rng';
import type { DifficultyFilter, Proof, Question, Settings, Subtest } from '../types';

export const LOCAL_MODELS=[...TWK_MODELS,...TKP_MODELS,...BAHASA_MODELS,...EXTRA_TWK,...EXTRA_TKP,...SOCIAL_MODELS,...DIGITAL_MODELS];
const byId=new Map(LOCAL_MODELS.map(m=>[m.id,m]));
export type LocalRecipe={key:string; model:string; context:number; state:number; subtest:'TWK'|'TKP'; topic:string; subtopic:string; difficulty:Question['difficulty']};
export const LOCAL_RECIPES:LocalRecipe[]=LOCAL_MODELS.flatMap(m=>m.contexts.flatMap((_,context)=>m.states.map((s,state)=>({key:[m.id,context,state].join(':'),model:m.id,context,state,subtest:m.subtest,topic:m.topic,subtopic:m.chapter,difficulty:s.difficulty}))));
export const usesLocal=(settings:Pick<Settings,'twkSource'|'tkpSource'>,subtest:Subtest)=>subtest==='TWK'?settings.twkSource==='new':subtest==='TKP'&&settings.tkpSource==='new';
export function localRecipes(subtest:Subtest,topics:string[]=[],difficulty:DifficultyFilter='campuran',subtopics:string[]=[]){
  return LOCAL_RECIPES.filter(q=>q.subtest===subtest&&(!topics.length||topics.includes(q.topic))&&(difficulty==='campuran'||q.difficulty===difficulty)&&(!subtopics.length||subtopics.includes(q.topic+'::'+q.subtopic)));
}
export function localRecipeKey(q:Question){return q.proof.kind==='local'?[q.proof.model,q.proof.context,q.proof.state].join(':'):undefined;}
export function renderLocal(proof:Extract<Proof,{kind:'local'}>):Question {
  const m=byId.get(proof.model);
  if(![1,2].includes(proof.version)||!m||(proof.version===2&&m.subtest!=='TWK')||!Number.isInteger(proof.context)||!Number.isInteger(proof.state)||proof.context<0||proof.state<0)throw new Error('Model soal lokal tidak dikenal.');
  const c=m.contexts[proof.context],s=m.states[proof.state];
  if(!c||!s||!Array.isArray(proof.order)||proof.order.length!==5||new Set(proof.order).size!==5||proof.order.some(i=>!Number.isInteger(i)||i<0||i>4))throw new Error('Parameter atau urutan opsi model lokal tidak valid.');
  const text=(value:string)=>fill(value,c);
  const actions=proof.version===2?twkOptionsV2(m,proof.context,proof.state):s.actions??m.actions;
  const options=proof.order.map(i=>({text:text(actions[i]),score:s.scores[i],reason:text(s.reasons[i])}));
  if(proof.version===2&&!parallelTwkOptions(options.map(o=>o.text)))throw new Error('Opsi TWK '+m.id+' perlu disunting: rentang panjang pilihan melebihi batas editorial.');
  const best=options.findIndex(o=>o.score===5),runner=options.find(o=>o.score===4);
  const fact=text(s.fact),conclusion=text(s.conclusion);
  const mapping=MAPPING_ROWS.find(row=>row.subtest===m.subtest&&row.topic===m.topic&&row.chapter===m.chapter);
  const explanation='Konsep yang digunakan: '+text(s.concept??m.concept)+'\n\nFakta penentu: '+fact+'\n\n'+conclusion+'\n\nPilihan terbaik: '+options[best].text+' '+options[best].reason+(runner?'\n\nPembeda 5 dan 4 poin: '+runner.reason:'');
  const q:Question={id:'local-'+[m.id,proof.context,proof.state].join('-'),no:0,subtest:m.subtest,topic:m.topic,subtopic:m.chapter,difficulty:s.difficulty,
    bloom:s.difficulty==='mudah'?'C3':s.difficulty==='sulit'?'C5':'C4',family:'local-'+m.id,origin:'kasus',mappingId:mapping?.id,
    stem:text(c.intro)+'\n\n'+fact+'\n\n'+text(s.prompt??m.prompt),options,answer:best,explanation,tip:text(s.tip??m.tip),
    source:'Soal baru dari model lokal '+m.id+' v'+proof.version+'. '+m.source,
    difficultyReason:(s.difficulty==='mudah'?'Satu hambatan utama dan langkah yang langsung sesuai.':s.difficulty==='sedang'?'Membedakan respons atau kaidah berdasarkan beberapa fakta yang berkaitan.':'Menilai tindakan dari batas kewenangan, dampak, dan alternatif yang tampak masuk akal.')+' Estimasi penulis; belum dikalibrasi dengan hasil peserta.',proof,
    ...(m.subtest==='TKP'?{rubric:{authority:'Gunakan peran dan batas kewenangan yang dinyatakan pada stimulus.',urgency:fact,efficacy:conclusion,risk:'Bandingkan dampak tiap tindakan pada alasan opsi; jangan menambah asumsi yang tidak terdapat pada kasus.',followUp:options[best].reason}}:{}),
  };
  return {...q,binding:validationBinding(q)};
}
export function makeLocal(recipe:LocalRecipe,r:Rng){return renderLocal({kind:'local',version:recipe.subtest==='TWK'?2:1,model:recipe.model,context:recipe.context,state:recipe.state,order:r.shuffle([0,1,2,3,4])});}
// Prefer a different decision state AND a different context before repeating either.
export function chooseLocal(pool:LocalRecipe[],questions:Question[],r:Rng,history:Question[]=[]):LocalRecipe|undefined {
  const cost=(x:LocalRecipe)=>questions.reduce((n,q)=>n+(q.proof.kind==='local'&&q.proof.model===x.model?20+(q.proof.state===x.state?4:0)+(q.proof.context===x.context?2:0):0)+
    (q.proof.kind==='local'&&['bahasa-ide','bahasa-simpulan'].includes(x.model)&&['bahasa-ide','bahasa-simpulan'].includes(q.proof.model)&&q.proof.context===x.context?20:0),0);
  const past=(x:LocalRecipe)=>history.reduce((n,q)=>n+(q.proof.kind==='local'&&q.proof.model===x.model?1:0),0);
  return r.shuffle(pool).sort((a,b)=>cost(a)-cost(b)||past(a)-past(b))[0];
}
export function replaceLocalQuestion(q:Question,peers:Question[],r:Rng){
  const used=new Set([q,...peers].map(localRecipeKey).filter(Boolean));
  const pool=localRecipes(q.subtest,[q.topic],q.difficulty,[q.topic+'::'+q.subtopic]).filter(x=>!used.has(x.key));
  const next=chooseLocal(pool,peers,r);if(!next)throw new Error('Variasi baru yang unik untuk chapter dan tingkat ini sudah habis. Perluas filter atau sunting soal.');
  return makeLocal(next,r);
}
export function auditLocal(q:Question):string[]{
  if(q.proof.kind!=='local')return [];
  const expected=renderLocal(q.proof);
  const fields=['subtest','topic','subtopic','difficulty','stem','options','answer','explanation','tip','rubric'] as const;
  return fields.filter(key=>JSON.stringify(q[key])!==JSON.stringify(expected[key])).map(key=>'isi '+key+' berbeda dari model lokal; gunakan penyuntingan dan tinjau ulang');
}
