'use client';
import { useEffect, useRef, useState } from 'react';
import { KURASI_AKTIF } from '@/lib/config';
import { download, exportCsv, exportFile, exportJson, exportTitle, fileSlug, pdfBlob } from '@/lib/export';
import { exportSiadu, siaduDocuments, siaduDeliveryDocuments, siaduFilename, SIADU_SUBTESTS, TKP_IMPORT_GUIDE, SIADU_MIXED_GUIDE, SIADU_FORMAT_GUIDE, type SiaduScope } from '@/lib/siadu';
import type { ExportContent, ExportFormat, Result } from '@/lib/types';
import Icon from './Icon';
import { exportPackages, exportScope } from '@/lib/quality';

const formats: { id: ExportFormat; title: string; detail: string }[] = [
  { id: 'pdf', title: 'PDF', detail: 'Naskah siap cetak' },
  { id: 'siadu', title: 'Word SiAdu', detail: 'Input soal, kunci & poin' },
  { id: 'docx', title: 'Word biasa', detail: 'Naskah untuk disunting' },
  { id: 'csv', title: 'CSV', detail: 'Bank soal & poin opsi' },
  { id: 'json', title: 'JSON', detail: 'Data soal lengkap' },
];
export default function ExportDialog({ result, active, initialFormat = 'pdf', onClose }: { result: Result; active: number; initialFormat?: ExportFormat; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [content, setContent] = useState<ExportContent>('pembahasan');
  const siaduContent = content === 'soal-jawaban' ? 'soal-jawaban' : 'pembahasan';
  const [all, setAll] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [delivery, setDelivery] = useState({ pdf: 'single', docx: 'single', siadu: 'single' });
  const [status, setStatus] = useState(''), [success, setSuccess] = useState('');
  const [reviewScope, setReviewScope] = useState<'approved' | 'draft'>('approved');
  const [subtest, setSubtest] = useState<SiaduScope>('all');
  const [preview, setPreview] = useState<{ url: string; blob: Blob; key: string; result: Result; filename: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), running = useRef(false);
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; requestAnimationFrame(() => trigger?.focus()); };
  }, []);
  const scope = exportScope(reviewScope);
  // Preview follows export scope, including exclusions on workspaces from earlier versions.
  const selected = (all ? result.packages : [result.packages[active]]).map((pack) => ({ ...pack, questions: pack.questions.filter((q) => !q.review?.excluded && (scope === 'draft' || q.review?.status === 'approved')) })).filter((pack) => pack.questions.length);
  const splitDocs = siaduDocuments(selected, subtest);
  const siaduZip = delivery.siadu === 'zip' && splitDocs.length > 1;
  const docs = siaduDeliveryDocuments(selected, subtest, siaduZip ? 'zip' : 'single');
  const questions = format === 'siadu' ? docs.flatMap((doc) => doc.questions) : selected.flatMap((pack) => pack.questions);
  const packageCount = format === 'siadu' ? selected.filter(pack => pack.questions.some(q => subtest === 'all' || q.subtest === subtest)).length : selected.length;
  const label = formats.find((item) => item.id === format)!.title;
  const documentFormat = format === 'pdf' || format === 'docx';
  const zip = documentFormat && delivery[format] === 'zip' && selected.length > 1;
  const archive = format === 'siadu' ? siaduZip : (format === 'pdf' || format === 'docx') && zip;
  const mixedSiadu = questions.some(q => q.subtest === 'TKP') && questions.some(q => q.subtest !== 'TKP');
  const previewKey = [content, all, scope, active].join('|');
  const currentPreview = preview?.key === previewKey && preview.result === result ? preview : null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  const showPdfPreview = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setSuccess(''); setStatus('Menyiapkan pratinjau PDF…');
    try {
      const packages = exportPackages(result, scope, all ? undefined : active);
      const settings = { ...result.settings, title: exportTitle(result.settings.title, scope) };
      const blob = await pdfBlob(packages, settings, content);
      setPreview({ blob, url: URL.createObjectURL(blob), key: previewKey, result, filename: fileSlug(settings.title) + '-' + content + '.pdf' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Pratinjau PDF gagal.'); }
    finally { running.current = false; setBusy(false); setStatus(''); }
  };
  const run = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setSuccess(''); setStatus('Menyiapkan ' + label + '…');
    try {
      const packages = exportPackages(result, scope, all ? undefined : active);
      const settings = { ...result.settings, title: exportTitle(result.settings.title, scope) };
      if (format === 'siadu') await exportSiadu(packages, settings, subtest, setStatus, siaduZip ? 'zip' : 'single', siaduContent);
      else if (format === 'pdf' && !zip && currentPreview) download(currentPreview.blob, currentPreview.filename);
      else if (format === 'csv') exportCsv(packages, settings);
      else if (format === 'json') exportJson(packages, settings);
      else await exportFile(format, content, packages, settings, zip);
      setSuccess((archive ? 'ZIP berisi ' + label : label) + ' siap · ' + questions.length + ' soal dari ' + packageCount + ' paket. Periksa unduhan browser Anda.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Ekspor gagal.'); }
    finally { running.current = false; setBusy(false); setStatus(''); }
  };
  return <dialog ref={dialog} className={'export-dialog' + (format === 'pdf' && currentPreview ? ' has-pdf-preview' : '')} aria-labelledby="export-heading" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}>
    <div className="dialog-heading"><div><span className="eyebrow">UNDUH HASIL</span><h2 id="export-heading">Ekspor paket soal</h2></div>
      <button className="icon-button" aria-label="Tutup dialog ekspor" onClick={onClose} disabled={busy}><Icon name="close"/></button></div>
    <p className="muted">PDF untuk dibaca atau dicetak. Word SiAdu untuk input soal ke SiAdu.</p>
    <fieldset className="export-fields" disabled={busy} onChange={() => { setSuccess(''); setError(''); }}>
      <legend className="sr-only">Pengaturan unduhan</legend>
      <div className="format-grid export-formats" role="group" aria-label="Format berkas">{formats.map((item) => <button type="button" key={item.id}
        className={format === item.id ? 'format-button selected' : 'format-button'} onClick={() => { setFormat(item.id); setError(''); setSuccess(''); }} aria-pressed={format === item.id}>
        <Icon name={item.id === 'siadu' ? 'book' : 'file'}/><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>
      <div className="field"><label htmlFor="export-scope">Paket yang diunduh</label><select id="export-scope" value={all ? 'all' : 'active'} onChange={(e) => setAll(e.target.value === 'all')}>
        <option value="active">Paket yang sedang dibuka · {result.packages[active].id}</option><option value="all">Semua paket ({result.packages.length})</option></select></div>
      {KURASI_AKTIF && <label className="field">Status soal yang disertakan<select value={reviewScope} onChange={(e) => setReviewScope(e.target.value as 'approved' | 'draft')}><option value="approved">Hanya soal disetujui</option><option value="draft">Semua soal aktif · draf untuk kurasi</option></select></label>}
      {(documentFormat || format === 'siadu') && <div className="field"><label htmlFor="export-content">Isi dokumen</label><select id="export-content" value={format === 'siadu' ? siaduContent : content} onChange={(e) => setContent(e.target.value as ExportContent)}>
        <option value="pembahasan">Soal + kunci + pembahasan</option><option value="soal-jawaban">Soal + jawaban tanpa pembahasan</option>{format !== 'siadu' && <><option value="soal">Naskah soal tanpa kunci</option><option value="kunci">Kunci & poin jawaban</option></>}</select></div>}
      {documentFormat && <>
        <fieldset className="export-delivery">
          <legend>Bentuk unduhan</legend>
          <label className={'export-delivery-option' + (!zip ? ' selected' : '')}>
            <input type="radio" name="export-delivery" value="single" checked={!zip} onChange={() => setDelivery({ ...delivery, [format]: 'single' })}/>
            <span><strong>Satu file {format === 'pdf' ? 'PDF' : 'Word'}</strong><small>Langsung dibuka tanpa ekstrak ZIP.{selected.length > 1 ? ' Semua paket digabung; tiap paket mulai di halaman baru.' : ''}</small></span>
          </label>
          <label className={'export-delivery-option' + (zip ? ' selected' : '') + (selected.length < 2 ? ' unavailable' : '')}>
            <input type="radio" name="export-delivery" value="zip" checked={zip} disabled={selected.length < 2} onChange={() => setDelivery({ ...delivery, [format]: 'zip' })}/>
            <span><strong>ZIP per paket</strong><small>{selected.length < 2 ? 'Tersedia jika lebih dari satu paket dipilih.' : 'Satu file ' + (format === 'pdf' ? 'PDF' : 'Word') + ' untuk setiap paket, dikumpulkan dalam ZIP.'}</small></span>
          </label>
        </fieldset>
      </>}
      {format === 'siadu' && <>
        <div className="field"><label htmlFor="export-subtest">Subtes untuk Word SiAdu</label><select id="export-subtest" value={subtest} onChange={(e) => setSubtest(e.target.value as SiaduScope)}>
          <option value="all">Semua subtes dalam paket</option>{SIADU_SUBTESTS.map((item) => <option key={item} value={item} disabled={!selected.some((pack) => pack.questions.some((q) => q.subtest === item))}>{item}</option>)}</select></div>
        <fieldset className="export-delivery">
          <legend>Bentuk unduhan Word SiAdu</legend>
          <label className={'export-delivery-option' + (!siaduZip ? ' selected' : '')}>
            <input type="radio" name="siadu-delivery" value="single" checked={!siaduZip} onChange={() => setDelivery({ ...delivery, siadu: 'single' })}/>
            <span><strong>Satu file Word SiAdu</strong><small>Langsung unduh DOCX tanpa ZIP. Paket dan subtes yang dipilih digabung, dengan penomoran berlanjut.</small></span>
          </label>
          <label className={'export-delivery-option' + (siaduZip ? ' selected' : '') + (splitDocs.length < 2 ? ' unavailable' : '')}>
            <input type="radio" name="siadu-delivery" value="zip" checked={siaduZip} disabled={splitDocs.length < 2} onChange={() => setDelivery({ ...delivery, siadu: 'zip' })}/>
            <span><strong>ZIP per paket dan subtes</strong><small>{splitDocs.length < 2 ? 'Pilihan saat ini hanya menghasilkan satu DOCX.' : 'Satu DOCX untuk setiap paket dan subtes. Ekstrak ZIP sebelum impor.'}</small></span>
          </label>
        </fieldset>
        <p className="help">Batang soal TWK/TKP menjadi satu paragraf. Pilihan A–E tetap terpisah. {siaduContent === 'soal-jawaban' ? 'Kunci, poin TKP, gambar, tabel, dan rumus soal tetap ikut. Pembahasan, alasan opsi, dan cara cepat tidak disertakan. Gunakan importir SiAdu v2.7.1 untuk mengimpor file ini.' : 'Pembahasan TIU mempertahankan langkah, tebal, warna, coretan, tabel, dan gambar; rumus berupa LaTeX.'}</p>
      </>}
    </fieldset>
    <div className="export-preview" aria-live="polite">
      <strong>{questions.length} soal · {packageCount} paket</strong>
      <p>{format === 'siadu' ? (archive ? docs.length + ' berkas Word, dipisah per paket dan subtes dalam satu ZIP. Ekstrak ZIP sebelum mengimpor .docx.' : 'Satu file Word SiAdu (.docx), langsung dibuka tanpa ekstrak ZIP.') :
        format === 'pdf' || format === 'docx' ? (zip ? selected.length + ' berkas dalam satu ZIP.' : 'Satu berkas ' + (all && selected.length > 1 ? 'gabungan semua paket.' : 'untuk paket ini.')) : 'Satu berkas berisi data soal, kunci, dan poin setiap pilihan.'}</p>
      {format === 'siadu' && docs.length > 0 && <ul>{docs.slice(0, 6).map((doc) => <li key={doc.filename}>{siaduFilename(doc, siaduContent)} <span>· {doc.questions.length} soal</span></li>)}{docs.length > 6 && <li>dan {docs.length - 6} berkas lainnya</li>}</ul>}
      {format === 'siadu' && mixedSiadu && !archive ? <p className="help">{SIADU_MIXED_GUIDE}</p> : format === 'siadu' && questions.some((q) => q.subtest === 'TKP') && <p className="help">{TKP_IMPORT_GUIDE}</p>}
      {format === 'siadu' && <details className="siadu-format-note"><summary>Pasang importir SiAdu & cara mengimpor</summary>
        <p><a className="btn" href="/siadu-auto-input.user.js" download="SiAdu-Auto-Input-2.7.1.user.js"><Icon name="download" size={16} /> Unduh importir SiAdu v2.7.1</a></p>
        <ol className="help"><li>Pasang berkas .user.js di Tampermonkey untuk mengganti skrip Auto Input lama. Pastikan hanya satu versi aktif.</li><li>Buka halaman input SiAdu, pilih DOCX gabungan, lalu klik <strong>Parse File</strong>. Biarkan mode <strong>Otomatis per soal</strong>.</li><li>Periksa melalui <strong>Isi 1 Soal Tanpa Simpan</strong>, lalu pilih <strong>Mulai Auto Input + Simpan</strong> untuk menjalankan antrean.</li></ol>
        <p className="help">{SIADU_FORMAT_GUIDE}</p></details>}
      {!questions.length && <p role="status">Tidak ada soal yang dapat diunduh pada pilihan ini. Ubah paket, subtes, atau status soal.</p>}
      {KURASI_AKTIF && <p className="help">Soal yang dikeluarkan dilewati. Nomor soal diurutkan kembali dalam berkas.</p>}
    </div>
    {format === 'pdf' && currentPreview && <section className="pdf-preview" aria-label="Pratinjau PDF">
      <div className="pdf-preview-heading"><div><strong>Pratinjau PDF</strong><p className="help">{zip ? 'Semua paket ditampilkan bersama di pratinjau. Unduhan ZIP tetap dipisah per paket.' : 'Unduhan satu PDF memakai berkas yang sama dengan pratinjau ini.'} Teks soal, pilihan, tabel, dan pembahasan memakai ukuran 12 pt.</p></div>
        <button className="text-button" onClick={() => setPreview(null)} disabled={busy}>Tutup pratinjau</button></div>
      <iframe title="Pratinjau naskah PDF" src={currentPreview.url + '#toolbar=1&view=FitH'} />
      <p className="help">Jika PDF tidak terlihat, <a href={currentPreview.url} target="_blank" rel="noopener noreferrer">buka PDF di tab baru</a>.</p>
    </section>}
    <footer className="export-dialog-footer">
      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="export-success" role="status"><Icon name="check"/>{success}</p>}
      <div role="status" aria-live="polite" className="help">{busy ? status : ''}</div>
      {format === 'pdf' && <button className="secondary-button full-width" onClick={showPdfPreview} disabled={busy || !questions.length}>{currentPreview ? 'Perbarui pratinjau PDF' : 'Lihat pratinjau PDF'}</button>}
      <button className="primary-button full-width" onClick={run} disabled={busy || !questions.length} aria-busy={busy}><Icon name="download"/>{busy ? 'Menyiapkan berkas…' : 'Unduh ' + (archive ? 'ZIP ' : format === 'pdf' || format === 'siadu' ? '1 file ' : '') + label}</button>
    </footer>
  </dialog>;
}
