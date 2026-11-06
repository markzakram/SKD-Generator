// Alasan opsi yang tidak memberi informasi (kalimat pengisi), sisa catatan penyusunan sumber, dan rujukan posisi opsi.
// Dipakai pemeriksaan mutu (lib/quality.ts, scripts/quality-verify.ts), pemuatan bank (lib/bank/index.ts), dan generator.

export const GENERIC_REASONS = [
  'Bandingkan cakupan pilihan ini dengan konsep dan kata kunci pada pembahasan.',
  'Pilihan yang sesuai dengan penjelasan kunci.',
  'Pilihan ini sesuai dengan konsep dan langkah pada pembahasan utama.',
  'Penjelasan per pilihan tidak dipisahkan dalam sumber; gunakan langkah penyelesaian pada pembahasan.',
];
const canonical = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '').toLowerCase();
const GENERIC = new Set(GENERIC_REASONS.map(canonical));
export const isGenericReason = (text: string) => GENERIC.has(canonical(text));
// Alasan generik tidak boleh tampil; opsi tanpa alasan spesifik dibiarkan kosong.
export const withoutGenericReason = (text: string) => isGenericReason(text) ? '' : text;

// Catatan kerja yang tidak boleh sampai ke peserta atau pengguna: judul materi lain, label Bloom sumber, blok tips rumus.
export const WORKING_NOTE = /Kesulitan\s+Kesulitan|Kesulitan\s+Contoh Soal|\bContoh Soal\s+\d|\bLevel Bloom\b|\bTips\s*(?:&|dan)\s*Tri(?:ck|k)\b|\bCara cepat\b|\bCarcep\b/i;
export const workingNote = (text: string) => text.match(WORKING_NOTE)?.[0];

// TIU hanya menyertakan alasan per opsi untuk silogisme dan analogi verbal; semua soal TIU lain (pola, bank, contoh diterima, profil
// tryout) cukup dengan pembahasan. Pengenalnya: keluarga pola, atau sub-materi sumber (3 Premis, 2/3 Premis - Narasi, Analogi 2 Kata).
export const OPTION_REASON_FAMILIES = ['silogisme', 'analogi'];
const OPTION_REASON_CHAPTERS = new Set(['silogisme naratif', 'analogi dua kata', '3 premis', '2 premis narasi', '3 premis narasi', '2 kata']);
const chapterKey = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export const keepsOptionReasons = (q: { subtest: string; subtopic: string; family?: string }) =>
  q.subtest !== 'TIU' || OPTION_REASON_FAMILIES.includes(q.family ?? '') || OPTION_REASON_CHAPTERS.has(chapterKey(q.subtopic));
export const withoutOptionReasons = <T extends { options: { reason: string }[] }>(item: T): T => ({ ...item, options: item.options.map((option) => ({ ...option, reason: '' })) });

// Urutan opsi diacak saat paket dibuat; pembahasan tidak boleh menunjuk huruf atau urutan opsi.
const POSITION_REFERENCE = /\b(?:opsi|pilihan|jawaban)\s+[A-E]\b|\b(?:kalimat|pernyataan|opsi|pilihan|jawaban)\s+(?:pertama|kedua|ketiga|keempat|kelima|terakhir)\b/gi;
export const positionReferences = (text: string) => text.match(POSITION_REFERENCE) ?? [];

// Opsi yang hanya berbeda pada kata ordinal ("Sila pertama." sampai "Sila kelima.") punya urutan baku. Mengembalikan peringkat tiap opsi
// (0 = pertama), atau null bila opsi bukan deret ordinal seperti itu.
const ORDINALS = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima'];
export function ordinalRanks(texts: string[]): number[] | null {
  const ranks: number[] = [], shells = new Set<string>();
  for (const text of texts) {
    const found = text.match(/\b(pertama|kedua|ketiga|keempat|kelima)\b/i);
    if (!found) return null;
    ranks.push(ORDINALS.indexOf(found[1].toLowerCase()));
    shells.add(text.replace(found[0], '#').trim().toLowerCase());
  }
  return texts.length === 5 && shells.size === 1 && new Set(ranks).size === 5 ? ranks : null;
}
// Keluarga pola yang opsinya kategori berurutan baku (kecukupan data: "(1) saja cukup" sampai "keduanya bersama tetap tidak cukup").
export const ORDERED_FAMILIES = ['data'];

// Soal yang urutan opsinya tidak diacak ulang oleh generator: contoh diterima, soal model lokal, kategori kecukupan data, dan opsi ordinal.
export const keepsOptionOrder = (q: { family?: string; options?: { text: string }[]; provenance?: { status: string }; proof: { kind: string } }) =>
  q.provenance?.status === 'accepted-example' || q.proof.kind === 'local' || ORDERED_FAMILIES.includes(q.family ?? '') ||
  (q.options !== undefined && ordinalRanks(q.options.map((option) => option.text)) !== null);
