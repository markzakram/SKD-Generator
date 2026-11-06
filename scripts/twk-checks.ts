// Pemeriksaan bank TWK hasil revisi akademik (tahap 2): label, tip, pembahasan, bentuk opsi, dan pasangan soal yang tidak boleh satu paket.
// Dijalankan sendiri: `npx tsx scripts/twk-checks.ts` (kode keluar 1 bila ada yang gagal), atau lewat `npm run verify:quality`
// (scripts/quality-verify.ts memanggil runTwkChecks).
// Cakupan "bank TWK" = soal TWK buatan generator: twk-case-v2-* (lib/bank/twk.ts) dan twk-ref-* (data/twk-reference.json). Contoh tryout diterima
// (tryout-ref-*) milik pengguna: labelnya (Bloom, kesulitan) dan 31 butir revisi datang dari data/tryout-twk-koreksi.json (QC tahap 2b, lewat
// scripts/import-tryouts.py); isi lainnya dari sumber. Pemeriksaan di sini tidak mempersyaratkan Bloom pada contoh tryout (jumlah tanpa Bloom dilaporkan).
// "Direvisi" = 15 butir twk-case-v2 yang punya alasan kunci tersendiri (twkRevisedIds) dan 33 butir twk-ref dengan penggantian penuh di data/twk-ref-koreksi.json.
import assert from 'node:assert/strict';
import koreksi from '../data/twk-ref-koreksi.json';
import { BANK } from '../lib/bank';
import { twkRevisedIds } from '../lib/bank/twk';
import { DEFAULT_SETTINGS, TOPICS } from '../lib/config';
import { buildBlueprint } from '../lib/blueprint';
import { EXCLUSIVE_TWK, capacity, clashesExclusive, generate, normalizeSettings } from '../lib/generate';
import { positionReferences, workingNote } from '../lib/reasons';
import type { BankItem, Package, Question, Settings } from '../lib/types';
import { explanationOf } from '../lib/explanation';
import { boldAnswerLabels } from '../lib/pembahasan';
import { LOCAL_RECIPES, renderLocal } from '../lib/local';
import { PROFILE_SETTINGS } from '../lib/tryout-profile';

export type Check = (condition: unknown, message: string) => void;

const isAccepted = (item: Pick<BankItem, 'provenance'>) => item.provenance?.status === 'accepted-example';
const generated = (item: BankItem) => item.subtest === 'TWK' && !isAccepted(item);
const LETTER = /\b(?:Opsi|Pilihan|opsi|pilihan|Jawaban)\s+[A-E]\b/;
const FORMULA_TIP = /Apabila soal menyebut[\s\S]*mengarah ke|mengarah ke[\s\S]*Apabila soal menyebut/i;
const CHEAT_BLOCK = /Cara cepat\s*:|Tips\s*(?:&|dan)\s*Tri(?:ck|k)\b/i;
const COMMA_SEHINGGA = /,\s+sehingga\b/i;
const texts = (item: BankItem) => [item.stem, item.explanation, item.tip ?? '', item.difficultyReason ?? '', ...item.options.flatMap((o) => [o.text, o.reason])];
const bankId = (q: Question) => q.proof.kind === 'bank' ? q.proof.id : q.id;
const PAIR = Object.keys(EXCLUSIVE_TWK);
// Kelompok per family eksklusif (dua soal atau lebih): soal hanya bentrok bila family eksklusifnya sama.
const GROUPS = [...new Set(Object.values(EXCLUSIVE_TWK))].map((family) => PAIR.filter((id) => EXCLUSIVE_TWK[id] === family));

// Pasangan eksklusif: tidak pernah satu paket pada berbagai seed, ukuran paket, dan mode pengulangan; tiap anggota tetap bisa muncul (bergantian antarpaket).
function pairInPackages(check: Check) {
  const seen: Record<string, number> = {}, alternating = new Set<string>();
  let packages = 0, runs = 0;
  const settings: [string, Partial<Settings>][] = [];
  for (const seed of ['pasangan-a', 'pasangan-b', 'pasangan-c', 'pasangan-d', 'pasangan-e', 'pasangan-f', 'JADIASN-2027']) {
    settings.push(['TWK 30 x2 ' + seed, { seed, mode: 'TWK', count: 30, packages: 2 }]);
    settings.push(['TWK 30 x3 ' + seed, { seed, mode: 'TWK', count: 30, packages: 3 }]);
    settings.push(['TWK 30 x4 boleh ulang ' + seed, { seed, mode: 'TWK', count: 30, packages: 4, uniqueAcross: false }]);
    settings.push(['Bela Negara 20 ' + seed, { seed, mode: 'TWK', count: 20, packages: 1, topics: ['Bela Negara'] }]);
    settings.push(['Bela Negara 12 x2 ' + seed, { seed, mode: 'TWK', count: 12, packages: 2, topics: ['Bela Negara'] }]);
  }
  for (const seed of ['pasangan-a', 'JADIASN-2027']) settings.push(['SKD 110 x2 ' + seed, { seed, packages: 2 }]);
  // Satu proses 3 paket per kelompok pada sel (KD × kesulitan) tempat anggotanya paling banyak, dengan jumlah soal yang hampir menghabiskan sel: anggota kelompok
  // bergantian di paket berbeda secara pasti (bukan kebetulan undian), dan tetap muat karena tiap kelompok menyumbang satu slot per paket.
  for (const group of GROUPS) {
    const members = group.map((id) => BANK.find((item) => item.id === id)!), cells = members.map((item) => item.topic + '|' + item.difficulty);
    const [topic, difficulty] = cells.sort((a, b) => cells.filter((x) => x === b).length - cells.filter((x) => x === a).length)[0].split('|');
    const size = BANK.filter((item) => item.subtest === 'TWK' && item.topic === topic && item.difficulty === difficulty).length;
    for (const seed of ['pasangan-a', 'pasangan-b']) settings.push(['Sel ' + topic + ' ' + difficulty + ' x3 ' + seed, { seed, mode: 'TWK', count: Math.floor(size / 3), packages: 3, topics: [topic], difficulty: difficulty as Settings['difficulty'] }]);
  }
  const together: string[] = [];
  for (const [label, partial] of settings) {
    const made: Package[] = generate(normalizeSettings({ ...DEFAULT_SETTINGS, ...partial })); runs++;
    const inRun = new Set<string>();
    for (const pack of made) {
      packages++;
      const present = pack.questions.map(bankId).filter((id) => PAIR.includes(id));
      present.forEach((id) => { seen[id] = (seen[id] ?? 0) + 1; inRun.add(id); });
      if (GROUPS.some((group) => present.filter((id) => group.includes(id)).length > 1)) together.push(label + ' ' + pack.id);
    }
    // Bergantian = dalam satu proses berpaket banyak, sedikitnya dua anggota kelompok muncul (di paket berbeda). Kelompok berisi lima soal tidak mungkin
    // semuanya muncul dalam satu proses sependek ini, jadi syaratnya dua anggota, bukan semua anggota.
    if (made.length > 1) GROUPS.forEach((group, g) => { if (group.filter((id) => inRun.has(id)).length >= 2) alternating.add(String(g)); });
  }
  check(!together.length, 'Kelompok eksklusif (' + GROUPS.length + ' kelompok, ' + PAIR.length + ' soal) tidak pernah satu paket: ' + together.slice(0, 5).join(' | '));
  check(PAIR.every((id) => (seen[id] ?? 0) > 0), 'Setiap anggota kelompok eksklusif tetap dapat muncul di paket: ' + JSON.stringify(PAIR.filter((id) => !seen[id])));
  check(alternating.size === GROUPS.length, 'Anggota tiap kelompok dapat bergantian di paket berbeda (kapasitas antarpaket tidak berkurang): ' + alternating.size + '/' + GROUPS.length);
  // Pengganti manual (app/page.tsx): anggota pasangan ditolak bila pasangannya sudah ada di paket yang sama, dan diterima bila tidak.
  const pack = generate(normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TWK', count: 20, packages: 1, topics: ['Bela Negara'], seed: 'pasangan-a' }))[0];
  const holder = pack.questions.find((q) => PAIR.includes(bankId(q)));
  if (holder) {
    const partner = { family: EXCLUSIVE_TWK[PAIR.find((id) => id !== bankId(holder) && EXCLUSIVE_TWK[id] === EXCLUSIVE_TWK[bankId(holder)])!] };
    check(clashesExclusive(partner, pack.questions, 'lain') && !clashesExclusive(partner, pack.questions, holder.id) && !clashesExclusive({ family: 'twk-ref-0-1' }, pack.questions, 'lain'),
      'Pengganti manual menolak pasangan eksklusif yang sudah ada di paket, tetapi tidak soal biasa.');
  }
  return { runs, packages, kemunculan: seen, bergantianDi: alternating.size };
}

// Pembagian lintas paket (lib/bagi.ts): TWK 4 dan 5 paket pada 60 seed tidak boleh gagal secara acak selama persediaan cukup (memilih paket demi paket
// menyisakan anggota satu kelompok eksklusif untuk paket terakhir: dulu 3 dari 100 seed gagal pada 4 paket dan 51 pada 5 paket), tanpa butir berulang
// antarpaket dan tanpa dua anggota satu kelompok eksklusif dalam satu paket. Jumlah paket yang persediaannya memang tidak cukup (ditolak sejak blueprint, tidak
// bergantung seed) dilewati, tetapi 4 paket wajib terhitung.
function acrossPackages(check: Check) {
  const failures: string[] = [], repeated: string[] = [], together: string[] = [], skipped: number[] = [];
  let runs = 0, packages = 0;
  for (const count of [4, 5]) {
    const base = { ...DEFAULT_SETTINGS, mode: 'TWK' as const, count: 30, packages: count };
    try { buildBlueprint(normalizeSettings(base)); if (capacity(normalizeSettings(base)).some((c) => c.required > c.available)) throw new Error('kapasitas'); } catch { skipped.push(count); continue; }
    for (let n = 0; n < 60; n++) {
      const label = 'TWK 30 x' + count + ' rate-' + n;
      let made: Package[];
      try { made = generate(normalizeSettings({ ...base, seed: 'rate-' + n })); } catch (error) { failures.push(label + ': ' + (error instanceof Error ? error.message : error)); continue; }
      runs++;
      const seen = new Set<string>();
      for (const pack of made) {
        packages++;
        const present = pack.questions.map(bankId);
        for (const id of present) { if (seen.has(id)) repeated.push(label + ' ' + id); seen.add(id); }
        if (GROUPS.some((group) => present.filter((id) => group.includes(id)).length > 1)) together.push(label + ' ' + pack.id);
      }
    }
  }
  check(!skipped.includes(4) && runs >= 60, 'TWK 30 soal untuk 4 paket tersedia (persediaan cukup) dan diuji pada 60 seed: ' + runs + ' proses, dilewati ' + JSON.stringify(skipped));
  check(!failures.length, 'TWK 4 dan 5 paket tidak gagal pada seed mana pun selama persediaan cukup: ' + failures.slice(0, 3).join(' | '));
  check(!repeated.length && !together.length, 'TWK 4 dan 5 paket: tanpa butir berulang antarpaket dan tanpa dua anggota kelompok eksklusif dalam satu paket: ' + [...repeated, ...together].slice(0, 3).join(' | '));
  return { runs, packages, dilewati: skipped };
}

// Format pembahasan TWK (QC akademik #2; dirakit lib/pembahasan.ts saat tampil/ekspor): satu paragraf yang ditutup "Opsi yang paling tepat adalah X", lalu
// "Alasan opsi salah:" dengan TEPAT empat opsi nonkunci berurutan (huruf kunci tidak diulang), lalu "Cara cepat:" bila ada tip. Tanpa pecahan "Konsep yang
// digunakan / Fakta penentu / Pilihan terbaik", tanpa "Kata kunci", tanpa teks tebal. Cara cepat tidak berpola "kata kunci → jawaban".
// Butir yang alasan opsi nonkuncinya kosong di sumber (MENUNGGU_ALASAN) baru lulus setelah koreksi penuh di data/twk-ref-koreksi.json dan `npm run references`
// (persetujuan PM); daftar ini harus dikosongkan begitu butirnya lulus.
export const MENUNGGU_ALASAN: string[] = [];
const TIP_KATA_KUNCI = /→|->|\bkata kunci\b|\b(?:jika|bila|apabila)\s+(?:ada|muncul|terdapat|soal menyebut)\b|langsung pilih|mengarah ke|jawabannya\s+(?:adalah\s+)?[A-E]\b/i;
export function twkFormatProblems(q: Pick<Question, 'id' | 'subtest' | 'topic' | 'explanation' | 'answer' | 'options' | 'tip' | 'provenance'>): string[] {
  const L = String.fromCharCode(65 + q.answer), others = q.options.map((_, i) => String.fromCharCode(65 + i)).filter((x) => x !== L);
  const lines = explanationOf(q).split('\n').filter((line) => !/^\s*(?:\*\*)?Sumber\s*:/i.test(line)), problems: string[] = [];
  if (!lines[0]?.includes('Opsi yang paling tepat adalah ' + L)) problems.push('paragraf tidak ditutup "Opsi yang paling tepat adalah ' + L + '"');
  if (lines.some((line) => /Konsep yang digunakan:|Fakta penentu|Pilihan terbaik|Kata [Kk]unci:|\*\*|~~/.test(line))) problems.push('memuat pecahan label lama atau teks bergaya');
  if (lines[1] !== 'Alasan opsi salah:') problems.push('baris kedua bukan "Alasan opsi salah:"');
  const items = lines.slice(2, 6);
  if (items.length !== 4 || items.some((line, i) => !line.startsWith(others[i] + '. ')) || /^[A-E]\. /.test(lines[6] ?? '')) problems.push('alasan bukan tepat empat opsi nonkunci (' + lines.slice(2).filter((line) => /^[A-E]\. /.test(line)).map((line) => line[0]).join('') + ', kunci ' + L + ')');
  const tip = q.tip?.trim();
  const between = tip ? lines.slice(2, -1) : lines.slice(2);
  if ((tip && lines[lines.length - 1] !== 'Cara cepat: ' + tip.replace(/\s+/g, ' ')) || lines.length < 2 || !between.every((line) => /^[A-E]\. /.test(line))) problems.push('"Cara cepat:" tidak tepat di akhir sesudah alasan opsi');
  if (tip && TIP_KATA_KUNCI.test(tip)) problems.push('cara cepat berpola kata kunci → jawaban');
  return problems;
}
function pembahasanFormat(check: Check) {
  const locals = LOCAL_RECIPES.filter((r) => r.subtest === 'TWK').map((r) => renderLocal({ kind: 'local', version: 2, model: r.model, context: r.context, state: r.state, order: [0, 1, 2, 3, 4] }));
  const packs = [
    ...['JADIASN-2027', 'qc2-twk'].flatMap((seed) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed, mode: 'TWK', count: 30, packages: 2 }))),
    ...(['new', 'accepted'] as const).flatMap((twkSource) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, ...PROFILE_SETTINGS, seed: 'qc2-twk', packages: 2, twkSource, tkpSource: 'accepted' }))),
  ];
  const packed = packs.flatMap((pack) => pack.questions.filter((q) => q.subtest === 'TWK'));
  const sources = [...BANK.filter((item) => item.subtest === 'TWK'), ...locals], items = [...sources, ...packed];
  const failing = new Map<string, string[]>();
  for (const q of items) { const problems = twkFormatProblems(q); if (problems.length) failing.set(q.id, problems); }
  const pending = [...failing.keys()].filter((id) => MENUNGGU_ALASAN.some((p) => id === p || id.startsWith(p + '-')));
  check([...failing.keys()].every((id) => pending.includes(id)), 'Pembahasan TWK semua sumber (bank, riset, contoh tryout, ' + locals.length + ' resep lokal, ' + packed.length + ' butir paket teracak): paragraf, "Alasan opsi salah:" tepat empat opsi nonkunci, "Cara cepat:": ' +
    [...failing].filter(([id]) => !pending.includes(id)).slice(0, 4).map(([id, problems]) => id + ' ' + problems.join('; ')).join(' | '));
  check(MENUNGGU_ALASAN.every((id) => failing.get(id)?.every((problem) => problem.startsWith('alasan bukan tepat empat'))), 'Daftar MENUNGGU_ALASAN hanya berisi butir yang memang belum punya empat alasan nonkunci (kosongkan setelah koreksi diimpor): ' + MENUNGGU_ALASAN.join(', '));
  // Uji mutasi: pembahasan suntingan berbentuk akhir tidak dirakit ulang, jadi bentuk lama (kunci diulang di alasan, pecahan label, penutup tanpa huruf kunci) harus tertangkap.
  const sample = packed.find((q) => q.tip && q.topic !== 'Bahasa Negara')!, L = String.fromCharCode(65 + sample.answer), assembled = explanationOf(sample);
  const mutants = [
    assembled.replace('Alasan opsi salah:', 'Alasan opsi salah:\n' + L + '. Alasan kunci diulang.'),
    'Konsep yang digunakan: x\n' + assembled,
    assembled.replace(new RegExp('Opsi yang paling tepat adalah ' + L + '\\b'), 'Pilihan terbaik'),
    assembled.replace(/\nCara cepat: [^\n]*$/, ''),
  ];
  check(mutants.every((explanation) => explanation !== assembled && twkFormatProblems({ ...sample, explanation }).length > 0), 'Pemeriksa format TWK menolak kunci diulang di alasan, pecahan label lama, penutup tanpa huruf kunci, dan cara cepat hilang.');
  // Gaya cetak: Bahasa Negara mengikuti Dhea (Jawaban/Pembahasan tebal), empat KD lain mengikuti Nynda (label biasa).
  check(items.every((q) => boldAnswerLabels(q) === (q.topic === 'Bahasa Negara')), 'Label "Jawaban:"/"Pembahasan:" tebal hanya untuk TWK Bahasa Negara (gaya Dhea); KD lain gaya Nynda.');
  // Naskah pengganti QC butir 25 dan 6 (model lokal bahasa-ide teks kebun dan nas-ingatan keadaan kedua).
  const local = (key: string) => locals.find((q) => q.proof.kind === 'local' && [q.proof.model, q.proof.context, q.proof.state].join(':') === key)!;
  const kebun = local('bahasa-ide:3:0'), museum = local('nas-ingatan:0:1');
  check(![...BANK, ...locals].some((q) => q.stem.includes('volume penggunaan setiap pekan')) && kebun.stem.includes('Pengelola mencatat volume air yang tersedia dan digunakan setiap pekan.') &&
    explanationOf(kebun).includes('Paragraf membahas pengelolaan air kebun yang menyesuaikan sumber penyiraman dan luas tanam dengan ketersediaan air.') && kebun.tip === 'Pilih gagasan yang menaungi hubungan antarrincian, bukan satu tindakan pengelola atau informasi di luar paragraf.',
    'Naskah QC butir 25: stimulus kebun mencatat air yang tersedia dan digunakan; pembahasan dan cara cepat pengganti terpasang.');
  check(explanationOf(museum).startsWith('Konsep yang diuji dalam soal ini adalah penghargaan terhadap sejarah perjuangan sebagai bagian dari nasionalisme yang tetap bertanggung jawab terhadap bukti.') &&
    explanationOf(museum).includes('Popularitas cerita tidak dapat menggantikan verifikasi') && museum.tip?.startsWith('Jika kebanggaan sejarah berhadapan dengan keterbatasan bukti'), 'Naskah QC butir 6: konsep, hubungan, dan cara cepat pengganti terpasang.');
  // Laporan: butir sumber tanpa tip tampil tanpa "Cara cepat:" (perlu ditulis lewat standar TWK, bukan dikarang generator).
  return { diperiksa: items.length, resepLokal: locals.length, butirPaket: packed.length, menungguAlasan: pending, tanpaCaraCepat: sources.filter((q) => !q.tip?.trim()).map((q) => q.id) };
}

export function runTwkChecks(check: Check) {
  const twk = BANK.filter((item) => item.subtest === 'TWK');
  const own = twk.filter(generated);
  const accepted = twk.filter(isAccepted);
  const refRevised = Object.entries(koreksi as unknown as Record<string, { stem?: string }>).filter(([id, fix]) => !id.startsWith('_') && fix.stem !== undefined).map(([id]) => id);
  const revisedIds = [...twkRevisedIds, ...refRevised];
  const revised = revisedIds.map((id) => own.find((item) => item.id === id));
  // 34 = 33 revisi QC tahap 2 + twk-ref-4-5 (alasan empat opsi nonkunci, QC akademik #2, 3 Nov).
  check(own.length === 77 && twkRevisedIds.length === 15 && refRevised.length === 34 && revised.every(Boolean), 'Bank TWK: 77 soal buatan generator, 15 revisi twk-case-v2 dan 34 revisi twk-ref terpasang (ada ' + own.length + ').');
  const revisedItems = revised as BankItem[];
  // Label.
  check(!twk.some((item) => item.subtopic === 'Contoh riset') && !twk.some((item) => !item.subtopic.trim()), 'Tidak ada subtopik "Contoh riset" atau kosong pada soal TWK.');
  check(own.every((item) => /^C[1-6]$/.test(item.bloom ?? '')), 'Semua soal TWK bank punya level Bloom: ' + own.filter((item) => !/^C[1-6]$/.test(item.bloom ?? '')).map((item) => item.id).slice(0, 5));
  check(own.every((item) => TOPICS.TWK.includes(item.topic) && ['mudah', 'sedang', 'sulit'].includes(item.difficulty) && (item.difficultyReason ?? '').trim()), 'Soal TWK bank: KD termasuk 5 KD, kesulitan mudah/sedang/sulit, alasan kesulitan terisi.');
  // Tip dan pembahasan.
  check(!twk.some((item) => FORMULA_TIP.test(item.tip ?? '')), 'Tidak ada tip berpola "Apabila soal menyebut … mengarah ke": ' + twk.filter((item) => FORMULA_TIP.test(item.tip ?? '')).map((item) => item.id).slice(0, 5));
  check(!twk.some((item) => CHEAT_BLOCK.test(item.explanation) || item.options.some((o) => CHEAT_BLOCK.test(o.reason))), 'Pembahasan TWK tidak memuat blok "Cara cepat:" atau "Tips & Trik".');
  check(revisedItems.every((item) => (item.tip ?? '').trim().length > 20), 'Soal yang direvisi punya tip.');
  check(revisedItems.every((item) => texts(item).every((text) => !workingNote(text) && !LETTER.test(text)) && !positionReferences(item.explanation).length), 'Soal yang direvisi: pembahasan, alasan, dan tip tanpa huruf atau urutan opsi dan tanpa sisa catatan.');
  check(revisedItems.every((item) => new Set(item.options.map((o) => o.reason)).size === 5 && item.options.every((o) => /^[\p{Lu}“"(]/u.test(o.reason) && /[.!?”")]$/.test(o.reason))), 'Soal yang direvisi: alasan tiap opsi berbeda dan berupa kalimat utuh (alasan kunci tersendiri).');
  // Bentuk opsi.
  const wellFormed = (item: BankItem) => item.options.length === 5 && item.options.filter((o) => o.score === 5).length === 1 && item.options[item.answer].score === 5 &&
    item.options.every((o, i) => i === item.answer || o.score === 0) && new Set(item.options.map((o) => o.text.trim().toLowerCase())).size === 5;
  check(own.every(wellFormed), 'Tiap soal TWK bank: 5 opsi berbeda, satu kunci, kunci bernilai 5 dan lainnya 0.');
  const longest = (item: BankItem) => { const sizes = item.options.map((o) => o.text.length); return sizes[item.answer] === Math.max(...sizes) && sizes.filter((n) => n === sizes[item.answer]).length === 1; };
  check(!revisedItems.some(longest), 'Pada soal yang direvisi, kunci bukan satu-satunya opsi terpanjang: ' + revisedItems.filter(longest).map((item) => item.id));
  check(!revisedItems.some((item) => texts(item).some((text) => COMMA_SEHINGGA.test(text))), 'Tidak ada koma sebelum "sehingga" pada soal yang direvisi: ' + revisedItems.filter((item) => texts(item).some((text) => COMMA_SEHINGGA.test(text))).map((item) => item.id));
  // Paket hasil generate: soal buatan generator berlabel lengkap dan berbentuk benar.
  const sample = ['JADIASN-2027', 'twk-a', 'twk-b'].flatMap((seed) => generate(normalizeSettings({ ...DEFAULT_SETTINGS, seed, packages: 2 }))).flatMap((pack) => pack.questions.filter((q) => q.subtest === 'TWK'));
  const own2 = sample.filter((q) => q.provenance?.status !== 'accepted-example');
  check(own2.length > 40 && own2.every((q) => /^C[1-6]$/.test(q.bloom ?? '') && q.subtopic !== 'Contoh riset') && sample.every((q) => q.options.length === 5 && q.options.filter((o) => o.score === 5).length === 1 && q.options[q.answer].score === 5),
    'Paket hasil generate: soal TWK buatan generator berlabel Bloom dan subtopik nyata; semua soal TWK berlima opsi dengan satu kunci.');
  const pair = pairInPackages(check);
  const lintas = acrossPackages(check);
  const pembahasan = pembahasanFormat(check);
  // Peringatan (tidak menggagalkan): soal TWK bank dengan himpunan opsi yang sama.
  const bySet = new Map<string, string[]>();
  for (const item of own) { const key = item.options.map((o) => o.text.trim().toLowerCase()).sort().join('|'); bySet.set(key, [...(bySet.get(key) ?? []), item.id]); }
  const sameOptions = [...bySet.values()].filter((ids) => ids.length > 1);
  const bySubtopic = new Map<string, number>();
  for (const item of own) bySubtopic.set(item.topic + '::' + item.subtopic, (bySubtopic.get(item.topic + '::' + item.subtopic) ?? 0) + 1);
  return {
    bank: own.length, direvisi: { case: twkRevisedIds.length, riset: refRevised.length }, contohDiterimaTanpaBloom: accepted.filter((item) => !item.bloom).length,
    subtopik: bySubtopic.size, subtopikSatuSoal: [...bySubtopic.values()].filter((n) => n === 1).length,
    kesulitan: Object.fromEntries(['mudah', 'sedang', 'sulit'].map((level) => [level, own.filter((item) => item.difficulty === level).length])),
    kunciTerpanjangTersisa: own.filter(longest).length, himpunanOpsiSama: sameOptions, pasangan: pair, lintasPaket: lintas, pembahasan,
  };
}

// Dijalankan langsung: seluruh pemeriksaan, dilaporkan satu per satu.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/twk-checks.ts')) {
  let checks = 0;
  const check: Check = (condition, message) => { assert.ok(condition, message); checks++; };
  try { const report = runTwkChecks(check); console.log(JSON.stringify({ status: 'PASS', checks, ...report }, null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
}
