'use client';
import {useState} from 'react';
import {LOCAL_MODELS,LOCAL_RECIPES,renderLocal} from '@/lib/local';
import {LABELS} from '@/lib/config';
import QuestionCard from './QuestionCard';

export default function LocalModelLibrary(){
  const [model,setModel]=useState(0),[context,setContext]=useState(0),[state,setState]=useState(0);
  const current=LOCAL_MODELS[model],q=renderLocal({kind:'local',version:1,model:current.id,context,state,order:[2,4,0,3,1]});
  return <details className="panel local-model-library"><summary><strong>Model generator soal baru</strong><span>{LOCAL_MODELS.length} model · {LOCAL_RECIPES.filter(r=>r.subtest==='TWK').length} kombinasi TWK · {LOCAL_RECIPES.filter(r=>r.subtest==='TKP').length} kombinasi TKP</span></summary><div className="local-model-body">
    <p className="help">Bandingkan kondisi untuk melihat perubahan kunci dan alasannya. Konteks yang berbeda dapat memakai pola keputusan yang sama; angka kombinasi tidak berarti sebanyak itu kompetensi yang berbeda.</p>
    <label className="field">Model soal<select aria-label="Model soal baru" value={model} onChange={e=>{setModel(Number(e.target.value));setContext(0);setState(0);}}>{LOCAL_MODELS.map((m,i)=><option key={m.id} value={i}>{m.subtest} · {m.topic} · {m.concept}</option>)}</select></label>
    <div className="field-pair"><label className="field">Konteks<select aria-label="Konteks soal baru" value={context} onChange={e=>setContext(Number(e.target.value))}>{current.contexts.map((_,i)=><option key={i} value={i}>Konteks {i+1}</option>)}</select></label><label className="field">Kondisi<select aria-label="Kondisi soal baru" value={state} onChange={e=>setState(Number(e.target.value))}>{current.states.map((s,i)=><option key={i} value={i}>Kondisi {i+1} · {LABELS[s.difficulty]}</option>)}</select></label></div>
    <QuestionCard question={{...q,no:1}} showAnswers/>
  </div></details>;
}
