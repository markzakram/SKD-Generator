'use client';
import { useState } from 'react';
import { ACCEPTED_BANK } from '@/lib/bank';
import { KURASI_AKTIF } from '@/lib/config';
import { MAPPING_ROWS } from '@/lib/mapping';
import QuestionCard from './QuestionCard';
import type { Question } from '@/lib/types';

export default function ReferenceLibrary(){
  const [subtest,setSubtest]=useState('TWK'),[chapter,setChapter]=useState(''),[page,setPage]=useState(0),[open,setOpen]=useState<string|null>(null);
  const items=ACCEPTED_BANK.filter((q)=>q.subtest===subtest&&(!chapter||q.subtopic===chapter));
  const item=ACCEPTED_BANK.find((q)=>q.id===open);
  return <section className="panel reference-library"><span className="eyebrow">ACUAN TRYOUT DITERIMA</span><h2>312 soal dari dokumen Anda</h2><p className="help">90 TWK · 87 TIU · 135 TKP. Kunci, poin, pembahasan, dan label sumber dipertahankan; {KURASI_AKTIF ? 'pengesahan paket tetap dicatat melalui kurasi.' : 'periksa sendiri soal sebelum dipakai.'}</p><div className="bank-toolbar"><label className="field">Subtes contoh<select value={subtest} onChange={(e)=>{setSubtest(e.target.value);setChapter('');setPage(0);setOpen(null);}}>{['TWK','TIU','TKP'].map((s)=><option key={s}>{s}</option>)}</select></label><label className="field">Chapter contoh<select value={chapter} onChange={(e)=>{setChapter(e.target.value);setPage(0);setOpen(null);}}><option value="">Semua chapter</option>{[...new Set(ACCEPTED_BANK.filter((q)=>q.subtest===subtest).map((q)=>q.subtopic))].map((s)=><option key={s}>{s}</option>)}</select></label></div><div className="reference-items">{items.slice(page*8,(page+1)*8).map((q)=><button className={'reference-item '+(open===q.id?'selected':'')} key={q.id} onClick={()=>setOpen(open===q.id?null:q.id)}><span>{q.subtopic}</span><strong>{q.stem.slice(0,140)}{q.stem.length>140?'…':''}</strong><small>{q.source}</small></button>)}</div><div className="pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Sebelumnya</button><span>{items.length} contoh · {page+1} / {Math.ceil(items.length/8)}</span><button disabled={(page+1)*8>=items.length} onClick={()=>setPage(page+1)}>Berikutnya</button></div>
    {item&&<div className="reference-preview"><QuestionCard question={{...item,no:item.provenance?.question??1,origin:'referensi',family:item.id,mappingId:MAPPING_ROWS.find((r)=>r.chapter===item.subtopic)?.id??'reference',proof:{kind:'bank',id:item.id,answerText:item.options[item.answer].text}} as Question} showAnswers/></div>}
  </section>;
}
