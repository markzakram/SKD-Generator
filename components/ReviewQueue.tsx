'use client';
import { useEffect, useRef } from 'react';
import { LABELS } from '@/lib/config';
import { mathParts } from '@/lib/math';
import { STATUS_LABELS } from '@/lib/quality';
import type { Question } from '@/lib/types';
import Icon from './Icon';
import type { Mark } from './review-quality';

// Potongan teks polos dari stem untuk satu baris antrean. Rumus LaTeX dibuat terbaca ringkas; hasilnya dipotong dengan CSS (ellipsis).
const readable = (latex: string) => latex
  .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\\sqrt\{([^{}]*)\}/g, '√$1').replace(/\\(?:mathrm|text)\{([^{}]*)\}/g, '$1')
  .replace(/\\(?:times|cdot)(?![a-zA-Z])\s*/g, '×').replace(/\\div(?![a-zA-Z])\s*/g, '÷').replace(/\\(?:leq|le)(?![a-zA-Z])\s*/g, '≤').replace(/\\(?:geq|ge)(?![a-zA-Z])\s*/g, '≥').replace(/\\(?:neq|ne)(?![a-zA-Z])\s*/g, '≠').replace(/\\pm(?![a-zA-Z])\s*/g, '±')
  .replace(/\\ldots(?![a-zA-Z])\s*/g, '…').replace(/\\%/g, '%').replace(/\{,\}/g, ',').replace(/\^\{([^{}]*)\}/g, '^$1').replace(/\\[a-zA-Z]+\s*/g, '').replace(/[{}]/g, '');
const SNIPPETS = new WeakMap<Question, string>();
const snippet = (q: Question) => {
  let text = SNIPPETS.get(q);
  if (text === undefined) { text = mathParts(q.stem).map((p) => p.kind === 'math' ? readable(p.value) : p.value).join('').replace(/\s+/g, ' ').trim(); SNIPPETS.set(q, text); }
  return text;
};

type Props = {
  total: number; items: Question[]; activeId: string; marks: ReadonlyMap<string, Mark | null>;
  pick: boolean; picked: ReadonlySet<string>; onSelect: (id: string) => void; onTogglePick: (id: string) => void;
  search: string; onSearch: (value: string) => void; subtest: string; onSubtest: (value: string) => void; status: string; onStatus: (value: string) => void;
};

// Antrean soal: semua hasil filter dalam satu daftar bergulir (tanpa halaman), satu baris per soal.
export default function ReviewQueue({ total, items, activeId, marks, pick, picked, onSelect, onTogglePick, search, onSearch, subtest, onSubtest, status, onStatus }: Props) {
  const list = useRef<HTMLUListElement>(null), activeRow = useRef<HTMLElement | null>(null);
  // Hanya menggulir daftar itu sendiri (bukan scrollIntoView, yang ikut menggulir halaman di layar sempit).
  useEffect(() => {
    const box = list.current, row = activeRow.current;
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }, [activeId, items]);
  return <aside className="review-queue" aria-label="Antrean soal">
    <div className="queue-head">
      <div className="queue-title"><h2>Daftar soal</h2><span className="queue-count">{items.length === total ? total + ' soal' : items.length + ' dari ' + total + ' soal'}</span></div>
      <label className="queue-search"><Icon name="search" size={16}/><input aria-label="Cari soal" placeholder="Cari soal atau nomor" value={search} onChange={(e) => onSearch(e.target.value)}/></label>
      <div className="queue-filters">
        <select aria-label="Filter subtes" value={subtest} onChange={(e) => onSubtest(e.target.value)}><option value="all">Semua subtes</option>{['TWK', 'TIU', 'TKP'].map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filter status" value={status} onChange={(e) => onStatus(e.target.value)}><option value="all">Semua status</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="excluded">Dikeluarkan</option></select>
      </div>
    </div>
    {items.length ? <ul className="queue-list" ref={list}>{items.map((item) => {
      const active = item.id === activeId, mark = marks.get(item.id) ?? null, state = item.review?.excluded ? 'Dikeluarkan' : STATUS_LABELS[item.review?.status ?? 'draft'];
      const cls = 'number-button queue-row ' + (item.review?.excluded ? 'excluded' : item.review?.status ?? 'draft') + (active ? ' active' : '');
      const body = <span className="queue-body">
        <span className="queue-line"><strong className="queue-no">{String(item.no).padStart(2, '0')}</strong><span className={'tag tag-' + item.subtest.toLowerCase()}>{item.subtest}</span><span className="queue-meta">{item.subtopic}</span><span className="queue-level">{LABELS[item.difficulty]}</span><span className="queue-dot" aria-hidden="true"/></span>
        <span className="queue-stem">{snippet(item)}</span>
        <span className="sr-only">{state}</span>
        {mark && <span className={'queue-mark ' + mark.tone} title={mark.title}><Icon name={mark.tone === 'error' ? 'close' : mark.tone === 'warning' ? 'guide' : 'check'} size={12}/>{mark.text}</span>}
      </span>;
      // Mode pilih beberapa soal: baris menjadi kotak centang; soal yang diklik juga tampil di tengah supaya isinya bisa dibaca.
      return <li key={item.id}>{pick ?
        <label ref={active ? (el) => { activeRow.current = el; } : undefined} className={cls + ' pick' + (picked.has(item.id) ? ' picked' : '')} aria-current={active ? 'true' : undefined}>
          <input type="checkbox" aria-label={'Pilih soal ' + item.no + ' ' + item.subtest + ' ' + state} checked={picked.has(item.id)} onChange={() => onTogglePick(item.id)}/>{body}</label> :
        <button type="button" ref={active ? (el) => { activeRow.current = el; } : undefined} className={cls} aria-current={active ? 'true' : undefined} onClick={() => onSelect(item.id)}>{body}</button>}</li>;
    })}</ul> : <p className="queue-empty" role="status">Tidak ada soal sesuai filter.</p>}
  </aside>;
}
