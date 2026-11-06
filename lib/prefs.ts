// Pengaturan generator yang tersimpan di localStorage (app/page.tsx) diberi nomor versi supaya perubahan bawaan bisa dimigrasikan satu kali.
// Versi 1 (tanpa penanda): bawaan lama memilih jalur lokal untuk TWK dan TKP, jadi hampir semua preferensi tersimpan memuat tkpSource "new".
// Versi 2: sumber TKP bawaan kembali ke bank ("accepted"); tkpSource "new" dari versi 1 diganti sekali. Pilihan manual sesudahnya (versi 2) dipertahankan,
// dan pengaturan lain tidak disentuh.
export const SETTINGS_VERSION = 2;
export const SETTINGS_KEY = 'jadiasn-skd-settings-v1';
export const SETTINGS_VERSION_KEY = 'jadiasn-skd-settings-version';
export function migrateStoredSettings(stored: Record<string, unknown>, version: number): Record<string, unknown> {
  if (!stored || typeof stored !== 'object' || version >= SETTINGS_VERSION) return stored;
  const next = { ...stored };
  if (next.tkpSource === 'new') next.tkpSource = 'accepted';
  return next;
}
