// Pembahasan TWK dan TKP dirakit dari field yang sudah ada (explanation, alasan tiap opsi, tip, kunci) saat ditampilkan atau diekspor, sehingga bank,
// soal model lokal, contoh tryout, dan paket tersimpan memakai satu bentuk tanpa mengubah datanya. Dipanggil dari explanationOf (lib/explanation.ts).
// Acuan: hasil QC akademik #2 (standar pembahasan Nynda/Tri/Dhea untuk TWK, Nynda untuk TKP).
//
//   TWK   satu paragraf (konsep → fakta → hubungan → "Opsi yang paling tepat adalah X, karena …"), lalu
//         "Alasan opsi salah:" dengan HANYA empat opsi nonkunci ("A. …"), lalu "Cara cepat:". Tanpa tebal di dalam isi.
//   TKP   "Konsep yang digunakan:", "Kata kunci:" (bila ada), "Opsi X (5 poin) paling tepat karena …", "Pembahasan opsi lain:" dengan empat opsi
//         nonkunci ("A (3 poin) …", satu label poin per opsi), "Cara cepat:". Label dicetak tebal; isinya biasa.
// Penebalan label "Jawaban:" dan "Pembahasan:" yang dicetak keluaran: TWK gaya Nynda (Nasionalisme, Integritas, Bela Negara, Pilar Negara) tidak menebalkannya,
// TWK Bahasa Negara (gaya Dhea) dan TKP menebalkannya; judul "Soal N" dan materi selalu tebal (tidak diatur di sini).
import { withoutGenericReason } from './reasons';

type CaseOption = { text?: string; reason?: string; score?: number };
export type CaseQuestion = { subtest?: string; topic?: string; answer: number; options?: CaseOption[]; tip?: string; kasus?: { kataKunci?: string } };
export type PembahasanGaya = 'nynda' | 'dhea' | 'tkp';

export const BAHASA_NEGARA = 'Bahasa Negara';
export const WRONG_LABEL = 'Alasan opsi salah:';
export const OTHERS_LABEL = 'Pembahasan opsi lain:';
export const TIP_LABEL = 'Cara cepat:';
export const isCaseSubtest = (q: { subtest?: string }) => q.subtest === 'TWK' || q.subtest === 'TKP';
export const pembahasanGaya = (q: CaseQuestion): PembahasanGaya | null => q.subtest === 'TKP' ? 'tkp' : q.subtest === 'TWK' ? q.topic === BAHASA_NEGARA ? 'dhea' : 'nynda' : null;
// "Jawaban:" dan "Pembahasan:" tebal pada keluaran cetak? Hanya TWK gaya Nynda yang tidak.
export const boldAnswerLabels = (q: CaseQuestion) => pembahasanGaya(q) !== 'nynda';
// Cara cepat TWK/TKP ikut menyatu dalam pembahasan rakitan; hanya soal lain (TIU) yang menampilkannya terpisah.
export const separateTip = (q: CaseQuestion) => isCaseSubtest(q) ? undefined : q.tip;
// Teks sudah berbentuk akhir (hasil suntingan atau rakitan sebelumnya): tidak dirakit ulang.
const ASSEMBLED = /(?:^|\n)\s*(?:\*\*)?(?:Alasan opsi salah|Pembahasan opsi lain):/;
export const isAssembled = (text: string) => ASSEMBLED.test(text);

const letter = (index: number) => String.fromCharCode(65 + index);
// Nama diri dan sapaan yang tetap berhuruf kapital di awal kalimat; singkatan (dua huruf kapital pertama) selalu dipertahankan.
const PROPER = new Set(['Anda', 'Indonesia', 'Pancasila', 'Soedirman', 'Kongres', 'Sumpah', 'Proklamasi', 'Piagam', 'Jenderal', 'Presiden', 'Bhinneka', 'Undang-Undang', 'Bung', 'Majelis', 'Mahkamah', 'Badan']);
export const lower1 = (text: string) => {
  const word = /^[^\s,;:.]+/.exec(text)?.[0] ?? '';
  return !word || PROPER.has(word) || /^[A-Z]{2}/.test(word) || /^[A-Z][a-z]*[A-Z\d]/.test(word) || word[0] === word[0].toLowerCase() ? text : word[0].toLowerCase() + text.slice(1);
};
export const upper1 = (text: string) => text ? text[0].toUpperCase() + text.slice(1) : text;
const end = (text: string) => /[.!?…:]["”’)]*$/.test(text) ? text : text + '.';
const squash = (text: string) => text.replace(/\s+/g, ' ').trim();
const dotless = (text: string) => squash(text).replace(/[.:;,\s]+$/, '');

// Alasan opsi tanpa awalan sumber: "(4 poin)", "karena", "Benar." dan alasan pengisi (kosong).
export function cleanReason(raw: string | undefined): string {
  let text = squash(withoutGenericReason(raw ?? ''));
  text = text.replace(/^\(?\s*\d\s*poin\s*\)?\s*[:.\-–]?\s*/i, '').replace(/^(?:Benar|Tepat|Salah)[.:]\s+/i, '').replace(/^(?:paling\s+(?:tepat|lengkap)\s+)?karena\s+/i, '');
  return text;
}

// Memecah teks sumber menurut label yang dipakai generator dan acuan lama. `lead` = teks sebelum label pertama (seluruh teks bila tanpa label);
// contoh riset TWK menaruh "Konsep:" dan "Kata Kunci:" sesudah paragrafnya.
type Parts = { concept?: string; keywords?: string; fact?: string; extra: string[]; body: string; lead: string; legacy: boolean };
const LABEL = /(Konsep(?: yang (?:digunakan|diuji))?\s*:|Kata [Kk]unci\s*:|Fakta penentu\s*:|Pilihan terbaik\s*:|Pembeda 5 dan 4 poin\s*:)/g;
export function splitSource(text: string): Parts {
  const raw = text.replace(/\r\n?/g, '\n').trim(), parts: Parts = { extra: [], body: raw, lead: raw, legacy: false };
  const cuts = [...raw.matchAll(LABEL)];
  if (!cuts.length) return parts;
  parts.lead = raw.slice(0, cuts[0].index).trim();
  cuts.forEach((cut, i) => {
    const label = /^Konsep/.test(cut[1]) ? 'concept' : /^Kata/.test(cut[1]) ? 'keywords' : /^Fakta/.test(cut[1]) ? 'fact' : /^Pilihan/.test(cut[1]) ? 'best' : 'diff';
    const chunk = raw.slice(cut.index! + cut[0].length, i + 1 < cuts.length ? cuts[i + 1].index : undefined);
    // Kepala = isi label itu sendiri; sisanya (baris berikutnya, atau kalimat "Opsi X ..." yang menyambung) menjadi baris tambahan.
    const [head, ...rest] = chunk.split(/\s*\n+\s*|\s+(?=Opsi\s+[A-E]\b)/).map(squash).filter(Boolean);
    if (label === 'concept') parts.concept = head; else if (label === 'keywords') parts.keywords = head; else if (label === 'fact') parts.fact = head;
    if (label !== 'best' && label !== 'diff') parts.extra.push(...rest.filter((line) => !/^Opsi\s+[A-E]\b/.test(line)));
  });
  parts.legacy = parts.fact !== undefined || /Pilihan terbaik\s*:/.test(raw);
  return parts;
}

const wrongOptions = (q: CaseQuestion) => (q.options ?? []).flatMap((option, index) => index === q.answer ? [] : [{ index, option, reason: cleanReason(option.reason) }]).filter((item) => item.reason);
const norm = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Kalimat kunci sumber diseragamkan menjadi "Opsi yang paling tepat adalah X, karena …" (QC akademik #2). Dua bentuk sumber yang dikenali:
//   "Opsi/Pilihan/Jawaban yang paling tepat adalah <isi kunci> karena …" → "… adalah X, yaitu <isi kunci>, karena …" (isi kunci dicocokkan dengan kata awal teks opsi kunci, lihat isKey;
//                                                                          disebut ulang karena kalimat sesudahnya sering merujuknya, mis. "itulah ikrar …")
//   "Opsi X (paling) tepat karena …" (X = huruf kunci)                    → "Opsi yang paling tepat adalah X, karena …"
// Huruf atau isi yang bukan kunci tidak disentuh.
const NAMED_CLOSING = /\b(?:Opsi|Pilihan|Jawaban) yang (?:paling )?(?:tepat|benar) (?:adalah|ialah) (“[^”]+”|"[^"]+"|[^.!?“"]+?),? karena /g;
const LETTER_CLOSING = /\b(?:Opsi|Pilihan|Jawaban) ([A-E]) (?:yang )?(?:paling )?(?:tepat|benar),? karena /g;
function standardClosing(body: string, q: CaseQuestion, L: string): string {
  const keyWords = norm(q.options?.[q.answer]?.text ?? '').split(' ').filter(Boolean);
  // Isi kunci: kata-kata awal teks opsi kunci muncul di awal isi yang disebut (boleh didahului "simpulan bahwa" dan sejenisnya). Kunci ≥ 3 kata boleh
  // berbeda bentuk pada separuh kata awalnya ("Nyatakan …, minta …" → "menyatakan …, meminta …"). Kalimat "yang paling tepat adalah …" memang menyebut kunci;
  // pencocokan ini hanya penjaga agar huruf yang disisipkan tidak salah.
  const isKey = (named: string) => { const words = norm(named.replace(/…|\.\.\./g, ' ')).split(' ').filter(Boolean), n = Math.min(4, keyWords.length);
    if (!n || words.length < n) return false;
    const head = new Set(words.slice(0, n + 3)), hits = keyWords.slice(0, n).filter((word) => head.has(word)).length;
    return hits === n || n >= 3 && hits >= Math.ceil(n / 2); };
  return body.replace(NAMED_CLOSING, (all, named: string) => {
    const bare = named.replace(/^[“"]|[”"]$/g, '').trim();
    if (/^[A-E]$/.test(bare)) return bare === L ? 'Opsi yang paling tepat adalah ' + L + ', karena ' : all;
    return isKey(bare) ? 'Opsi yang paling tepat adalah ' + L + ', yaitu ' + named.trim() + ', karena ' : all;
  }).replace(LETTER_CLOSING, (all, x: string) => x === L ? 'Opsi yang paling tepat adalah ' + L + ', karena ' : all);
}

function twk(q: CaseQuestion, text: string): string {
  const parts = splitSource(text), key = cleanReason(q.options?.[q.answer]?.reason), L = letter(q.answer);
  const lines = (value: string) => value.split('\n').map(squash).filter(Boolean);
  // Konsep → fakta terpilih → hubungan. "Kata kunci" tidak dipakai pada TWK. Fakta yang berupa salinan bacaan atau tugas (Bahasa Negara, teks panjang,
  // isian ___) tidak diulang di pembahasan (QC: jangan menyalin ulang stimulus sebagai "Fakta penentu").
  const sentences: string[] = [];
  if (parts.concept) sentences.push(end('Konsep yang diuji dalam soal ini adalah ' + lower1(dotless(parts.concept))));
  if (parts.fact && q.topic !== BAHASA_NEGARA && parts.fact.length <= 280 && !/___/.test(parts.fact)) sentences.push(end('Dalam kasus ini, ' + lower1(parts.fact)));
  sentences.push(...lines(parts.lead).map(end), ...parts.extra.map(end));
  // "Gagasan utamanya adalah: Penyediaan …" → "… adalah penyediaan …" (paragraf, bukan label).
  let body = standardClosing(sentences.join(' ').replace(/\b(adalah|ialah|yaitu|menunjukkan):\s+(\S+)/g, (_, verb: string, first: string) => verb + (verb === 'menunjukkan' ? ' bahwa ' : ' ') + lower1(first)), q, L);
  // Penutup baku bila belum ada: dengan alasan kunci bila alasan itu belum tertulis di paragraf.
  if (!new RegExp('Opsi yang paling tepat adalah ' + L + '\\b').test(body)) {
    const closing = 'Opsi yang paling tepat adalah ' + L + (key && !norm(body).includes(norm(key)) || key && norm(body) === norm(key) ? ', karena ' + lower1(dotless(key)) + '.' : '.');
    body = key && norm(body) === norm(key) ? closing : [body, closing].filter(Boolean).join(' ');
  }
  const out = [body, WRONG_LABEL, ...wrongOptions(q).map((item) => letter(item.index) + '. ' + end(upper1(item.reason)))];
  if (q.tip?.trim()) out.push(TIP_LABEL + ' ' + squash(q.tip));
  return out.join('\n');
}

function tkp(q: CaseQuestion, text: string): string {
  const parts = splitSource(text), keyOption = q.options?.[q.answer], key = cleanReason(keyOption?.reason), L = letter(q.answer);
  const keywords = q.kasus?.kataKunci ?? parts.keywords;
  const lines: string[] = [];
  if (parts.concept) lines.push('**Konsep yang digunakan:** ' + end(upper1(dotless(parts.concept))));
  else if (!parts.legacy && text.trim() && !parts.extra.length) lines.push(...text.replace(/\r\n?/g, '\n').split('\n').map(squash).filter(Boolean));
  if (keywords?.trim()) lines.push('**Kata kunci:** ' + end(dotless(keywords)));
  lines.push('Opsi ' + L + ' (' + (keyOption?.score ?? 5) + ' poin) paling tepat' + (key ? ' karena ' + end(lower1(dotless(key))) : '.'));
  // Penegasan prinsip: teks sebelum label pertama (bila sumbernya berlabel) dan baris sesudah isi label.
  lines.push(...(parts.lead !== parts.body ? parts.lead.split('\n').map(squash).filter(Boolean) : []).map(end), ...parts.extra.map(end));
  lines.push('**' + OTHERS_LABEL + '**', ...wrongOptions(q).map((item) => letter(item.index) + ' (' + item.option.score + ' poin) ' + end(lower1(item.reason))));
  if (q.tip?.trim()) lines.push('**Cara cepat:** ' + squash(q.tip));
  return lines.join('\n');
}

// Pembahasan akhir untuk soal TWK/TKP; soal lain, soal tanpa alasan opsi, dan teks yang sudah berbentuk akhir dikembalikan apa adanya.
// Baris metadata "Sumber: …" tidak ikut dirakit ke paragraf: ditaruh utuh di akhir supaya documentExplanation tetap dapat membuangnya dari naskah terbit.
const META_LINE = /^\s*(?:\*\*)?Sumber\s*:/i;
export function caseExplanation(q: CaseQuestion, text: string): string {
  const gaya = pembahasanGaya(q);
  if (!gaya || !q.options?.length || !q.options.some((option) => typeof option.reason === 'string') || isAssembled(text)) return text;
  const all = text.replace(/\r\n?/g, '\n').split('\n'), meta = all.filter((line) => META_LINE.test(line)), body = all.filter((line) => !META_LINE.test(line)).join('\n');
  return [gaya === 'tkp' ? tkp(q, body) : twk(q, body), ...meta].join('\n');
}
