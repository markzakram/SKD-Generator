import { PRESET } from './config';
import { MAPPING_ROWS } from './mapping';
import type { Mode } from './types';

// Pengaturan generator yang tersimpan di localStorage (app/page.tsx) diberi nomor versi supaya perubahan bawaan bisa dimigrasikan satu kali.
// Versi 1 (tanpa penanda): bawaan lama memilih jalur lokal untuk TWK dan TKP, jadi hampir semua preferensi tersimpan memuat tkpSource "new".
// Versi 2: sumber TKP bawaan kembali ke bank ("accepted"); tkpSource "new" dari versi 1 diganti sekali. Pilihan manual sesudahnya (versi 2) dipertahankan,
// dan pengaturan lain tidak disentuh.
export const SETTINGS_VERSION = 2;
export const SETTINGS_KEY = 'jadiasn-skd-settings-v1';
export const SETTINGS_VERSION_KEY = 'jadiasn-skd-settings-version';
// Isian jumlah per chapter (Settings.chapterCounts) disimpan apa adanya, termasuk saat masih kosong atau sedang diketik. Isian yang tidak sah saat dibaca kembali tidak boleh menggugurkan seluruh
// preferensi (normalizeSettings menolaknya): id tak dikenal dan angka tidak sah dibuang, dan isian yang kosong kembali ke kuota saran.
function withValidChapterCounts(stored: Record<string, unknown>): Record<string, unknown> {
  const counts = stored.chapterCounts;
  if (counts === undefined) return stored;
  const entries = counts && typeof counts === 'object' && !Array.isArray(counts) ? MAPPING_ROWS.flatMap((row) => { const n = (counts as Record<string, unknown>)[row.id]; return Number.isInteger(n) && (n as number) > 0 && (n as number) <= 200 ? [[row.id, n as number] as const] : []; }) : [];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (entries.length && total <= 200) return { ...stored, chapterCounts: Object.fromEntries(entries), count: total };
  const next: Record<string, unknown> = { ...stored, count: PRESET[stored.mode as Mode] ?? PRESET.SKD };
  delete next.chapterCounts;
  return next;
}
export function migrateStoredSettings(stored: Record<string, unknown>, version: number): Record<string, unknown> {
  if (!stored || typeof stored !== 'object') return stored;
  if (version >= SETTINGS_VERSION) return withValidChapterCounts(stored);
  const next = { ...stored };
  if (next.tkpSource === 'new') next.tkpSource = 'accepted';
  return withValidChapterCounts(next);
}
