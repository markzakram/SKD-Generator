// Pemeriksaan silogisme menurut Blueprint Silogisme Tanpa Logika Kuantor (akademik, 28 Okt 2026, disesuaikan 29 Okt). Dipakai scripts/tiu-format-checks.ts.
//  - checkSilogismeBlueprint(q, fail): pemeriksa SATU soal yang dihitung ulang secara mandiri (tidak membaca rumus dari penyusun): tabel kebenaran tiap opsi, jenis kesalahan,
//    format stem, dan format pembahasan (urutan, hukum, rumus tiap langkah, kesimpulan, jawaban). Silogisme Biasa berakhir pada "Jawaban: kalimat" tanpa analisis opsi dan tanpa alasan
//    opsi (blueprint Bagian 8); Silogisme Narasi menambahkan analisis kelima opsi berhuruf (huruf lewat {opsi:N}, opsi salah dicoret) dengan alasan singkat menurut jenis kesalahan.
//    Contoh blueprint (kode N2-01 sampai N3-11, lib/silo-contoh.ts) diperiksa dengan aturan yang sama, kecuali aturan kerangka bahasa pembangkit (frasa berulang) yang tidak berlaku
//    pada tulisan tim akademik.
//  - runSilogismeChecks(check, options): setiap pola katalog benar-benar terbangkitkan (576 konfigurasi dua premis, 12.096 tiga premis, narasi, perluasan), lalu stress seed per chapter,
//    kerangka bahasa, statistik penyajian, pemakaian contoh blueprint (19 contoh dipakai lebih dahulu pada profil variasi dan latihan bebas, pembangkit hanya mengisi kekurangan), dan keberagaman keluarga
//    modus per paket tryout (QC akademik 2 Nov 2026: lima butir silogisme sepaket berkeluarga berbeda, redaksi konsekuen-dahulu paling banyak 10%, tiga premis tepat tiga kalimat tanpa pengisi, label Premis 4).
//    Dijalankan langsung (`npx tsx scripts/silogisme-checks.ts`): seluruh pemeriksaan di atas dijalankan dan ringkasannya dicetak.
import assert from 'node:assert/strict';
import { analysisBlock, ANALYSIS_MARK, explanationOf } from '../lib/explanation';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate, normalizeSettings } from '../lib/generate';
import { solveModel } from '../lib/models';
import { positionReferences } from '../lib/reasons';
import { rng } from '../lib/rng';
import { BIASA_FRAMES, NARASI_FRAMES, type Frame, type Prop } from '../lib/silo-frames';
import { CONTOH_NARASI, contohAt, contohBuild, contohOf, keluargaOfCode, keluargaOfContoh } from '../lib/silo-contoh';
import { constrainNarrativePackage } from '../lib/silo-production';
import { barisan, keluargaButir } from '../lib/silo-rencana';
import { allConfigs, base2, codeOf, COUNT2, COUNT3, FAM2, formsOf, keluargaOfConfig, keyForms, KELUARGA, type Config, type Form, type Keluarga } from '../lib/silo-spec';
import { entails, not, variable, type Logic } from '../lib/solver';
import { buildFromConfig, buildLogika, ERROR_NAME, randomConfig, type Chapter, type ErrorTag } from '../lib/tiu-logika';
import type { Question } from '../lib/types';

type Check = (condition: unknown, message: string) => void;
export const BANNED = /\b(jika|apabila|bila|kalau|maka|sehingga|karena|agar|sebab|akibatnya)\b/i;
export const QUANTIFIERS = /\b(semua|setiap|seluruh|sebagian|beberapa)\b/i;
const LIT = /^(\\neg )?([pqrst])$/;
const lit = (text: string): Logic | undefined => { const m = LIT.exec(text.trim()); return m ? (m[1] ? not(variable(m[2])) : variable(m[2])) : undefined; };
// Rumus LaTeX penyusun pembahasan (literal, a \to b, a \lor b, a \land b, \neg (a \land b), \neg (a \to b)) menjadi pohon logika; undefined bila di luar tata bahasa itu.
export function parseSym(tex: string): Logic | undefined {
  const text = tex.trim(), negated = /^\\neg \((.+)\)$/.exec(text);
  if (negated) { const inner = parseSym(negated[1]); return inner ? not(inner) : undefined; }
  const op = / \\(to|lor|land) /.exec(text);
  if (!op) return lit(text);
  const parts = text.split(op[0]);
  if (parts.length !== 2) return undefined;
  const left = lit(parts[0]), right = lit(parts[1]);
  if (!left || !right) return undefined;
  return op[1] === 'to' ? { op: 'implies', left, right } : { op: op[1] === 'lor' ? 'or' : 'and', left, right };
}
const sameLogic = (a: Logic | undefined, b: Logic | undefined) => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);
const equiv = (a: Logic, b: Logic) => entails([a], [b])[0] && entails([b], [a])[0];
const negate = (l: Logic): Logic => l.op === 'not' ? l.item : not(l);
// Hasil penerapan hukum pada operandnya (urutan operand bebas), atau undefined bila hukum itu tidak berlaku pada operand tersebut.
export function derive(law: 'mp' | 'mt' | 'sk' | 'sd', ops: Logic[]): Logic | undefined {
  if (ops.length !== 2) return undefined;
  for (const [x, y] of [[ops[0], ops[1]], [ops[1], ops[0]]]) {
    if (law === 'mp' && x.op === 'implies' && sameLogic(x.left, y)) return x.right;
    if (law === 'mt' && x.op === 'implies' && sameLogic(negate(x.right), y)) return negate(x.left);
    if (law === 'sk' && x.op === 'implies' && y.op === 'implies' && sameLogic(x.right, y.left)) return { op: 'implies', left: x.left, right: y.right };
    if (law === 'sd' && x.op === 'or' && sameLogic(negate(x.left), y)) return x.right;
    if (law === 'sd' && x.op === 'or' && sameLogic(negate(x.right), y)) return x.left;
  }
  return undefined;
}
const LAW_OF: Record<string, 'mp' | 'mt' | 'sk' | 'sd'> = { 'Modus Ponens': 'mp', 'Modus Tollens': 'mt', 'hukum Silogisme': 'sk', 'rumus silogisme': 'sk', 'Silogisme Disjungtif': 'sd' };
const tex = (line: string) => /\\\((.*)\\\)/.exec(line)?.[1];
const unbold = (line: string) => line.replace(/\*\*/g, '');
const TAGS = Object.keys(ERROR_NAME) as ErrorTag[];
export const isContoh = (code?: string) => /^N[23]-\d\d$/.test(code ?? ''); // butir jadi dari contoh blueprint (lib/silo-contoh.ts)
const STEMS = [/^Simpulan yang pasti benar( berdasarkan (ketentuan|ketiga premis) tersebut)? adalah …\.$/, /^Hubungan yang pasti mengikuti (kedua ketentuan|ketiga premis|ketentuan) tersebut adalah …\.$/, /^Pernyataan yang setara dengan simpulan (kedua|ketiga) premis adalah …\.$/,
  /^(Berdasarkan kedua premis tersebut, apa yang dapat (disimpulkan|dipastikan)|Apa yang dapat disimpulkan) mengenai kebenaran pernyataan bahwa .+\?$/];

// Frasa berulang: urutan tiga kata atau lebih yang muncul dua kali dalam satu kalimat atau opsi (subjek ditutup karena opsi boleh mengulang subjek). Dihitung mandiri (tidak memakai lib/silo-lang.ts).
const SUBJECTS = [...BIASA_FRAMES, ...NARASI_FRAMES].flatMap((frame) => frame.subjects.map(([noun, id]) => (noun ? noun + ' ' + id : id).toLowerCase())).sort((a, b) => b.length - a.length);
export function repeatedWords(text: string, min = 3): string | undefined {
  let rest = text.toLowerCase();
  for (const subject of SUBJECTS) rest = rest.split(subject).join(' ');
  const words = rest.replace(/[.,…?;]/g, ' ').split(/\s+/).filter(Boolean);
  for (let n = min; n <= 8; n++) for (let i = 0; i + n <= words.length; i++) {
    const phrase = words.slice(i, i + n).join(' ');
    for (let j = i + n; j + n <= words.length; j++) if (words.slice(j, j + n).join(' ') === phrase) return phrase;
  }
  return undefined;
}
// Frasa pengisi berulang antarkalimat (narasi): tiga kata yang sama pada dua kalimat berbeda setelah SEMUA frasa proposisi kerangka (semua kerangka narasi) dan nama subjek dibuang;
// proposisi penghubung memang muncul pada dua premis, keterangan rujukan atau pembuka konteks tidak boleh diulang. Dihitung mandiri (tidak memakai lib/silo-lang.ts).
const NARASI_MASKS = [...NARASI_FRAMES.flatMap((frame) => frame.props.flatMap((p) => [p.pos, p.neg, ...(p.mod ?? []), ...(p.cat ?? []), ...(p.right ?? [])])), ...NARASI_FRAMES.flatMap((frame) => frame.subjects.map(([noun, id]) => (noun ? noun + ' ' + id : id)))]
  .map((text) => text.toLowerCase()).sort((a, b) => b.length - a.length);
export function fillerAcross(sentences: string[]): string | undefined {
  const grams = sentences.map((sentence) => {
    let rest = sentence.toLowerCase();
    for (const mask of NARASI_MASKS) rest = rest.split(mask).join(' § ');
    const found = new Set<string>();
    for (const chunk of rest.split('§')) { const words = chunk.replace(/[.,…?;]/g, ' ').split(/\s+/).filter(Boolean); for (let i = 0; i + 3 <= words.length; i++) found.add(words.slice(i, i + 3).join(' ')); }
    return found;
  });
  for (let i = 0; i < grams.length; i++) for (const gram of grams[i]) if (grams.some((other, j) => j > i && other.has(gram))) return gram;
  return undefined;
}
const countTidak = (text: string) => (text.match(/\btidak\b/gi) ?? []).length;
// Kalimat tidak gramatikal atau janggal: kategori "penerima" tanpa daftar, "keterangan bahwa … berlaku", dan pewatas "dengan/tanpa" yang disusul "(tidak) termasuk …" dalam satu kalimat
// ("Arman dengan pendaftaran peserta tidak termasuk pemilik hak memilih sesi"), serta "termasuk penerima/pemilik …" (berkas atau desain bukan penerima).
export const UNGRAMMATICAL = /\b(tercakup dalam|berada di luar|tercantum dalam) (pemilik|penerima|penyerah)\b|keterangan bahwa .* berlaku|\b(dengan|tanpa)\b[^.]*\btermasuk\b|\btermasuk (penerima|pemilik)\b/;
// Kombinasi yang bertentangan dengan pengetahuan umum pada kerangka bahasa (dicegat pada soal hasil pembangkit): keadaan "tertutup" bersama "mengalirkan air", hasil "gagal" bersama
// "sertifikat", dan "tepat waktu" bersama "tidak terbebas dari denda".
export const COMMON_SENSE = /tertutup[^.]*\bmengalirkan\b|\bmengalirkan\b[^.]*tertutup|gagal[^.]*\bsertifikat\b|\bsertifikat\b[^.]*gagal|tepat waktu[^.]*tidak terbebas dari denda/;
// Kalimat pengisi tanpa peran logis (QC akademik 2 Nov): letak ruang, meja panduan, warna map atau tutup, ikon. Narasi menjadi panjang hanya karena rujukan, status, hak, atau cakupan yang perlu dibaca.
export const FILLER_CUES = /\b(terletak|menghadap|berwarna|bercat|ditempatkan di dekat|di sisi ruang|meja (layanan|panduan|pembagian)|map (berwarna|abu)|tutup berwarna|ikon)\b/i;
const isRelation = (logic: Logic | undefined) => !!logic && (logic.op === 'implies' || logic.op === 'or');

export function checkSilogismeBlueprint(q: Question, fail: (text: string) => void): string {
  const model = q.proof.kind === 'model' ? q.proof.model : undefined;
  if (!model || model.kind !== 'syllogism') return fail('bukti model silogisme tidak ada'), 'tanpa-model';
  const P = model.premises, n = P.length, narasi = !!model.chapter?.endsWith('Narasi'), contoh = isContoh(model.code), keyText = q.options[q.answer].text, lines = q.explanation.split('\n');
  if (!model.chapter || !model.code || !['2 Premis', '3 Premis', '2 Premis - Narasi', '3 Premis - Narasi'].includes(model.chapter) || (n !== (model.chapter.startsWith('3') ? 3 : 2))) fail('chapter dan jumlah premis model tidak sesuai');
  // 1. Tabel kebenaran: tepat satu opsi sah, tidak ada opsi lain yang setara dengan kunci, opsi "tidak dapat disimpulkan" hanya benar bila tidak ada kesimpulan sah.
  const solved = solveModel(q);
  if (solved.filter(Boolean).length !== 1 || !solved[q.answer]) fail('kunci berbeda dari hasil solver model');
  if (new Set(q.options.map((o) => o.text)).size !== 5) fail('lima opsi harus berbeda');
  const found = q.options.map((o) => model.options.find((x) => x.text === o.text));
  if (found.some((f) => !f)) return fail('opsi tidak ada pada model'), 'tanpa-opsi';
  const tdsKey = !found[q.answer]!.logic;
  // Jenis kesalahan tiap opsi dicocokkan lewat teks opsi pada model (urutan opsi dapat diacak setelah soal dibuat).
  const errs = found.map((f) => model.errors?.[model.options.indexOf(f!)] ?? null);
  if (found.filter((f) => !f!.logic).length > 1) fail('opsi "Tidak dapat disimpulkan" paling banyak satu');
  const holds = found.map((f) => f!.logic ? entails(P, [f!.logic])[0] : null), against = found.map((f) => f!.logic ? entails(P, [not(f!.logic)])[0] : null);
  if (tdsKey) {
    if (holds.some((h) => h === true)) fail('TDS: ada opsi yang pasti mengikuti premis');
    found.forEach((f, i) => { if (errs[i] === 'kepastian' && (holds[i] || against[i])) fail('TDS: pernyataan yang ditanyakan sudah pasti benar atau pasti salah'); });
    if (!found.some((_, i) => errs[i] === 'kepastian' && !!found[i]!.logic)) fail('TDS: pernyataan yang ditanyakan (dan negasinya) harus menjadi opsi');
  } else {
    if (!holds[q.answer]) fail('kunci tidak mengikuti premis');
    q.options.forEach((_, i) => { if (i !== q.answer && (holds[i] || (found[i]!.logic && equiv(found[i]!.logic!, found[q.answer]!.logic!)))) fail('opsi ' + (i + 1) + ' mengikuti premis atau setara dengan kunci'); });
    P.forEach((_, drop) => { if (entails(P.filter((_p, i) => i !== drop), [found[q.answer]!.logic!])[0]) fail('kunci tetap pasti tanpa salah satu premis (premis tidak diperlukan)'); });
  }
  // 2. Jenis kesalahan dan alasan opsi. Silogisme Biasa tidak memuat alasan opsi (analisis opsi hanya untuk Narasi, blueprint Bagian 8). Alasan Narasi singkat: kunci dibuka dengan
  // "Maknanya sama dengan hasil penalaran langsung." (TDS: "Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan."), redaksi pengecoh sesuai status dari tabel kebenaran,
  // dan keempat pengecoh tidak boleh berbunyi sama semua.
  const errors = errs;
  if (errors[q.answer] !== null || errors.some((e, i) => i !== q.answer && !TAGS.includes(e as ErrorTag))) fail('setiap pengecoh harus dipetakan ke satu dari lima jenis kesalahan blueprint');
  q.options.forEach((o, i) => {
    if (!narasi) { if (o.reason !== '') fail('Silogisme Biasa tidak memuat alasan opsi (opsi ' + (i + 1) + ')'); return; }
    const right = i === q.answer;
    if (!o.reason.trim() || o.reason.split(/\s+/).length > 45) fail('alasan opsi ' + (i + 1) + ' wajib ada dan singkat (paling banyak 45 kata)');
    if (right && !o.reason.startsWith(tdsKey ? 'Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan.' : 'Maknanya sama dengan hasil penalaran langsung.')) fail('alasan kunci tidak sesuai redaksi blueprint: ' + o.reason.slice(0, 60));
    if (!right && /berlawanan|bertentangan/.test(o.reason) && !against[i]) fail('alasan opsi ' + (i + 1) + ' menyebut bertentangan padahal premis tidak menolaknya: ' + o.reason.slice(0, 60));
    if (!right && /belum diketahui|belum pasti|tidak dijamin|belum ditetapkan|masih sesuai/.test(o.reason) && against[i]) fail('alasan opsi ' + (i + 1) + ' menyebut belum pasti padahal premis menolaknya: ' + o.reason.slice(0, 60));
  });
  if (narasi && new Set(q.options.flatMap((o, i) => i === q.answer ? [] : [o.reason])).size < 2) fail('alasan keempat pengecoh tidak boleh sama semua (berbeda menurut jenis kesalahan)');
  // 3. Stem: satu paragraf premis tanpa label, titik dua, penghubung bersyarat, penanda sebab-akibat, dan kuantor; narasi juga tanpa koma.
  const stemLines = q.stem.split('\n'), question = stemLines[stemLines.length - 1], premiseText = stemLines.slice(0, -1).join(' '), sentences = premiseText.split(/(?<=\.) (?=\p{Lu})/u);
  if (stemLines.length !== 2 || sentences.length !== n || !STEMS.some((pattern) => pattern.test(question))) fail('stem harus memuat tepat ' + n + ' kalimat premis dalam satu paragraf lalu satu kalimat pertanyaan baku');
  if (/^Premis\s*\d/m.test(q.stem) || premiseText.includes(':') || BANNED.test(premiseText) || QUANTIFIERS.test(premiseText)) fail('premis tidak boleh berlabel, bertitik dua, berpenghubung bersyarat, bersebab-akibat, atau berkuantor: ' + premiseText.slice(0, 80));
  if (q.options.some((o) => BANNED.test(o.text) || QUANTIFIERS.test(o.text) || o.text.includes(':'))) fail('opsi memuat penghubung bersyarat, penanda sebab-akibat, kuantor, atau titik dua');
  // Narasi tanpa koma sama sekali (blueprint Bagian B: "Hindari koma"); contoh blueprint menulis "Dalam ketentuan … hak …" tanpa koma.
  if (narasi && (q.stem.includes(',') || q.options.some((o) => o.text.includes(',')))) fail('narasi tidak memakai koma pada stem dan opsi');
  if (!narasi && sentences.some((s) => s.split(' ').length > 40)) fail('premis Silogisme Biasa harus ringkas');
  if (FILLER_CUES.test(premiseText)) fail('kalimat pengisi tanpa peran logis (letak ruang, meja, warna, atau ikon): ' + FILLER_CUES.exec(premiseText)![0]);
  // Frasa berulang pada tiap premis dan opsi, kalimat tidak gramatikal, paling banyak dua kata "tidak" per opsi, dan kunci berupa hubungan: semua opsi berupa hubungan.
  // (Contoh blueprint adalah tulisan tim akademik: aturan kerangka bahasa pembangkit di bawah ini tidak berlaku padanya.)
  if (!contoh) {
    sentences.forEach((sentence, i) => { const phrase = repeatedWords(sentence); if (phrase) fail('premis ' + (i + 1) + ' memuat frasa berulang: "' + phrase + '"'); });
    q.options.forEach((o, i) => {
      const phrase = repeatedWords(o.text);
      if (phrase) fail('opsi ' + (i + 1) + ' memuat frasa berulang: "' + phrase + '"');
      if (countTidak(o.text) > 2) fail('opsi ' + (i + 1) + ' memuat lebih dari dua kata "tidak": ' + o.text.slice(0, 90));
    });
    if (UNGRAMMATICAL.test(q.stem) || q.options.some((o) => UNGRAMMATICAL.test(o.text))) fail('kalimat tidak gramatikal atau janggal ("tercakup dalam pemilik …", "keterangan bahwa … berlaku", atau "dengan/tanpa … termasuk …")');
    if (COMMON_SENSE.test(q.stem) || q.options.some((o) => COMMON_SENSE.test(o.text))) fail('kalimat bertentangan dengan pengetahuan umum (katup tertutup mengalirkan air, gagal bersertifikat, dan sejenisnya)');
    // Narasi: keterangan rujukan atau pembuka konteks yang sama tidak boleh diulang pada tiap premis (hanya frasa proposisi penghubung yang boleh muncul pada dua premis).
    const filler = narasi ? fillerAcross(sentences) : undefined;
    if (filler) fail('narasi: frasa pengisi berulang antarpremis: "' + filler + '"');
  }
  if (!tdsKey && (/^Hubungan yang pasti/.test(question) || isRelation(found[q.answer]!.logic)) && found.some((f) => !isRelation(f!.logic))) fail('kunci berupa hubungan: semua opsi harus berupa hubungan (implikasi atau disjungsi), bukan literal tunggal, "dan", atau "tidak terjadi bersamaan"');
  if (tdsKey && !keyText.startsWith('Tidak dapat disimpulkan')) fail('kunci TDS harus berbunyi "Tidak dapat disimpulkan …"');
  // 4. Pembahasan menurut urutan blueprint: kutipan premis, definisi variabel, rumus premis, hukum, kesimpulan, jawaban, lalu analisis opsi.
  lines.slice(0, n).forEach((line, i) => { if (unbold(line) !== 'Premis ' + (i + 1) + ': ' + sentences[i]) fail('baris "Premis ' + (i + 1) + ':" harus mengutip kalimat premis di soal'); });
  const spans = (line: string) => (line.match(/\*\*[^*]+\*\*/g) ?? []).length;
  if (narasi ? lines.slice(0, n).some((line) => spans(line) < 1) : lines.slice(0, n).some((line) => line.includes('**'))) fail(narasi ? 'narasi: kata kunci variabel pada kutipan premis wajib tebal' : 'Silogisme Biasa: kutipan premis tidak ditebalkan');
  if (lines[n] !== '') fail('baris kosong setelah kutipan premis');
  // Label Premis 4 (blueprint Bagian 8 dan 14): dua premis tanpa langkah; tiga premis tepat dua langkah ("Langkah 1 (Premis a + b)" lalu "Langkah 2 (Premis 4 + c)"), hasil antara berlabel "Kesimpulan (Premis 4)",
  // Premis 1–3 mengikuti urutan tampil pada stem (rumus tiap label dicocokkan dengan premis stem di bawah) dan ketiganya dipakai tepat sekali.
  const stepHeads = lines.filter((line) => line.startsWith('**Langkah ')), interimLines = lines.filter((line) => line.startsWith('**Kesimpulan (Premis 4): '));
  if (n === 2) { if (stepHeads.length || lines.some((line) => /Premis 4/.test(line))) fail('dua premis: tanpa "Langkah" dan tanpa label Premis 4'); }
  else {
    const first = /^\*\*Langkah 1 \(Premis ([123]) \+ ([123])\):\*\*$/.exec(stepHeads[0] ?? ''), second = /^\*\*Langkah 2 \(Premis (4 \+ [123]|[123] \+ 4)\):\*\*$/.exec(stepHeads[1] ?? '');
    const covered = first && second ? new Set([first[1], first[2], ...second[1].split(' + ').filter((x) => x !== '4')]) : undefined, at = interimLines.length === 1 ? lines.indexOf(interimLines[0]) : -1;
    if (stepHeads.length !== 2 || !first || !second || !covered || first[1] === first[2] || covered.size !== 3 || at < lines.indexOf(stepHeads[0]) || at > lines.indexOf(stepHeads[1])) fail('tiga premis: dua langkah ("Langkah 1 (Premis a + b)", "Langkah 2 (Premis 4 + c)"), Premis 1–3 dipakai tepat sekali, dan hasil antara berlabel "Kesimpulan (Premis 4)" di antara kedua langkah');
  }
  const names = new Set<string>(), collect = (l: Logic) => { if (l.op === 'var') names.add(l.name); else if (l.op === 'not') collect(l.item); else { collect(l.left); collect(l.right); } };
  P.forEach(collect);
  const analysisAt = lines.indexOf(ANALYSIS_MARK);
  const defs = lines.slice(n + 1, analysisAt < 0 ? lines.length : analysisAt).flatMap((line) => { const m = /^\\\(([pqrs])\\\): (\S.*)$/.exec(line); return m ? [m[1]] : []; });
  if ([...names].some((name) => !defs.includes(name)) || defs.length !== names.size || new Set(defs).size !== defs.length) fail('setiap variabel pada premis didefinisikan tepat satu kali ("p: …") dengan kalimat positif');
  if (!narasi && analysisAt >= 0) fail('Silogisme Biasa tidak memuat "Analisis setiap opsi" (format inti berakhir pada jawaban kalimat)');
  if (narasi && analysisAt < 0) return fail('bagian "Analisis setiap opsi" wajib ada pada Silogisme Narasi'), 'tanpa-analisis';
  const body = lines.slice(n + 1, analysisAt < 0 ? lines.length : analysisAt);
  let operands = new Map<number, Logic>(), pending: Logic | undefined, final: Logic | undefined, interim: Logic | undefined, concluded = false, keyEquivalence = false, tdsLine = false;
  const opsNow = () => [...operands.values()];
  for (let i = 0; i < body.length; i++) {
    const line = body[i], plain = unbold(line);
    let m: RegExpExecArray | null;
    if (/^\\\(([pqrs])\\\): /.test(line) || line === '') continue;
    if ((m = /^\*\*Langkah (\d) \(Premis (\d)(?: [+] | dan )(\d)\):\*\*$/.exec(line))) { operands = new Map(); pending = undefined; continue; }
    if ((m = /^Premis (\d): \\\((.*)\\\)$/.exec(line))) {
      const label = Number(m[1]), parsed = parseSym(m[2]);
      if (!parsed) { fail('rumus pembahasan di luar tata bahasa yang diperiksa: ' + m[2]); continue; }
      if (label <= n && !equiv(parsed, P[label - 1])) fail('rumus "Premis ' + label + '" setara dengan premis ' + label + ' di soal: ' + m[2]);
      if (label === 4 && !entails(P, [parsed])[0]) fail('Premis 4 bukan akibat logis dari premis: ' + m[2]);
      if (label === 4 && interim && !sameLogic(parsed, interim)) fail('Premis 4 harus sama dengan kesimpulan langkah 1');
      operands.set(label, parsed); continue;
    }
    if ((m = /^Gunakan (hukum [^(]+) \(\\\((.*)\\\)\)$/.exec(line))) { // hukum ekuivalensi: sisi-sisinya setara dan hukumnya sesuai bentuk
      const sides = m[2].split(' \\equiv ').map(parseSym);
      if (sides.some((s) => !s) || sides.length < 2) { fail('rumus ekuivalensi di luar tata bahasa: ' + m[2]); continue; }
      const parsed = sides as Logic[];
      if (parsed.some((s) => !equiv(s, parsed[0]))) fail('hukum ekuivalensi menyamakan rumus yang tidak setara: ' + m[2]);
      if (!opsNow().some((o) => sameLogic(o, parsed[0])) && !(interim && sameLogic(interim, parsed[0]))) fail('hukum ekuivalensi tidak diterapkan pada rumus yang baru ditulis: ' + m[2]);
      const kind = JSON.stringify(parsed).includes('"and"') ? (parsed.some((s) => s.op === 'not' && s.item.op === 'implies') ? 'negasi implikasi' : 'De Morgan') : parsed.every((s) => s.op === 'implies') ? 'kontraposisi' : 'implikasi';
      if (!m[1].includes(kind)) fail('nama hukum "' + m[1] + '" tidak sesuai bentuk persamaan (' + kind + '): ' + m[2]);
      if (interim && sameLogic(interim, parsed[0])) keyEquivalence = true;
      continue;
    }
    if ((m = /^Gunakan (Modus Ponens|Modus Tollens|hukum Silogisme|rumus silogisme|Silogisme Disjungtif)$/.exec(plain))) {
      const ops = opsNow().slice(-2); pending = derive(LAW_OF[m[1]], ops);
      if (!pending) fail('hukum "' + m[1] + '" tidak berlaku pada rumus yang dipakai: ' + ops.map((o) => JSON.stringify(o)).join(' ; ').slice(0, 120));
      if (n === 2 && m[1] === 'hukum Silogisme' && !narasi) fail('dua premis Biasa memakai "rumus silogisme"');
      continue;
    }
    if ((m = /^Premis (\d)(?: dan |, )(\d) tidak masuk ke rumus silogisme manapun sehingga tidak dapat disimpulkan\.$/.exec(plain))) {
      tdsLine = true; const ops = opsNow().slice(-2);
      if ((['mp', 'mt', 'sk', 'sd'] as const).some((law) => derive(law, ops))) fail('TDS: ternyata ada hukum yang berlaku pada premis terakhir');
      if (!tdsKey) fail('baris TDS pada soal yang punya kesimpulan pasti');
      continue;
    }
    if ((m = /^\*\*Kesimpulan \(Premis 4\): \\\((.*)\\\)\*\*$/.exec(line))) {
      const parsed = parseSym(m[1]);
      if (!parsed || !sameLogic(parsed, pending)) fail('"Kesimpulan (Premis 4)" tidak sama dengan hasil penerapan hukum: ' + m[1]);
      interim = parsed; continue;
    }
    if ((m = /^Kesimpulan sementara: \*\*\\\((.*)\\\)\*\*$/.exec(line))) {
      const parsed = parseSym(m[1]);
      if (model.code?.startsWith('NI-')) { if (!parsed || !entails(P, [parsed])[0]) fail('"Kesimpulan sementara" (NI) bukan akibat logis dari premis: ' + m[1]); }
      else if (!parsed || !sameLogic(parsed, pending)) fail('"Kesimpulan sementara" tidak sama dengan hasil penerapan hukum: ' + m[1]);
      interim = parsed; continue;
    }
    if (line === '**Kesimpulan: Tidak dapat disimpulkan**') { concluded = true; if (!tdsKey || !tdsLine) fail('"Kesimpulan: Tidak dapat disimpulkan" hanya untuk TDS dengan baris penjelasannya'); continue; }
    if ((m = /^\*\*Kesimpulan: \\\((.*)\\\)\*\*$/.exec(line))) {
      const parsed = parseSym(m[1]); concluded = true; final = parsed;
      if (!parsed) { fail('kesimpulan di luar tata bahasa: ' + m[1]); continue; }
      if (interim && keyEquivalence) { if (!equiv(parsed, interim)) fail('"Kesimpulan" tidak setara dengan kesimpulan sementara'); } else if (!sameLogic(parsed, pending)) fail('"Kesimpulan" tidak sama dengan hasil penerapan hukum: ' + m[1]);
      continue;
    }
    // Pemetaan kata kunci (Bagian 20): lawan kata dibaca sebagai negasi proposisi pada domain yang tertulis di soal.
    if (narasi && (m = /^Pada (.+) status .+ dan .+ merupakan dua keadaan yang tersedia\.$/.exec(plain))) { if (!q.stem.toLowerCase().includes(m[1].toLowerCase())) fail('domain pasangan makna harus terbaca pada soal: ' + m[1]); continue; }
    if (narasi && (m = /^Ungkapan (.+) pada keadaan yang sama: \\\(\\neg ([pqrs])\\\)$/.exec(plain))) { if (!defs.includes(m[2])) fail('pemetaan lawan kata merujuk variabel yang belum didefinisikan'); continue; }
    // Perluasan NI (E-08): negasi implikasi menjadi konjungsi, penyederhanaan konjungsi, lalu Modus Ponens pada literal hasilnya.
    if (line === 'Gunakan penyederhanaan konjungsi') continue;
    if ((m = /^Gunakan Modus Ponens pada \\\((.*)\\\) dan \\\((.*)\\\)$/.exec(plain))) {
      const ops = [parseSym(m[1]), parseSym(m[2])];
      if (ops.some((o) => !o) || !interim || !sameLogic(ops[0], interim)) fail('Modus Ponens (NI) harus memakai kesimpulan sementara: ' + plain.slice(0, 80));
      pending = ops.every(Boolean) ? derive('mp', ops as Logic[]) : undefined;
      if (!pending) fail('Modus Ponens (NI) tidak berlaku: ' + plain.slice(0, 80));
      continue;
    }
    if (/^\*\*Jawaban: /.test(line)) continue;
    fail('baris pembahasan di luar format blueprint: ' + line.slice(0, 80));
  }
  const keyLogic = found[q.answer]!.logic;
  if (!concluded) fail('pembahasan harus berakhir pada "Kesimpulan"');
  if (tdsKey ? final !== undefined || !tdsLine : !final || !keyLogic || !equiv(final, keyLogic)) fail('"Kesimpulan:" pembahasan harus sama dengan (atau setara dengan) rumus opsi kunci');
  const jawabanAt = lines.findIndex((line) => line.startsWith('**Jawaban: '));
  if (jawabanAt < 0 || jawabanAt !== (narasi ? analysisAt - 2 : lines.length - 1) || lines[jawabanAt] !== '**Jawaban: ' + (tdsKey ? 'Tidak dapat disimpulkan' : keyText.replace(/\.$/, '')) + '**') fail('baris "**Jawaban: <teks kunci>**" harus tebal, memuat kunci, dan menutup pembahasan inti' + (narasi ? '' : ' (Silogisme Biasa: baris terakhir)'));
  if (!narasi) return model.chapter ?? 'tanpa-chapter';
  // 5. Analisis setiap opsi (Narasi): notasi tambahan bagi proposisi baru pada opsi; tiap opsi `{opsi:N}. teks` (salah tercoret, kunci tidak) lalu `→ **rumus** — alasan (**status**)`.
  // Pembahasan mentah memakai penanda {opsi:N} (nomor tetap opsi, Option.ref); pada tampilan huruf diisi dan butir diurutkan A sampai E, juga setelah opsi diacak.
  const analysis = lines.slice(analysisAt + 1);
  if (analysis.some((line) => /^[A-E]\.\s/.test(line)) || positionReferences(q.explanation).length) fail('pembahasan mentah tidak boleh menyebut huruf atau urutan opsi (pakai {opsi:N}, opsi diacak)');
  const extras = [...new Set(found.flatMap((f) => (f!.logic ? JSON.stringify(f!.logic).match(/"name":"(\w)"/g) ?? [] : []).map((s) => s.slice(8, -1))))].filter((name) => !names.has(name));
  const notation = analysis.filter((line) => /^\\\([pqrst]\\\): \S/.test(line)).map((line) => line[2]);
  if (notation.join() !== extras.sort().join() || (extras.length > 0) !== analysis.includes('Notasi tambahan ini hanya memetakan isi opsi dan tidak menjadi premis soal.')) fail('opsi dengan informasi tambahan wajib memetakan notasi tambahan dan menyatakan bahwa notasi itu bukan premis');
  const OPTION_ENTRY = /^\{opsi:(\d)\}\. (.+)$/, entries: { ref: number; head: string; arrow: string }[] = [];
  analysis.forEach((line, i) => { const m = OPTION_ENTRY.exec(line); if (m && analysis[i + 1]?.startsWith('→ ')) entries.push({ ref: Number(m[1]), head: m[2], arrow: analysis[i + 1] }); });
  if (entries.length !== 5) fail('analisis opsi harus memuat lima opsi');
  const refs = q.options.map((o) => o.ref);
  if (refs.some((ref) => ref === undefined) || new Set(refs).size !== 5) fail('setiap opsi narasi wajib membawa nomor tetap (Option.ref) yang berbeda');
  q.options.forEach((o, i) => {
    const right = i === q.answer, wanted = right ? o.text : '~~' + o.text + '~~', entry = entries.find((e) => e.ref === o.ref);
    if (!entry) return fail('analisis tidak memuat opsi ' + (i + 1) + ' (nomor tetap tidak cocok)');
    if (entry.head !== wanted) fail('opsi ' + (i + 1) + (right ? ' (kunci) tidak boleh dicoret dan teksnya harus sama' : ' (salah) wajib dicoret dan teksnya harus sama dengan opsi'));
    const m = /^→ \*\*(.+)\*\* — (.+) \(\*\*(kesimpulan yang dicari|bukan kesimpulan yang dicari)\*\*\)$/.exec(entry.arrow);
    if (!m) return fail('baris analisis opsi ' + (i + 1) + ' di luar format "→ **rumus** — alasan (**status**)": ' + entry.arrow.slice(0, 80));
    if (m[2] !== o.reason || (m[3] === 'kesimpulan yang dicari') !== right) fail('alasan atau status analisis opsi ' + (i + 1) + ' tidak sama dengan alasan opsi');
    const symbol = tex(m[1]), logic = found[i]!.logic;
    if (logic ? !symbol || !parseSym(symbol) || !equiv(parseSym(symbol)!, logic) : m[1] !== 'Tidak dapat disimpulkan') fail('rumus analisis opsi ' + (i + 1) + ' tidak sama dengan logika opsi');
  });
  // Tampilan: huruf terisi sesuai urutan opsi dan butir terurut A sampai E.
  const shown = explanationOf({ explanation: q.explanation, answer: q.answer, options: q.options }).split('\n'), shownAt = shown.indexOf(ANALYSIS_MARK) + 1;
  const heads = shown.slice(shownAt).filter((line) => /^[A-E]\. /.test(line));
  if (heads.join('|') !== q.options.map((o, i) => 'ABCDE'[i] + '. ' + (i === q.answer ? o.text : '~~' + o.text + '~~')).join('|') || shown.some((line) => line.includes('{opsi:'))) fail('huruf opsi pada tampilan analisis harus sesuai urutan opsi dan terurut A sampai E');
  return model.chapter ?? 'tanpa-chapter';
}

// ---- Pembangkitan: seluruh pola katalog dan stress seed ---------------------------------------------------------------------------------------
export const toQuestion = (built: ReturnType<typeof buildFromConfig>, id: string): Question => ({ id, no: 1, subtest: 'TIU', topic: 'Verbal', subtopic: 'Silogisme naratif', difficulty: 'sedang', family: 'silogisme', stem: built.stem,
  options: built.options.map((o) => ({ text: o.text, reason: o.reason, score: 0, ...(o.ref !== undefined ? { ref: o.ref } : {}) })), answer: built.answer, explanation: built.explanation, source: 'uji', origin: 'pola', bloom: built.bloom, proof: { kind: 'model', model: built.model } });
const problemsOf = (q: Question) => { const out: string[] = []; try { checkSilogismeBlueprint(q, (text) => out.push(text)); } catch (error) { out.push('galat: ' + (error as Error).message); } return out; };

// `catalog: false` melewatkan pembangkitan seluruh katalog (±10 detik) dan hanya menjalankan stress; dipakai verify:quality, sedangkan berkas ini dijalankan penuh sendiri.
export function runSilogismeChecks(check: Check, options: { stress?: number; catalog?: boolean; statistik?: number } = {}): Record<string, unknown> {
  const stress = options.stress ?? 3000, report: Record<string, unknown> = {}, started = Date.now();
  if (options.catalog !== false) runCatalogChecks(check, report);
  runFrameChecks(check, report);
  runContohChecks(check, report);
  runStressChecks(check, report, stress);
  runStatisticChecks(check, report, options.statistik ?? 250);
  runDiversityChecks(check, report);
  runRedactionChecks(check, report);
  report.ms = Date.now() - started;
  return report;
}
function runCatalogChecks(check: Check, report: Record<string, unknown>): void {
  // (a) Katalog: setiap konfigurasi Bagian 4.4 dan 14 dibangun dan lolos pemeriksa mandiri; jumlahnya sama dengan hitungan blueprint.
  for (const [premises, chapter, expected] of [[2, '2 Premis', 576], [3, '3 Premis', 12096]] as const) {
    const configs = allConfigs(premises), codes = new Set(configs.map(codeOf)), bad: string[] = [], tags = new Set<string>(), keys = new Set<string>();
    configs.forEach((cfg) => {
      let built;
      try { built = buildFromConfig(cfg, chapter, rng('katalog-' + codeOf(cfg))); } catch (error) { bad.push(codeOf(cfg) + ': ' + (error as Error).message); return; }
      const problems = problemsOf(toQuestion(built, 'k-' + codeOf(cfg)));
      if (problems.length) bad.push(codeOf(cfg) + ': ' + problems[0]);
      built.options.forEach((o) => { if (o.error) tags.add(o.error); });
      keys.add(cfg.base.fam);
    });
    check(configs.length === expected && codes.size === expected, chapter + ': katalog blueprint memuat ' + expected + ' konfigurasi berkode (diperoleh ' + configs.length + ', unik ' + codes.size + ')');
    check(bad.length === 0, chapter + ': ' + (configs.length - bad.length) + '/' + configs.length + ' konfigurasi terbangkitkan dan lolos pemeriksa; gagal: ' + bad.slice(0, 3).join(' | '));
    check(tags.size === 5, chapter + ': kelima jenis kesalahan pengecoh terpakai (' + [...tags].join(', ') + ')');
    report['katalog ' + chapter] = { konfigurasi: configs.length, keluarga: keys.size };
  }
  check(COUNT2.MP + COUNT2.MT + COUNT2.SK + COUNT2.SD + COUNT2.TK + COUNT2.TA === 32 && COUNT3.reduce((a, b) => a + b, 0) === 96, 'katalog dasar: 32 variasi dua premis dan 96 variasi tiga premis');
  // (b) Narasi: seluruh variasi dasar (tanpa indeks ekuivalensi E dan bentuk kunci K), semua urutan penyajian.
  for (const [chapter, premises] of [['2 Premis - Narasi', 2], ['3 Premis - Narasi', 3]] as const) {
    const bases = allConfigs(premises).filter((cfg) => cfg.forms.every((f) => f === 0) && cfg.keyForm === 0), bad: string[] = [];
    bases.forEach((cfg) => {
      // Seperti buildLogika, konfigurasi dicoba ulang dengan undian lain bila kerangka bahasa menolak (frasa berulang, alasan pengecoh seragam); gagal hanya bila semua percobaan gagal.
      let last = '';
      for (let attempt = 0; attempt < 8; attempt++) {
        try { const problems = problemsOf(toQuestion(buildFromConfig(cfg, chapter, rng('narasi-' + codeOf(cfg) + '-' + attempt)), 'n-' + codeOf(cfg))); if (!problems.length) return; last = problems[0]; break; } catch (error) { last = (error as Error).message; }
      }
      bad.push(codeOf(cfg) + ': ' + last);
    });
    check(bases.length === (premises === 2 ? 32 * 2 : 96 * 6) && bad.length === 0, chapter + ': ' + bases.length + ' variasi dasar bertanda (tiap urutan penyajian) terbangkitkan tanpa ekuivalensi; gagal: ' + bad.slice(0, 3).join(' | '));
    report['narasi ' + chapter] = bases.length;
  }
  // (c) Perluasan: bentuk De Morgan sebagai bentuk premis dan keluarga NI (negasi implikasi, contoh E-08).
  {
    let built = 0; const bad: string[] = [];
    for (const [fam, count] of [['MP', 4], ['MT', 4], ['SK', 8], ['SD', 8], ['TK', 4], ['TA', 4], ['NI', 8]] as const) for (let i = 0; i < count; i++) {
      const base = base2(fam, i), choices = base.premises.map((p) => formsOf(p, true));
      for (const forms of choices.reduce<Form[][]>((acc, list) => acc.flatMap((prefix) => list.map((f) => [...prefix, f])), [[]])) {
        if (fam !== 'NI' && !forms.includes(3)) continue;
        const cfg: Config = { base, forms, keyForm: keyForms(base)[i % keyForms(base).length], order: i % 2 };
        try { const problems = problemsOf(toQuestion(buildFromConfig(cfg, '2 Premis', rng('perluasan-' + codeOf(cfg))), 'x-' + codeOf(cfg))); built++; if (problems.length) bad.push(codeOf(cfg) + ': ' + problems[0]); } catch (error) { bad.push(codeOf(cfg) + ': ' + (error as Error).message); }
      }
    }
    check(built > 100 && bad.length === 0, 'perluasan De Morgan dan negasi implikasi (E-08): ' + built + ' konfigurasi lolos; gagal: ' + bad.slice(0, 3).join(' | '));
    report.perluasan = built;
  }
}
function runStressChecks(check: Check, report: Record<string, unknown>, stress: number): void {
  // (d) Stress: minimal 3000 seed per chapter lewat pintu masuk generator (buildLogika), tiap soal diperiksa mandiri.
  const stats: Record<string, unknown> = {};
  for (const [id, chapter] of [['b2', '2 Premis'], ['b2x', '2 Premis'], ['b3', '3 Premis'], ['b3x', '3 Premis'], ['n2', '2 Premis - Narasi'], ['n3', '3 Premis - Narasi']] as const) {
    const bad: string[] = [], codes = new Set<string>(), tds = { n: 0 }; let reversed = 0, withImplication = 0, firstFail = 0;
    for (let seed = 0; seed < stress; seed++) {
      const r = rng('stress-' + id + '-' + seed);
      const built = buildLogika(id, rng('stress-' + id + '-' + seed));
      // percobaan pertama tanpa pengulangan: seberapa sering konfigurasi acak gagal dibangun (diulang diam-diam oleh buildLogika)
      try { buildFromConfig(randomConfig(chapter, id.endsWith('x') ? 'always' : id === 'b3' ? 'maybe' : 'never', r), chapter, r); } catch { firstFail++; }
      codes.add(built.code); if (built.model.kind === 'syllogism' && built.model.options.every((o) => o.logic)) { /* kunci pasti */ } else tds.n++;
      if (built.reversed) reversed++;
      if (built.implications) withImplication++;
      const problems = problemsOf(toQuestion(built, 's-' + id + '-' + seed));
      if (problems.length && bad.length < 5) bad.push(built.code + ': ' + problems[0]);
      else if (problems.length) bad.push('');
    }
    check(bad.length === 0, id + ' (' + chapter + '): ' + stress + ' seed lolos pemeriksa mandiri; gagal ' + bad.length + ': ' + bad.filter(Boolean).slice(0, 3).join(' | '));
    if (chapter.endsWith('Narasi')) check(reversed <= 0.2 * stress && (withImplication === 0 || reversed > 0), id + ': susunan konsekuensi lebih dahulu paling banyak 20% soal (' + reversed + '/' + stress + ')');
    stats[id] = { seed: stress, kodeUnik: codes.size, tds: tds.n, terbalik: reversed, gagalPercobaanPertama: firstFail };
  }
  report.stress = stats;
}

// ---- Kerangka bahasa (lib/silo-frames.ts): tidak ada frasa berulang antarproposisi atau antara konteks dan proposisi ------------------------
const aForms = (p: Prop) => [p.pos, p.neg, ...(p.mod ?? [])]; // bentuk yang dapat muncul sebagai anteseden atau pewatas
const bForms = (p: Prop) => [p.pos, p.neg, ...(p.cat ?? []), ...(p.right ?? [])]; // bentuk yang dapat muncul sebagai konsekuen
function runFrameChecks(check: Check, report: Record<string, unknown>): void {
  const bad: string[] = [], longWords = (text: string) => text.toLowerCase().split(/\s+/).filter((word) => word.length >= 4);
  const listed = (frame: Frame) => (NARASI_FRAMES.includes(frame) ? 'narasi ' : 'biasa ') + frame.name;
  for (const frame of [...BIASA_FRAMES, ...NARASI_FRAMES]) {
    if (frame.props.length !== 5) bad.push(listed(frame) + ': harus memuat lima proposisi');
    frame.props.forEach((a, i) => {
      for (const form of [...aForms(a), ...bForms(a)]) { const phrase = repeatedWords(form); if (phrase) bad.push(listed(frame) + ': proposisi ' + (i + 1) + ' memuat frasa berulang "' + phrase + '"'); }
      for (const form of a.cat ?? []) if (!/^(tercakup dalam|tidak tercakup dalam|berada di luar|tercantum dalam|tidak tercantum dalam) /.test(form) || /^(tidak )?(tercakup dalam|tercantum dalam) (pemilik|penerima|penyerah)\b|^berada di luar (pemilik|penerima|penyerah)\b/.test(form)) bad.push(listed(frame) + ': kategori tidak gramatikal "' + form + '"');
      frame.props.forEach((b, j) => {
        if (i !== j) for (const x of aForms(a)) for (const y of bForms(b)) { const phrase = repeatedWords(x + ' ' + y); if (phrase) bad.push(listed(frame) + ': proposisi ' + (i + 1) + ' dan ' + (j + 1) + ' berbagi frasa "' + phrase + '"'); }
      });
      if (NARASI_FRAMES.includes(frame)) for (const form of [...aForms(a), ...bForms(a)]) { const phrase = repeatedWords(frame.ctx + ' ' + form); if (phrase) bad.push(listed(frame) + ': konteks dan proposisi ' + (i + 1) + ' berbagi frasa "' + phrase + '"'); }
    });
    // Konteks tidak memakai kata benda subjek ("pengoperasian katup saluran" + "katup K11"); hanya kerangka narasi menyisipkan konteks di depan subjek.
    const nouns = new Set(longWords(frame.subjects.map(([noun]) => noun).join(' '))), shared = longWords(frame.ctx).filter((word) => nouns.has(word));
    if (NARASI_FRAMES.includes(frame) && shared.length) bad.push(listed(frame) + ': konteks "' + frame.ctx + '" memakai kata benda subjek (' + shared.join(', ') + ')');
  }
  check(bad.length === 0, 'kerangka bahasa silogisme bersih dari frasa berulang dan kategori tidak gramatikal; masalah: ' + [...new Set(bad)].slice(0, 4).join(' | '));
  report.kerangka = BIASA_FRAMES.length + NARASI_FRAMES.length;
}

// ---- Contoh blueprint (lib/silo-contoh.ts): dipakai lebih dahulu, pembangkit hanya mengisi kekurangan ----------------------------------------------------------------------
function runContohChecks(check: Check, report: Record<string, unknown>): void {
  const bad: string[] = [], codeOfQuestion = (q: Question) => (q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' ? q.proof.model.code ?? '' : '');
  // (a) 19 contoh (8 dua premis, 11 tiga premis) lolos pemeriksa mandiri pada beberapa urutan opsi; urutan pemakaian tiap seed memuat semuanya tepat sekali, lalu habis.
  const two = contohOf('2 Premis - Narasi'), three = contohOf('3 Premis - Narasi');
  check(two.map((c) => c.code).join() === 'N2-01,N2-02,N2-03,N2-04,N2-05,N2-06,N2-07,N2-08' && three.map((c) => c.code).join() === 'N3-01,N3-02,N3-03,N3-04,N3-05,N3-06,N3-07,N3-08,N3-09,N3-10,N3-11' && CONTOH_NARASI.length === 19, 'contoh blueprint: 8 contoh dua premis dan 11 contoh tiga premis (Contoh 55 sampai 73)');
  for (const item of CONTOH_NARASI) for (let s = 0; s < 4; s++) { const found = problemsOf(toQuestion(contohBuild(item, rng('contoh-' + item.code + '-' + s)), 'contoh-' + item.code)); if (found.length) bad.push(item.code + ': ' + found[0]); }
  check(bad.length === 0, 'seluruh 19 contoh blueprint lolos pemeriksa mandiri (kunci tunggal, analisis lima opsi berhuruf benar setelah opsi diacak, tanpa aturan frasa pembangkit); gagal: ' + bad.slice(0, 3).join(' | '));
  for (const seed of ['a', 'b', 'kunci']) for (const [chapter, list] of [['2 Premis - Narasi', two], ['3 Premis - Narasi', three]] as const) {
    const order = list.map((_, i) => contohAt(chapter, seed, i)?.code);
    check(new Set(order).size === list.length && order.every(Boolean) && contohAt(chapter, seed, list.length) === undefined, 'urutan pemakaian contoh ' + chapter + ' (seed ' + seed + ') memuat semua contoh tepat sekali lalu habis');
  }
  // (b) Contoh bersusunan terbalik (55 dan 65) memiliki padanan kondisi-lebih-dahulu untuk batas produksi 20% per chapter (Bagian 25); padanan itu tetap lolos pemeriksa.
  for (const code of ['N2-01', 'N3-03']) {
    const item = CONTOH_NARASI.find((c) => c.code === code)!, original = toQuestion(contohBuild(item, rng('forward-' + code)), 'forward-' + code), converted = constrainNarrativePackage([original])[0], found = problemsOf(converted);
    check(converted.stem !== original.stem && !converted.stem.includes('melekat pada') && found.length === 0, code + ': padanan kondisi-lebih-dahulu menggantikan susunan terbalik dan tetap lolos (' + found[0] + ')');
  }
  // (c) Profil tryout variasi (TIU, lima paket, tanpa kewajiban unik antarpaket): keluarga modus tiap butir diatur perencana (lib/silo-rencana.ts), dan contoh blueprint berkeluarga itu dipakai lebih dahulu.
  // Banyak contoh terpakai per baris = jumlah min(butir keluarga f, contoh keluarga f); sebaran seimbang (tiap keluarga non-NEG dua kali per baris) memakai 8 dari 8 contoh dua premis dan 8 dari 11 contoh tiga premis.
  const run = generate(normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', mode: 'TIU', count: 35, tiuSource: 'variation', uniqueAcross: false, packages: 5, seed: 'contoh-uji' }));
  const row14 = run.flatMap((p) => p.questions.filter((q) => q.mappingId === 'map-14')), row15 = run.flatMap((p) => p.questions.filter((q) => q.mappingId === 'map-15'));
  const failures: string[] = [];
  for (const q of [...row14, ...row15]) { const found: string[] = []; checkSilogismeBlueprint(q, (text) => found.push(text)); if (found.length) failures.push(codeOfQuestion(q) + ': ' + found[0]); }
  for (const [label, rows, list, expected] of [['baris 14', row14, two, 8], ['baris 15', row15, three, 8]] as const) {
    const codes = rows.map(codeOfQuestion), used = codes.filter(isContoh), families = codes.map((code) => keluargaOfCode(code));
    const perFamily = KELUARGA.map((f) => families.filter((x) => x === f).length), possible = KELUARGA.reduce((sum, f, i) => sum + Math.min(perFamily[i], list.filter((item) => keluargaOfContoh(item) === f).length), 0);
    check(rows.length === 10 && new Set(used).size === used.length && used.length === possible && used.length === expected && perFamily.every((n, i) => KELUARGA[i] === 'NEG' ? n === 0 : n === 2),
      'profil variasi: ' + label + ' memakai ' + used.length + ' contoh blueprint (target ' + expected + ', maksimum menurut keluarga ' + possible + '), tiap keluarga non-NEG dua kali pada lima paket (' + codes.join(' ') + ')');
  }
  check(failures.length === 0 && run.every((p) => p.questions.filter((q) => q.mappingId === 'map-13').every((q) => !isContoh(codeOfQuestion(q)))), 'butir baris 13–15 profil variasi lolos pemeriksa mandiri; baris 13 (3 Premis Biasa) tidak memakai contoh narasi; ' + failures.slice(0, 2).join(' | '));
  // (d) Latihan bebas: contoh dipakai lebih dahulu menurut urutan pembuatan (semua paket), pembangkit mengisi kekurangan; kunci tersebar dan tidak ada soal kembar.
  const free = generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 60, packages: 4, seed: 'contoh-bebas', topics: ['Verbal'], subtopics: ['Verbal::Silogisme naratif'] })).flatMap((p) => p.questions);
  const sequence = (chapter: string) => free.filter((q) => q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' && q.proof.model.chapter === chapter).map(codeOfQuestion);
  for (const [chapter, size] of [['2 Premis - Narasi', two.length], ['3 Premis - Narasi', three.length]] as const) {
    const codes = sequence(chapter), head = codes.slice(0, size);
    check(codes.length > size && head.every(isContoh) && new Set(head).size === size && codes.slice(size).every((code) => !isContoh(code)), 'latihan bebas: ' + chapter + ' memakai ' + size + ' contoh lebih dahulu lalu pembangkit (' + codes.length + ' soal)');
  }
  const freeFailures: string[] = [];
  for (const q of free) if (q.proof.kind === 'model' && q.proof.model.kind === 'syllogism') { const found: string[] = []; checkSilogismeBlueprint(q, (text) => found.push(text)); if (found.length) freeFailures.push(codeOfQuestion(q) + ': ' + found[0]); }
  check(freeFailures.length === 0, 'latihan bebas: seluruh soal silogisme (contoh dan pembangkit) lolos pemeriksa mandiri; ' + freeFailures.slice(0, 2).join(' | '));
  report.contoh = { dua: two.length, tiga: three.length, profil14: row14.map(codeOfQuestion), profil15: row15.map(codeOfQuestion) };
}

// ---- Statistik penyajian: panjang opsi, aturan permukaan, dan komposisi jenis kesalahan -------------------------------------------------------------------------------------
// Sampel tetap (seed berurutan, sama pada setiap jalan) per pola. Kriteria: kunci terpendek atau terpanjang paling banyak 25% soal (acak murni ≈20%); menyisihkan opsi
// berbentuk "dan", "tidak terjadi bersamaan", atau predikat baru tidak pernah menyisakan satu opsi pada lebih dari 5% soal berkunci; satu komposisi jenis kesalahan tidak mendominasi.
export const SURFACE_RULES: [string, (text: string, logic: Logic | undefined) => boolean][] = [
  ['dan', (text) => / dan /.test(text)], ['tidak terjadi', (text) => /tidak terjadi|^Tidak benar bahwa|^Pernyataan bahwa/.test(text)], ['predikat baru', (_text, logic) => !!logic && JSON.stringify(logic).includes('"t"')],
];
function runStatisticChecks(check: Check, report: Record<string, unknown>, perId: number): void {
  type Row = { chapter: string; tds: boolean; shortest: boolean; longest: boolean; solo: boolean; relation: boolean; composition: string };
  const rows: Row[] = [];
  for (const id of ['b2', 'b2x', 'b3', 'b3x', 'n2', 'n3']) for (let seed = 0; seed < perId; seed++) {
    const built = buildLogika(id, rng('statistik-' + id + '-' + seed));
    const lens = built.options.map((o) => o.text.length), keyLen = lens[built.answer], keyOption = built.options[built.answer], tds = !keyOption.logic;
    const survivors = built.options.filter((o) => !SURFACE_RULES.some(([, rule]) => rule(o.text, o.logic)));
    rows.push({ chapter: built.chapter, tds, shortest: lens.every((n) => n >= keyLen), longest: lens.every((n) => n <= keyLen), solo: !tds && survivors.length === 1 && survivors[0] === keyOption,
      relation: !tds && isRelation(keyOption.logic), composition: built.options.flatMap((o) => o.error ? [o.error] : []).sort().join('+') });
  }
  const share = (list: Row[], test: (row: Row) => boolean) => list.length ? list.filter(test).length / list.length : 0, round = (value: number) => Math.round(value * 1000) / 10;
  const keyed = rows.filter((row) => !row.tds), chapters = [...new Set(rows.map((row) => row.chapter))];
  const stats = { soal: rows.length, kunciTerpendek: round(share(rows, (r) => r.shortest)), kunciTerpanjang: round(share(rows, (r) => r.longest)), sisaSatuOpsi: round(share(keyed, (r) => r.solo)), komposisiKunciLiteral: 0, komposisiKunciHubungan: 0 };
  check(stats.kunciTerpendek <= 25 && stats.kunciTerpanjang <= 25, 'panjang opsi: kunci terpendek ' + stats.kunciTerpendek + '% dan terpanjang ' + stats.kunciTerpanjang + '% dari ' + rows.length + ' soal (batas 25%)');
  check(stats.kunciTerpanjang >= 8, 'panjang opsi: kunci tidak boleh hampir tidak pernah terpanjang (' + stats.kunciTerpanjang + '%)');
  for (const chapter of chapters) { const list = rows.filter((row) => row.chapter === chapter); check(share(list, (r) => r.shortest) <= 0.32 && share(list, (r) => r.longest) <= 0.32, chapter + ': kunci terpendek ' + round(share(list, (r) => r.shortest)) + '% dan terpanjang ' + round(share(list, (r) => r.longest)) + '% (batas 32% per chapter)'); }
  check(stats.sisaSatuOpsi <= 5, 'aturan permukaan ("dan", "tidak terjadi bersamaan", predikat baru) menyisakan satu opsi pada ' + stats.sisaSatuOpsi + '% soal berkunci (batas 5%)');
  for (const chapter of chapters) { const list = keyed.filter((row) => row.chapter === chapter); check(share(list, (r) => r.solo) <= 0.05, chapter + ': aturan permukaan menyisakan satu opsi pada ' + round(share(list, (r) => r.solo)) + '% soal berkunci'); }
  for (const [name, list] of [['literal', keyed.filter((r) => !r.relation)], ['hubungan', keyed.filter((r) => r.relation)]] as const) {
    const counts = new Map<string, number>(); list.forEach((row) => counts.set(row.composition, (counts.get(row.composition) ?? 0) + 1));
    const top = list.length ? Math.max(...counts.values()) / list.length : 0;
    check(list.length > 0 && top <= 0.5 && counts.size >= (name === 'literal' ? 3 : 6), 'komposisi jenis kesalahan soal berkunci ' + name + ': ' + counts.size + ' komposisi berbeda, terbanyak ' + round(top) + '% (batas 50%)');
    if (name === 'literal') stats.komposisiKunciLiteral = counts.size; else stats.komposisiKunciHubungan = counts.size;
  }
  report.statistik = stats;
}

// ---- Keberagaman keluarga modus per paket tryout (QC akademik 2 Nov 2026) ----------------------------------------------------------------------
// Lima butir silogisme sepaket (baris 13: 3 Premis, baris 14: 2 Premis - Narasi dua butir, baris 15: 3 Premis - Narasi dua butir) memakai lima keluarga BERBEDA dari MP, MT, SK, SD, NEG (De Morgan atau negasi
// implikasi; hanya Silogisme Biasa), dan TDS (lib/silo-spec.ts: keluarga penentu per kode). Keluarga dan jebakan (jenis kesalahan pengecoh) tidak boleh sama pada dua butir sepaket; paket berbeda dan tanpa kembar.
const tryoutTiu = (seed: string, packages: number, tiuSource: 'accepted' | 'variation' = 'variation') => generate(normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', mode: 'TIU', count: 35, tiuSource, uniqueAcross: false, packages, seed }));
const syllogismOf = (q: Question) => q.proof.kind === 'model' && q.proof.model.kind === 'syllogism' ? q.proof.model : undefined;
const premiseSentencesOf = (q: Question) => q.stem.split('\n').slice(0, -1).join(' ').split(/(?<=\.) (?=\p{Lu})/u);
const trapOf = (q: Question) => [...new Set((syllogismOf(q)?.errors ?? []).flatMap((e) => e ? [e] : []))].sort().join('+');
const ROW_CHAPTERS = ['3 Premis', '2 Premis - Narasi', '2 Premis - Narasi', '3 Premis - Narasi', '3 Premis - Narasi'];
function runDiversityChecks(check: Check, report: Record<string, unknown>): void {
  // (a) Rencana murni: enam keluarga berbeda per paket, NEG hanya pada baris 13, baris 13 berputar sehingga lima paket berurutan berbeda.
  {
    const bad: string[] = [];
    for (let k = 0; k < 40; k++) {
      const seed = 'rencana-' + k, rows13 = [new Set<Keluarga>(), new Set<Keluarga>()], narasi: Record<string, number> = {};
      for (let p = 0; p < 12; p++) {
        const lineup = barisan(seed, p), five = [keluargaButir(seed, 13, p, 0), keluargaButir(seed, 14, p, 0), keluargaButir(seed, 14, p, 1), keluargaButir(seed, 15, p, 0), keluargaButir(seed, 15, p, 1)];
        if (new Set(lineup).size !== 6 || new Set(five).size !== 5 || five.slice(1).includes('NEG') || ![0, 5].includes(lineup.indexOf('NEG'))) bad.push(seed + ' paket ' + p + ': ' + five.join());
        if (p < 10) { rows13[Math.floor(p / 5)].add(five[0]); five.slice(1).forEach((f, i) => { const key = Math.floor(p / 5) + '|' + (i < 2 ? 14 : 15) + '|' + f; narasi[key] = (narasi[key] ?? 0) + 1; }); }
      }
      if (rows13.some((set) => set.size !== 5)) bad.push(seed + ': baris 13 pada blok lima paket tidak berbeda');
      for (const blok of [0, 1]) for (const baris of [14, 15]) for (const f of KELUARGA.filter((x) => x !== 'NEG')) if (narasi[blok + '|' + baris + '|' + f] !== 2) bad.push(seed + ' blok ' + blok + ': keluarga ' + f + ' tidak tepat dua kali pada baris ' + baris);
    }
    check(bad.length === 0, 'perencana keluarga: tiap paket lima keluarga berbeda, NEG hanya baris 13, baris 13 berbeda pada blok lima paket, tiap keluarga non-NEG tepat dua kali pada baris 14 dan 15 per blok; ' + bad.slice(0, 2).join(' | '));
  }
  // (b) Kode butir menentukan keluarga yang sama dengan keluarga konfigurasi (seluruh katalog) dan tiap contoh blueprint.
  {
    let mismatch = '';
    for (const premises of [2, 3] as const) for (const cfg of allConfigs(premises)) if (!mismatch && keluargaOfCode(codeOf(cfg)) !== keluargaOfConfig(cfg)) mismatch = codeOf(cfg);
    // Perluasan (bentuk De Morgan dan keluarga NI, keduanya NEG) di luar katalog blueprint.
    for (const fam of FAM2) for (let i = 0; i < COUNT2[fam]; i++) {
      const base = base2(fam, i), combos = base.premises.map((p) => formsOf(p, true)).reduce<Form[][]>((acc, list) => acc.flatMap((prefix) => list.map((f) => [...prefix, f])), [[]]);
      for (const forms of combos) { const cfg: Config = { base, forms, keyForm: 0, order: 0 }; if (!mismatch && keluargaOfCode(codeOf(cfg)) !== keluargaOfConfig(cfg)) mismatch = codeOf(cfg); }
    }
    for (const item of CONTOH_NARASI) if (!mismatch && keluargaOfCode(item.code) !== keluargaOfContoh(item)) mismatch = item.code;
    check(mismatch === '', 'keluarga dari kode butir sama dengan keluarga konfigurasi (katalog, perluasan De Morgan dan NI, serta 19 contoh); beda: ' + mismatch);
  }
  // (c) Pembangkit untuk keluarga tertentu: butir lolos pemeriksa mandiri dan keluarganya sesuai permintaan (NEG hanya Silogisme Biasa).
  {
    const bad: string[] = [], per = 60, chapters: [string, Chapter, readonly Keluarga[]][] = [['b2', '2 Premis', KELUARGA], ['b3', '3 Premis', KELUARGA], ['n2', '2 Premis - Narasi', KELUARGA.filter((f) => f !== 'NEG')], ['n3', '3 Premis - Narasi', KELUARGA.filter((f) => f !== 'NEG')]];
    for (const [id, chapter, families] of chapters) for (const family of families) for (let seed = 0; seed < per; seed++) {
      const r = rng('keluarga-' + id + '-' + family + '-' + seed);
      let built: ReturnType<typeof buildFromConfig> | undefined;
      for (let attempt = 0; attempt < 40 && !built; attempt++) { try { built = buildFromConfig(randomConfig(chapter, id === 'b3' ? 'maybe' : 'never', r, family), chapter, r); } catch { /* kerangka bahasa menolak konfigurasi: coba lagi */ } }
      if (!built || keluargaOfCode(built.code) !== family) { bad.push(id + '/' + family + ': ' + (built ? built.code : 'gagal dibangun')); continue; }
      const problems = problemsOf(toQuestion(built, 'keluarga-' + id + '-' + family + '-' + seed));
      if (problems.length) bad.push(built.code + ': ' + problems[0]);
    }
    let narasiNeg = false;
    try { randomConfig('2 Premis - Narasi', 'never', rng('x'), 'NEG'); } catch { narasiNeg = true; }
    check(bad.length === 0 && narasiNeg, 'pembangkit per keluarga: ' + per + ' butir tiap keluarga pada empat chapter lolos pemeriksa dan berkeluarga sesuai permintaan; NEG pada narasi ditolak; gagal: ' + bad.slice(0, 3).join(' | '));
  }
  // (d) Paket tryout profil variasi (TIU, lima butir silogisme per paket) pada beberapa seed, delapan paket (melewati lima paket pertama dan kehabisan contoh).
  // Profil contoh diterima (bawaan; paket yang di-QC) juga membangkitkan baris 13–15 (lib/tryout-profile.ts: SILO_ROWS), jadi diperiksa dengan aturan yang sama.
  const seeds = ['contoh-uji', 'a', 'b', 'c', '1001', 'keluarga-6', 'keluarga-7', 'keluarga-8', 'diterima:JADIASN-2027', 'diterima:a', 'diterima:keluarga-9'], bad: string[] = [], spread: Record<string, string[]> = {}, tally: Record<string, number> = {};
  let contohTotal = 0, generated = 0, threePremise = 0;
  for (const seed of seeds) {
    const run = seed.startsWith('diterima:') ? tryoutTiu(seed.slice(9), 8, 'accepted') : tryoutTiu(seed, 8), stems = new Set<string>(), sequences = new Set<string>(), usedContoh: Record<string, Set<string>> = { '2 Premis - Narasi': new Set(), '3 Premis - Narasi': new Set() };
    spread[seed] = [];
    run.forEach((pack, p) => {
      const items = pack.questions.filter((q) => ['map-13', 'map-14', 'map-15'].includes(q.mappingId ?? '')), models = items.map(syllogismOf), where = seed + ' paket ' + (p + 1);
      if (items.length !== 5 || models.some((m) => !m) || models.map((m) => m!.chapter).join('|') !== ROW_CHAPTERS.join('|')) { bad.push(where + ': harus lima butir silogisme (3 Premis, dua 2 Premis - Narasi, dua 3 Premis - Narasi)'); return; }
      const families = models.map((m) => keluargaOfCode(m!.code!)), pairs = items.map((q, i) => families[i] + '/' + trapOf(q));
      if (families.some((f) => !f) || new Set(families).size !== 5) bad.push(where + ': keluarga modus tidak berbeda (' + families.join(', ') + ')');
      if (new Set(pairs).size !== 5) bad.push(where + ': keluarga dan jebakan sama pada dua butir');
      if (families.slice(1).includes('NEG')) bad.push(where + ': NEG hanya untuk Silogisme Biasa');
      items.forEach((q, i) => {
        const model = models[i]!, family = families[i]!;
        stems.add(q.stem); tally[family] = (tally[family] ?? 0) + 1; threePremise += model.premises.length === 3 ? 1 : 0;
        const found: string[] = []; checkSilogismeBlueprint(q, (text) => found.push(text)); if (found.length) bad.push(where + ' ' + model.code + ': ' + found[0]);
        if (premiseSentencesOf(q).length !== model.premises.length) bad.push(where + ' ' + model.code + ': jumlah kalimat premis tidak sama dengan jumlah premis utama');
        if (model.premises.length === 3 && !q.explanation.includes('**Kesimpulan (Premis 4): ')) bad.push(where + ' ' + model.code + ': label Premis 4 hilang');
        // Contoh blueprint dipakai lebih dahulu: pembangkit hanya mengisi keluarga yang contohnya sudah habis.
        const used = usedContoh[model.chapter!];
        if (used) {
          if (isContoh(model.code)) { used.add(model.code!); contohTotal++; }
          else { generated++; if (contohOf(model.chapter as '2 Premis - Narasi' | '3 Premis - Narasi').some((item) => keluargaOfContoh(item) === family && !used.has(item.code))) bad.push(where + ' ' + model.code + ': masih ada contoh blueprint ' + family + ' yang belum dipakai'); }
        }
      });
      const sequence = families.join('-'); spread[seed].push(sequence);
      if (p < 5) { if (sequences.has(sequence)) bad.push(where + ': urutan keluarga kembar dengan paket lain'); sequences.add(sequence); }
    });
    if (stems.size !== run.length * 5) bad.push(seed + ': ada butir silogisme kembar pada ' + run.length + ' paket');
  }
  check(bad.length === 0, 'keluarga modus beragam per paket tryout (profil variasi dan contoh diterima): ' + seeds.length + ' seed x 8 paket, tiap paket lima keluarga berbeda (keluarga dan jebakan tidak kembar), NEG hanya baris 13, contoh blueprint dipakai lebih dahulu, tanpa butir kembar; ' + bad.slice(0, 3).join(' | '));
  check(KELUARGA.every((f) => (tally[f] ?? 0) > 0), 'keenam keluarga modus muncul pada paket tryout (' + JSON.stringify(tally) + ')');
  report.keluarga = { sebaran: spread, total: tally, contoh: contohTotal, pembangkit: generated, tigaPremis: threePremise };
}

// ---- Redaksi konsekuen-dahulu (QC akademik 2 Nov): konsekuen mendahului kondisi (predikat hak di depan: "hak ... melekat pada S ...") paling banyak 10% pada kumpulan besar ----------------
// Itu pembalikan urutan kata, bukan pembalikan arah (p → q tetap). Dihitung pada premis implikasi dan opsi hubungan implikasi Silogisme Narasi: (1) 2000 butir pembangkit tiap chapter narasi; (2) latihan bebas
// 240 butir yang memuat 19 contoh blueprint (dua di antaranya bersusunan terbalik; lib/silo-production.ts membatasinya per paket). Silogisme Biasa tidak pernah memakai susunan ini.
const CONSEQUENT_FIRST = /\bmelekat pada\b/;
function runRedactionChecks(check: Check, report: Record<string, unknown>): void {
  type Tally = { premises: number; reversedPremises: number; options: number; reversedOptions: number };
  const count = (questions: Question[]): Tally => {
    const tally: Tally = { premises: 0, reversedPremises: 0, options: 0, reversedOptions: 0 };
    for (const q of questions) {
      const model = syllogismOf(q);
      if (!model?.chapter?.endsWith('Narasi')) continue;
      premiseSentencesOf(q).forEach((sentence, i) => { if (model.premises[i]?.op === 'implies') { tally.premises++; if (CONSEQUENT_FIRST.test(sentence)) tally.reversedPremises++; } });
      q.options.forEach((o) => { const logic = model.options.find((x) => x.text === o.text)?.logic; if (logic?.op === 'implies') { tally.options++; if (CONSEQUENT_FIRST.test(o.text)) tally.reversedOptions++; } });
    }
    return tally;
  };
  const sampleOf = (id: string, n: number): Question[] => Array.from({ length: n }, (_, seed) => toQuestion(buildLogika(id, rng('redaksi-' + id + '-' + seed)), 'redaksi-' + id + '-' + seed));
  const free = generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', count: 60, packages: 4, seed: 'konsekuen-dahulu', topics: ['Verbal'], subtopics: ['Verbal::Silogisme naratif'] })).flatMap((pack) => pack.questions);
  const result: Record<string, Tally> = { pembangkitDua: count(sampleOf('n2', 2000)), pembangkitTiga: count(sampleOf('n3', 2000)), latihanBebas: count(free) };
  for (const [name, tally] of Object.entries(result)) {
    check(tally.premises > 0 && tally.reversedPremises <= 0.1 * tally.premises, name + ': premis konsekuen-dahulu paling banyak 10% (' + tally.reversedPremises + '/' + tally.premises + ')');
    check(tally.options > 0 && tally.reversedOptions <= 0.1 * tally.options, name + ': opsi hubungan konsekuen-dahulu paling banyak 10% (' + tally.reversedOptions + '/' + tally.options + ')');
  }
  check(free.every((q) => { const model = syllogismOf(q); return !model || model.chapter?.endsWith('Narasi') || !CONSEQUENT_FIRST.test(q.stem); }), 'Silogisme Biasa tidak memakai susunan konsekuen-dahulu');
  report.konsekuenDahulu = result;
}

// Dijalankan langsung: seluruh pemeriksaan silogisme (katalog, contoh blueprint, stress 3000 seed per chapter, statistik, keberagaman keluarga, redaksi).
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/silogisme-checks.ts')) {
  let checks = 0;
  const check: Check = (condition, message) => { assert.ok(condition, message); checks++; };
  const report = runSilogismeChecks(check, { stress: 3000 });
  console.log(JSON.stringify({ status: 'PASS', checks, ...report }, null, 2));
}
