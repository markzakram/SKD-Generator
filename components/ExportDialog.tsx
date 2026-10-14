'use client';
import { useEffect, useRef, useState } from 'react';
import { exportCsv, exportFile, exportJson } from '@/lib/export';
import type { ExportContent, Result } from '@/lib/types';
import Icon from './Icon';

export default function ExportDialog({ result, active, onClose }: { result: Result; active: number; onClose: () => void }) {
  const [format, setFormat] = useState<'pdf' | 'docx' | 'csv' | 'json'>('pdf');
  const [content, setContent] = useState<ExportContent>('pembahasan');
  const [all, setAll] = useState(true), [zip, setZip] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const run = async () => {
    setBusy(true); setError('');
    try {
      const packages = all ? result.packages : [result.packages[active]];
      if (format === 'csv') exportCsv(packages, result.settings);
      else if (format === 'json') exportJson(packages, result.settings);
      else await exportFile(format, content, packages, result.settings, zip);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ekspor gagal.'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="export-dialog" onCancel={(e) => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="dialog-heading"><div><span className="eyebrow">SIAP DIGUNAKAN</span><h2>Unduh paket soal</h2></div>
      <button className="icon-button" aria-label="Tutup dialog ekspor" onClick={onClose} disabled={busy}><Icon name="close"/></button></div>
    <p className="muted">Pilih format dan isi berkas yang ingin kamu simpan.</p>
    <label className="field-label">Format berkas</label>
    <div className="format-grid">{(['pdf', 'docx', 'csv', 'json'] as const).map((value) => <button key={value}
      className={format === value ? 'format-button selected' : 'format-button'} onClick={() => setFormat(value)} disabled={busy} aria-pressed={format === value}>
      <Icon name="file"/><strong>{value === 'docx' ? 'Word' : value.toUpperCase()}</strong>
      <span>{value === 'pdf' ? 'Siap cetak' : value === 'docx' ? 'Bisa disunting' : value === 'csv' ? 'Bank & skor' : 'Data lengkap'}</span></button>)}</div>
    {(format === 'pdf' || format === 'docx') && <div className="field"><label htmlFor="export-content">Isi dokumen</label><select id="export-content" value={content} onChange={(e) => setContent(e.target.value as ExportContent)} disabled={busy}>
      <option value="pembahasan">Soal + kunci + pembahasan</option><option value="soal">Naskah soal tanpa kunci</option><option value="kunci">Kunci & poin jawaban</option></select></div>}
    <div className="field"><label htmlFor="export-scope">Paket yang diunduh</label><select id="export-scope" value={all ? 'all' : 'active'} onChange={(e) => setAll(e.target.value === 'all')} disabled={busy}>
      <option value="all">Semua paket ({result.packages.length})</option><option value="active">Paket aktif ({result.packages[active].id})</option></select></div>
    {(format === 'pdf' || format === 'docx') && <label className="check-row"><input type="checkbox" checked={zip} onChange={(e) => setZip(e.target.checked)} disabled={busy}/><span>Pisahkan per paket dalam ZIP</span></label>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <button className="primary-button full-width" onClick={run} disabled={busy}><Icon name="download"/>{busy ? 'Menyiapkan berkas…' : 'Unduh ' + (format === 'docx' ? 'Word' : format.toUpperCase())}</button>
  </dialog>;
}
