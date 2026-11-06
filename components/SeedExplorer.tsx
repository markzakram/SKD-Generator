'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { generate, normalizeSettings } from '@/lib/generate';
import { checkScanBudget, compareSeeds, DIFFERENCE_LABELS, questionVariables, randomSeed, scanSummary, sequenceSeeds, type DifferenceKind, type SeedRun } from '@/lib/seed-analysis';
import { SOURCE_LABELS, variationSpace } from '@/lib/variation-space';
import type { Settings } from '@/lib/types';
import QuestionCard from './QuestionCard';
import Icon from './Icon';

export default function SeedExplorer({ settings, basis, hasWorkspace, onBasis, onUse, onConfigure }: {
  settings: Settings; basis: 'generator' | 'workspace'; hasWorkspace: boolean;
  onBasis: (basis: 'generator' | 'workspace') => void; onUse: (settings: Settings) => void; onConfigure: () => void;
}) {
  const [seedA, setSeedA] = useState(settings.seed), [seedB, setSeedB] = useState(() => { try { return sequenceSeeds(settings.seed, 2)[1]; } catch { return 'SKD-pembanding'; } });
  const [sampleCount, setSampleCount] = useState(10), [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const [result, setResult] = useState<{ runs: SeedRun[]; settings: Settings; scan: boolean } | null>(null), [rightIndex, setRightIndex] = useState(1);
  const [subtest, setSubtest] = useState('all'), [kind, setKind] = useState('all'), [rowIndex, setRowIndex] = useState(0), [page, setPage] = useState(0), [explanations, setExplanations] = useState(false);
  const [sourceSearch, setSourceSearch] = useState(''), [sourcePage, setSourcePage] = useState(0);
  const epoch = useRef(0), running = useRef(false);
  useEffect(() => () => { epoch.current++; }, []);
  const space = useMemo(() => { try { return { rows: variationSpace(normalizeSettings(settings)), error: '' }; } catch (e) { return { rows: [], error: (e as Error).message }; } }, [settings]);
  const sources = space.rows.filter((row) => (row.subtest + ' ' + row.topic + ' ' + row.name + ' ' + row.variables).toLowerCase().includes(sourceSearch.toLowerCase()));
  const compare = useMemo(() => result && result.runs.length > 1 ? compareSeeds(result.runs[0], result.runs[rightIndex]) : null, [result, rightIndex]);
  const scan = useMemo(() => result?.scan ? scanSummary(result.runs) : null, [result]);
  const visible = compare?.rows.map((row, i) => ({ row, i })).filter(({ row }) => (subtest === 'all' || row.b.q.subtest === subtest) && (kind === 'all' || row.kind === kind)) ?? [];
  const chosen = visible.find(({ i }) => i === rowIndex)?.row ?? visible[0]?.row;
  const varsA = chosen?.a ? questionVariables(chosen.a.q) : {}, varsB = chosen ? questionVariables(chosen.b.q) : {};
  const variableKeys = [...new Set([...Object.keys(varsA), ...Object.keys(varsB)])];
  const cancel = () => { epoch.current++; running.current = false; setBusy(false); setProgress('Pengujian dihentikan.'); };
  const run = async (scanMode: boolean) => {
    if (running.current) return;
    const token = ++epoch.current; running.current = true; setBusy(true); setError(''); setResult(null); setProgress('Memeriksa pengaturan…');
    try {
      const normalized = normalizeSettings({ ...settings, seed: seedA });
      const seeds = scanMode ? sequenceSeeds(normalized.seed, sampleCount) : [normalized.seed, normalizeSettings({ ...normalized, seed: seedB }).seed];
      checkScanBudget(normalized, seeds.length);
      const runs: SeedRun[] = [], cache = new Map<string, SeedRun['packages']>();
      for (const [index, seed] of seeds.entries()) {
        if (epoch.current !== token) return;
        setProgress('Menyusun seed ' + (index + 1) + '/' + seeds.length + ' · ' + seed);
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (epoch.current !== token) return;
        try {
          const packages = cache.get(seed) ?? generate({ ...normalized, seed });
          cache.set(seed, packages); runs.push({ seed, packages });
        } catch (e) { throw new Error('Seed ' + seed + ': ' + (e as Error).message); }
      }
      if (epoch.current !== token) return;
      setResult({ runs, settings: normalized, scan: scanMode }); setRightIndex(1); setRowIndex(0); setPage(0); setSubtest('all'); setKind('all'); setProgress('');
    } catch (e) { if (epoch.current === token) setError(e instanceof Error ? e.message : 'Perbandingan gagal.'); }
    finally { if (epoch.current === token) { running.current = false; setBusy(false); } }
  };
  return <div className="seed-explorer">
    <section className="panel seed-controls" aria-label="Pengaturan perbandingan seed">
      <div className="section-heading"><div><h2>Satu pengaturan, seed berbeda</h2><p>Seed dan pengaturan yang sama menghasilkan paket awal yang sama pada versi generator yang sama.</p></div><button className="text-button" disabled={busy} onClick={onConfigure}>Ubah pengaturan generator</button></div>
      <fieldset disabled={busy} className="seed-fields">
        <label className="field">Pengaturan yang dibandingkan<select value={basis} onChange={(e) => onBasis(e.target.value as 'generator' | 'workspace')}><option value="generator">Pengaturan di Buat paket</option><option value="workspace" disabled={!hasWorkspace}>Pengaturan paket tersimpan</option></select></label>
        <p className="seed-config">{settings.mode} · {settings.count} soal × {settings.packages} paket per seed · {settings.profile === 'tryout-2027' ? 'Standar tryout 2027' : 'Latihan bebas'} · {settings.difficulty}<br/>
          TWK: {settings.twkSource === 'new' ? 'model lokal' : 'bank'} · TKP: {settings.tkpSource === 'new' ? 'model lokal' : 'bank'} · TIU: {settings.profile === 'tryout-2027' ? settings.tiuSource === 'variation' ? 'variasi terhitung + acuan' : 'acuan + pola tersedia' : 'pola + bank sesuai filter'}</p>
        <div className="seed-input-grid">{([{ title: 'Seed A', value: seedA, set: setSeedA }, { title: 'Seed B', value: seedB, set: setSeedB }]).map((field) => <label className="field" key={field.title}>{field.title}<span className="seed-input"><input aria-label={field.title} maxLength={100} value={field.value} onChange={(e) => field.set(e.target.value)}/><button type="button" className="secondary-button" aria-label={'Acak ' + field.title} onClick={() => field.set(randomSeed())}><Icon name="refresh"/>Acak</button></span></label>)}</div>
        <div className="seed-run-actions"><button className="primary-button" onClick={() => run(false)}><Icon name="sliders"/>Bandingkan A dan B</button><label className="field">Jumlah seed uji<select value={sampleCount} onChange={(e) => setSampleCount(Number(e.target.value))}>{[5, 10, 20].map((count) => <option key={count} value={count}>{count} seed</option>)}</select></label><button className="secondary-button" onClick={() => run(true)}>Uji {sampleCount} seed dari A</button></div>
      </fieldset>
      <p className="help">Uji banyak seed memakai A sebagai awal. Seed angka dilanjutkan berurutan; seed teks diberi akhiran -uji-2, -uji-3, dan seterusnya. Hasil adalah pratinjau paket awal; suntingan pada paket tersimpan tidak ikut dibuat ulang.</p>
      <div className="seed-progress" role="status">{progress}{busy && <button className="text-button" onClick={cancel}>Hentikan pengujian</button>}</div>
      {error && <p className="error-message" role="alert">{error}</p>}
    </section>
    {scan && result && <section className="panel" aria-label="Hasil uji banyak seed"><h2>Seberapa sering isinya berulang?</h2><p><strong>{scan.unique} isi unik</strong> dari {scan.total} soal pada {result.runs.length} seed yang diuji. Pengacakan pilihan tidak menambah hitungan isi unik.</p><p className="help">Ini ukuran sampel yang diuji, bukan batas seluruh kemungkinan generator. “Tambahan” adalah isi yang belum muncul pada seed sebelumnya dalam uji ini.</p>
      <div className="table-scroll"><table className="seed-table"><thead><tr><th>Seed</th><th>Isi unik</th><th>Tambahan</th><th>Sama dengan A</th><th>Akumulasi isi unik</th><th>Lihat</th></tr></thead><tbody>{scan.rows.map((row, i) => <tr key={row.seed}><td>{row.seed}</td><td>{row.unique} / {row.total}</td><td>+{row.added}</td><td><span className="seed-meter"><span style={{ width: row.overlap + '%' }}/></span>{row.overlap}%</td><td>{row.cumulative}</td><td>{i === 0 ? 'Acuan A' : <button className="text-button" aria-pressed={rightIndex === i} onClick={() => { setRightIndex(i); setRowIndex(0); setPage(0); }}>Bandingkan</button>}</td></tr>)}</tbody></table></div>
    </section>}
    {compare && result && <section className="seed-comparison" aria-label="Hasil perbandingan seed">
      <div className="panel"><h2>{compare.overlap}% isi pada B juga ada di A</h2><p className="seed-result-label">A: <strong>{compare.a}</strong> · B: <strong>{compare.b}</strong> · {compare.total} soal pada B</p>
        <div className="seed-stat-grid">{(Object.keys(DIFFERENCE_LABELS) as DifferenceKind[]).map((item) => <div key={item}><strong>{compare.counts[item]}</strong><span>{DIFFERENCE_LABELS[item]}</span></div>)}</div>
        <p className="help">Isi dibandingkan berdasarkan stimulus, tabel/gambar, pilihan, serta kunci/poin. Isi sama dicari lintas nomor dan paket, kemudian sisanya dipasangkan menurut model, pola, atau chapter. Kategori ini mengikuti data pola yang tersedia, bukan penilaian kesamaan makna.</p>
        {compare.onlyA.length > 0 && <p className="help">{compare.onlyA.length} soal A tidak mendapat pasangan pada B.</p>}
        <div className="seed-input-grid"><label className="field">Filter subtes perbandingan<select value={subtest} onChange={(e) => { setSubtest(e.target.value); setPage(0); }}>{['all', 'TWK', 'TIU', 'TKP'].map((value) => <option key={value} value={value}>{value === 'all' ? 'Semua subtes' : value}</option>)}</select></label><label className="field">Jenis perbedaan<select value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}><option value="all">Semua perbedaan</option>{Object.entries(DIFFERENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <div className="table-scroll"><table className="seed-table"><thead><tr><th>Paket / nomor B</th><th>Materi</th><th>Hasil</th><th>Pasangan A</th><th>Detail</th></tr></thead><tbody>{visible.slice(page * 10, page * 10 + 10).map(({ row, i }) => <tr key={i} className={row === chosen ? 'seed-selected' : ''}><td>{row.b.packageId} / {row.b.q.no}</td><td>{row.b.q.subtest} · {row.b.q.subtopic}</td><td>{DIFFERENCE_LABELS[row.kind]}</td><td>{row.a ? row.a.packageId + ' / ' + row.a.q.no : 'Tidak ada'}</td><td><button className="text-button" aria-label={'Lihat perbedaan ' + row.b.packageId + ' nomor ' + row.b.q.no} onClick={() => setRowIndex(i)}>Lihat</button></td></tr>)}</tbody></table></div>
        {!visible.length && <p className="help">Tidak ada soal pada filter ini.</p>}
        <div className="pagination"><button disabled={!page} onClick={() => setPage(page - 1)}>Sebelumnya</button><span>{visible.length} pasangan · halaman {page + 1} / {Math.max(1, Math.ceil(visible.length / 10))}</span><button disabled={(page + 1) * 10 >= visible.length} onClick={() => setPage(page + 1)}>Berikutnya</button></div>
      </div>
      {chosen && <div className="panel seed-detail"><h2>Perubahan pada soal {chosen.b.q.no} · {chosen.b.packageId}</h2><p>{chosen.changed.length ? chosen.changed.join(' · ') : 'Isi, pilihan, dan pembahasan sama.'}{chosen.moved ? ' · Nomor atau paket berpindah' : ''}</p>
        <details open className="seed-variables"><summary>Variabel dan sumber pola</summary><div className="table-scroll"><table className="seed-table"><thead><tr><th>Variabel</th><th>Seed A</th><th>Seed B</th></tr></thead><tbody>{variableKeys.map((key) => <tr key={key} className={varsA[key] !== varsB[key] ? 'seed-variable-changed' : ''}><th>{key}</th><td>{varsA[key] || '—'}</td><td>{varsB[key] || '—'}</td></tr>)}</tbody></table></div></details>
        <label className="check-row"><input type="checkbox" checked={explanations} onChange={(e) => setExplanations(e.target.checked)}/><span>Tampilkan pembahasan kedua soal</span></label>
        <div className="seed-question-grid">{[{ label: 'A', seed: compare.a, entry: chosen.a }, { label: 'B', seed: compare.b, entry: chosen.b }].map(({ label, seed, entry }) => <section key={label} aria-label={'Soal seed ' + label}><div className="seed-question-title"><strong>{label} · {seed}</strong><button className="text-button" onClick={() => onUse({ ...result.settings, seed })}>Gunakan seed {label}</button></div>{entry ? <QuestionCard question={entry.q} showAnswers hideExplanation={!explanations}/> : <p className="help">Tidak ada butir pembanding pada chapter ini.</p>}</section>)}</div>
      </div>}
    </section>}
    <section className="panel" aria-label="Ruang variasi generator"><h2>Ruang variasi pada pengaturan ini</h2><p>{space.rows.filter((r) => r.kind === 'local').length} model lokal · {space.rows.filter((r) => r.kind === 'local').reduce((n, r) => n + (r.size ?? 0), 0)} kombinasi konteks dan kondisi · {space.rows.filter((r) => r.kind === 'parameter').length} kelompok pola berparameter.</p>
      <p className="help">Stok dan kombinasi mengikuti sumber, materi, serta kesulitan yang dipilih. Kuota, larangan pengulangan, dan validasi bisa mengurangi yang dapat dipakai dalam satu paket. Bank soal memiliki isi tetap; model lokal memiliki konteks/kondisi terbatas; pola TIU memiliki parameter dengan batas masing-masing.</p>
      {space.error && <p className="error-message">{space.error}</p>}
      <label className="field">Cari pola atau variabel<input type="search" value={sourceSearch} onChange={(e) => { setSourceSearch(e.target.value); setSourcePage(0); }} placeholder="Misalnya: TKP, rotasi, numerik, kewenangan"/></label>
      <div className="table-scroll"><table className="seed-table seed-source-table"><thead><tr><th>Subtes / pola</th><th>Sumber</th><th>Batas yang diketahui</th><th>Variabel yang dapat berubah</th></tr></thead><tbody>{sources.slice(sourcePage * 10, sourcePage * 10 + 10).map((row) => <tr key={row.subtest + row.id}><td><small>{row.subtest} · {row.topic}</small><strong>{row.name}</strong></td><td>{SOURCE_LABELS[row.kind]}</td><td>{row.size === null ? 'Total kombinasi belum dihitung' : row.size + (row.kind === 'local' ? ' kombinasi' : ' butir')}<p className="help">{row.limit}</p></td><td>{row.variables}</td></tr>)}</tbody></table></div>
      <div className="pagination"><button disabled={!sourcePage} onClick={() => setSourcePage(sourcePage - 1)}>Pola sebelumnya</button><span>{sources.length} sumber / kelompok pola</span><button disabled={(sourcePage + 1) * 10 >= sources.length} onClick={() => setSourcePage(sourcePage + 1)}>Pola berikutnya</button></div>
    </section>
  </div>;
}
