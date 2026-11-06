'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import GeneratorForm from '@/components/GeneratorForm';
import SeedExplorer from '@/components/SeedExplorer';
import Workbench from '@/components/Workbench';
import ExportDialog from '@/components/ExportDialog';
import ExportPanel from '@/components/ExportPanel';
import AnalysisPanel from '@/components/AnalysisPanel';
import PilotRunner from '@/components/PilotRunner';
import Icon from '@/components/Icon';
import TopBar from '@/components/TopBar';
import { BANK, bankStats } from '@/lib/bank';
import { DEFAULT_SETTINGS, KURASI_AKTIF, LABELS } from '@/lib/config';
import { generate, normalizeSettings } from '@/lib/generate';
import { auditPackages } from '@/lib/validate';
import { createWorkspace, exportPackages, exportScope, reviseWorkspace } from '@/lib/quality';
import { analyzePilots, validatePilot } from '@/lib/pilot';
import { exportPilot } from '@/lib/pilot-export';
import { download } from '@/lib/export';
import { readBackup } from '@/lib/backup';
import { deleteWorkspace, getWorkspace, listPilots, listWorkspaces, savePilot, saveWorkspace } from '@/lib/storage';
import { TIU_FAMILIES } from '@/lib/tiu';
import type { ExportFormat, PilotSession, Question, Settings, Workspace } from '@/lib/types';
import { PROFILE_SETTINGS } from '@/lib/tryout-profile';
import ReferenceLibrary from '@/components/ReferenceLibrary';
import LocalModelLibrary from '@/components/LocalModelLibrary';
import { replaceMessages, replaceQuestions } from '@/lib/replace';
import { SETTINGS_KEY, SETTINGS_VERSION, SETTINGS_VERSION_KEY, migrateStoredSettings } from '@/lib/prefs';

type Tab = 'seeds' | 'generator' | 'review' | 'history' | 'analysis' | 'bank' | 'guide';
const tabs: { id: Tab; label: string; icon: 'grid' | 'book' | 'clock' | 'sliders' | 'guide' | 'file' | 'refresh' }[] = [
  { id: 'generator', label: 'Buat paket', icon: 'grid' }, { id: 'review', label: KURASI_AKTIF ? 'Ruang kurasi' : 'Hasil paket', icon: 'book' },
  { id: 'seeds', label: 'Bandingkan seed', icon: 'refresh' },
  { id: 'history', label: 'Riwayat paket', icon: 'clock' }, { id: 'analysis', label: 'Evaluasi peserta', icon: 'sliders' },
  { id: 'bank', label: 'Pustaka soal', icon: 'file' }, { id: 'guide', label: 'Panduan', icon: 'guide' },
];
const titles: Record<Tab, [string, string]> = {
  seeds: ['Bandingkan seed dan ruang variasi.', 'Lihat perubahan isi, pilihan, serta variabel pola pada pengaturan yang sama.'],
  generator: ['Rancang latihan yang lebih terarah.', KURASI_AKTIF ? 'Susun blueprint, buat soal, lalu tinjau kualitasnya sebelum digunakan.' : 'Susun blueprint, buat paket, lalu periksa soalnya.'],
  review: KURASI_AKTIF ? ['Dari draf menjadi soal yang siap dipakai.', 'Periksa satu soal pada satu waktu. Simpan revisi dan keputusan penelaah.'] : ['Hasil paket.', 'Baca soal satu per satu, sunting atau ganti nomor yang kurang baik, lalu ekspor.'],
  history: ['Lanjutkan pekerjaan dari versi terakhir.', KURASI_AKTIF ? 'Paket dan riwayat kurasi tersimpan di browser ini. Cadangkan untuk memindahkan perangkat.' : 'Paket dan riwayat versi tersimpan di browser ini. Cadangkan untuk memindahkan perangkat.'],
  analysis: ['Lihat bagaimana soal bekerja pada peserta.', 'Evaluasi berdasarkan hasil pengerjaan yang cocok dengan versi soal.'],
  bank: ['Kenali materi dan pola dalam pustaka.', 'Referensi riset, kasus orisinal, dan pola TIU dengan pembuktian terstruktur.'],
  guide: ['Alur penyusunan yang dapat ditelusuri.', KURASI_AKTIF ? 'Dari riset dan blueprint sampai kurasi, uji peserta, dan ekspor.' : 'Dari riset dan blueprint sampai hasil paket, uji peserta, dan ekspor.'],
};
export default function Page() {
  // Sumber bawaan: TWK model lokal, TKP bank (kasus baru di data/tkp-kasus/). Jalur lokal TKP tetap bisa dipilih di form ("Penyusunan TKP").
  const [tab, setTab] = useState<Tab>('generator'), [settings, setSettings] = useState<Settings>({...DEFAULT_SETTINGS,...PROFILE_SETTINGS,twkSource:'new',tkpSource:'accepted'}), [workspace, setWorkspace] = useState<Workspace | null>(null), [history, setHistory] = useState<Workspace[]>([]), [sessions, setSessions] = useState<PilotSession[]>([]);
  const [active, setActive] = useState(0), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [saved, setSaved] = useState('Memuat penyimpanan…'), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reviewer, setReviewer] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null), [testing, setTesting] = useState(false), [bankFilter, setBankFilter] = useState('TWK'), [bankTopic, setBankTopic] = useState(''), [bankSearch, setBankSearch] = useState(''), [bankPage, setBankPage] = useState(0);
  const [seedBasis, setSeedBasis] = useState<'generator' | 'workspace'>('generator');
  const backupInput = useRef<HTMLInputElement>(null), pilotInput = useRef<HTMLInputElement>(null), initialized = useRef(false), saveSequence = useRef(0);
  const pack = workspace?.result.packages[active] ?? workspace?.result.packages[0];
  useEffect(() => {
    if (initialized.current) return; initialized.current = true;
    try { const prefs = localStorage.getItem(SETTINGS_KEY); if (prefs) setSettings(normalizeSettings({ ...migrateStoredSettings(JSON.parse(prefs), Number(localStorage.getItem(SETTINGS_VERSION_KEY) ?? 1)), blueprint: undefined })); setReviewer(localStorage.getItem('jadiasn-skd-reviewer') ?? ''); } catch { /* old preferences may be incompatible */ }
    Promise.all([listWorkspaces(), listPilots()]).then(([rows, pilots]) => {
      setHistory(rows); setSessions(pilots); if (rows[0]) { setWorkspace(rows[0]); setTab('review'); } setSaved('Tersimpan di perangkat ini');
    }).catch((e) => { setSaved('Penyimpanan belum tersedia'); setError(e.message); }).finally(() => setReady(true));
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); localStorage.setItem(SETTINGS_VERSION_KEY, String(SETTINGS_VERSION)); localStorage.setItem('jadiasn-skd-reviewer', reviewer); } catch { /* workspace save reports its own error */ } } }, [settings, reviewer, ready]);
  useEffect(() => {
    if (!workspace || !ready) return;
    const seq = ++saveSequence.current; setSaved('Menyimpan…');
    saveWorkspace(workspace).then(async () => { if (seq !== saveSequence.current) return; setSaved('Tersimpan di perangkat ini'); setHistory(await listWorkspaces()); }).catch((e) => { if (seq === saveSequence.current) { setSaved('Belum tersimpan'); setError(e.message); } });
  }, [workspace, ready]);
  const handleError = (e: unknown) => setError(e instanceof Error ? e.message : 'Proses belum berhasil.');
  const create = (input: Settings) => {
    setBusy(true); setError(''); setNotice('');
    setTimeout(() => { try { const settings = normalizeSettings(input), started = performance.now(), packages = generate(settings), audit = auditPackages(packages, settings); const next = createWorkspace({ settings, packages, audit, elapsed: performance.now() - started }); setWorkspace(next); setActive(0); setTab('review'); setNotice(KURASI_AKTIF ? 'Paket tersusun. Semua soal berstatus draf dan siap ditinjau.' : 'Paket tersusun: ' + packages.length + ' paket, ' + packages[0].questions.length + ' soal per paket.'); } catch (e) { handleError(e); } finally { setBusy(false); } }, 30);
  };
  const changeQuestion = (updated: Question, label: string) => {
    if (!workspace || !pack) return;
    const result = { ...workspace.result, packages: workspace.result.packages.map((p) => p.id === pack.id ? { ...p, questions: p.questions.map((q) => q.id === updated.id ? updated : q) } : p) };
    setWorkspace(reviseWorkspace(workspace, result, label)); setError(''); setNotice(label + ' tersimpan dalam riwayat versi.');
  };
  // Ganti satu atau beberapa nomor pada paket aktif (lib/replace.ts), berurutan: pengganti yang baru jadi ikut dihitung sebagai soal lain bagi nomor berikutnya.
  // Hasilnya satu versi workspace baru, jadi ikut tersimpan di IndexedDB dan bisa dipulihkan dari riwayat versi. Mengembalikan id soal yang berhasil diganti.
  const replaceIds = (ids: string[]) => {
    if (!workspace || !pack) return [];
    setError(''); setNotice('');
    try {
      const outcome = replaceQuestions(workspace.result, pack.id, ids, workspace.id + '-' + workspace.version), messages = replaceMessages(outcome);
      if (outcome.replaced.length) setWorkspace(reviseWorkspace(workspace, outcome.result, outcome.replaced.length === 1 ? 'Mengganti nomor ' + outcome.replaced[0].no : 'Mengganti ' + outcome.replaced.length + ' nomor (' + outcome.replaced.map((q) => q.no).join(', ') + ')'));
      setNotice(messages.notice); setError(messages.error);
      return outcome.replaced.map((q) => q.id);
    } catch (e) { handleError(e); return []; }
  };
  const replace = (q: Question) => { replaceIds([q.id]); };
  const backup = () => { if (workspace) download(new Blob([JSON.stringify({ ...workspace, pilotSessions: sessions.filter((s) => s.workspaceId === workspace.id) }, null, 2)], { type: 'application/json' }), 'cadangan-jadiasn-v' + workspace.version + '.json'); };
  const importBackup = async (file?: File) => {
    if (!file) return; setError('');
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('Cadangan maksimal 30 MB.');
      const text = await file.text(), imported = readBackup(text), current = await getWorkspace(imported.id);
      const next = current ? reviseWorkspace(current, imported.result, 'Memulihkan cadangan v' + imported.version) : imported;
      const raw = JSON.parse(text); const pilots = (Array.isArray(raw.pilotSessions) ? raw.pilotSessions : []).map((s: unknown) => validatePilot(s, next));
      await saveWorkspace(next); for (const s of pilots) await savePilot(s);
      setWorkspace(next); setActive(0); setTab('review'); setHistory(await listWorkspaces()); setSessions(await listPilots()); setNotice('Cadangan berhasil dimuat.');
    } catch (e) { handleError(e); } finally { if (backupInput.current) backupInput.current.value = ''; }
  };
  const importPilots = async (files: FileList | null) => {
    if (!files || !workspace) return; setError('');
    try {
      const validated: PilotSession[] = [];
      for (const file of Array.from(files)) { if (file.size > 5 * 1024 * 1024) throw new Error('Berkas hasil maksimal 5 MB.'); const data = JSON.parse(await file.text()); const records = Array.isArray(data) ? data : Array.isArray(data.sessions) ? data.sessions : [data]; if (records.length > 5000) throw new Error('Maksimal 5.000 sesi per impor.'); validated.push(...records.map((r: unknown) => validatePilot(r, workspace))); }
      const existing = new Set(sessions.map((s) => s.id)); for (const session of validated) if (!existing.has(session.id)) { await savePilot(session); existing.add(session.id); }
      setSessions(await listPilots()); setNotice('Hasil peserta diimpor; ID sesi yang sama tidak dihitung ulang.');
    } catch (e) { handleError(e); } finally { if (pilotInput.current) pilotInput.current.value = ''; }
  };
  const finishPilot = async (session: PilotSession) => {
    try { await savePilot(session); setSessions(await listPilots()); setTesting(false); setTab('analysis'); setNotice('Sesi selesai dan hasil tersimpan.'); }
    catch (e) { download(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }), 'hasil-uji-' + session.id + '.json'); setTesting(false); handleError(e); }
  };
  const filteredBank = useMemo(() => BANK.filter((q) => q.subtest === bankFilter && (!bankTopic || q.topic === bankTopic) && (q.stem + q.subtopic).toLowerCase().includes(bankSearch.toLowerCase())), [bankFilter, bankTopic, bankSearch]);
  const stats = bankStats();
  // Ruang kerja paket (Ruang kurasi / Hasil paket) memakai layar penuh dan sidebar rail hanya saat ruang kerjanya benar-benar tampil.
  const reviewMode = tab === 'review' && !testing && !!workspace && !!pack;
  const includedCount = pack ? pack.questions.filter((q) => !q.review?.excluded).length : 0;
  const approvedCount = pack ? pack.questions.filter((q) => !q.review?.excluded && q.review?.status === 'approved').length : 0;
  const showPackage = !!workspace && !!pack && !testing && ['review', 'analysis'].includes(tab);
  return <div className={reviewMode ? 'app-shell is-review' : 'app-shell'}><aside className="sidebar"><a href="#" className="brand" onClick={(e) => { e.preventDefault(); if (!testing) setTab('generator'); }} aria-label="JadiASN SKD Studio"><span className="brand-mark">J<span>A</span></span><div><strong>JadiASN<span>SKD Studio</span></strong><small>Ruang kerja penyusun soal</small></div></a>
    <span className="nav-label">RUANG KERJA</span><nav>{tabs.map((item) => <button key={item.id} disabled={testing} className={tab === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setTab(item.id); setError(''); setNotice(''); }}><Icon name={item.icon}/><span>{item.label}</span>{item.id === 'review' && workspace && KURASI_AKTIF && <span className="nav-count">{approvedCount}</span>}</button>)}</nav>
    <div className="sidebar-bottom"><span className="brand-dot"/><strong>Workspace lokal</strong><p>Paket dan hasil peserta tersimpan di browser ini. Unduh cadangan untuk memindahkannya.</p><button className="sidebar-link" disabled={!workspace || testing} onClick={backup}><Icon name="download" size={16}/><span className="sidebar-link-label">Unduh cadangan workspace</span></button></div>
  </aside><main className="main-content"><TopBar crumb={testing ? ['Evaluasi peserta', 'Sesi pengerjaan'] : [tabs.find((t) => t.id === tab)?.label ?? '']} detail={showPackage && workspace && pack ? workspace.name + ' · v' + workspace.version + ' · ' + pack.questions.length + ' soal · ' + pack.duration + ' menit' : undefined} showPackage={showPackage} packages={workspace?.result.packages ?? []} active={active} onActive={setActive} approved={approvedCount} included={includedCount} onBackup={backup} onExport={() => setExporting('pdf')} saved={saved}/>
    <div className="page-content">{tab === 'review' && !testing ? <h1 className="sr-only">{KURASI_AKTIF ? 'Ruang kurasi' : 'Hasil paket'}</h1> : <div className="page-title"><h1>{testing ? 'Sesi pengerjaan peserta' : titles[tab][0]}</h1><p>{testing ? 'Pilihan dan waktu dicatat untuk evaluasi paket.' : titles[tab][1]}</p></div>}
      {error && <div className="error-message global-message" role="alert"><p>{error}</p><button className="icon-button" aria-label="Tutup pesan kesalahan" onClick={() => setError('')}><Icon name="close"/></button></div>}{notice && <div className="notice-message global-message" role="status"><Icon name="check"/><p>{notice}</p><button className="icon-button" aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}><Icon name="close"/></button></div>}
      {!ready && <p className="help">Memuat paket tersimpan…</p>}
      {testing && workspace && pack ? <PilotRunner workspace={workspace} pack={exportPackages(workspace.result, exportScope('approved'), active)[0]} onClose={() => setTesting(false)} onFinish={finishPilot}/> : <>
      {tab === 'generator' && <GeneratorForm settings={settings} onSettings={setSettings} onGenerate={create} busy={busy} onCompare={(input) => { setSettings(input); setSeedBasis('generator'); setTab('seeds'); }}/>}
      {tab === 'seeds' && <SeedExplorer key={seedBasis} settings={seedBasis === 'workspace' && workspace ? workspace.result.settings : settings} basis={seedBasis} hasWorkspace={!!workspace} onBasis={setSeedBasis} onConfigure={() => { if (seedBasis === 'workspace' && workspace) setSettings(workspace.result.settings); setTab('generator'); }} onUse={(input) => { setSettings(input); setTab('generator'); setNotice('Seed ' + input.seed + ' diterapkan. Tekan Buat paket untuk menyimpannya sebagai paket baru.'); }}/>}
      {['review', 'analysis'].includes(tab) && (!workspace || !pack) && <section className="empty-state"><div className="empty-icon"><Icon name="book" size={36}/></div><h2>Mulai dengan satu paket latihan.</h2><p>Susun blueprint baru atau impor paket yang pernah dikerjakan.</p><div className="dialog-actions"><button className="secondary-button" onClick={() => backupInput.current?.click()}>Impor cadangan</button><button className="primary-button" onClick={() => setTab('generator')}>Buat paket pertama</button></div></section>}
      {tab === 'review' && workspace && pack && <ExportPanel pack={pack} seed={workspace.result.settings.seed} onExport={setExporting} onCompare={() => { setSeedBasis('workspace'); setTab('seeds'); }}/>}
      {tab === 'review' && workspace && pack && <Workbench key={workspace.id + ':' + pack.id} pack={pack} blueprint={workspace.result.settings.blueprint} settings={workspace.result.settings} title={workspace.result.settings.title} reviewer={reviewer} onReviewer={setReviewer} onChange={changeQuestion} onReplace={replace} onReplaceMany={replaceIds}/>}
      {tab === 'analysis' && workspace && pack && <AnalysisPanel workspace={workspace} pack={pack} sessions={sessions} onStart={() => { try { exportPackages(workspace.result, exportScope('approved'), active); setTesting(true); } catch (e) { handleError(e); } }} onShare={() => { try { exportPilot(workspace, pack); } catch (e) { handleError(e); } }} onImport={() => pilotInput.current?.click()} onDownload={() => download(new Blob([JSON.stringify({ sessions: sessions.filter((s) => s.workspaceId === workspace.id && s.packageId === pack.id), analysis: analyzePilots(workspace, pack, sessions) }, null, 2)], { type: 'application/json' }), 'evaluasi-' + pack.id + '.json')}/>}
      {tab === 'history' && <><div className="history-toolbar"><p className="help">{history.length} paket tersimpan di perangkat ini.</p><button className="secondary-button" onClick={() => backupInput.current?.click()}>Impor cadangan JSON</button></div><div className="history-grid">{history.map((w) => <article className="panel history-card" key={w.id}><span className="eyebrow">{w.result.settings.mode} · VERSI {w.version}</span><h2>{w.name}</h2><p>{w.result.packages.length} paket · {w.result.packages.flatMap((p) => p.questions).length} soal</p><span className="help">Terakhir disimpan {new Date(w.updatedAt).toLocaleString('id-ID')}</span><button className="primary-button" onClick={() => { setWorkspace(w); setActive(0); setTab('review'); }}>{KURASI_AKTIF ? 'Lanjutkan kurasi' : 'Buka paket'}<Icon name="arrow"/></button><details><summary>Riwayat versi ({w.snapshots.length})</summary><div className="version-list">{[...w.snapshots].reverse().map((s, i) => <div key={s.version + ':' + i}><p><strong>v{s.version}</strong> · {s.label}<small>{new Date(s.at).toLocaleString('id-ID')}</small></p><button className="text-button" onClick={() => { setWorkspace(reviseWorkspace(w, s.result, 'Memulihkan versi ' + s.version)); setActive(0); setTab('review'); setNotice('Versi lama dipulihkan sebagai versi baru.'); }}>Pulihkan</button></div>)}</div></details><button className="text-button danger" onClick={async () => { try { download(new Blob([JSON.stringify({ ...w, pilotSessions: sessions.filter((s) => s.workspaceId === w.id) }, null, 2)], { type: 'application/json' }), 'arsip-sebelum-hapus-' + w.id + '.json'); await deleteWorkspace(w.id); if (workspace?.id === w.id) setWorkspace(null); setHistory(await listWorkspaces()); setNotice('Paket dihapus dari riwayat; cadangan diunduh terlebih dahulu.'); } catch (e) { handleError(e); } }}>Hapus & unduh cadangan</button></article>)}</div>{!history.length && <section className="empty-state small"><h2>Belum ada paket tersimpan.</h2><p>{KURASI_AKTIF ? 'Buat paket pertama untuk memulai riwayat kurasi.' : 'Buat paket pertama untuk memulai riwayat paket.'}</p><button className="primary-button" onClick={() => setTab('generator')}>Buat paket</button></section>}</>}
      {tab === 'bank' && <><LocalModelLibrary/><ReferenceLibrary/><div className="bank-stats">{stats.map((s) => <article className="panel" key={s.subtest}><span className="eyebrow">{s.subtest}</span><strong>{s.count} butir</strong><p>{s.accepted} contoh tryout · {s.count-s.accepted} pustaka sebelumnya</p></article>)}</div><section className="panel"><div className="bank-toolbar"><select aria-label="Subtes pustaka" value={bankFilter} onChange={(e) => { setBankFilter(e.target.value); setBankTopic(''); setBankPage(0); }}>{['TWK', 'TIU', 'TKP'].map((s) => <option key={s}>{s}</option>)}</select><select aria-label="Materi pustaka" value={bankTopic} onChange={(e) => { setBankTopic(e.target.value); setBankPage(0); }}><option value="">Semua materi</option>{[...new Set(BANK.filter((q) => q.subtest === bankFilter).map((q) => q.topic))].map((t) => <option key={t}>{t}</option>)}</select><input aria-label="Cari pustaka" placeholder="Cari contoh atau submateri" value={bankSearch} onChange={(e) => { setBankSearch(e.target.value); setBankPage(0); }}/></div>
        {bankFilter === 'TIU' ? <div className="family-grid">{TIU_FAMILIES.map((f) => <div key={f.id}><span>{f.topic}</span><h3>{f.name}</h3><p>{f.levels.map((l) => LABELS[l]).join(' · ')}</p></div>)}</div> : <><div className="bank-list">{filteredBank.slice(bankPage * 10, (bankPage + 1) * 10).map((q) => <details key={q.id}><summary><span className={'tag tag-' + q.subtest.toLowerCase()}>{q.topic}</span><strong>{q.subtopic}</strong><span>{LABELS[q.difficulty]}</span></summary><p className="question-stem">{q.stem}</p><ol className="bank-options" type="A">{q.options.map((o, i) => <li key={i}>{o.text}{q.subtest === 'TKP' ? ' · ' + o.score + ' poin' : i === q.answer ? ' · Kunci' : ''}</li>)}</ol><p>{q.explanation}</p><p className="source-note">{q.source}</p></details>)}</div><div className="pagination"><button disabled={!bankPage} onClick={() => setBankPage(bankPage - 1)}>Sebelumnya</button><span>{filteredBank.length} butir · Halaman {bankPage + 1}</span><button disabled={(bankPage + 1) * 10 >= filteredBank.length} onClick={() => setBankPage(bankPage + 1)}>Berikutnya</button></div></>}</section><p className="help">{KURASI_AKTIF ? 'Pustaka dan hasil solver merupakan bahan kurasi. Status disetujui diberikan oleh penelaah pada paket, bukan oleh generator.' : 'Pustaka dan hasil solver merupakan bahan penyusunan. Periksa sendiri kebenaran soal sebelum dipakai; generator tidak mengesahkan kualitas akademiknya.'}</p></>}
      {tab === 'guide' && <div className="guide-layout"><section className="panel"><h2>Enam langkah menyusun paket</h2>{(KURASI_AKTIF ? ['Pilih subtes, materi, jumlah, dan kesulitan. Tinjau atau sunting kuota blueprint.', 'Buat paket. Soal draf diperiksa dari struktur, skor, duplikasi, dan model pembuktian yang tersedia.', 'Tinjau stimulus, pengecoh, kunci, pembahasan, sumber, dan rubrik. Sunting, ganti, tandai, atau keluarkan soal.', 'Isi identitas penelaah dan catatan. Setujui per soal setelah pemeriksaan; suntingan konten membatalkan persetujuan.', 'Uji soal disetujui pada peserta. Bagikan HTML tanpa kunci, lalu impor hasil JSON. Periksa statistik berdasarkan versi soal.', 'Ekspor soal disetujui atau draf berlabel. Cadangkan paket beserta riwayat versi dan hasil peserta secara berkala.'] :
        ['Pilih subtes, materi, jumlah, dan kesulitan. Tinjau atau sunting kuota blueprint.', 'Buat paket. Soal diperiksa dari struktur, skor, duplikasi, dan model pembuktian yang tersedia.', 'Di Hasil paket, baca stimulus, pengecoh, kunci, pembahasan, sumber, dan rubrik. Sunting soal, atau ganti nomor yang kurang baik: satu per satu atau banyak sekaligus.', 'Periksa sendiri kebenaran soal. Suntingan dan penggantian tersimpan sebagai versi baru dan bisa dipulihkan dari Riwayat paket.', 'Uji soal pada peserta. Bagikan HTML tanpa kunci, lalu impor hasil JSON. Periksa statistik berdasarkan versi soal.', 'Di panel Unduh paket, pilih PDF untuk naskah cetak atau Word SiAdu untuk input soal. Word SiAdu dipisah per subtes; beberapa berkas dikemas dalam ZIP. Pilih Format lainnya untuk Word biasa, CSV, atau JSON. Cadangkan paket beserta riwayat versi dan hasil peserta secara berkala.']).map((text, i) => <div className="guide-step" key={i}><span className="step-dot">{i + 1}</span><p>{text}</p></div>)}</section><section className="panel"><h2>Dasar kualitas soal</h2><p>Kesulitan menilai kompleksitas tugas, sementara Bloom menggambarkan proses berpikir. Label HOTS dari versi lama dinormalisasi menjadi sulit dan perlu ditelaah.</p><p>Soal TWK memakai prinsip atau fakta yang relevan, TIU menggunakan pengecoh dari kesalahan penalaran dan perhitungan, TKP membandingkan tindakan melalui kewenangan, urgensi, efektivitas, risiko, dan tindak lanjut.</p><p>Solver membuktikan model terstruktur, bukan seluruh penafsiran bahasa alami. Model lokal TWK/TKP memeriksa konsistensi kondisi, kunci, dan alasan; penilaian substansinya tetap dilakukan {KURASI_AKTIF ? 'penelaah' : 'pengguna'}. Pilih Soal baru pada sumber TWK atau TKP. Periksa cakupan model di Pustaka soal. Soal hasil suntingan harus diverifikasi ulang. {KURASI_AKTIF ? 'Persetujuan dicatat atas nama penelaah yang mengerjakannya.' : 'Kebenaran soal diperiksa oleh pengguna; aplikasi tidak memberi status persetujuan.'}</p><h3>Referensi</h3><ul><li>Riset Seleksi CPNS 2027 JadiASN, khususnya bab 5.</li><li><a href="https://drive.google.com/file/d/1tzx3GR5GSYtkuTkR1kXfDqyUsao2jXiP/view" target="_blank" rel="noreferrer">Contoh TIU dari riset</a></li><li><a href="https://drive.google.com/file/d/1NgyWaSFh7oL_Sfjkw37LvxiZCOFQw7P_/view" target="_blank" rel="noreferrer">Panduan TKP JadiASN</a></li><li><a href="https://www.dpr.go.id/dokumen/jdih/undang-undang-dasar" target="_blank" rel="noreferrer">UUD NRI 1945 — DPR RI</a></li><li><a href="https://ejaan.kemendikdasmen.go.id/eyd/" target="_blank" rel="noreferrer">EYD V — Badan Bahasa</a></li></ul><p className="help">Baseline riset tidak menyatakan aturan resmi CPNS 2027. Skor kasus TKP orisinal adalah rubrik latihan, bukan kunci resmi BKN.</p></section><section className="panel"><h2>Penyimpanan dan penggunaan</h2><p>Aplikasi dapat dijalankan di Vercel tanpa API key. Riwayat paket dan hasil peserta disimpan dengan IndexedDB pada browser dan domain yang sama. Data tidak tersinkron antarperangkat atau pengguna.</p><p>Berkas cadangan JSON menyertakan versi dan hasil uji. Impor memeriksa struktur, skor, dan model soal. Simpan cadangan sebelum membersihkan data browser atau berpindah domain.</p><p>Berkas uji HTML dapat dibuka peserta tanpa instalasi. Hasil peserta dikirim sebagai JSON untuk diimpor penyusun; pengumpulan belum menggunakan basis data bersama.</p></section></div>}
      </>}
      <footer className="page-footer"><span>JadiASN SKD Studio</span><span>Susun · Tinjau · Uji</span></footer>
    </div>
  </main><input type="file" ref={backupInput} accept=".json,application/json" hidden onChange={(e) => importBackup(e.target.files?.[0])}/><input type="file" ref={pilotInput} accept=".json,application/json" multiple hidden onChange={(e) => importPilots(e.target.files)}/>{exporting && workspace && <ExportDialog result={workspace.result} active={active} initialFormat={exporting} onClose={() => setExporting(null)}/>}</div>;
}
