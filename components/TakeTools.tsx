'use client';
import { useEffect, useRef, useState } from 'react';
import { copyQuestions, downloadPdf, downloadPng } from '@/lib/take-actions';
import { ALL_PARTS, NASKAH_PARTS, TAKE_MENU, partsOf, pickAll, pickedQuestions, selectable, type TakeChoice } from '@/lib/take';
import type { Package, Question } from '@/lib/types';
import Icon from './Icon';

export type ToastState = { kind: 'ok' | 'warn' | 'error'; text: string };
// Pemberitahuan singkat di bawah layar: "Tersalin", peringatan (hanya teks yang tersalin), atau galat.
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null), timer = useRef(0);
  const notify = (next: ToastState | null) => {
    window.clearTimeout(timer.current); setToast(next);
    if (next) timer.current = window.setTimeout(() => setToast(null), next.kind === 'ok' ? 3500 : 7000);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { toast, notify };
}
export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  return <div className="toast-region" aria-live="polite">{toast && <div className={'toast ' + toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'}>
    <Icon name={toast.kind === 'ok' ? 'check' : 'close'} size={16}/><p>{toast.text}</p>
    <button className="icon-button" aria-label="Tutup pemberitahuan" onClick={onClose}><Icon name="close" size={14}/></button></div>}</div>;
}

const message = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const WHAT: Record<TakeChoice, string> = { soal: 'soal', pilihan: 'pilihan', jawaban: 'jawaban', pembahasan: 'pembahasan', semua: 'soal lengkap' };

// Panel "Ambil soal": Salin (menu bagian), Unduh PNG/PDF untuk soal yang sedang dilihat, dan mode pilih beberapa soal.
export default function TakePanel({ question: q, pack, title, visible, pick, onPick, picked, onPicked, notify }: {
  question: Question; pack: Package; title: string; visible: Question[]; pick: boolean; onPick: (on: boolean) => void;
  picked: ReadonlySet<string>; onPicked: (next: Set<string>) => void; notify: (toast: ToastState | null) => void;
}) {
  const [withKey, setWithKey] = useState(true), [busy, setBusy] = useState(''), [progress, setProgress] = useState(''), [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const context = { title, packId: pack.id }, chosen = pickedQuestions(pack.questions, picked), anyBusy = busy !== '';
  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  // Pekerjaan dijalankan langsung dari klik (clipboard Safari menuntut itu), lalu hasilnya dilaporkan lewat toast.
  const run = async (id: string, job: () => Promise<void>, failure: string) => {
    if (busy) return;
    setBusy(id); setProgress(''); notify(null);
    try { await job(); } catch (e) { notify({ kind: 'error', text: message(e, failure) }); } finally {
      setBusy(''); setProgress('');
      if (id === 'salin') window.setTimeout(() => wrap.current?.querySelector('button')?.focus(), 0); // fokus kembali ke tombol Salin untuk pengguna papan ketik
    }
  };
  const reportCopy = (kind: 'kaya' | 'teks', what: string) => notify(kind === 'kaya' ?
    { kind: 'ok', text: 'Tersalin: ' + what + '. Siap ditempel ke Word atau Google Docs.' } :
    { kind: 'warn', text: 'Tersalin sebagai teks saja: ' + what + '. Browser ini tidak mengizinkan salinan dengan format dan gambar.' });
  const copyOne = (choice: TakeChoice) => run('salin', async () => reportCopy(await copyQuestions([q], partsOf(choice), choice === 'semua'), WHAT[choice] + ' ' + q.no), 'Gagal menyalin.');
  const downloadOnePng = () => run('png', async () => { notify({ kind: 'ok', text: 'PNG diunduh: ' + await downloadPng([q], context, withKey) }); }, 'PNG gagal dibuat.');
  const downloadOnePdf = () => run('pdf', async () => { notify({ kind: 'ok', text: 'PDF diunduh: ' + await downloadPdf(pack, [q], context, withKey) }); }, 'PDF gagal dibuat.');
  const exportPdf = () => run('pilih-pdf', async () => { notify({ kind: 'ok', text: 'PDF diunduh: ' + await downloadPdf(pack, chosen, context, withKey) }); }, 'PDF gagal dibuat.');
  const exportPng = () => run('pilih-png', async () => {
    const name = await downloadPng(chosen, context, withKey, (done, total) => setProgress(done + 1 + ' / ' + total));
    notify({ kind: 'ok', text: (chosen.length > 1 ? 'ZIP berisi ' + chosen.length + ' PNG diunduh: ' : 'PNG diunduh: ') + name });
  }, 'PNG gagal dibuat.');
  const copyChosen = () => run('pilih-salin', async () => reportCopy(await copyQuestions(chosen, withKey ? ALL_PARTS : NASKAH_PARTS, true), chosen.length + ' soal terpilih'), 'Gagal menyalin.');
  const label = (id: string, idle: string, working: string) => busy === id ? working + (progress ? ' ' + progress : '…') : idle;
  const none = chosen.length === 0;
  return <section className="take-panel" aria-label="Ambil soal">
    <div className="take-row">
      <span className="take-title"><Icon name="copy" size={15}/>Ambil soal {q.no}</span>
      <div className="menu-wrap" ref={wrap}>
        <button className="secondary-button" aria-expanded={open} aria-controls="take-menu" disabled={anyBusy} onClick={() => setOpen(!open)}><Icon name="copy" size={16}/>{label('salin', 'Salin', 'Menyalin')}<Icon name="chevron" size={14}/></button>
        {open && <div className="menu" id="take-menu" role="group" aria-label="Bagian soal yang disalin">{TAKE_MENU.map((item) => <button key={item.id} className="menu-item" onClick={() => { setOpen(false); copyOne(item.id); }}><strong>{item.label}</strong><small>{item.hint}</small></button>)}</div>}
      </div>
      <button className="secondary-button" disabled={anyBusy} onClick={downloadOnePng}><Icon name="image" size={16}/>{label('png', 'Unduh PNG', 'Menyiapkan')}</button>
      <button className="secondary-button" disabled={anyBusy} onClick={downloadOnePdf}><Icon name="download" size={16}/>{label('pdf', 'Unduh PDF', 'Menyiapkan')}</button>
    </div>
    <div className="take-row take-options">
      <label className="check-row" title="Berlaku untuk Unduh PNG, Unduh PDF, dan soal terpilih. Menu Salin memilih bagiannya sendiri."><input type="checkbox" checked={withKey} onChange={(e) => setWithKey(e.target.checked)}/><span>Sertakan kunci & pembahasan</span></label>
      <label className="check-row"><input type="checkbox" checked={pick} onChange={(e) => onPick(e.target.checked)}/><span>Pilih beberapa soal</span></label>
    </div>
    {pick && <div className="take-select" role="group" aria-label="Soal terpilih">
      <div className="take-row take-summary">
        <p className="take-count" aria-live="polite"><strong>{chosen.length}</strong> soal terpilih</p>
        <button className="text-button" onClick={() => onPicked(pickAll(picked, visible))} disabled={anyBusy || !selectable(visible).length}>Pilih semua ({selectable(visible).length})</button>
        <button className="text-button" onClick={() => onPicked(new Set())} disabled={anyBusy || none}>Batal pilih</button>
      </div>
      <p className="help">Klik nomor di daftar soal untuk memilih. Pilih semua mengikuti filter daftar dan melewati soal yang dikeluarkan. Kunci & pembahasan mengikuti kotak di atas.</p>
      <div className="take-row">
        <button className="primary-button" disabled={anyBusy || none} onClick={exportPdf}><Icon name="download" size={16}/>{label('pilih-pdf', 'Ekspor PDF', 'Menyiapkan')}</button>
        <button className="primary-button" disabled={anyBusy || none} onClick={exportPng}><Icon name="image" size={16}/>{label('pilih-png', chosen.length > 1 ? 'Ekspor PNG (ZIP)' : 'Ekspor PNG', 'Menyiapkan PNG')}</button>
        <button className="secondary-button" disabled={anyBusy || none} onClick={copyChosen}><Icon name="copy" size={16}/>{label('pilih-salin', 'Salin terpilih', 'Menyalin')}</button>
      </div>
    </div>}
  </section>;
}
