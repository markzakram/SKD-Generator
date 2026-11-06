// Bentuk implikasi (Panduan Produksi Soal TIU JadiASN, PDF 26): konvers, invers, dan kontraposisi dari "Jika p, maka q". Ini subbentuk Silogisme yang terpisah dari blueprint
// Silogisme Tanpa Logika Kuantor (lib/tiu-logika.ts) dan tidak berubah oleh blueprint itu; pernyataan aslinya memang berbentuk "Jika ... maka ...".
import { inline } from './explanation';
import type { Model } from './models';
import type { Rng } from './rng';
import { implies, not, variable, type Logic } from './solver';
import type { LogikaBuild, LogikaOption } from './tiu-logika';

export type Prop = [pos: string, neg: string];
export const CONTEXTS: Prop[][] = [
  [['berkas telah terverifikasi', 'berkas belum terverifikasi'], ['berkas dapat diproses', 'berkas tidak dapat diproses'], ['pemohon menerima nomor registrasi', 'pemohon tidak menerima nomor registrasi'], ['pemohon dapat mengunduh bukti pendaftaran', 'pemohon tidak dapat mengunduh bukti pendaftaran']],
  [['peserta lulus pelatihan', 'peserta tidak lulus pelatihan'], ['peserta mendapat sertifikat', 'peserta tidak mendapat sertifikat'], ['peserta dapat mengikuti tahap lanjutan', 'peserta tidak dapat mengikuti tahap lanjutan'], ['peserta masuk daftar penugasan', 'peserta tidak masuk daftar penugasan']],
  [['produk lolos pemeriksaan', 'produk tidak lolos pemeriksaan'], ['produk masuk rak utama', 'produk tidak masuk rak utama'], ['produk mendapat label promosi', 'produk tidak mendapat label promosi'], ['produk dipasarkan ke seluruh cabang', 'produk tidak dipasarkan ke seluruh cabang']],
  [['jadwal disetujui', 'jadwal tidak disetujui'], ['ruangan disiapkan', 'ruangan tidak disiapkan'], ['peserta menerima undangan', 'peserta tidak menerima undangan'], ['kegiatan dimulai tepat waktu', 'kegiatan tidak dimulai tepat waktu']],
  [['dokumen lengkap', 'dokumen tidak lengkap'], ['permohonan diterima', 'permohonan tidak diterima'], ['nomor permohonan diterbitkan', 'nomor permohonan tidak diterbitkan'], ['pemohon dihubungi petugas', 'pemohon tidak dihubungi petugas']],
  [['musim kemarau tiba', 'musim kemarau tidak tiba'], ['debit air di bendungan berkurang', 'debit air di bendungan tidak berkurang'], ['pasokan air irigasi dibatasi', 'pasokan air irigasi tidak dibatasi'], ['petani menunda penanaman', 'petani tidak menunda penanaman']],
  [['lampu lalu lintas berwarna merah', 'lampu lalu lintas tidak berwarna merah'], ['kendaraan harus berhenti', 'kendaraan tidak harus berhenti'], ['pejalan kaki boleh melintas', 'pejalan kaki tidak boleh melintas'], ['pengendara menunggu di belakang garis henti', 'pengendara tidak menunggu di belakang garis henti']],
  [['anggota memiliki kartu aktif', 'anggota tidak memiliki kartu aktif'], ['anggota dapat meminjam buku', 'anggota tidak dapat meminjam buku'], ['anggota mengembalikan buku tepat waktu', 'anggota tidak mengembalikan buku tepat waktu'], ['anggota terbebas dari denda', 'anggota tidak terbebas dari denda']],
];

type Kind = 'fakta' | 'negasi-implikasi' | 'konvers' | 'invers' | 'implikasi' | 'disjungsi' | 'tds';
export type Stmt = { text: string; logic: Logic; kind: Kind; why?: string };
const LETTERS = ['p', 'q', 'r', 's'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lower = (text: string) => text.replace(/\.$/, '');
const or = (left: Logic, right: Logic): Logic => ({ op: 'or', left, right });

// Pembuat pernyataan untuk satu konteks: indeks 0–3 = p, q, r, s; `neg` memilih bentuk negatif.
function toolkit(props: Prop[]) {
  const lit = (i: number, neg = false) => neg ? props[i][1] : props[i][0];
  const v = (i: number, neg = false): Logic => neg ? not(variable(LETTERS[i])) : variable(LETTERS[i]);
  return {
    props, lit,
    atom: (i: number, neg = false, why?: string): Stmt => ({ text: cap(lit(i, neg)) + '.', logic: v(i, neg), kind: 'fakta', why }),
    cond: (i: number, j: number, kind: Kind = 'implikasi', ni = false, nj = false): Stmt => ({ text: 'Jika ' + lit(i, ni) + ', maka ' + lit(j, nj) + '.', logic: implies(v(i, ni), v(j, nj)), kind }),
    disj: (i: number, ni: boolean, j: number, nj: boolean): Stmt => ({ text: cap(lit(i, ni)) + ' atau ' + lit(j, nj) + '.', logic: or(v(i, ni), v(j, nj)), kind: 'disjungsi' }),
    negImpl: (i: number, j: number): Stmt => ({ text: 'Tidak benar bahwa jika ' + lit(i) + ', maka ' + lit(j) + '.', logic: not(implies(v(i), v(j))), kind: 'negasi-implikasi' }),
  };
}


// ---- Bentuk implikasi (PDF 26): konvers, invers, dan kontraposisi dari "Jika p, maka q" ----------------------------------------------------------------------
// Pertanyaannya meminta bentuk menurut namanya. Konvers dan invers ekuivalen secara logis, begitu pula pernyataan asli dan kontraposisinya, sehingga opsi yang
// ekuivalen dengan kunci tidak pernah dimunculkan; kunci tunggal menurut bentuknya.
export type Asked = 'konvers' | 'invers' | 'kontraposisi';
const FORM_RULE: Record<Asked, [string, string, string]> = { konvers: ['q \\to p', 'konvers', 'q → p'], invers: ['\\neg p \\to \\neg q', 'invers', '¬p → ¬q'], kontraposisi: ['\\neg q \\to \\neg p', 'kontraposisi', '¬q → ¬p'] };
// Ulasan opsi memakai lambang biasa (bukan LaTeX) supaya terbaca sama di layar, CSV, Word, dan salinan; pembahasan memakai rumus.
// Bentuk turunan implikasi "left → right" menurut namanya (dibandingkan sebagai pohon logika oleh solver model).
export function transformImplication(premise: Logic, asked: Asked): Logic | undefined {
  if (premise.op !== 'implies') return undefined;
  return asked === 'konvers' ? implies(premise.right, premise.left) : asked === 'invers' ? implies(not(premise.left), not(premise.right)) : implies(not(premise.right), not(premise.left));
}
export function buildImplikasi(asked: Asked, r: Rng): LogikaBuild {
  const props = r.shuffle(r.pick(CONTEXTS)).slice(0, 2) as Prop[], kit = toolkit(props), original = kit.cond(0, 1);
  const forms: Record<Asked, Stmt> = { konvers: kit.cond(1, 0, 'konvers'), invers: kit.cond(0, 1, 'invers', true, true), kontraposisi: kit.cond(1, 0, 'implikasi', true, true) };
  const partial = kit.cond(0, 1, 'implikasi', false, true);
  // Pengecoh: bentuk turunan lain yang tidak ekuivalen dengan kunci, bentuk "atau" (bila tidak ekuivalen dengan kunci), negasi, dan akibat saja yang dinegasikan.
  const others = (['konvers', 'invers', 'kontraposisi'] as Asked[]).filter((form) => form !== asked && !(asked === 'konvers' && form === 'invers') && !(asked === 'invers' && form === 'konvers'));
  const extras: { stmt: Stmt; reason: string }[] = [
    ...others.map((form) => ({ stmt: forms[form], reason: 'Tidak sesuai: ini ' + FORM_RULE[form][1] + ' dengan rumus ' + FORM_RULE[form][2] + ', bukan ' + asked + ' yang rumusnya ' + FORM_RULE[asked][2] + '.' })),
    ...(asked !== 'kontraposisi' ? [{ stmt: kit.disj(0, true, 1, false), reason: 'Tidak sesuai: bentuk "atau" ini ekuivalen dengan pernyataan asli (hukum implikasi), bukan ' + asked + '.' }] : []),
    { stmt: kit.negImpl(0, 1), reason: 'Tidak sesuai: ini menyangkal pernyataan asli, bukan ' + asked + '.' },
    { stmt: partial, reason: 'Tidak sesuai: arah dipertahankan dan hanya akibat yang dinegasikan; bentuk ini bukan konvers, invers, maupun kontraposisi.' },
  ];
  const picked = r.shuffle(extras).slice(0, 4);
  if (picked.length < 4) throw new Error('Pengecoh bentuk implikasi belum cukup.');
  const key = forms[asked], keyReason = 'Sesuai dengan yang diminta: ini ' + asked + ' dari pernyataan asli dengan rumus ' + FORM_RULE[asked][2] + '.';
  const entries = r.shuffle([{ stmt: key, reason: keyReason }, ...picked]);
  const options = entries.map((entry): LogikaOption => ({ text: entry.stmt.text, reason: entry.reason, status: entry.stmt === key ? 'pasti' : 'belum', logic: entry.stmt.logic }));
  const answer = options.findIndex((option) => option.status === 'pasti');
  const asking = cap(asked) + ' dari kalimat "' + lower(original.text) + '" adalah ...';
  const explanation = ['**Pernyataan Asli:** Jika ' + props[0][0] + ' (' + inline('p') + '), maka ' + props[1][0] + ' (' + inline('q') + ').',
    '• **Identifikasi Variabel:** ' + inline('p') + ' adalah "' + props[0][0] + '" dan ' + inline('q') + ' adalah "' + props[1][0] + '".',
    '• **Penerapan Rumus:** ' + cap(asked) + ' memiliki rumus ' + inline(FORM_RULE[asked][0]) + '.', '• **Kesimpulan Akhir:** ' + lower(key.text) + '.'].join('\n');
  const model: Model = { kind: 'implication', asked, premise: original.logic, options: options.map((option) => ({ text: option.text, logic: option.logic! })) };
  return { stem: asking, options, answer, explanation, model, bloom: 'C2', code: 'implikasi-' + asked, chapter: 'Bentuk Implikasi', reversed: 0, implications: 1 };
}
