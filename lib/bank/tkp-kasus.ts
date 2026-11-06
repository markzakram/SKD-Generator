import { TOPICS } from '../config';
import type { BankItem, Option, TkpMeta, TkpTag } from '../types';
import pelayananPublik from '@/data/tkp-kasus/pelayanan-publik.json';
import jejaringKerja from '@/data/tkp-kasus/jejaring-kerja.json';
import sosialBudaya from '@/data/tkp-kasus/sosial-budaya.json';
import tik from '@/data/tkp-kasus/tik.json';
import profesionalisme from '@/data/tkp-kasus/profesionalisme.json';
import antiRadikalisme from '@/data/tkp-kasus/anti-radikalisme.json';

// Bank TKP baru: satu butir = satu skenario (spesifikasi Tahap 3). Satu berkas JSON per kompetensi di data/tkp-kasus/.
// Pengganti kerangka lama lib/bank/cases.ts, kompetensi demi kompetensi: begitu sebuah berkas berisi kasus, semua kerangka lama
// untuk kompetensi (topic) itu tidak dipakai lagi (lib/bank/index.ts); berkas kosong ([]) berarti kompetensi itu masih memakai kerangka lama.
// Menambah kompetensi = mengisi berkasnya (tidak ada daftar lain yang perlu diubah). Berkas baru di luar enam nama di bawah harus didaftarkan di sini.

// Nilai yang sah. Sumber tunggal untuk pemeriksaan (scripts/tkp-checks.ts) dan penalti sebaran (lib/generate.ts).
export const TKP_POLA = ['dua-tanggung-jawab', 'kebutuhan-individual-vs-keadilan', 'kesalahan-baru-ditemukan', 'informasi-belum-lengkap-bertentangan', 'gangguan-layanan-mendadak', 'masalah-berulang',
  'penolakan-perubahan', 'ketegangan-kesalahpahaman', 'tekanan-atasan-rekan-mitra', 'peluang-pengembangan-keterbatasan', 'hak-minoritas-keputusan-mayoritas', 'dugaan-ancaman'] as const;
export const TKP_PERAN = ['pelaksana', 'pegawai-baru', 'anggota-tim', 'koordinator', 'pimpinan-unit', 'penghubung-mitra', 'warga'] as const;
export const TKP_KEWENANGAN = ['penuh', 'terbatas', 'hanya-usul', 'tidak-ada'] as const;
export const TKP_TEMPAT = ['loket', 'administratif', 'lapangan', 'rapat', 'pelatihan', 'kemitraan', 'layanan-digital', 'masyarakat'] as const;
export const TKP_KEPUTUSAN = ['bertindak-sendiri', 'koordinasi', 'minta-bantuan', 'menolak', 'mengoreksi', 'melindungi', 'memulihkan', 'mengembangkan', 'ubah-mekanisme'] as const;
export const TKP_PEMBEDA = ['kunci', 'sasaran', 'urutan', 'waktu', 'risiko', 'cakupan'] as const;
export type TkpPola = (typeof TKP_POLA)[number];
export type TkpPeran = (typeof TKP_PERAN)[number];
export type TkpKewenangan = (typeof TKP_KEWENANGAN)[number];
export type TkpTempat = (typeof TKP_TEMPAT)[number];
export type TkpKeputusan = (typeof TKP_KEPUTUSAN)[number];
export type TkpPembeda = (typeof TKP_PEMBEDA)[number];

export type TkpOpsi = Pick<Option, 'text' | 'score' | 'reason'> & { tag?: TkpTag };
export type TkpKasus = {
  id: string; // tkp-kasus-<kode>-<nn>; unik di seluruh bank
  skenario: string; // family di generator; unik di seluruh bank (satu skenario tidak muncul dua kali dalam paket atau antarpaket)
  topic: string; subtopic: string; // kompetensi (TOPICS.TKP) dan submateri (TKP_SUBTOPICS di lib/config.ts)
  pola: TkpPola;
  peran: TkpPeran;
  kewenangan: TkpKewenangan;
  penentu: string; // satu fakta yang bila dihapus mengubah peringkat opsi
  tempat: TkpTempat;
  keputusan: TkpKeputusan;
  bloom: 'C3' | 'C4' | 'C5';
  difficulty: 'mudah' | 'sedang' | 'sulit'; difficultyReason: string;
  stem: string; // 60–90 kata; berakhir "... adalah ..." atau tanda tanya
  options: [TkpOpsi, TkpOpsi, TkpOpsi, TkpOpsi, TkpOpsi]; // skor permutasi 1–5; tag.pembeda ∈ TKP_PEMBEDA, tag.pengecoh = tag tabel skor (null pada kunci)
  answer: number; // indeks opsi bernilai 5 (bervariasi antarkasus)
  explanation: string; tip: string;
  source: string; // kredit publik saja
  konteks?: string; // kelompok situasi dalam kompetensi (metadata)
  kataKunci?: string; // istilah pembahasan ("Kata kunci:"): 4–6 istilah dari stem, dipisah koma; wajib untuk kasus di data/tkp-kasus/ (scripts/tkp-checks.ts), pembahasan tanpa baris itu bila kosong
  catatan?: string; // internal; tidak masuk bank
};

// Berkas terdaftar. `topic` = kompetensi yang diwakili berkas; pemeriksaan memastikan semua kasus di dalamnya bertopik sama.
export const TKP_KASUS_BERKAS: { berkas: string; topic: string; kasus: TkpKasus[] }[] = [
  { berkas: 'pelayanan-publik', topic: TOPICS.TKP[0], kasus: pelayananPublik as unknown as TkpKasus[] },
  { berkas: 'jejaring-kerja', topic: TOPICS.TKP[1], kasus: jejaringKerja as unknown as TkpKasus[] },
  { berkas: 'sosial-budaya', topic: TOPICS.TKP[2], kasus: sosialBudaya as unknown as TkpKasus[] },
  { berkas: 'tik', topic: TOPICS.TKP[3], kasus: tik as unknown as TkpKasus[] },
  { berkas: 'profesionalisme', topic: TOPICS.TKP[4], kasus: profesionalisme as unknown as TkpKasus[] },
  { berkas: 'anti-radikalisme', topic: TOPICS.TKP[5], kasus: antiRadikalisme as unknown as TkpKasus[] },
];
export const TKP_KASUS: TkpKasus[] = TKP_KASUS_BERKAS.flatMap((entry) => entry.kasus);
// Kompetensi yang sudah punya kasus baru; kerangka lama untuk kompetensi ini tidak dipakai lagi.
export const TKP_KASUS_TOPICS = new Set(TKP_KASUS.map((kasus) => kasus.topic));

export function toBankItem(kasus: TkpKasus): BankItem {
  const { skenario, pola, peran, kewenangan, penentu, tempat, keputusan, konteks, kataKunci, catatan, ...item } = kasus;
  void catatan;
  const meta: TkpMeta = { skenario, pola, peran, kewenangan, penentu, tempat, keputusan, ...(konteks ? { konteks } : {}), ...(kataKunci ? { kataKunci } : {}) };
  return { ...item, subtest: 'TKP', options: item.options.map((option) => ({ ...option })), kasus: meta };
}
export const TKP_KASUS_BANK: BankItem[] = TKP_KASUS.map(toBankItem);
