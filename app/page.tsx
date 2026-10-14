'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import QuestionCard from '@/components/QuestionCard';
import ExportDialog from '@/components/ExportDialog';
import { BANK, bankStats } from '@/lib/bank';
import { BASELINE, DEFAULT_SETTINGS, DESCRIPTIONS, LABELS, PRESET, TOPICS } from '@/lib/config';
import { capacity, distribution, generate, normalizeSettings } from '@/lib/generate';
import { auditPackages } from '@/lib/validate';
import { TIU_FAMILIES } from '@/lib/tiu';
import type { DifficultyFilter, Mode, Result, Settings, Subtest } from '@/lib/types';

const storageKey = 'jadiasn-skd-settings-v1';
const modes: Mode[] = ['SKD', 'TWK', 'TIU', 'TKP'];
const names: Record<Mode, string> = { SKD: 'SKD lengkap', TWK: 'TWK', TIU: 'TIU', TKP: 'TKP' };

export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<Result | null>(null);
  const [tab, setTab] = useState<'generator' | 'bank' | 'guide'>('generator');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [active, setActive] = useState(0), [showAnswers, setShowAnswers] = useState(false);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
  const [exportOpen, setExportOpen] = useState(false);
  const initialized = useRef(false);
  const update = (patch: Partial<Settings>) => setSettings((previous) => ({ ...previous, ...patch }));

  async function run(value: Settings) {
    setBusy(true); setError('');
    await new Promise((resolve) => setTimeout(resolve, 25));
    try {
      const normalized = normalizeSettings(value);
      const started = performance.now();
      const packages = generate(normalized);
      const audit = auditPackages(packages, normalized);
      setResult({ settings: normalized, packages, audit, elapsed: Math.round(performance.now() - started) });
      setActive(0); setSearch(''); setFilter('all');
      try { localStorage.setItem(storageKey, JSON.stringify(normalized)); } catch { /* Generation remains usable when storage is blocked. */ }
    } catch (e) { setError(e instanceof Error ? e.message : 'Paket tidak dapat dibuat.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let initial = DEFAULT_SETTINGS;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) initial = normalizeSettings(JSON.parse(saved));
    } catch { /* Fall back to the documented preset. */ }
    setSettings(initial); void run(initial);
  }, []);

  const requested = useMemo(() => distribution(settings.mode, settings.count), [settings.mode, settings.count]);
  const stock = useMemo(() => capacity(settings), [settings]);
  const availableTopics = settings.mode === 'SKD' ? Object.values(TOPICS).flat() : TOPICS[settings.mode];
  const availableSubtopics = [...new Set([
    ...BANK.filter((item) => (settings.mode === 'SKD' || item.subtest === settings.mode) &&
      (!settings.topics.length || settings.topics.includes(item.topic))).map((item) => item.topic + '::' + item.subtopic),
    ...(settings.mode === 'SKD' || settings.mode === 'TIU' ? TIU_FAMILIES.filter((family) =>
      !settings.topics.length || settings.topics.includes(family.topic)).map((family) => family.topic + '::' + family.name) : []),
  ])];
  const current = result?.packages[active];
  const visible = current?.questions.filter((q) => (filter === 'all' || q.subtest === filter) &&
    (q.stem + ' ' + q.topic + ' ' + q.subtopic).toLowerCase().includes(search.toLowerCase())) ?? [];
  const dirty = result ? JSON.stringify(settings) !== JSON.stringify(result.settings) : false;
  const total = result?.audit.checked ?? 0;
  const maximum = current?.questions.reduce((sum, q) => sum + Math.max(...q.options.map((option) => option.score)), 0) ?? 0;

  const setMode = (mode: Mode) => update({ mode, count: PRESET[mode], topics: [], subtopics: [], duration: mode === 'SKD' ? 100 : mode === 'TKP' ? 35 : 30 });
  const toggleTopic = (topic: string) => {
    const selected = settings.topics.length ? settings.topics : availableTopics;
    const next = selected.includes(topic) ? selected.filter((item) => item !== topic) : [...selected, topic];
    if (next.length) update({ topics: next.length === availableTopics.length ? [] : next, subtopics: [] });
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="JadiASN SKD Studio">
        <span className="brand-symbol"><Icon name="grid" size={25}/></span>
        <span><strong>JadiASN<span className="brand-dot">.</span></strong><small>SKD STUDIO</small></span>
      </a>
      <div className="sidebar-section-label">RUANG KERJA</div>
      <nav className="main-nav" aria-label="Navigasi utama">
        <button className={tab === 'generator' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('generator')}><Icon name="sliders"/><span>Generator soal</span><span className="nav-mark"/></button>
        <button className={tab === 'bank' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('bank')}><Icon name="book"/><span>Bank & cakupan</span></button>
        <button className={tab === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => setTab('guide')}><Icon name="guide"/><span>Panduan penggunaan</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-illustration" aria-hidden="true"><span>TWK</span><span>TIU</span><span>TKP</span></div>
        <strong>Satu studio, tiga kompetensi.</strong><p>Susun latihan dengan materi dan pembahasan yang terarah.</p>
        <div className="sidebar-footer"><span className="status-dot"/>Riset CPNS 2027<span className="version">v1.0</span></div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">JadiASN <span>/</span> SKD Studio <span>/</span><strong>{tab === 'generator' ? 'Generator' : tab === 'bank' ? 'Bank soal' : 'Panduan'}</strong></div>
        <div className="topbar-right"><span className="research-badge">BERBASIS RISET</span><span className="avatar">JA</span></div></header>
      <main className="main-content">
        <div className="page-heading">
          <div><div className="eyebrow">GENERATOR SOAL · CPNS 2027</div><h1>{tab === 'generator' ? 'Susun paket soal SKD.' : tab === 'bank' ? 'Kenali isi bank soal.' : 'Dari pengaturan ke naskah.'}</h1>
            <p>{tab === 'generator' ? 'Pilih kompetensi, atur paket, lalu tinjau hasilnya sebelum digunakan.' : tab === 'bank' ? 'Lihat sumber, persediaan kasus, dan pola yang tersedia.' : 'Buat latihan yang sesuai, lengkap dengan kunci dan pembahasan.'}</p></div>
          {tab === 'generator' && <button className="secondary-button" disabled={!result || busy} onClick={() => setExportOpen(true)}><Icon name="download"/>Unduh paket</button>}
        </div>
        {tab === 'generator' ? <>
          <div className="competency-strip" aria-label="Pilih jenis paket">
            {modes.map((mode) => <button key={mode} className={'competency-card ' + (settings.mode === mode ? 'selected' : '')} onClick={() => setMode(mode)} aria-pressed={settings.mode === mode}>
              <span className={'competency-icon mode-' + mode.toLowerCase()}><Icon name={mode === 'SKD' ? 'grid' : mode === 'TWK' ? 'book' : mode === 'TIU' ? 'spark' : 'guide'}/></span>
              <span><strong>{names[mode]}</strong><small>{mode === 'SKD' ? 'Tiga subtes dalam satu paket' : mode === 'TWK' ? 'Wawasan kebangsaan' : mode === 'TIU' ? 'Intelegensia umum' : 'Karakteristik pribadi'}</small></span>
              <span className="radio-indicator">{settings.mode === mode && <span/>}</span>
            </button>)}
          </div>
          <div className="generator-layout">
            <section className="control-panel" aria-label="Pengaturan generator">
              <div className="panel-heading"><span className="section-icon"><Icon name="sliders"/></span><div><h2>Pengaturan paket</h2><p>Sesuaikan dengan kebutuhan latihan.</p></div></div>
              <form onSubmit={(e) => { e.preventDefault(); void run(settings); }}>
                <div className="field"><label htmlFor="title">Judul naskah</label><input id="title" value={settings.title} maxLength={150} onChange={(e) => update({ title: e.target.value })} required/></div>
                <div className="field-pair">
                  <div className="field"><label htmlFor="packages">Jumlah paket</label><input id="packages" type="number" min="1" max="50" value={settings.packages} onChange={(e) => update({ packages: Number(e.target.value) })} required/></div>
                  <div className="field"><label htmlFor="count">Soal per paket</label><input id="count" type="number" min={settings.mode === 'SKD' ? 3 : 1} max="200" value={settings.count} onChange={(e) => update({ count: Number(e.target.value) })} required/></div>
                </div>
                <div className="field-pair">
                  <div className="field"><label htmlFor="difficulty">Kesulitan</label><select id="difficulty" value={settings.difficulty} onChange={(e) => update({ difficulty: e.target.value as DifficultyFilter })}>
                    <option value="campuran">Campuran</option>{Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
                  <div className="field"><label htmlFor="duration">Durasi <span>(menit)</span></label><input id="duration" type="number" min="1" max="300" value={settings.duration} onChange={(e) => update({ duration: Number(e.target.value) })} required/></div>
                </div>
                <div className="field"><div className="label-line"><label htmlFor="seed">Seed paket</label><span>Naskah dapat dibuat ulang</span></div>
                  <div className="input-with-button"><input id="seed" value={settings.seed} maxLength={100} onChange={(e) => update({ seed: e.target.value })} required/>
                    <button type="button" aria-label="Buat seed baru" title="Buat seed baru" onClick={() => update({ seed: 'SKD-' + crypto.randomUUID().slice(0, 8).toUpperCase() })}><Icon name="refresh" size={16}/></button></div>
                </div>
                <div className="materials-heading"><label>Materi yang digunakan</label><button type="button" onClick={() => update({ topics: [], subtopics: [] })}>Pilih semua</button></div>
                <div className="material-list">{availableTopics.map((topic) => <label className="material-check" key={topic}>
                  <input type="checkbox" checked={!settings.topics.length || settings.topics.includes(topic)} onChange={() => toggleTopic(topic)}/><span>{topic === 'Teknologi Informasi dan Komunikasi' ? 'Teknologi informasi & komunikasi' : topic}</span>
                </label>)}</div>
                <details className="subtopic-control"><summary>Filter submateri<span>{settings.subtopics.length ? settings.subtopics.length + ' dipilih' : 'Semua'}</span><Icon name="chevron" size={13}/></summary>
                  <button type="button" className="clear-subtopics" onClick={() => update({ subtopics: [] })}>Gunakan semua submateri</button>
                  <div className="subtopic-list">{availableSubtopics.map((key) => <label className="material-check" key={key}>
                    <input type="checkbox" checked={settings.subtopics.includes(key)} onChange={() => update({ subtopics: settings.subtopics.includes(key) ?
                      settings.subtopics.filter((item) => item !== key) : [...settings.subtopics, key] })}/><span><small>{key.split('::')[0]}</small>{key.split('::')[1]}</span>
                  </label>)}</div>
                </details>
                <label className="check-row unique-setting"><input type="checkbox" checked={settings.uniqueAcross} onChange={(e) => update({ uniqueAcross: e.target.checked })}/>
                  <span><strong>Tanpa soal berulang antarpaket</strong><small>Pengulangan dalam satu paket selalu dicegah.</small></span></label>
                <div className="request-summary"><span>Komposisi per paket</span><div>{Object.entries(requested).filter(([, count]) => count > 0).map(([subtest, count]) =>
                  <span key={subtest}><i className={'color-dot dot-' + subtest.toLowerCase()}/>{subtest}<strong>{count}</strong></span>)}</div></div>
                <button className="primary-button full-width" type="submit" disabled={busy}><Icon name={busy ? 'refresh' : 'spark'}/>{busy ? 'Menyusun paket…' : 'Buat paket soal'}<Icon name="arrow" size={17}/></button>
                <p className="control-footnote">{stock.length ? stock.map((entry) => entry.subtest + ': ' + entry.available + ' butir tersedia').join(' · ') : 'TIU dirakit dari pola berparameter.'}</p>
              </form>
            </section>
            <div className="results-column">
              {error && <div className="error-message" role="alert"><strong>Paket belum dapat dibuat</strong><p>{error}</p>{result && <small>Pratinjau di bawah masih menampilkan hasil terakhir.</small>}</div>}
              {result && current ? <>
                <div className="metrics-grid">
                  <div className="metric"><span>Total soal</span><div><strong>{total}</strong><small>dalam {result.packages.length} paket</small></div><Icon name="file" size={19}/></div>
                  <div className="metric"><span>Skor maksimal</span><div><strong>{maximum}</strong><small>per paket aktif</small></div><Icon name="spark" size={19}/></div>
                  <div className="metric"><span>Durasi latihan</span><div><strong>{current.duration}<em>menit</em></strong><small>{current.questions.length} soal per paket</small></div><Icon name="clock" size={19}/></div>
                </div>
                <div className="validation-line"><span><span className="validated-icon"><Icon name="check" size={12}/></span>{result.audit.checked} soal lolos pemeriksaan struktur & pola</span>
                  <span>{result.audit.duplicateCount} duplikat · {result.elapsed} ms</span></div>
                {dirty && <p className="pending-settings">Pengaturan berubah. Klik “Buat paket soal” untuk menerapkannya pada hasil.</p>}
                <section className="preview-panel">
                  <div className="preview-heading"><div><span className="eyebrow">HASIL GENERATE</span><h2>Pratinjau paket</h2></div>
                    <label className="answer-toggle"><input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)}/><span className="toggle-track"/><span>Tampilkan kunci</span></label></div>
                  <div className="package-tabs" aria-label="Paket hasil">{result.packages.map((pack, index) => <button key={pack.id} className={active === index ? 'active' : ''}
                    onClick={() => setActive(index)} aria-pressed={active === index}>Paket {String(index + 1).padStart(2, '0')}<span>{pack.questions.length}</span></button>)}</div>
                  <div className="preview-toolbar"><div className="search-field"><Icon name="search" size={17}/><input aria-label="Cari soal dalam paket" placeholder="Cari soal atau materi…" value={search} onChange={(e) => setSearch(e.target.value)}/></div>
                    <select aria-label="Filter subtes pratinjau" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">Semua subtes</option>
                      {(['TWK', 'TIU', 'TKP'] as const).filter((subtest) => current.questions.some((q) => q.subtest === subtest)).map((subtest) => <option key={subtest}>{subtest}</option>)}</select>
                  </div>
                  <div className="preview-meta"><span>{visible.length} soal ditampilkan</span><span>Seed <code>{current.seed}</code></span></div>
                  <div className="question-list">{visible.map((question) => <QuestionCard key={question.id} question={question} showAnswers={showAnswers}/>)}
                    {!visible.length && <div className="empty-state"><Icon name="search" size={30}/><h3>Tidak ada soal yang cocok.</h3><p>Coba kata kunci lain atau ubah filter subtes.</p></div>}</div>
                </section>
                <div className="result-footer"><span>Sebaran kunci {result.audit.keyDistribution.map((n, i) => String.fromCharCode(65 + i) + ': ' + n).join(' · ')}</span>
                  <button onClick={() => setExportOpen(true)}>Unduh hasil <Icon name="arrow" size={15}/></button></div>
              </> : <div className="empty-state preparing"><span className="empty-symbol"><Icon name="grid" size={30}/></span><h2>{busy ? 'Paket sedang disusun.' : 'Paketmu dimulai dari sini.'}</h2>
                <p>{busy ? 'Menyiapkan soal dan memeriksa hasilnya.' : 'Atur materi di sebelah kiri, lalu buat paket pertama.'}</p></div>}
            </div>
          </div>
        </> : tab === 'bank' ? <section className="information-panel">
          <div className="bank-overview">{bankStats().map((item) => <div key={item.subtest}><span className={'tag tag-' + item.subtest.toLowerCase()}>{item.subtest}</span><strong>{item.count}</strong><p>butir dalam bank</p><small>{item.reference} contoh referensi + {item.count - item.reference} variasi kasus latihan</small></div>)}
            <div><span className="tag tag-tiu">TIU</span><strong>{TIU_FAMILIES.length}</strong><p>famili pola berparameter</p><small>Verbal, numerik, dan gambar figural</small></div></div>
          <h2>Cakupan materi</h2><p className="muted">Kasus dengan konteks berbeda dapat mengikuti kerangka yang sama. Angka persediaan adalah jumlah butir, bukan jumlah kompetensi atau kerangka unik.</p>
          <div className="coverage-grid">{(['TWK', 'TIU', 'TKP'] as const).map((subtest) => <div key={subtest}><h3>{subtest}</h3>
            {TOPICS[subtest].map((topic) => <div className="coverage-row" key={topic}><span>{topic}</span><strong>{subtest === 'TIU' ? TIU_FAMILIES.filter((family) => family.topic === topic).length + ' pola' : BANK.filter((item) => item.topic === topic).length + ' butir'}</strong></div>)}</div>)}</div>
          <h2>Sumber dan pemeriksaan konten</h2><p>TWK mengikuti Bab 5 riset JadiASN. TKP memakai panduan produksi dengan 23 submateri dan poin setiap alternatif. TIU mengikuti contoh verbal, numerik, kecukupan data, tabel, dan figural.</p>
          <p>Beberapa contoh TWK dikecualikan karena berulang, perlu verifikasi sejarah, atau berada pada klasifikasi berbeda. Pembahasan yang kosong dilengkapi dan label opsi yang bergeser diperbaiki.</p>
          <p>Pemeriksaan otomatis memeriksa struktur, skor, kunci, hitungan/logika yang dimodelkan, pola gambar, dan pengulangan. Ketepatan akademik setiap narasi tetap perlu ditinjau sebelum dipublikasikan sebagai bank produksi.</p>
          <p className="source-note">Preset {BASELINE.counts.TWK}/{BASELINE.counts.TIU}/{BASELINE.counts.TKP} soal dan {BASELINE.duration} menit berasal dari riset dengan acuan aturan {BASELINE.rulesYear}. Sesuaikan konfigurasi ketika ketentuan resmi CPNS 2027 tersedia.</p>
        </section> : <section className="information-panel guide-panel">
          <div className="guide-step"><span>01</span><div><h2>Pilih jenis dan materi latihan</h2><p>Pilih SKD lengkap, TWK, TIU, atau TKP. Materi dapat dipilih satu atau beberapa. Jumlah paket, soal, tingkat kesulitan, dan durasi dapat diubah.</p></div></div>
          <div className="guide-step"><span>02</span><div><h2>Buat dan periksa paket</h2><p>Seed yang sama dengan pengaturan yang sama menghasilkan naskah yang sama. Gunakan pencarian, filter subtes, serta kunci dan pembahasan untuk meninjau hasilnya.</p></div></div>
          <div className="guide-step"><span>03</span><div><h2>Simpan dalam format yang sesuai</h2><p>PDF untuk cetak, Word untuk penyuntingan, CSV untuk bank soal, dan JSON untuk data lengkap. Word dan PDF dapat berisi soal, kunci, atau pembahasan, serta dipisahkan per paket dalam ZIP.</p></div></div>
          <div className="guide-step"><span>04</span><div><h2>Perhatikan persediaan bank</h2><p>TWK dan TKP memakai bank terbatas. Jika permintaan melebihi persediaan, kurangi jumlah atau perluas filter. Mematikan pilihan unik antarpaket mengizinkan suatu soal muncul di paket berbeda; satu paket tetap bebas pengulangan.</p></div></div>
          <p className="source-note">Kesulitan dan level Bloom merupakan metadata berbeda. Filter tertentu dapat mempunyai persediaan lebih kecil. Generator menyusun naskah latihan dan belum menyediakan sesi pengerjaan CAT.</p>
        </section>}
        <footer className="workspace-footer"><span>JadiASN · SKD Studio</span><span>Latihan berdasarkan riset seleksi CPNS 2027</span></footer>
      </main>
    </div>
    {exportOpen && result && <ExportDialog result={result} active={active} onClose={() => setExportOpen(false)}/>}
  </div>;
}
