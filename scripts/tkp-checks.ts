// Pemeriksaan mutu bank TKP baru (Tahap 3): data/tkp-kasus/*.json lewat lib/bank/tkp-kasus.ts, dan paket hasil generate.
// Dijalankan sendiri: `npx tsx scripts/tkp-checks.ts` (cetak semua galat dan peringatan; kode keluar 1 bila ada galat), atau lewat
// `npm run verify:quality` (scripts/quality-verify.ts memanggil runTkpChecks).
// - checkKasusBank(kasus, berkas): pemeriksa data murni (galat + peringatan + ringkasan per kompetensi); bisa dipakai untuk draf sebelum disalin ke data/.
// - checkGenerated(packages): skenario unik dan sebaran pola/keputusan/peran/tempat per paket.
// - runTkpChecks(check): semuanya, dengan `check(kondisi, pesan)` seperti pemeriksa lain di quality-verify.
// Aturan sumbernya: revisi-akademik/spec-tahap-3-tkp.md bagian 2 (aturan tulis R1–R7) dan bagian 6; tabel skor tag pengecoh: SKOR_TAG di bawah
// (satu tag = satu skor, berlaku lintas kasus dan kompetensi; tag baru ditambahkan di sini bersama skornya, jangan memberi skor di luar tabel).
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACCEPTED_BANK, BANK, BANK_MAP } from '../lib/bank';
import {
  TKP_KASUS, TKP_KASUS_BERKAS, TKP_KEPUTUSAN, TKP_KEWENANGAN, TKP_PEMBEDA, TKP_PERAN, TKP_POLA, TKP_TEMPAT, TKP_KASUS_TOPICS, type TkpKasus,
} from '../lib/bank/tkp-kasus';
import { DEFAULT_SETTINGS, TKP_SUBTOPICS, TOPICS } from '../lib/config';
import { generate, normalizeSettings, spreadLimit } from '../lib/generate';
import { WORKING_NOTE } from '../lib/reasons';
import type { Package, Question } from '../lib/types';
import { explanationOf } from '../lib/explanation';
import { LOCAL_RECIPES, renderLocal } from '../lib/local';
import { profilePlan } from '../lib/mapping';
import { PROFILE_SETTINGS, TRYOUT_TKP, profileCapacityErrors } from '../lib/tryout-profile';

export type Check = (condition: unknown, message: string) => void;
export type Problems = { errors: string[]; warnings: string[] };

// Tabel skor tag pengecoh (tabel-skor-tkp.md). Skor 5 hanya untuk kunci (tag.pembeda 'kunci', tag.pengecoh null).
export const SKOR_TAG: Record<string, number> = {
  'kurang-komunikasi': 4, 'kurang-cakupan': 4, 'kurang-langsung': 4, 'kurang-perlindungan': 4, 'terlalu-dini': 4, 'mengambil-alih': 4,
  'sah-terlambat': 3, 'sah-parsial': 3, 'eskalasi-dini': 3, 'kaku': 3,
  'pembiaran': 2, 'melempar': 2, 'menutup-sementara': 2, 'janji-tanpa-dasar': 2, 'kosmetik': 2, 'jalur-tidak-resmi': 2, 'menangani-sendiri': 2,
  'melanggar-aturan': 1, 'manipulasi-data': 1, 'tanpa-verifikasi': 1, 'melampaui-kewenangan': 1, 'membuka-data': 1, 'membahayakan': 1, 'menyalahkan-pengguna': 1, 'menutup-hak': 1,
  // Tag khas kompetensi, berawalan kode kompetensi: ar: = Anti Radikalisme, sb: = Sosial Budaya, tik: = Teknologi Informasi dan Komunikasi, prof: = Profesionalisme, jk: = Jejaring Kerja.
  'tik:manual-padahal-ada-alat': 3, 'tik:inisiatif-tertutup': 3, 'sb:satu-suara': 3, 'prof:koreksi-diam-diam': 3, 'prof:menanggung-sendiri': 3,
  'ar:amplifikasi': 2, 'ar:mempermalukan': 2, 'tik:alat-baru-tanpa-kajian': 2, 'tik:bertahan-cara-lama': 2, 'tik:memperluas-paparan': 2, 'sb:penyeragaman': 2, 'prof:patuh-tanpa-pertimbangan': 2, 'jk:menghindari-mitra': 2,
  'ar:pelabelan': 1, 'ar:pembungkaman': 1, 'ar:menyalahkan-korban': 1, 'tik:uji-tautan-langsung': 1,
  // Tag lintas kompetensi dari koreksi 26 contoh TKP referensi (data/tkp-ref-koreksi.json).
  'merendahkan-martabat': 1, 'sb:stereotip': 1, 'sb:abai-norma': 1, 'sb:memojokkan': 1, 'prof:mempermalukan': 1, 'prof:menyalahkan-pihak-lain': 1, 'jk:mempermalukan': 1, 'jk:klaim-pengakuan': 1,
};
// Kuota minimum kasus (mudah + sedang) per berkas kompetensi di data/tkp-kasus/, bila berkasnya tidak kosong. Kunci = nama berkas tanpa .json.
// Berkas baru di luar enam nama ini belum punya kuota sampai ditambahkan di sini.
export const KUOTA_BERKAS: Record<string, number> = {
  'pelayanan-publik': 25, 'jejaring-kerja': 26, 'sosial-budaya': 26, 'tik': 23, 'profesionalisme': 21, 'anti-radikalisme': 23,
};
// Pembeda yang sah antara skor 5 dan 4 (bukan satu kata penanda seperti "segera" atau "dengan sopan").
const PEMBEDA_5_4 = ['sasaran', 'urutan', 'cakupan', 'risiko'];
// Frasa sisa kerangka lama, sisipan panduan, dan catatan penyusunan yang tidak boleh tercetak di kasus baru.
const FRASA_SISA: [RegExp, string][] = [
  [/\bKesulitan\s+(?:Kesulitan|Contoh|Soal)\b|\bKesulitan\s*:/, 'Kesulitan'], [/Contoh Soal/i, 'Contoh Soal'], [/Level Bloom/i, 'Level Bloom'], [/Tingkat Kesulitan/i, 'Tingkat Kesulitan'],
  [/rubrik/i, 'rubrik'], [/Kasus orisinal v2/i, 'Kasus orisinal v2'], [/Anda berwenang menjalankan/i, 'Anda berwenang menjalankan'],
  [/pemeriksaan manual untuk setiap/i, 'pemeriksaan manual untuk setiap'], [/penyelesaian informal/i, 'penyelesaian informal'], [/tanpa catatan perubahan/i, 'tanpa catatan perubahan'],
  [/Batasi akses dokumen;/i, 'Batasi akses dokumen;'], [/Tunggu balasan/i, 'Tunggu balasan'], [/sumber resmi BKN/i, 'sumber resmi BKN'], [/kunci resmi/i, 'kunci resmi'],
  [/Materi Pokok/i, 'Materi Pokok'], [/Cara cepat/i, 'Cara cepat'], [/Prinsip Kunci/i, 'Prinsip Kunci'], [/Diskresi dalam Soal/i, 'Diskresi dalam Soal'], [WORKING_NOTE, 'catatan penyusunan'],
];
const ABSOLUT = /\b(?:selalu|tidak pernah|pasti|mutlak|sama sekali|apa pun|seluruh|semua|satu-satunya|hanya satu)\b/i;
const STOP = new Set(['yang', 'dengan', 'dalam', 'untuk', 'tetapi', 'sedangkan', 'padahal', 'karena', 'sudah', 'belum', 'dapat', 'bagi', 'oleh', 'pada', 'dari', 'atau', 'lebih', 'tidak', 'adalah', 'sebagai', 'lewat', 'tanpa', 'agar',
  'setelah', 'sehingga', 'berwenang', 'anda', 'paling', 'tepat', 'tindakan', 'langkah', 'sikap', 'respons', 'keputusan', 'sebaiknya', 'lakukan', 'hari', 'kepada', 'mereka', 'sekitar', 'hanya', 'masih', 'sedang', 'harus', 'bahwa',
  'seorang', 'tersebut', 'dilakukan', 'ketika', 'kemudian', 'selama', 'sampai', 'antara', 'bukan', 'memiliki', 'menjadi', 'melalui', 'dahulu']);

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
const count = (items: (string | number)[]) => items.reduce<Record<string, number>>((map, item) => { map[item] = (map[item] ?? 0) + 1; return map; }, {});
const near = (a: number, b: number) => a <= b + 1e-9;
const percent = (n: number, of: number) => Math.round(n / of * 100) + '%';

// Kata kunci pembahasan (field kataKunci, baris "Kata kunci:"; QC akademik #2): 4–6 istilah pendek dipisah koma, tanpa duplikat, dan SETIAP kata isi
// istilah harus muncul di stem (toleransi imbuhan sederhana), supaya tidak ada kata kunci yang hanya ada di opsi atau tidak didukung stem
// (temuan QC: "rapat investor" padahal stem menyebut "rapat siang"; "modul" yang tidak disebut stem). Huruf kapital hanya untuk kata yang juga
// berhuruf kapital di tengah kalimat stem (nama diri, singkatan, nama hari).
const KATA_TUGAS = new Set(['dan', 'di', 'ke', 'dari', 'yang', 'ada', 'atau', 'serta', 'untuk', 'dengan', 'dalam', 'pada', 'oleh', 'bagi', 'tanpa', 'lewat', 'melalui',
  'tidak', 'belum', 'sudah', 'masih', 'hanya', 'sedang', 'akan', 'juga', 'lebih', 'agar', 'karena', 'itu', 'ini', 'paling', 'dapat', 'bukan']);
const AWALAN = ['memper', 'meng', 'meny', 'mem', 'men', 'me', 'peng', 'peny', 'pem', 'pen', 'per', 'pe', 'ber', 'be', 'ter', 'di', 'ke', 'se'];
const AKHIRAN = ['nya', 'lah', 'kah', 'kan', 'an', 'i'];
const LULUH: Record<string, string[]> = { meng: ['', 'k'], peng: ['', 'k'], meny: ['s'], peny: ['s'], mem: ['', 'p'], pem: ['', 'p'], men: ['', 't'], pen: ['', 't'] };
const tokens = (text: string) => text.match(/[\p{L}\p{N}]+/gu) ?? [];
// Bentuk kata tanpa imbuhan (beberapa kemungkinan; peluluhan awalan me-/pe- dipulihkan): "pemeriksaan" dan "diperiksa" sama-sama memuat "periksa".
function bentukDasar(word: string): Set<string> {
  const out = new Set([word]);
  let frontier = [word];
  for (let round = 0; round < 4 && frontier.length; round++) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const s of AKHIRAN) if (w.endsWith(s) && w.length - s.length >= 3) next.push(w.slice(0, -s.length));
      for (const p of AWALAN) if (w.startsWith(p) && w.length - p.length >= 3) for (const l of LULUH[p] ?? ['']) next.push(l + w.slice(p.length));
    }
    frontier = next.filter((w) => !out.has(w));
    frontier.forEach((w) => out.add(w));
  }
  return out;
}
export function kataKunciProblems(k: Pick<TkpKasus, 'stem' | 'kataKunci'>): string[] {
  const value = k.kataKunci?.trim();
  if (!value) return ['kataKunci kosong (wajib untuk baris "Kata kunci:" di pembahasan)'];
  const problems: string[] = [];
  if (/[.;:]$/.test(value) || /;/.test(value)) problems.push('kataKunci dipisah koma, tanpa titik koma dan tanda baca penutup');
  const terms = value.split(',').map((term) => term.trim());
  if (terms.length < 4 || terms.length > 6) problems.push('kataKunci berisi ' + terms.length + ' istilah (harus 4–6)');
  const seen = new Set<string>();
  const stemRoots = new Set<string>();
  for (const word of tokens(k.stem.toLowerCase())) for (const root of bentukDasar(word)) stemRoots.add(root);
  // Kata berhuruf kapital di stem yang bukan sekadar awal kalimat (nama diri, singkatan; di awal kalimat hanya bila diikuti kata berhuruf kapital,
  // seperti "Bu Wati"): hanya kata ini yang boleh berhuruf kapital di kata kunci.
  const found = [...k.stem.matchAll(/[\p{L}\p{N}]+/gu)];
  const capitals = new Set(found.filter((m, i) => /\p{Lu}/u.test(m[0]) && (!/(?:^|[.!?:"“]\s*)$/.test(k.stem.slice(0, m.index)) || /^\p{Lu}/u.test(found[i + 1]?.[0] ?? ''))).map((m) => m[0]));
  for (const term of terms) {
    if (!term) { problems.push('kataKunci memuat istilah kosong'); continue; }
    const key = term.toLowerCase();
    if (seen.has(key)) problems.push('istilah ganda "' + term + '"'); else seen.add(key);
    if (term.split(/\s+/).length > 5) problems.push('istilah "' + term + '" lebih dari lima kata');
    const words = tokens(term), content = words.filter((w) => !KATA_TUGAS.has(w.toLowerCase()));
    if (!content.length) problems.push('istilah "' + term + '" tanpa kata isi');
    for (const word of words) if (/\p{Lu}/u.test(word) && !capitals.has(word)) problems.push('istilah "' + term + '": huruf kapital pada "' + word + '" (huruf kecil kecuali nama diri yang juga tertulis begitu di stem)');
    const missing = content.filter((w) => { const lower = w.toLowerCase(); return ![...bentukDasar(lower)].some((root) => (root === lower || root.length >= 4) && stemRoots.has(root)); });
    if (missing.length) problems.push('istilah "' + term + '": kata "' + missing.join('", "') + '" tidak ada di stem');
  }
  return problems;
}

type Summary = { berkas: string; topic: string; total: number; mudah: number; sedang: number; sulit: number; kunciTerpanjang: number; peringkatPanjang: number[]; posisiKunci: number[];
  pola: number; peran: number; tempat: number; keputusan: number; bloom: Record<string, number> };

// Pemeriksa data murni. `berkas` memetakan kasus ke berkasnya (kompetensi yang diharapkan); tanpa itu, topic kasus dipakai apa adanya.
export function checkKasusBank(kasus: TkpKasus[], berkas: { berkas: string; topic: string; kasus: TkpKasus[] }[] = []): Problems & { summary: Summary[] } {
  const errors: string[] = [], warnings: string[] = [];
  const err = (id: string, message: string) => errors.push(id + ': ' + message), warn = (id: string, message: string) => warnings.push(id + ': ' + message);
  const subtopics = new Map(TOPICS.TKP.map((topic) => [topic, TKP_SUBTOPICS.filter(([name]) => name === topic).map(([, sub]) => sub as string)]));
  const ids = new Map<string, number>(), skenario = new Map<string, string>(), reasons = new Map<string, string>();
  const reasonWords: [string, Set<string>][] = [];

  // Entri yang bukan objek (null, angka, teks, larik) ditolak dengan galat sendiri dan dikeluarkan dari pemeriksaan lain, supaya tidak TypeError.
  const isRecord = (value: unknown): value is TkpKasus => typeof value === 'object' && value !== null && !Array.isArray(value);
  (kasus as unknown[]).forEach((k, index) => { if (!isRecord(k)) err('entri ke-' + (index + 1), 'bukan objek kasus (' + (k === null ? 'null' : Array.isArray(k) ? 'larik' : typeof k) + '); setiap entri harus berupa objek'); });
  kasus = kasus.filter(isRecord);

  for (const k of kasus) {
    const id = k?.id ?? '(tanpa id)';
    if (typeof k?.id !== 'string' || !/^tkp-kasus-[a-z0-9-]+$/.test(k.id)) err(id, 'id harus berbentuk tkp-kasus-<kode>-<nn>');
    ids.set(id, (ids.get(id) ?? 0) + 1);
    if (typeof k.skenario !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(k.skenario)) err(id, 'skenario harus berupa slug huruf kecil bertanda hubung');
    else { if (skenario.has(k.skenario)) err(id, 'skenario ganda dengan ' + skenario.get(k.skenario)); skenario.set(k.skenario, id); if (BANK_MAP.has(k.skenario)) err(id, 'skenario sama dengan id butir bank lain'); }
    if (!TOPICS.TKP.includes(k.topic)) err(id, 'topic bukan kompetensi TKP: ' + k.topic);
    else if (!subtopics.get(k.topic)!.includes(k.subtopic)) err(id, 'subtopic "' + k.subtopic + '" bukan submateri ' + k.topic + ' di lib/config.ts');
    if (!(TKP_POLA as readonly string[]).includes(k.pola)) err(id, 'pola tidak sah: ' + k.pola);
    if (!(TKP_PERAN as readonly string[]).includes(k.peran)) err(id, 'peran tidak sah: ' + k.peran);
    if (!(TKP_KEWENANGAN as readonly string[]).includes(k.kewenangan)) err(id, 'kewenangan tidak sah: ' + k.kewenangan);
    if (!(TKP_TEMPAT as readonly string[]).includes(k.tempat)) err(id, 'tempat tidak sah: ' + k.tempat);
    if (!(TKP_KEPUTUSAN as readonly string[]).includes(k.keputusan)) err(id, 'keputusan tidak sah: ' + k.keputusan);
    if (!['C3', 'C4', 'C5'].includes(k.bloom)) err(id, 'bloom harus C3, C4, atau C5');
    if (!['mudah', 'sedang', 'sulit'].includes(k.difficulty)) err(id, 'difficulty harus mudah, sedang, atau sulit');
    for (const field of ['penentu', 'difficultyReason', 'stem', 'explanation', 'tip', 'source'] as const) if (typeof k[field] !== 'string' || !k[field].trim()) err(id, 'field wajib kosong: ' + field);
    if (!Array.isArray(k.options) || k.options.length !== 5 || k.options.some((o) => typeof o?.text !== 'string' || !o.text.trim() || typeof o.reason !== 'string' || !o.reason.trim() || !Number.isInteger(o.score))) { err(id, 'harus tepat lima opsi dengan teks, alasan, dan skor bulat'); continue; }
    if (/^\s*$/.test(k.stem ?? '')) continue;
    // Kata kunci pembahasan: wajib, 4–6 istilah dari stem (kataKunciProblems).
    for (const problem of kataKunciProblems(k)) err(id, problem);

    // Skor: permutasi 1–5; answer = indeks skor 5.
    if ([...k.options.map((o) => o.score)].sort().join('') !== '12345') err(id, 'skor bukan permutasi 1–5: ' + k.options.map((o) => o.score));
    const key = k.options.findIndex((o) => o.score === 5);
    if (k.answer !== key) err(id, 'answer ' + k.answer + ' bukan indeks skor 5 (' + key + ')');
    if (key < 0) continue;

    // Tag: satu tag pengecoh = satu skor sesuai tabel; kunci bertanda pembeda "kunci".
    k.options.forEach((o, i) => {
      if (!o.tag || !(TKP_PEMBEDA as readonly string[]).includes(o.tag.pembeda)) { err(id, 'opsi ' + i + ': tag.pembeda tidak sah'); return; }
      if (o.score === 5) { if (o.tag.pembeda !== 'kunci' || o.tag.pengecoh !== null) err(id, 'tag kunci harus {pembeda:"kunci", pengecoh:null}'); return; }
      if (o.tag.pembeda === 'kunci' || !o.tag.pengecoh) { err(id, 'opsi ' + i + ': pengecoh wajib bertag pembeda dan pengecoh'); return; }
      const table = SKOR_TAG[o.tag.pengecoh];
      if (table === undefined) err(id, 'opsi ' + i + ': tag "' + o.tag.pengecoh + '" tidak ada di tabel skor');
      else if (table !== o.score) err(id, 'opsi ' + i + ': tag "' + o.tag.pengecoh + '" bernilai ' + table + ' di tabel, skor opsi ' + o.score);
    });
    const four = k.options.find((o) => o.score === 4);
    if (four?.tag && !PEMBEDA_5_4.includes(four.tag.pembeda)) err(id, 'pembeda skor 4 terhadap kunci "' + four.tag.pembeda + '" bukan sasaran/urutan/cakupan/risiko');

    // R1 panjang: rasio terpanjang/terpendek ≤ 1,3; kunci dalam ±20% rata-rata.
    const lengths = k.options.map((o) => o.text.length), mean = lengths.reduce((a, b) => a + b, 0) / 5;
    if (Math.max(...lengths) / Math.min(...lengths) > 1.3) err(id, 'rasio panjang opsi ' + (Math.max(...lengths) / Math.min(...lengths)).toFixed(2) + ' > 1,3 (' + lengths.join('/') + ')');
    if (Math.abs(lengths[key] - mean) / mean > 0.2) err(id, 'panjang kunci menyimpang ' + Math.round((lengths[key] - mean) / mean * 100) + '% dari rata-rata opsi (maksimal 20%)');
    // Stem: 60–90 kata; berakhir "... adalah ..." atau tanda tanya.
    const stemWords = words(k.stem);
    if (stemWords < 60 || stemWords > 90) err(id, 'stem ' + stemWords + ' kata (harus 60–90)');
    if (!/adalah \.\.\.$/.test(k.stem.trim()) && !/\?$/.test(k.stem.trim())) err(id, 'stem tidak berakhir "adalah ..." atau tanda tanya');

    // Frasa sisa kerangka lama dan sisipan; level Bloom di teks harus sama dengan field bloom.
    const texts: [string, string][] = [['stem', k.stem], ['pembahasan', k.explanation], ['tip', k.tip], ['source', k.source], ['difficultyReason', k.difficultyReason], ['penentu', k.penentu],
      ...k.options.flatMap((o, i) => [['opsi ' + i, o.text], ['alasan opsi ' + i, o.reason]] as [string, string][])];
    for (const [where, text] of texts) {
      for (const [pattern, label] of FRASA_SISA) if (pattern.test(text)) err(id, where + ' memuat frasa sisa "' + label + '"');
      for (const level of text.match(/\bC[1-6]\b/g) ?? []) if (level !== k.bloom) err(id, where + ' menyebut ' + level + ' padahal bloom ' + k.bloom);
    }
    for (const where of [k.explanation, ...k.options.map((o) => o.reason)]) if (/\b(?:[Oo]psi|[Pp]ilihan|[Jj]awaban) [A-E]\b/.test(where)) err(id, 'pembahasan/alasan menyebut huruf opsi (opsi diacak)');
    k.options.forEach((o, i) => { if (ABSOLUT.test(o.text)) warn(id, 'opsi ' + i + ' memuat kata absolut: ' + o.text.match(ABSOLUT)![0]); });
    if (!/Konsep yang diuji/.test(k.explanation) || !/Fakta penentu/.test(k.explanation)) warn(id, 'pembahasan tanpa bagian "Konsep yang diuji" dan "Fakta penentu"');

    // R5 alasan: dua kalimat, memuat kata dari penentu, unik di seluruh katalog.
    const determinant = new Set(plain(k.penentu).filter((w) => w.length >= 5 && !STOP.has(w)));
    k.options.forEach((o, i) => {
      if (o.reason.split(/\.\s+(?=[A-Z“])/).length !== 2) warn(id, 'alasan opsi ' + i + ' bukan dua kalimat');
      if (!plain(o.reason).some((w) => determinant.has(w))) warn(id, 'alasan opsi ' + i + ' tidak memuat kata dari penentu');
      const canonical = o.reason.replace(/\s+/g, ' ').trim().toLowerCase();
      if (reasons.has(canonical)) err(id, 'alasan opsi ' + i + ' identik dengan ' + reasons.get(canonical)); else reasons.set(canonical, id + '#' + i);
      reasonWords.push([id + '#' + i, new Set(plain(o.reason).filter((w) => w.length > 3))]);
    });
  }
  for (const [id, n] of ids) if (n > 1) err(id, 'id ganda (' + n + ' kali)');
  if (BANK_MAP.size !== BANK.length) err('bank', 'ada id butir ganda di BANK (' + BANK.length + ' butir, ' + BANK_MAP.size + ' id unik)');
  // Kemiripan alasan lintas kasus (Jaccard ≥ 0,6 = peringatan).
  for (let i = 0; i < reasonWords.length; i++) for (let j = i + 1; j < reasonWords.length; j++) {
    const [first, a] = reasonWords[i], [second, b] = reasonWords[j];
    let shared = 0; for (const w of a) if (b.has(w)) shared++;
    const jaccard = shared / (a.size + b.size - shared || 1);
    if (jaccard >= 0.6 && first.split('#')[0] !== second.split('#')[0]) warn('alasan', first + ' ~ ' + second + ' Jaccard ' + jaccard.toFixed(2));
  }

  // Berkas: kasus berada di berkas kompetensinya; semua berkas di data/tkp-kasus/ terdaftar.
  for (const entry of berkas) for (const k of entry.kasus) if (isRecord(k) && k.topic !== entry.topic) err(k.id, 'berkas ' + entry.berkas + '.json untuk ' + entry.topic + ', kasus bertopik ' + k.topic);
  // Kuota: berkas yang tidak kosong menggusur seluruh kerangka lama kompetensinya (lib/bank/index.ts), jadi harus memuat minimal kuota kasus mudah + sedang.
  // Berkas kosong ([]) tetap sah (kompetensi itu masih memakai kerangka lama).
  for (const entry of berkas) {
    const quota = KUOTA_BERKAS[entry.berkas];
    if (!entry.kasus.length || quota === undefined) continue;
    const usable = entry.kasus.filter((k) => isRecord(k) && (k.difficulty === 'mudah' || k.difficulty === 'sedang')).length;
    if (usable < quota) err(entry.berkas + '.json', 'baru berisi ' + usable + ' kasus mudah + sedang (dari ' + entry.kasus.length + ' entri), kurang dari kuota ' + quota + ' untuk ' + entry.topic +
      '. Berkas yang terisi sebagian menggusur seluruh kerangka lama kompetensinya: lengkapi sampai kuota, atau kosongkan ([]).');
  }

  // Per kompetensi: kunci terpanjang ≤ 20%; peringkat panjang kunci 1–5 masing-masing 15–25%; posisi kunci A–E masing-masing 15–25%.
  // Di bawah 20 kasus persentase terlalu kasar untuk dijadikan galat; dilaporkan sebagai peringatan.
  const summary: Summary[] = [];
  for (const topic of TOPICS.TKP) {
    const own = kasus.filter((k) => k.topic === topic && Array.isArray(k.options) && k.options.length === 5 && k.options.some((o) => o.score === 5));
    if (!own.length) continue;
    const strict = own.length >= 20, flag = (message: string) => strict ? err(topic, message) : warn(topic, message + ' (hanya ' + own.length + ' kasus; ambang berlaku mulai 20)');
    const ranks = own.map((k) => { const lengths = k.options.map((o) => o.text.length), keyLength = lengths[k.options.findIndex((o) => o.score === 5)]; return 1 + lengths.filter((n) => n > keyLength).length; });
    const positions = own.map((k) => k.options.findIndex((o) => o.score === 5));
    const rankCount = [1, 2, 3, 4, 5].map((r) => ranks.filter((x) => x === r).length), positionCount = [0, 1, 2, 3, 4].map((p) => positions.filter((x) => x === p).length);
    if (!near(rankCount[0] / own.length, 0.2)) flag('kunci terpanjang pada ' + rankCount[0] + ' dari ' + own.length + ' kasus (' + percent(rankCount[0], own.length) + ', maksimal 20%)');
    rankCount.forEach((n, i) => { if (n / own.length < 0.15 - 1e-9 || !near(n / own.length, 0.25)) flag('peringkat panjang kunci ke-' + (i + 1) + ' = ' + n + ' kasus (' + percent(n, own.length) + ', target 15–25%)'); });
    positionCount.forEach((n, i) => { if (n / own.length < 0.15 - 1e-9 || !near(n / own.length, 0.25)) flag('posisi kunci ' + 'ABCDE'[i] + ' = ' + n + ' kasus (' + percent(n, own.length) + ', target 15–25%)'); });
    const entry = berkas.find((b) => b.topic === topic);
    summary.push({ berkas: entry?.berkas ?? topic, topic, total: own.length, mudah: own.filter((k) => k.difficulty === 'mudah').length, sedang: own.filter((k) => k.difficulty === 'sedang').length,
      sulit: own.filter((k) => k.difficulty === 'sulit').length, kunciTerpanjang: rankCount[0], peringkatPanjang: rankCount, posisiKunci: positionCount,
      pola: new Set(own.map((k) => k.pola)).size, peran: new Set(own.map((k) => k.peran)).size, tempat: new Set(own.map((k) => k.tempat)).size, keputusan: new Set(own.map((k) => k.keputusan)).size,
      bloom: count(own.map((k) => k.bloom + '/' + k.difficulty)) });
  }
  return { errors, warnings, summary };
}

// Berkas JSON di data/tkp-kasus/ yang belum didaftarkan di lib/bank/tkp-kasus.ts tidak akan pernah dimuat; lebih baik gagal keras daripada diam-diam.
export function unregisteredFiles(directory = join(process.cwd(), 'data', 'tkp-kasus')): string[] {
  const registered = new Set(TKP_KASUS_BERKAS.map((entry) => entry.berkas + '.json'));
  return readdirSync(directory).filter((name) => /\.json$/i.test(name) && !registered.has(name));
}

// Sebaran per paket hasil generate: skenario tidak berulang (dalam paket dan antarpaket pada satu proses), serta pola ≤15%, keputusan ≤20%,
// peran ≤25%, tempat ≤20% dari jumlah soal TKP paket (batas yang sama dengan penalti di lib/generate.ts).
export function checkGenerated(packages: Package[], label: string, uniqueAcross = true): Problems & { worst: Record<string, string> } {
  const errors: string[] = [], warnings: string[] = [], worst: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const pack of packages) {
    const tkp = pack.questions.filter((q) => q.subtest === 'TKP'), made = tkp.filter((q) => q.kasus);
    const inPackage = new Set<string>();
    for (const q of made) {
      if (inPackage.has(q.family)) errors.push(label + ' ' + pack.id + ': skenario ' + q.family + ' berulang dalam paket');
      inPackage.add(q.family);
      if (uniqueAcross && seen.has(q.family) && seen.get(q.family) !== pack.id) errors.push(label + ' ' + pack.id + ': skenario ' + q.family + ' sudah dipakai di ' + seen.get(q.family));
      seen.set(q.family, pack.id);
    }
    for (const key of ['pola', 'keputusan', 'peran', 'tempat'] as const) {
      const tally = count(made.map((q) => q.kasus![key])), limit = spreadLimit(key, tkp.length);
      const [top, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] ?? ['-', 0];
      if (n > limit) errors.push(label + ' ' + pack.id + ': ' + key + ' "' + top + '" ' + n + ' dari ' + tkp.length + ' soal TKP (batas ' + limit + ')');
      if (!worst[key] || n > Number(worst[key].split('/')[0])) worst[key] = n + '/' + limit + ' ' + top;
    }
  }
  return { errors, warnings, worst };
}

// Format pembahasan TKP (QC akademik #2; dirakit lib/pembahasan.ts saat tampil/ekspor), berurutan: "**Konsep yang digunakan:**" dan "**Kata kunci:**" (bila ada di sumber),
// "Opsi X (5 poin) paling tepat karena …", penegasan prinsip (boleh), "**Pembahasan opsi lain:**", TEPAT empat opsi nonkunci "A (3 poin) …" berurutan dengan satu label
// poin yang sama dengan skornya, lalu "**Cara cepat:**" bila ada tip. Tidak ada "(4 poin): (4 poin)", ejaan "Poin", atau entri kunci di daftar opsi lain.
export function tkpFormatProblems(q: Pick<Question, 'subtest' | 'topic' | 'explanation' | 'answer' | 'options' | 'tip' | 'kasus'>): string[] {
  const L = String.fromCharCode(65 + q.answer), others = q.options.map((_, i) => i).filter((i) => i !== q.answer), problems: string[] = [];
  const lines = explanationOf(q).split('\n').filter((line) => !/^\s*(?:\*\*)?Sumber\s*:/i.test(line));
  const at = (pattern: RegExp) => lines.findIndex((line) => pattern.test(line));
  const concept = at(/^\*\*Konsep yang digunakan:\*\* \S/), keywords = at(/^\*\*Kata kunci:\*\* \S/), key = at(new RegExp('^Opsi ' + L + ' \\(5 poin\\) paling tepat\\b')), others0 = lines.indexOf('**Pembahasan opsi lain:**');
  const order = [concept, keywords, key, others0].filter((index, i) => index >= 0 || i >= 2);
  if (order.some((index, i) => index < 0 || (i > 0 && index <= order[i - 1])) || (concept >= 0 && concept !== 0)) problems.push('urutan label bukan Konsep → Kata kunci → Opsi ' + L + ' (5 poin) → Pembahasan opsi lain');
  const items = others0 < 0 ? [] : lines.slice(others0 + 1, others0 + 5);
  if (items.length !== 4 || items.some((line, i) => !line.startsWith(String.fromCharCode(65 + others[i]) + ' (' + q.options[others[i]].score + ' poin) ') || line.length < 12)) problems.push('daftar opsi lain bukan tepat empat opsi nonkunci berpoin benar');
  const tail = others0 < 0 ? [] : lines.slice(others0 + 5), tip = q.tip?.trim();
  if (tip ? tail.length !== 1 || tail[0] !== '**Cara cepat:** ' + tip.replace(/\s+/g, ' ') : tail.length) problems.push('sesudah empat opsi lain hanya boleh "Cara cepat:"');
  if (lines.some((line) => (line.match(/\(\d\s*poin\)/gi) ?? []).length > 1 || /\(\d\s*poin\)\s*:/i.test(line) || /\bPoin\b/.test(line))) problems.push('label poin ganda atau ejaan "Poin"');
  if (q.kasus && (concept < 0 || keywords < 0 || !tip)) problems.push('kasus orisinal tanpa "Konsep yang digunakan", "Kata kunci", atau "Cara cepat"');
  return problems;
}
function pembahasanFormat(check: Check) {
  const locals = LOCAL_RECIPES.filter((r) => r.subtest === 'TKP').map((r) => renderLocal({ kind: 'local', version: 1, model: r.model, context: r.context, state: r.state, order: [4, 2, 0, 1, 3] }));
  const packed = ['JADIASN-2027', 'qc2-tkp'].flatMap((seed) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed, mode: 'TKP', count: 45, packages: 2 }))).flatMap((pack) => pack.questions);
  const items: (Pick<Question, 'subtest' | 'topic' | 'explanation' | 'answer' | 'options' | 'tip' | 'kasus'> & { id: string })[] = [...BANK.filter((q) => q.subtest === 'TKP'), ...locals, ...packed];
  const failing = items.map((q) => [q.id, tkpFormatProblems(q)] as const).filter(([, problems]) => problems.length);
  check(!failing.length, 'Pembahasan TKP semua sumber (' + items.length + ' butir: bank, kasus orisinal, contoh, model lokal, paket teracak): label berurutan, empat opsi nonkunci dengan satu label poin, "Cara cepat:" di akhir: ' +
    failing.slice(0, 4).map(([id, problems]) => id + ' ' + problems.join('; ')).join(' | '));
  // Uji mutasi: pembahasan suntingan berbentuk akhir tidak dirakit ulang, jadi kesalahan format lama (kunci diulang, label poin ganda, urutan terbalik) harus tertangkap.
  const sample = packed.find((q) => q.kasus)!, L = String.fromCharCode(65 + sample.answer), letters = sample.options.map((o, i) => String.fromCharCode(65 + i) + ' (' + o.score + ' poin) ');
  const assembled = explanationOf(sample), keyLine = 'Opsi ' + L + ' (5 poin) paling tepat karena alasan.';
  const mutants = [
    assembled.replace('**Pembahasan opsi lain:**', '**Pembahasan opsi lain:**\n' + letters[sample.answer] + 'alasan kunci diulang.'),
    assembled.replace(/\n([A-E]) \((\d) poin\) /, '\n$1 ($2 poin): ($2 poin) '),
    assembled.replace(/^Opsi [A-E] \(5 poin\) paling tepat[^\n]*\n/m, '').replace('**Pembahasan opsi lain:**', '**Pembahasan opsi lain:**').replace(/\n\*\*Cara cepat:\*\*/, '\n' + keyLine + '\n**Cara cepat:**'),
    assembled.replace(' poin) ', ' Poin) '),
  ];
  check(mutants.every((explanation) => explanation !== assembled && tkpFormatProblems({ ...sample, explanation }).length > 0), 'Pemeriksa format TKP menolak kunci diulang, label poin ganda, urutan label terbalik, dan ejaan "Poin".');
  // Kelengkapan field kasus orisinal: konsep dari "Konsep yang diuji:", kata kunci dari field kataKunci, cara cepat dari tip.
  const kataKunci = TKP_KASUS.filter((k) => k.kataKunci?.trim()).length, kataKunciSalah = TKP_KASUS.map((k) => [k.id, kataKunciProblems(k)] as const).filter(([, problems]) => problems.length);
  check(kataKunci === TKP_KASUS.length && !kataKunciSalah.length, 'Kata kunci kasus orisinal terisi ' + kataKunci + '/' + TKP_KASUS.length + ', 4–6 istilah dari stem tanpa duplikat: ' +
    kataKunciSalah.slice(0, 4).map(([id, problems]) => id + ' ' + problems.join('; ')).join(' | '));
  // Uji mutasi pemeriksa kata kunci: istilah di luar stem (temuan QC "rapat investor" dan "modul"), jumlah istilah, duplikat, dan huruf kapital ditolak.
  const contoh = { stem: 'Anda diminta memeriksa berkas sebelum rapat siang bersama kepala seksi dan petugas penelaah. Tindakan Anda adalah ...' };
  const salah = ['rapat investor, berkas, kepala seksi, petugas penelaah', 'modul, rapat siang, kepala seksi, petugas penelaah', 'rapat siang, berkas, kepala seksi', 'rapat siang, berkas, berkas, kepala seksi', 'Rapat siang, berkas, kepala seksi, petugas penelaah'];
  check(!kataKunciProblems({ ...contoh, kataKunci: 'rapat siang, pemeriksaan berkas, kepala seksi, petugas penelaah' }).length && salah.every((kataKunci) => kataKunciProblems({ ...contoh, kataKunci }).length > 0),
    'Pemeriksa kata kunci menerima istilah dari stem (dengan imbuhan) dan menolak istilah di luar stem, jumlah di luar 4–6, duplikat, dan huruf kapital.');
  return { diperiksa: items.length, kasus: { total: TKP_KASUS.length, konsep: TKP_KASUS.filter((k) => /Konsep yang diuji\s*:/.test(k.explanation)).length, kataKunci, caraCepat: TKP_KASUS.filter((k) => k.tip?.trim()).length } };
}

// Profil tryout-2027: TKP diambil dari kasus orisinal, bukan contoh tryout acuan (keputusan user 3 Nov 2026, QC akademik #2). Kuota per bab mengikuti mapping,
// skenario tidak berulang antarpaket, dan tidak ada butir yang stimulusnya sama dengan contoh acuan TKP (data/tryout-reference.json, tetap disimpan).
function tryoutTkp(check: Check) {
  const key = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const acuan = new Set(ACCEPTED_BANK.filter((q) => q.subtest === 'TKP').map((q) => key(q.stem)));
  check(acuan.size > 0 && TRYOUT_TKP.length === TKP_KASUS.length && TRYOUT_TKP.every((q) => q.kasus && !q.provenance && !acuan.has(key(q.stem))), 'Sumber TKP profil tryout = ' + TKP_KASUS.length + ' kasus orisinal, tanpa contoh acuan (' + acuan.size + ' stimulus acuan).');
  const base = normalizeSettings({ ...DEFAULT_SETTINGS, ...PROFILE_SETTINGS });
  const rows = profilePlan(base).filter((row) => row.subtest === 'TKP');
  const stock = rows.map((row) => ({ bab: row.chapter, kuota: row.count, stok: TRYOUT_TKP.filter((q) => q.topic === row.topic).length }));
  const most = Math.min(...stock.map((s) => Math.floor(s.stok / s.kuota)));
  const tkpErrors = (packages: number) => profileCapacityErrors(normalizeSettings({ ...base, packages })).filter((error) => rows.some((row) => error.includes(' ' + row.chapter + ':')));
  check(!tkpErrors(most).length && tkpErrors(most + 1).length > 0 && tkpErrors(most + 1).every((error) => error.startsWith('Kasus orisinal TKP')), 'Kapasitas TKP profil tryout tanpa ulang = ' + most + ' paket; paket berikutnya ditolak dengan pesan kasus orisinal.');
  const problems: string[] = [];
  for (const [seed, twkSource] of [['JADIASN-2027', 'new'], ['qc2-tryout', 'accepted']] as const) {
    const packs = generate(normalizeSettings({ ...base, seed, packages: most, twkSource, tkpSource: 'accepted' })), seen = new Set<string>();
    for (const pack of packs) {
      const tkp = pack.questions.filter((q) => q.subtest === 'TKP');
      for (const q of tkp) {
        if (!q.kasus || q.provenance || q.proof.kind !== 'bank' || !q.proof.id.startsWith('tkp-kasus-') || acuan.has(key(q.stem))) problems.push(seed + ' ' + pack.id + ': ' + q.id + ' bukan kasus orisinal');
        if (seen.has(q.family)) problems.push(seed + ' ' + pack.id + ': skenario ' + q.family + ' berulang antarpaket');
        seen.add(q.family);
      }
      for (const row of rows) if (tkp.filter((q) => q.mappingId === row.id).length !== row.count) problems.push(seed + ' ' + pack.id + ': kuota ' + row.chapter + ' berbeda');
    }
  }
  check(!problems.length, 'Paket profil tryout: semua TKP kasus orisinal, kuota per bab sesuai mapping, skenario tanpa ulang antarpaket: ' + problems.slice(0, 4).join(' | '));
  return { stokPerBab: stock, paketTanpaUlang: most };
}

export function runTkpChecks(check: Check) {
  const data = checkKasusBank(TKP_KASUS, TKP_KASUS_BERKAS);
  check(!data.errors.length, 'Bank TKP baru lulus pemeriksaan data (' + data.errors.length + ' galat): ' + data.errors.slice(0, 6).join(' | '));
  const loose = unregisteredFiles();
  check(!loose.length, 'Semua berkas data/tkp-kasus/ terdaftar di lib/bank/tkp-kasus.ts; belum terdaftar: ' + loose);
  // Kerangka lama tidak dipakai untuk kompetensi yang sudah punya kasus baru, dan skor seluruh bank TKP permutasi 1–5 dengan kunci bernilai 5.
  const tkpBank = BANK.filter((q) => q.subtest === 'TKP');
  check(!tkpBank.some((q) => q.id.startsWith('tkp-case-v2-') && TKP_KASUS_TOPICS.has(q.topic)), 'Kerangka TKP lama tidak dipakai untuk kompetensi yang sudah punya kasus baru.');
  check(tkpBank.every((q) => q.options.map((o) => o.score).sort().join('') === '12345' && q.options[q.answer].score === 5), 'Seluruh bank TKP: skor permutasi 1–5 dan answer = indeks skor 5.');
  check(tkpBank.filter((q) => q.kasus).length === TKP_KASUS.length && tkpBank.filter((q) => q.kasus).every((q) => q.kasus!.skenario), 'Setiap kasus baru masuk BANK dengan metadata.');
  // Paket hasil generate beberapa seed: SKD 2 paket (45 TKP per paket) dan paket TKP saja, satu kompetensi dan seluruh kompetensi.
  const problems: string[] = [], worst: Record<string, string> = {};
  let packages = 0;
  const runs: [string, Parameters<typeof normalizeSettings>[0]][] = [];
  for (const seed of ['JADIASN-2027', 'tkp-sebaran-1', 'tkp-sebaran-2', 'tkp-sebaran-3']) {
    runs.push(['SKD ' + seed, { seed, packages: 2 }]);
    runs.push(['TKP 45 ' + seed, { seed, mode: 'TKP', count: 45, packages: 2 }]);
    runs.push(['TKP PP 20 ' + seed, { seed, mode: 'TKP', count: 20, packages: 1, topics: ['Pelayanan Publik'] }]);
  }
  for (const [label, partial] of runs) {
    const made = generate(normalizeSettings({ ...DEFAULT_SETTINGS, ...partial }));
    const result = checkGenerated(made, label); packages += made.length;
    problems.push(...result.errors);
    for (const [key, value] of Object.entries(result.worst)) if (!worst[key] || Number(value.split('/')[0]) > Number(worst[key].split('/')[0])) worst[key] = value;
  }
  check(!problems.length, 'Paket hasil generate: skenario TKP unik dan sebaran per paket dalam batas: ' + problems.slice(0, 5).join(' | '));
  // Banyak paket (pembagian lintas paket, lib/bagi.ts): memilih paket demi paket menumpuk sisa kasus dengan strata sama di paket terakhir, jadi batas sebaran
  // harus dipenuhi di SEMUA paket pada 24 seed untuk 5 paket (dan 8 seed untuk 4 paket), tanpa skenario berulang antarpaket dan tanpa gagal.
  const many: string[] = [], failures: string[] = [], seedsUsed = new Set<string>();
  let manyPackages = 0;
  for (const [count, seeds] of [[5, 24], [4, 8]] as const) for (let n = 0; n < seeds; n++) {
    const label = 'TKP 45 x' + count + ' lintas-' + n; seedsUsed.add('lintas-' + n);
    try {
      const made = generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TKP', count: 45, packages: count, seed: 'lintas-' + n }));
      manyPackages += made.length; many.push(...checkGenerated(made, label).errors);
    } catch (error) { failures.push(label + ': ' + (error instanceof Error ? error.message : error)); }
  }
  check(!failures.length, 'TKP 4 dan 5 paket tidak gagal pada ' + seedsUsed.size + ' seed: ' + failures.slice(0, 3).join(' | '));
  check(!many.length && manyPackages === 24 * 5 + 8 * 4, 'TKP 4 dan 5 paket: skenario unik antarpaket dan sebaran dalam batas di semua paket (' + manyPackages + ' paket): ' + many.slice(0, 5).join(' | '));
  // Seed JADIASN-2027, 2 paket: kasus Pelayanan Publik baru dipakai tanpa duplikasi skenario.
  const sample = generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed: 'JADIASN-2027', packages: 2 }));
  const sampleKasus = sample.flatMap((p) => p.questions.filter((q) => q.kasus && q.topic === 'Pelayanan Publik').map((q) => q.family));
  check(!TKP_KASUS_TOPICS.has('Pelayanan Publik') || (sampleKasus.length > 0 && new Set(sampleKasus).size === sampleKasus.length), 'Seed JADIASN-2027 (2 paket) memakai kasus Pelayanan Publik baru tanpa duplikasi skenario.');
  const pembahasan = pembahasanFormat(check), tryout = tryoutTkp(check);
  return { kasus: TKP_KASUS.length, kompetensiDenganKasus: [...TKP_KASUS_TOPICS], perKompetensi: data.summary, peringatan: { jumlah: data.warnings.length, contoh: data.warnings.slice(0, 10) },
    paketDiperiksa: packages, paketLintas: manyPackages, sebaranTerburuk: worst, pembahasan, tryout };
}

// Dijalankan langsung: cetak semua galat dan peringatan data, lalu seluruh pemeriksaan.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/tkp-checks.ts')) {
  const data = checkKasusBank(TKP_KASUS, TKP_KASUS_BERKAS);
  console.log(JSON.stringify({ kasus: TKP_KASUS.length, ringkasan: data.summary }, null, 2));
  data.warnings.forEach((w) => console.log(' ~', w));
  data.errors.forEach((e) => console.log(' x', e));
  let checks = 0;
  const check: Check = (condition, message) => { assert.ok(condition, message); checks++; };
  try { const report = runTkpChecks(check); console.log(JSON.stringify({ status: 'PASS', checks, ...report, perKompetensi: undefined }, null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
}
