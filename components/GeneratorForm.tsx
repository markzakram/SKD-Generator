'use client';
import { useMemo, useState } from 'react';
import { BANK } from '@/lib/bank';
import { buildBlueprint, checkBlueprint, rowCapacity } from '@/lib/blueprint';
import { DESCRIPTIONS, LABELS, PRESET, TOPICS } from '@/lib/config';
import { normalizeSettings } from '@/lib/generate';
import { TIU_FAMILIES } from '@/lib/tiu';
import type { BlueprintRow, DifficultyFilter, Mode, Settings } from '@/lib/types';
import Icon from './Icon';

export default function GeneratorForm({ settings, onSettings, onGenerate, busy }: { settings: Settings; onSettings: (s: Settings) => void; onGenerate: (s: Settings) => void; busy: boolean }) {
  const [manual, setManual] = useState<BlueprintRow[] | null>(null), [mixed, setMixed] = useState(!!settings.composition);
  const update = (patch: Partial<Settings>) => { setManual(null); onSettings({ ...settings, ...patch, blueprint: undefined }); };
  const topics = settings.mode === 'SKD' ? Object.values(TOPICS).flat() : TOPICS[settings.mode];
  const subtopics = [...new Map([...BANK, ...TIU_FAMILIES.map((f) => ({ topic: f.topic, subtopic: f.name }))].filter((q) => topics.includes(q.topic) && (!settings.topics.length || settings.topics.includes(q.topic))).map((q) => [q.topic + '::' + q.subtopic, q])).entries()];
  const preview = useMemo(() => {
    try { const normalized = normalizeSettings({ ...settings, blueprint: undefined }); const rows = manual ?? buildBlueprint(normalized); return { rows, errors: checkBlueprint(rows, normalized) }; }
    catch (e) { return { rows: [] as BlueprintRow[], errors: [e instanceof Error ? e.message : 'Pengaturan belum valid.'] }; }
  }, [settings, manual]);
  const materials = [...new Map(preview.rows.map((row) => [row.subtest + row.topic, { subtest: row.subtest, topic: row.topic }])).values()];
  return <div className="generator-layout"><section className="panel generator-form" aria-label="Pengaturan generator">
    <div className="section-heading"><span className="step-dot">1</span><div><h2>Atur paket latihan</h2><p>Mulai dari kompetensi yang ingin dilatih.</p></div></div>
    <label className="field">Judul paket<input value={settings.title} maxLength={150} onChange={(e) => update({ title: e.target.value })}/></label>
    <fieldset><legend>Jenis paket</legend><div className="mode-grid">{(['SKD', 'TWK', 'TIU', 'TKP'] as Mode[]).map((mode) => <button key={mode} type="button" className={'mode-card ' + (settings.mode === mode ? 'selected' : '')} aria-pressed={settings.mode === mode}
      onClick={() => update({ mode, count: PRESET[mode], topics: [], subtopics: [], difficulty: 'campuran', composition: undefined })}><strong>{mode}</strong><span>{mode === 'SKD' ? 'Gabungan tiga subtes' : DESCRIPTIONS[mode].split(' dan ')[0]}</span></button>)}</div></fieldset>
    <fieldset><legend>Materi <span className="muted">· kosong berarti semua</span></legend><div className="chips">{topics.map((topic) => <button type="button" key={topic} aria-pressed={settings.topics.includes(topic)} className={settings.topics.includes(topic) ? 'chip selected' : 'chip'} onClick={() => update({ topics: settings.topics.includes(topic) ? settings.topics.filter((t) => t !== topic) : [...settings.topics, topic], subtopics: [] })}>{topic === 'Teknologi Informasi dan Komunikasi' ? 'Teknologi informasi' : topic}</button>)}</div></fieldset>
    <div className="field-pair"><label className="field">Soal per paket<input aria-label="Soal per paket" type="number" min={settings.mode === 'SKD' ? 3 : 1} max={200} value={settings.count} onChange={(e) => update({ count: Number(e.target.value) })}/></label>
      <label className="field">Kesulitan<select value={settings.difficulty} onChange={(e) => update({ difficulty: e.target.value as DifficultyFilter })}><option value="campuran">Campuran</option><option value="mudah">Mudah</option><option value="sedang">Sedang</option><option value="sulit">Sulit</option></select></label></div>
    {settings.difficulty === 'campuran' && <><label className="check-row"><input type="checkbox" checked={mixed && !!settings.composition} onChange={(e) => { setMixed(e.target.checked); update({ composition: e.target.checked ? { mudah: 25, sedang: 50, sulit: 25 } : undefined }); }}/><span>Tentukan persentase kesulitan</span></label>
      {settings.composition && <div className="composition-grid">{(['mudah', 'sedang', 'sulit'] as const).map((level) => <label className="field" key={level}>{LABELS[level]} %<input type="number" min={0} max={100} value={settings.composition![level]} onChange={(e) => update({ composition: { ...settings.composition!, [level]: Number(e.target.value) } })}/></label>)}</div>}</>}
    <details className="advanced"><summary><Icon name="sliders"/>Pengaturan lanjutan<Icon name="chevron"/></summary><div className="advanced-body">
      <div className="field-pair"><label className="field">Jumlah paket<input type="number" min={1} max={50} value={settings.packages} onChange={(e) => update({ packages: Number(e.target.value) })}/></label><label className="field">Durasi (menit)<input type="number" min={1} max={300} value={settings.duration} onChange={(e) => update({ duration: Number(e.target.value) })}/></label></div>
      <label className="field">Seed<input value={settings.seed} maxLength={100} onChange={(e) => update({ seed: e.target.value })}/><span className="help">Seed yang sama menghasilkan paket awal yang sama.</span></label>
      <label className="check-row"><input type="checkbox" checked={settings.uniqueAcross} onChange={(e) => update({ uniqueAcross: e.target.checked })}/><span>Hindari soal sama di paket berbeda</span></label>
      <fieldset><legend>Submateri khusus</legend><div className="subtopic-list">{subtopics.map(([key, q]) => <label className="check-row" key={key}><input type="checkbox" checked={settings.subtopics.includes(key)} onChange={(e) => update({ subtopics: e.target.checked ? [...settings.subtopics, key] : settings.subtopics.filter((s) => s !== key) })}/><span>{q.subtopic}<small>{q.topic}</small></span></label>)}</div></fieldset>
    </div></details>
    <button className="primary-button full-width generate-button" disabled={busy || !!preview.errors.length} onClick={() => onGenerate({ ...settings, blueprint: preview.rows })}><Icon name="spark"/>{busy ? 'Menyusun dan memeriksa…' : 'Buat paket untuk dikurasi'}<Icon name="arrow"/></button>
  </section><div className="blueprint-column"><section className="blueprint-hero"><span className="eyebrow">BLUEPRINT PAKET</span><h2>Komposisi yang jelas.<br/>Soal yang bisa ditinjau.</h2><p>Kuota di bawah menjadi acuan generator. Setiap soal dimulai sebagai draf untuk diperiksa oleh penelaah.</p><div className="hero-numbers"><div><strong>{settings.count}</strong><span>soal / paket</span></div><div><strong>{settings.packages}</strong><span>paket latihan</span></div><div><strong>{settings.duration}</strong><span>menit</span></div></div></section>
    <section className="panel"><div className="section-heading"><span className="step-dot">2</span><div><h2>Tinjau kuota materi</h2><p>{manual ? 'Kuota manual harus sesuai jumlah soal dan persediaan.' : 'Saran kuota mengikuti pilihan materi dan persediaan.'}</p></div></div>
      <div className="table-scroll blueprint-scroll"><table className="blueprint-table"><thead><tr><th>Materi</th><th>Mudah</th><th>Sedang</th><th>Sulit</th><th>Total</th></tr></thead><tbody>{materials.map((material) => <tr key={material.subtest + material.topic}><td><small>{material.subtest}</small>{material.topic === 'Teknologi Informasi dan Komunikasi' ? 'Teknologi informasi' : material.topic}</td>{(['mudah', 'sedang', 'sulit'] as const).map((difficulty) => {
        const row = preview.rows.find((r) => r.subtest === material.subtest && r.topic === material.topic && r.difficulty === difficulty) ?? { ...material, difficulty, count: 0 };
        const available = rowCapacity(settings, row);
        return <td key={difficulty}>{manual ? <input className="quota-input" aria-label={'Kuota ' + row.topic + ' ' + difficulty} disabled={!available || settings.difficulty !== 'campuran' && settings.difficulty !== difficulty} type="number" min={0} max={200} value={row.count} onChange={(e) => setManual(manual.map((r) => r.topic === row.topic && r.subtest === row.subtest && r.difficulty === difficulty ? { ...r, count: Number(e.target.value) } : r))}/> : <strong>{row.count || '—'}</strong>}<small>{material.subtest === 'TIU' ? (available ? 'pola' : '—') : '/ ' + available}</small></td>;
      })}<td><strong>{preview.rows.filter((r) => r.subtest === material.subtest && r.topic === material.topic).reduce((sum, r) => sum + r.count, 0)}</strong></td></tr>)}</tbody></table></div>
      <p className="help">Angka kecil menunjukkan persediaan tiap tingkat. Kuota berlaku untuk setiap paket.</p>
      {!preview.errors.length && <button className="text-button" onClick={() => setManual(manual ? null : materials.flatMap((material) => (['mudah', 'sedang', 'sulit'] as const).map((difficulty) => preview.rows.find((r) => r.subtest === material.subtest && r.topic === material.topic && r.difficulty === difficulty) ?? { ...material, difficulty, count: 0 })))}>{manual ? 'Gunakan saran kuota' : 'Sunting kuota secara manual'}</button>}
      {preview.errors.map((error) => <p key={error} className="error-message" role="alert">{error}</p>)}{manual && !!preview.errors.length && <button className="text-button" onClick={() => setManual(null)}>Reset kuota manual</button>}
      <p className="help">Kesulitan merupakan estimasi penulis. Bloom mencatat proses berpikir secara terpisah; keduanya ditinjau saat kurasi.</p>
    </section><div className="baseline-note"><Icon name="guide"/><p>Komposisi SKD 30 TWK, 35 TIU, 45 TKP dan 100 menit mengikuti baseline riset. Ketentuan resmi seleksi CPNS 2027 perlu diperbarui ketika diterbitkan.</p></div></div></div>;
}
