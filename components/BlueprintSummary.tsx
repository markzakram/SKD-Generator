import { useMemo } from 'react';
import { LEVELS, rowCapacity } from '@/lib/blueprint';
import { KURASI_AKTIF, LABELS } from '@/lib/config';
import { distribution } from '@/lib/generate';
import { MAPPING_SOURCE, type MappingRow } from '@/lib/mapping';
import type { BlueprintRow, Settings, Subtest } from '@/lib/types';
import Icon from './Icon';

const SUBTESTS = ['TWK', 'TIU', 'TKP'] as const;
export type SubtestTotals = Record<Subtest, number>;
type MappedRow = MappingRow & { count: number };
type Line = { key: string; label: string; count: number; note: string };

export const topicLabel = (topic: string) => (topic === 'Teknologi Informasi dan Komunikasi' ? 'Teknologi informasi' : topic);

// Total per subtes: tryout dari rencana mapping, latihan bebas dari baris blueprint.
// Bila rencana kosong (misalnya pengaturan belum valid), pakai distribusi bawaan, bukan nol.
export function planTotals(settings: Settings, isTryout: boolean, rows: BlueprintRow[], mapped: MappedRow[]): SubtestTotals {
  const planned: { subtest: Subtest; count: number }[] = isTryout ? mapped : rows;
  if (!planned.length) return distribution(settings.mode, settings.count);
  const totals: SubtestTotals = { TWK: 0, TIU: 0, TKP: 0 };
  for (const item of planned) totals[item.subtest] += item.count;
  return totals;
}

type Props = {
  settings: Settings;
  isTryout: boolean;
  rows: BlueprintRow[];
  mapped: MappedRow[];
  totals: SubtestTotals;
  errors: string[];
  manual: boolean;
  onToggleManual: () => void;
  onResetManual: () => void;
  busy: boolean;
  onGenerate: () => void;
};

// Ringkasan blueprint: angka besar, bar komposisi, rincian per subtes, cek persediaan, dan satu-satunya tombol buat paket.
export default function BlueprintSummary({ settings, isTryout, rows, mapped, totals, errors, manual, onToggleManual, onResetManual, busy, onGenerate }: Props) {
  const visible = SUBTESTS.filter((s) => totals[s] > 0);
  const { lines, spare } = useMemo(() => {
    const lines: Record<Subtest, Line[]> = { TWK: [], TIU: [], TKP: [] };
    if (isTryout) {
      for (const subtest of SUBTESTS) {
        const byTopic = new Map<string, { count: number; chapters: number }>();
        for (const row of mapped.filter((r) => r.subtest === subtest)) {
          const current = byTopic.get(row.topic) ?? { count: 0, chapters: 0 };
          byTopic.set(row.topic, { count: current.count + row.count, chapters: current.chapters + 1 });
        }
        lines[subtest] = [...byTopic].map(([topic, v]) => ({ key: topic, label: topicLabel(topic), count: v.count, note: v.chapters > 1 ? v.chapters + ' chapter' : '' }));
      }
      return { lines, spare: undefined };
    }
    let spare: { row: BlueprintRow; left: number } | undefined;
    const needed = settings.uniqueAcross ? settings.packages : 1;
    for (const subtest of SUBTESTS) {
      const byTopic = new Map<string, BlueprintRow[]>();
      for (const row of rows.filter((r) => r.subtest === subtest)) byTopic.set(row.topic, [...(byTopic.get(row.topic) ?? []), row]);
      for (const [topic, list] of byTopic) {
        const count = list.reduce((sum, r) => sum + r.count, 0);
        if (!count) continue;
        const parts: string[] = [];
        for (const level of LEVELS) {
          const r = list.find((item) => item.difficulty === level);
          if (!r || !r.count) continue;
          const available = rowCapacity(settings, r);
          // TIU dirakit dari pola; angka persediaannya hanya penanda, bukan stok yang bisa habis.
          if (subtest !== 'TIU' && (!spare || available - r.count * needed < spare.left)) spare = { row: r, left: available - r.count * needed };
          parts.push(LABELS[r.difficulty] + ' ' + r.count + (subtest === 'TIU' ? '' : '/' + available));
        }
        lines[subtest].push({ key: topic, label: topicLabel(topic), count, note: parts.join(' · ') + (subtest === 'TIU' ? ' · pola' : '') });
      }
    }
    return { lines, spare };
  }, [settings, isTryout, rows, mapped]);
  return <aside className="blueprint-summary" aria-label="Ringkasan blueprint">
    <div className="summary-head">
      <h2 className="summary-label">Ringkasan blueprint</h2>
      <div className="summary-total"><strong>{settings.count}</strong><span>soal · {settings.packages} paket · {settings.duration} menit</span></div>
      {settings.packages > 1 && <p className="summary-multiply">× {settings.packages} paket = {settings.count * settings.packages} soal</p>}
      <div className="quota-bar" aria-hidden="true">{visible.map((s) => <i key={s} className={'seg-' + s.toLowerCase()} style={{ flex: totals[s] }}/>)}</div>
      <div className="quota-legend">{visible.map((s) => <span key={s}><span className={'quota-dot seg-' + s.toLowerCase()}/>{s} {totals[s]}</span>)}{isTryout && <small className="summary-source">{MAPPING_SOURCE.file}</small>}</div>
    </div>
    <div className="summary-body">
      {visible.map((s) => <details className="summary-detail" key={s}>
        <summary><Icon name="chevron" size={14}/>Rincian {s}<b>{totals[s]}</b></summary>
        {lines[s].length ? <ul className="summary-lines">{lines[s].map((line) => <li key={line.key}><span>{line.label}{line.note && <small>{line.note}</small>}</span><b>{line.count}</b></li>)}</ul> : <p className="help">Kuota belum dapat dihitung dari pengaturan ini.</p>}
      </details>)}
      {errors.map((error) => <p key={error} className="error-message" role="alert">{error}</p>)}
      {!errors.length && <div className="check-ok" role="status"><Icon name="check" size={16}/><span>{isTryout ? 'Persediaan cukup untuk ' + settings.packages + ' paket. Tidak ada chapter yang kurang.' : 'Persediaan cukup untuk ' + settings.packages + ' paket.' + (spare ? ' Sisa terkecil ' + spare.left + ' soal pada ' + topicLabel(spare.row.topic) + ' / ' + LABELS[spare.row.difficulty] + '.' : '')}</span></div>}
      {!isTryout && !errors.length && <button className="text-button" onClick={onToggleManual}>{manual ? 'Gunakan saran kuota' : 'Sunting kuota secara manual'}</button>}
      {manual && !!errors.length && <button className="text-button" onClick={onResetManual}>Reset kuota manual</button>}
      {manual && <p className="help">Angka kuota disunting pada tabel di bawah formulir. Kuota manual harus sesuai jumlah soal dan persediaan.</p>}
      {!isTryout && !manual && <p className="help">Rincian menampilkan kuota per tingkat dan persediaannya (kuota/persediaan). Kuota berlaku untuk setiap paket.</p>}
      <p className="help">Kesulitan merupakan estimasi penulis. Bloom mencatat proses berpikir secara terpisah; {KURASI_AKTIF ? 'keduanya ditinjau saat kurasi.' : 'keduanya perlu kamu tinjau.'}</p>
    </div>
    <div className="summary-actions">
      <span className="summary-short">{errors.length ? 'Periksa pesan di ringkasan.' : <><strong>{settings.count}</strong> soal · {settings.packages} paket</>}</span>
      <button className="primary-button full-width" disabled={busy || !!errors.length} onClick={onGenerate}><Icon name="spark"/>{busy ? 'Menyusun dan memeriksa…' : KURASI_AKTIF ? 'Buat paket untuk dikurasi' : 'Buat paket'}<Icon name="arrow"/></button>
    </div>
  </aside>;
}
