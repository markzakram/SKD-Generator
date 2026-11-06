'use client';
import { useMemo, useState } from 'react';
import { chapterTotal, MAPPING_ROWS, MAPPING_SOURCE, type MappingRow } from '@/lib/mapping';
import { chapterLimit } from '@/lib/tryout-profile';
import type { Settings } from '@/lib/types';
import Icon from './Icon';

const SUBTESTS = ['TWK', 'TIU', 'TKP'] as const;
const chapterName = (row: MappingRow) => row.chapter.replace('SKD_', '');
const searchText = (row: MappingRow) => [row.subtest, row.category, row.lesson, row.chapter].join(' ').toLowerCase();

// Jumlah soal per chapter pada standar tryout 2027 (Settings.chapterCounts): kotak angka dikelompokkan Subtes > Category > Lesson, dengan kolom cari dan maksimum tiap chapter menurut pengaturan aktif.
export default function ChapterCounts({ settings, onChange, onReset }: { settings: Settings; onChange: (counts: Record<string, number>) => void; onReset: () => void }) {
  const [query, setQuery] = useState('');
  const counts = settings.chapterCounts ?? {}, total = chapterTotal(counts);
  const { difficulty, packages, uniqueAcross, tiuSource, twkSource, tkpSource } = settings;
  // Maksimum hanya bergantung pada pengaturan ini, jadi tidak dihitung ulang tiap kali angka diketik.
  const limits = useMemo(() => new Map(MAPPING_ROWS.map((row) => [row.id, chapterLimit(row, { ...settings, difficulty, packages, uniqueAcross, tiuSource, twkSource, tkpSource })])), [difficulty, packages, uniqueAcross, tiuSource, twkSource, tkpSource]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = MAPPING_ROWS.filter((row) => words.every((word) => searchText(row).includes(word)));
  const setCount = (id: string, text: string) => {
    const value = Math.max(0, Math.trunc(Number(text)) || 0), next = { ...counts };
    if (value) next[id] = value; else delete next[id];
    onChange(next);
  };
  return <section className="panel quota-panel" id="jumlah-per-chapter" aria-label="Jumlah per chapter">
    <div className="section-heading"><div><h2>Jumlah per chapter</h2><p>Isi chapter yang dibutuhkan; yang kosong tidak ikut. Sumber, pembangkit, dan format mengikuti standar tryout 2027.</p></div></div>
    <div className="chapter-tools">
      <label className="field">Cari chapter<input type="search" aria-label="Cari chapter" placeholder="Misalnya silogisme atau jadwal" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
      <div className="chapter-total"><span><strong>{total}</strong> soal per paket · {SUBTESTS.filter((s) => MAPPING_ROWS.some((row) => row.subtest === s && counts[row.id] > 0)).map((s) => s + ' ' + MAPPING_ROWS.filter((row) => row.subtest === s).reduce((sum, row) => sum + (counts[row.id] ?? 0), 0)).join(' · ') || 'belum ada chapter terisi'}</span>
        <span className="chapter-actions"><button type="button" className="text-button" disabled={!total} onClick={() => onChange({})}>Kosongkan</button><button type="button" className="text-button" onClick={onReset}>Kembalikan saran mapping</button></span></div>
    </div>
    {SUBTESTS.map((subtest) => {
      const rows = shown.filter((row) => row.subtest === subtest);
      if (!rows.length) return null;
      const lessons = [...new Set(rows.map((row) => row.category + ' › ' + row.lesson))];
      return <details className="summary-detail chapter-group" key={subtest} open>
        <summary><Icon name="chevron" size={14}/><span className={'tag tag-' + subtest.toLowerCase()}>{subtest}</span><b>{MAPPING_ROWS.filter((row) => row.subtest === subtest).reduce((sum, row) => sum + (counts[row.id] ?? 0), 0)} soal</b></summary>
        {lessons.map((lesson) => <div key={lesson}><p className="chapter-lesson">{lesson}</p>
          {rows.filter((row) => row.category + ' › ' + row.lesson === lesson).map((row) => {
            const limit = limits.get(row.id)!, count = counts[row.id] ?? 0, over = count > limit.max;
            return <div className="chapter-row" key={row.id}>
              <label htmlFor={'chapter-' + row.id}>{chapterName(row)}<small>maks {limit.max}{limit.max < 200 ? ' · ' + limit.source : ''}{row.count ? ' · saran ' + row.count : ''}</small></label>
              <input id={'chapter-' + row.id} className="quota-input" type="number" inputMode="numeric" min={0} max={limit.max} step={1} placeholder="0" aria-invalid={over} disabled={!limit.max && !count} value={count || ''} onChange={(e) => setCount(row.id, e.target.value)}/>
              {over && <p className="error-message chapter-note" role="alert">Melebihi maksimum {limit.max} soal per paket.{limit.hint}</p>}
              {!over && !limit.max && <p className="help chapter-note">Belum tersedia pada pengaturan ini.{limit.hint}</p>}
            </div>;
          })}</div>)}
      </details>;
    })}
    {!shown.length && <p className="help">Tidak ada chapter yang cocok dengan pencarian.</p>}
    <p className="help">Sumber: {MAPPING_SOURCE.file}. Maksimum berlaku per paket; bila soal tidak boleh sama antarpaket, stok dibagi ke semua paket.</p>
  </section>;
}
