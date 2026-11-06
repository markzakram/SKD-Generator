'use client';
import { useEffect, useRef, useState } from 'react';
import { KURASI_AKTIF, LABELS } from '@/lib/config';
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
  pick: boolean; onPick: (value: boolean) => void; picked: ReadonlySet<string>; onSelect: (id: string) => void; onTogglePick: (id: string) => void;
  search: string; onSearch: (value: string) => void; subtest: string; onSubtest: (value: string) => void; status: string; onStatus: (value: string) => void;
  // Pilih nomor untuk diganti sekaligus: kotak centang per baris (menambah/mengurangi himpunan `picked` tanpa memindahkan soal yang dibaca), pilihan cepat, dan tombolnya.
  pickedCount: number; replacing: boolean; onCheck: (id: string) => void; onPickAll: () => void; onPickNone: () => void; onReplacePicked: () => void;
};

// Peta nomor menjadi tampilan awal; daftar rinci tetap tersedia untuk membaca cuplikan soal.
export default function ReviewQueue({ total, items, activeId, marks, pick, onPick, picked, onSelect, onTogglePick, search, onSearch, subtest, onSubtest, status, onStatus, pickedCount, replacing, onCheck, onPickAll, onPickNone, onReplacePicked }: Props) {
  const [view, setView] = useState<'map' | 'detail'>('map');
  const list = useRef<HTMLDivElement>(null), activeRow = useRef<HTMLElement | null>(null);
  // Hanya menggulir daftar itu sendiri (bukan scrollIntoView, yang ikut menggulir halaman di layar sempit).
  useEffect(() => {
    const box = list.current, row = activeRow.current;
    if (!box || !row || !box.contains(row)) return;
    const bounds = box.getBoundingClientRect(), target = row.getBoundingClientRect();
    if (target.top < bounds.top) box.scrollTop += target.top - bounds.top;
    else if (target.bottom > bounds.bottom) box.scrollTop += target.bottom - bounds.bottom;
  }, [activeId, items, view]);
  const renderItem = (item: Question) => {
    const active = item.id === activeId, mark = marks.get(item.id) ?? null;
    const stateClass = item.review?.excluded ? 'excluded' : KURASI_AKTIF ? item.review?.status ?? 'draft' : 'draft';
    const state = item.review?.excluded ? 'Dikeluarkan' : KURASI_AKTIF ? STATUS_LABELS[item.review?.status ?? 'draft'] : '';
    const description = [item.subtest, item.subtopic, LABELS[item.difficulty], state, mark?.text].filter(Boolean).join(' · ');
    const cls = 'number-button ' + (view === 'map' ? 'queue-tile ' : 'queue-row ') + stateClass + (active ? ' active' : '') + (picked.has(item.id) ? ' checked' : '');
    const body = view === 'map' ? <>
      <strong className="queue-no">{String(item.no).padStart(2, '0')}</strong>
      {picked.has(item.id) ? <span className="queue-tile-indicator" aria-hidden="true"><Icon name="check" size={10}/></span> : mark && mark.tone !== 'ok' && <span className={'queue-tile-indicator ' + mark.tone} aria-hidden="true">!</span>}
    </> : <span className="queue-body">
      <span className="queue-line"><strong className="queue-no">{String(item.no).padStart(2, '0')}</strong><span className={'tag tag-' + item.subtest.toLowerCase()}>{item.subtest}</span><span className="queue-meta">{item.subtopic}</span><span className="queue-level">{LABELS[item.difficulty]}</span><span className="queue-dot" aria-hidden="true"/></span>
      <span className="queue-stem">{snippet(item)}</span>
      {state && <span className="sr-only">{state}</span>}
      {mark && <span className={'queue-mark ' + mark.tone} title={mark.title}><Icon name={mark.tone === 'error' ? 'close' : mark.tone === 'warning' ? 'guide' : 'check'} size={12}/>{mark.text}</span>}
    </span>;
    return <li key={item.id} className="queue-item" ref={active ? (el) => { activeRow.current = el; } : undefined}>
      {pick ? <label className={cls + ' pick'} aria-current={active ? 'true' : undefined} title={description + '\n' + snippet(item)}>
        <input type="checkbox" className={view === 'map' ? 'queue-tile-check' : undefined} aria-label={'Pilih soal ' + item.no + ' ' + description} checked={picked.has(item.id)} disabled={replacing} onChange={() => onTogglePick(item.id)}/>{body}
      </label> : <>
        {view === 'detail' && <input type="checkbox" className="queue-check" aria-label={'Pilih nomor ' + item.no + ' untuk diganti'} checked={picked.has(item.id)} disabled={replacing} onChange={() => onCheck(item.id)}/>}
        <button type="button" className={cls} aria-label={'Buka soal ' + item.no + ', ' + description} aria-current={active ? 'true' : undefined} title={description + '\n' + snippet(item)} onClick={() => onSelect(item.id)}>{body}</button>
      </>}
    </li>;
  };
  return <aside className="review-queue" aria-label="Antrean soal">
    <div className="queue-head">
      <div className="queue-title"><h2>Daftar soal</h2><span className="queue-count">{items.length === total ? total + ' soal' : items.length + ' dari ' + total + ' soal'}</span></div>
      <div className="queue-view-tools">
        <div className="queue-view-toggle" role="group" aria-label="Tampilan daftar soal">
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="grid" size={14}/>Nomor</button>
          <button type="button" aria-pressed={view === 'detail'} onClick={() => setView('detail')}><Icon name="file" size={14}/>Rinci</button>
        </div>
        <button type="button" className="text-button queue-pick-toggle" aria-pressed={pick} disabled={replacing} onClick={() => onPick(!pick)}>{pick ? 'Selesai pilih' : 'Pilih nomor'}</button>
      </div>
      <label className="queue-search"><Icon name="search" size={16}/><input aria-label="Cari soal" placeholder="Cari soal atau nomor" value={search} onChange={(e) => onSearch(e.target.value)}/></label>
      <div className={KURASI_AKTIF ? 'queue-filters' : 'queue-filters single'}>
        <select aria-label="Filter subtes" value={subtest} onChange={(e) => onSubtest(e.target.value)}><option value="all">Semua subtes</option>{['TWK', 'TIU', 'TKP'].map((s) => <option key={s}>{s}</option>)}</select>
        {KURASI_AKTIF && <select aria-label="Filter status" value={status} onChange={(e) => onStatus(e.target.value)}><option value="all">Semua status</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="excluded">Dikeluarkan</option></select>}
      </div>
      {(pick || pickedCount > 0) && <div className="queue-bulk" role="group" aria-label="Ganti beberapa nomor">
        <div className="queue-bulk-links"><button type="button" className="text-button" disabled={replacing || !items.length} onClick={onPickAll}>Pilih semua</button><button type="button" className="text-button" disabled={replacing || !pickedCount} onClick={onPickNone}>Kosongkan</button></div>
        <button type="button" className="secondary-button" disabled={replacing || !pickedCount} onClick={onReplacePicked}><Icon name="refresh" size={14}/>{replacing ? 'Mengganti…' : 'Ganti nomor terpilih (' + pickedCount + ')'}</button>
      </div>}
      <p className="queue-hint">{pick ? 'Klik nomor untuk memilih atau membatalkan.' : 'Klik nomor untuk membaca soal.'}</p>
    </div>
    {items.length ? <div className={'queue-list ' + (view === 'map' ? 'queue-map' : 'queue-detail')} ref={list}>
      {view === 'map' ? ['TWK', 'TIU', 'TKP'].map((name) => {
        const group = items.filter((q) => q.subtest === name);
        if (!group.length) return null;
        return <section className="queue-section" key={name} aria-label={'Nomor soal ' + name}>
          <h3><span className={'tag tag-' + name.toLowerCase()}>{name}</span><span>{group.length} soal</span></h3>
          <ul className="queue-number-grid">{group.map(renderItem)}</ul>
        </section>;
      }) : <ul className="queue-detail-list">{items.map(renderItem)}</ul>}
    </div> : <div className="queue-empty"><p role="status">Tidak ada soal sesuai filter.</p><button type="button" className="text-button" onClick={() => { onSearch(''); onSubtest('all'); onStatus('all'); }}>Hapus filter</button></div>}
    {view === 'map' && <div className="queue-legend"><span><i className="queue-key-active"/>Dibuka</span><span><i className="queue-key-picked"><Icon name="check" size={11}/></i>Terpilih{pickedCount > 0 ? ' (' + pickedCount + ')' : ''}</span>{items.some((q) => { const mark = marks.get(q.id); return mark && mark.tone !== 'ok'; }) && <span><i className="queue-key-issue">!</i>Catatan mutu</span>}</div>}
  </aside>;
}
