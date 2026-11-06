import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import QuestionCard from '../components/QuestionCard';
import { BANK } from '../lib/bank';
import { questionBlocks, scoreLine } from '../lib/export';
import { createWorkspace } from '../lib/quality';
import { readBackup } from '../lib/backup';
import { takeSections, sectionsText, takeFileName, NASKAH_PARTS } from '../lib/take';
import type { Question, Workspace } from '../lib/types';

const fixture=JSON.parse(fs.readFileSync('test-results/academic-fixture.json','utf8')) as Workspace;
const examples=fixture.result.packages[0].questions;
const bank=BANK.find(q=>q.id==='tryout-ref-00-31')!;
const table:Question={...bank,no:1,family:bank.id,origin:'referensi',proof:{kind:'bank',id:bank.id,answerText:bank.options[bank.answer].text}};
const questions=[...examples.filter(q=>q.subtest==='TWK'),table,...examples.filter(q=>!!q.visual),...examples.filter(q=>q.subtest==='TKP')].map((q,i)=>({...q,no:i+1,binding:undefined,
  explanation:'RAHASIA_PEMBAHASAN \\(\\tidakvalid{1}\\)',tip:'RAHASIA_TIP',source:'RAHASIA_SUMBER',options:q.options.map((o,i)=>({...o,reason:'RAHASIA_ALASAN_'+i+': '+o.reason}))}));
for(const q of questions){
  const {head,tail}=questionBlocks(q,'soal-jawaban',null);
  const text=JSON.stringify([...head,...tail]);
  assert.ok(text.includes('Jawaban: '+String.fromCharCode(65+q.answer)));
  assert.ok(!/RAHASIA_|Pembahasan:|Cara cepat/.test(text));
  assert.equal(tail.length,q.subtest==='TKP'?2:1);
  if(q.subtest==='TKP')assert.ok(text.includes(scoreLine(q)));
  const html=renderToStaticMarkup(createElement(QuestionCard,{question:q,showAnswers:true,hideExplanation:true}));
  assert.ok(html.includes('Jawaban: ')&&html.includes('correct-option'));
  assert.ok(!/RAHASIA_|explanation-body|<details/.test(html));
  const participant=renderToStaticMarkup(createElement(QuestionCard,{question:q,showAnswers:false,hideExplanation:true}));
  assert.ok(!/Jawaban:|correct-option|option-score/.test(participant));
  const copy=sectionsText(takeSections(q,[...NASKAH_PARTS,'jawaban']));
  assert.ok(copy.includes('Jawaban: ')&&!copy.includes('RAHASIA_'));
  assert.equal(questionBlocks(q,'soal',null).tail.length,0);
}
assert.match(takeFileName({title:'QC',packId:'01'},questions,'soal-jawaban','pdf'),/soal-jawaban\.pdf$/);
const result={...fixture.result,settings:{...fixture.result.settings,title:'QC soal dan jawaban',count:questions.length,packages:1},packages:[{...fixture.result.packages[0],id:'SOAL-JAWABAN',questions}]};
const workspace=JSON.stringify(createWorkspace(result));readBackup(workspace);
fs.writeFileSync('test-results/answer-only-fixture.json',workspace);
console.log('PASS: answer-only keeps keys/TKP scores and hides all explanations, reasons and tips; participant mode hides keys; '+questions.length+' mixed fixtures.');
