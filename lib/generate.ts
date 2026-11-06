import { BANK, BANK_MAP, bankFor } from './bank';
import { TKP_KASUS_TOPICS } from './bank/tkp-kasus';
import { BASELINE, DEFAULT_SETTINGS, TOPICS } from './config';
import { figureSignature, sceneSignature } from './figures';
import { rng, type Rng } from './rng';
import { TIU_FAMILIES, makeTiu } from './tiu';
import type { BankItem, DifficultyFilter, Mode, Package, Question, Settings, Subtest, TkpMeta } from './types';
import { auditPackages } from './validate';
import { buildBlueprint, checkBlueprint } from './blueprint';
import { validationBinding } from './binding';
import { generateTryout } from './tryout-profile';
import { MAPPING_ROWS, chapterDuration, chapterMode, chapterTotal } from './mapping';
import { LOCAL_RECIPES, localRecipes, usesLocal, chooseLocal, makeLocal } from './local';
import { keepsOptionOrder } from './reasons';
import { cellKey, planShares, type Share } from './bagi';
import { constrainNarrativePackage } from './silo-production';

// Isian jumlah per chapter: id baris mapping, bilangan bulat, dan batas total. Yang bernilai 0 dibuang; urutan mengikuti baris mapping, jadi urutan kunci masukan tidak berpengaruh.
function checkedChapterCounts(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Jumlah per chapter harus berupa objek id chapter dan jumlah soal.');
  const counts = input as Record<string, unknown>;
  for (const id of Object.keys(counts)) if (!MAPPING_ROWS.some((row) => row.id === id)) throw new Error('Chapter tidak dikenal: ' + id + '.');
  for (const row of MAPPING_ROWS) {
    const n = counts[row.id];
    if (n !== undefined && (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 200)) throw new Error('Jumlah untuk ' + row.chapter + ' harus bilangan bulat 0–200.');
  }
  const clean = Object.fromEntries(MAPPING_ROWS.filter((row) => (counts[row.id] as number) > 0).map((row) => [row.id, counts[row.id] as number]));
  const total = chapterTotal(clean);
  if (!total) throw new Error('Isi jumlah soal pada sedikitnya satu chapter.');
  if (total > 200) throw new Error('Total jumlah per chapter ' + total + ' soal, sedangkan satu paket maksimal 200 soal.');
  return clean;
}
export function normalizeSettings(input: Partial<Settings>): Settings {
  const value = { ...DEFAULT_SETTINGS, ...input };
  // Jumlah per chapter selalu memakai jalur standar tryout 2027. Jumlah soal dan jenis paket mengikuti isian; durasi sebanding jumlah soal bila tidak disebut.
  if (value.chapterCounts !== undefined) {
    if (value.profile === 'free') throw new Error('Jumlah per chapter hanya berlaku pada profil Standar tryout 2027.');
    const counts = checkedChapterCounts(value.chapterCounts);
    Object.assign(value, { profile: 'tryout-2027', chapterCounts: counts, count: chapterTotal(counts), mode: chapterMode(counts, value.mode), duration: input.duration === undefined ? chapterDuration(chapterTotal(counts)) : input.duration, topics: [], subtopics: [], composition: undefined, blueprint: undefined });
  }
  if (value.profile && !['free','tryout-2027'].includes(value.profile)) throw new Error('Profil paket tidak dikenal.');
  if (value.tiuSource && !['accepted','variation'].includes(value.tiuSource)) throw new Error('Sumber TIU tidak dikenal.');
  for(const key of ['twkSource','tkpSource'] as const) if(value[key]!==undefined&&!['accepted','new'].includes(value[key]!))throw new Error('Sumber '+key.slice(0,3).toUpperCase()+' tidak dikenal.');
  if (value.difficulty === 'hots') value.difficulty = 'sulit';
  if (!['SKD', 'TWK', 'TIU', 'TKP'].includes(value.mode)) throw new Error('Subtes tidak dikenal.');
  if (!['campuran', 'mudah', 'sedang', 'sulit', 'hots'].includes(value.difficulty)) throw new Error('Tingkat kesulitan tidak dikenal.');
  for (const [key, maximum] of [['packages', 50], ['count', 200], ['duration', 300]] as const) {
    if (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > maximum) throw new Error(key + ' harus berupa bilangan bulat 1–' + maximum + '.');
  }
  if (value.packages * value.count > 4000) throw new Error('Maksimal 4.000 soal per proses. Kurangi jumlah paket atau soal.');
  if (typeof value.uniqueAcross !== 'boolean') throw new Error('Pilihan pengulangan harus berupa boolean.');
  if (typeof value.seed !== 'string' || !value.seed.trim() || value.seed.length > 100) throw new Error('Seed harus berisi 1–100 karakter.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 150) throw new Error('Judul harus berisi 1–150 karakter.');
  if (!Array.isArray(value.topics) || value.topics.some((topic) => typeof topic !== 'string')) throw new Error('Pilihan materi tidak valid.');
  const available = value.mode === 'SKD' ? Object.values(TOPICS).flat() : TOPICS[value.mode];
  if (value.topics.some((topic) => !available.includes(topic))) throw new Error('Materi tidak sesuai dengan subtes yang dipilih.');
  if (!Array.isArray(value.subtopics) || value.subtopics.some((topic) => typeof topic !== 'string')) throw new Error('Pilihan submateri tidak valid.');
  const eligibleSubtopics = [...BANK, ...LOCAL_RECIPES, ...TIU_FAMILIES.map((family) => ({ ...family, subtopic: family.name })), ...MAPPING_ROWS.map((r)=>({ topic:r.topic,subtopic:r.chapter }))]
    .filter((item) => available.includes(item.topic)).map((item) => item.topic + '::' + item.subtopic);
  if (value.subtopics.some((topic) => !eligibleSubtopics.includes(topic))) throw new Error('Submateri tidak sesuai subtes yang dipilih.');
  if (value.mode === 'SKD' && value.count < 3 && !value.chapterCounts) throw new Error('Paket gabungan memerlukan minimal tiga soal.');
  if (value.composition) {
    const values = ['mudah', 'sedang', 'sulit'].map((level) => value.composition![level as keyof NonNullable<Settings['composition']>]);
    if (values.some((n) => !Number.isInteger(n) || n < 0 || n > 100) || values.reduce((a, b) => a + b, 0) !== 100) throw new Error('Komposisi kesulitan harus berjumlah 100%.');
  }
  if (value.blueprint && (!Array.isArray(value.blueprint) || value.blueprint.length > 100)) throw new Error('Blueprint tidak valid.');
  if (value.blueprint) { const errors = checkBlueprint(value.blueprint, value); if (errors.length) throw new Error(errors.join(' ')); }
  return { ...value, seed: value.seed.trim(), title: value.title.trim(), topics: [...new Set(value.topics)] };
}
export function distribution(mode: Mode, count: number): Record<Subtest, number> {
  if (mode !== 'SKD') return { TWK: mode === 'TWK' ? count : 0, TIU: mode === 'TIU' ? count : 0, TKP: mode === 'TKP' ? count : 0 };
  const exact = Object.entries(BASELINE.counts).map(([subtest, n]) => ({ subtest: subtest as Subtest, raw: count * n / 110 }));
  const result = { TWK: 0, TIU: 0, TKP: 0 };
  exact.forEach((item) => { result[item.subtest] = Math.floor(item.raw); });
  exact.sort((a, b) => (b.raw % 1) - (a.raw % 1));
  const remainder = count - Object.values(result).reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[exact[i].subtest]++;
  return result;
}
export const normalizeText = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function fingerprint(question: Question): string {
  const visual = question.visual ? [...question.visual.figures.map((figure) => figure ? figureSignature(figure) : '?'), ...(question.visual.scenes ?? []).map((scene) => scene ? sceneSignature(scene) : '?')].join(';') : '';
  const options = question.options.map((option) => option.scene ? sceneSignature(option.scene) : option.figure ? figureSignature(option.figure) : normalizeText(option.text)).sort().join('|');
  return normalizeText(question.stem) + '|' + JSON.stringify(question.table ?? '') + '|' + visual + '|' + options;
}
// Kasus TKP baru: family = skenario (satu skenario tidak muncul dua kali dalam paket, juga antarpaket bila uniqueAcross).
// Soal TWK yang tidak boleh satu paket karena set opsi dan kuncinya sama: berbagi family, sehingga `usedFamilies` (per paket) menyingkirkan pasangannya.
// Antarpaket tetap boleh bergantian (family hanya dicek per paket untuk soal bukan kasus), jadi kapasitas antarpaket tidak berkurang.
// Kelompok boleh berisi lebih dari dua soal (tryout-eksklusif-*: contoh tryout yang konstruknya berulang, mis. konflik kepentingan atau berita acara); tiap kelompok paling banyak satu soal per paket.
export const EXCLUSIVE_TWK: Record<string, string> = {
  'twk-ref-2-1': 'twk-eksklusif-nilai-dasar', 'twk-ref-2-6': 'twk-eksklusif-nilai-dasar', 'twk-ref-2-4': 'twk-eksklusif-sila-persatuan', 'twk-ref-3-6': 'twk-eksklusif-sila-persatuan',
  'tryout-ref-03-03': 'tryout-eksklusif-kemandirian', 'tryout-ref-05-01': 'tryout-eksklusif-kemandirian',
  'tryout-ref-04-01': 'tryout-eksklusif-proyek-lintas-daerah', 'tryout-ref-05-02': 'tryout-eksklusif-proyek-lintas-daerah',
  'tryout-ref-03-15': 'tryout-eksklusif-pemerasan-izin', 'tryout-ref-04-11': 'tryout-eksklusif-pemerasan-izin',
  'tryout-ref-03-14': 'tryout-eksklusif-konflik-kepentingan', 'tryout-ref-04-08': 'tryout-eksklusif-konflik-kepentingan', 'tryout-ref-04-12': 'tryout-eksklusif-konflik-kepentingan',
  'tryout-ref-05-07': 'tryout-eksklusif-konflik-kepentingan', 'tryout-ref-05-11': 'tryout-eksklusif-konflik-kepentingan',
  'tryout-ref-03-16': 'tryout-eksklusif-berita-acara', 'tryout-ref-04-07': 'tryout-eksklusif-berita-acara', 'tryout-ref-05-09': 'tryout-eksklusif-berita-acara',
};
// Pengganti manual (app/page.tsx) tidak boleh membawa soal eksklusif yang pasangannya sudah ada di paket yang sama.
export const clashesExclusive = (candidate: Pick<Question, 'family'>, pack: Pick<Question, 'id' | 'family'>[], replacingId: string) =>
  Object.values(EXCLUSIVE_TWK).includes(candidate.family) && pack.some((other) => other.id !== replacingId && other.family === candidate.family);
// Jumlah per chapter memakai sumber tryout (family = accepted-<id>), jadi kelompok eksklusif dibaca dari id sumbernya.
export const exclusiveGroupOf = (q: Pick<Question, 'proof'>) => q.proof.kind === 'bank' ? EXCLUSIVE_TWK[q.proof.id] : undefined;
const familyFor = (item: BankItem) => item.kasus ? item.kasus.skenario : EXCLUSIVE_TWK[item.id] ?? (item.id.startsWith('twk-case-v2-') ? item.id : item.id.includes('-case-') ? item.id.replace(/-\d+$/, '') : item.id);
// Sebaran kasus TKP baru per paket (Tahap 3): batas tiap nilai sebagai bagian dari jumlah TKP paket. Lunak: bila persediaan sel topik × kesulitan memaksa,
// batas boleh terlampaui; pemeriksaan di scripts/tkp-checks.ts melaporkannya.
const SPREAD_LIMITS = { pola: .15, keputusan: .2, peran: .25, tempat: .2 } as const;
type SpreadKey = keyof typeof SPREAD_LIMITS;
const SPREAD_KEYS = Object.keys(SPREAD_LIMITS) as SpreadKey[];
type Spread = Record<SpreadKey, Map<string, number>>;
const newSpread = (): Spread => ({ pola: new Map(), keputusan: new Map(), peran: new Map(), tempat: new Map() });
export const spreadLimit = (key: SpreadKey, total: number) => Math.max(1, Math.round(SPREAD_LIMITS[key] * total));
// Penalti memilih kasus: kelebihan di atas batas (utama, bobot 1000) ditambah keterpakaian nilainya dalam paket (pembeda); makin kecil makin baik.
function spreadPenalty(meta: TkpMeta, spread: Spread, total: number): number {
  let over = 0, used = 0;
  for (const key of SPREAD_KEYS) {
    const count = spread[key].get(meta[key]) ?? 0, limit = spreadLimit(key, total);
    over += Math.max(0, count + 1 - limit); used += count / limit;
  }
  return over * 1000 + used;
}
function noteSpread(meta: TkpMeta, spread: Spread) { for (const key of SPREAD_KEYS) spread[key].set(meta[key], (spread[key].get(meta[key]) ?? 0) + 1); }
function chooseSpread(items: BankItem[], spread: Spread, total: number, random: Rng): BankItem {
  const scored = items.map((item) => ({ item, penalty: spreadPenalty(item.kasus!, spread, total) }));
  const least = Math.min(...scored.map((entry) => entry.penalty));
  return random.pick(scored.filter((entry) => entry.penalty <= least + 1e-9).map((entry) => entry.item));
}
function fromBank(item: BankItem): Question {
  return {
    ...item, no: 0, options: item.options.map((option) => ({ ...option })), family: familyFor(item),
    origin: item.id.includes('-ref-') ? 'referensi' : 'kasus',
    proof: { kind: 'bank', id: item.id, answerText: item.options[item.answer].text },
  };
}
// Rujukan huruf opsi di pembahasan/alasan soal referensi dipetakan ke urutan baru. Hanya rujukan eksplisit yang disentuh: "Opsi B",
// "pilihan A dan C", "jawaban B", "(B)", dan rentang ("Opsi A–C", "A hingga D"; rentang tidak lagi berurutan setelah diacak, jadi
// ditulis ulang sebagai daftar huruf hasil pemetaan). Huruf pembuka butir "B." / "B:" di awal baris hanya dipetakan bila `lineLabels`
// (blok alasan per opsi), bukan di pembahasan bebas, karena nama seperti "A. Hasyim Muzadi" tidak bisa dibedakan dari butir.
// Huruf lain tidak pernah diubah: singkatan nama dan gelar ("R.A. Kartini", "A.H. Nasution", "D. N. Aidit") maupun huruf di dalam kata.
export function remapOptionLabels(text: string, order: number[], lineLabels = false): string {
  const move = (letter: string) => String.fromCharCode(65 + order.indexOf(letter.charCodeAt(0) - 65));
  const spoken = (letters: string[]) => letters.length < 3 ? letters.join(' dan ') : letters.slice(0, -1).join(', ') + ', dan ' + letters[letters.length - 1];
  const explicit = /\b((?:[Oo]psi|[Pp]ilihan|[Jj]awaban)\s+)([A-E])(?:\s*(?:–|—|-|hingga|sampai dengan|sampai|s\.d\.)\s*([A-E])\b|((?:(?:\s*,\s*(?:(?:dan|atau|serta)\s+)?|\s+(?:dan|atau|serta)\s+|\s*&\s*)[A-E])*)\b)/g;
  const mapped = text
    .replace(explicit, (_, lead: string, first: string, last: string | undefined, rest: string | undefined) => {
      if (!last) return lead + (first + (rest ?? '')).replace(/[A-E]/g, move);
      const from = Math.min(first.charCodeAt(0), last.charCodeAt(0)), to = Math.max(first.charCodeAt(0), last.charCodeAt(0));
      return lead + spoken(Array.from({ length: to - from + 1 }, (_, i) => move(String.fromCharCode(from + i))).sort());
    })
    .replace(/\(([A-E])\)/g, (_, letter: string) => '(' + move(letter) + ')');
  return lineLabels ? mapped.replace(/(^|\n)([A-E])(?=[.:]\s)(?!\.\s?[A-Z]\.)/g, (_, lead: string, letter: string) => lead + move(letter)) : mapped;
}
// Urutan opsi: `mix` adalah pengacakan bawaan (satu undian per butir yang diacak); bila `keyAt` diberikan, kunci dipindahkan ke posisi itu
// dan opsi lain tetap berurutan menurut `mix`. Butir yang urutannya dipertahankan (keepsOptionOrder) tidak melewati fungsi ini.
function arranged(question: Question, mix: number[], keyAt?: number): Question {
  const rest = mix.filter((i) => i !== question.answer);
  const order = keyAt === undefined ? mix : [...rest.slice(0, keyAt), question.answer, ...rest.slice(keyAt)];
  const proof = question.proof;
  const remapLabels = (text: string, lineLabels = false) => question.origin === 'referensi' ? remapOptionLabels(text, order, lineLabels) : text;
  return {
    // Opsi bergambar diberi nama menurut hurufnya setelah diacak ("Gambar C"), bukan menurut urutan susun.
    ...question, options: order.map((i, position) => ({ ...question.options[i], reason: remapLabels(question.options[i].reason, true),
      ...(question.options[i].scene || question.options[i].figure ? { text: 'Gambar ' + String.fromCharCode(65 + position) } : {}) })),
    answer: order.indexOf(question.answer), explanation: remapLabels(question.explanation),
    proof: proof.kind === 'numeric' ? { ...proof, values: order.map((i) => proof.values[i]) } :
      proof.kind === 'logic' ? { ...proof, valid: order.map((i) => proof.valid[i]),
        ...(proof.entailment ? { entailment: { ...proof.entailment, conclusions: order.map((i) => proof.entailment!.conclusions[i]) } } : {}) } : proof,
  };
}
// Posisi kunci untuk butir TWK/TIU yang diacak: huruf yang paling jarang muncul diisi lebih dahulu (butir yang posisinya tetap sudah
// dihitung di `fixed`), lalu urutannya diacak. Selisih antarhuruf paling banyak satu bila butir tetap tidak sudah timpang. Deterministik per seed.
function keyTargets(fixed: number[], count: number, random: Rng): number[] {
  const totals = [...fixed], targets: number[] = [];
  for (let i = 0; i < count; i++) {
    const least = Math.min(...totals);
    const position = random.pick(totals.flatMap((n, at) => n === least ? [at] : []));
    totals[position]++; targets.push(position);
  }
  return random.shuffle(targets);
}
function planTopics(topics: string[], count: number, random: Rng): string[] {
  const sorted = random.shuffle(topics);
  return Array.from({ length: count }, (_, index) => sorted[index % sorted.length]);
}
// Butir sekelompok eksklusif (EXCLUSIVE_TWK) tidak boleh satu paket, jadi satu kelompok hanya menyumbang satu slot per paket: paling banyak `packages` butir
// (satu per paket), bukan sebanyak butirnya. Butir lain satu slot masing-masing.
export function bankSlots(items: BankItem[], packages: number): number {
  const groups = new Map<string, number>();
  let single = 0;
  for (const item of items) { const group = EXCLUSIVE_TWK[item.id]; if (group) groups.set(group, (groups.get(group) ?? 0) + 1); else single++; }
  return [...groups.values()].reduce((sum, n) => sum + Math.min(n, packages), single);
}
export function capacity(settings: Settings) {
  const counts = distribution(settings.mode, settings.count), packages = settings.uniqueAcross ? settings.packages : 1;
  return (['TWK', 'TKP'] as const).filter((subtest) => counts[subtest]).map((subtest) => {
    const required = counts[subtest] * packages;
    if (usesLocal(settings, subtest)) { const available = localRecipes(subtest, settings.topics, settings.difficulty, settings.subtopics).length; return { subtest, available, bank: available, required }; }
    const items = bankFor(subtest, settings.topics, settings.difficulty, settings.subtopics);
    return { subtest, available: bankSlots(items, packages), bank: items.length, required };
  });
}
export function generate(settingsInput: Partial<Settings>): Package[] {
  const settings = normalizeSettings(settingsInput);
  if (settings.profile==='tryout-2027') {
    const packages=generateTryout(settings,fingerprint),audit=auditPackages(packages,settings);
    if (!audit.ok) throw new Error('Profil tryout gagal validasi: '+audit.errors.slice(0,3).join('; '));
    return packages;
  }
  const counts = distribution(settings.mode, settings.count);
  const blueprint = buildBlueprint(settings);
  for (const entry of capacity(settings)) if (entry.required > entry.available) {
    throw new Error('Persediaan ' + entry.subtest + ' untuk filter ini ' + entry.available + ' butir' +
      (entry.bank > entry.available ? ' (bank memuat ' + entry.bank + ', tetapi soal berpasangan eksklusif hanya boleh satu per paket)' : '') + ', sedangkan permintaan ' +
      entry.required + '. Kurangi jumlah, perluas materi/kesulitan, atau izinkan soal dipakai kembali di paket berbeda.');
  }
  const globalUsed = new Set<string>();
  const globalBankUsed = new Set<string>();
  const globalFamilies = new Set<string>();
  const globalLocalUsed = new Set<string>();
  const quotaError = (subtest: Subtest, topic: string, level: string) => new Error(TKP_KASUS_TOPICS.has(topic) && subtest === 'TKP' ?
    'Kuota ' + topic + ' / ' + level + ' tidak dapat dipenuhi tanpa mengulang skenario TKP. Kurangi soal atau paket, perluas filter, atau tambah kasus di data/tkp-kasus/.' :
    'Kuota ' + topic + ' / ' + level + ' tidak dapat dipenuhi. Materi tidak diganti otomatis.');
  // Soal TWK dan TKP dari bank dibagi ke SEMUA paket sekaligus bila soal tidak boleh berulang antarpaket (lib/bagi.ts); paket tunggal atau yang boleh
  // berulang memilih sendiri-sendiri (di bawah). Pemilihan serakah paket demi paket menyisakan anggota kelompok eksklusif dan strata TKP yang sama untuk paket terakhir.
  const shares = new Map<Subtest, Share>();
  if (settings.uniqueAcross && settings.packages > 1) for (const subtest of ['TWK', 'TKP'] as const) {
    if (!counts[subtest] || usesLocal(settings, subtest)) continue;
    const topics = TOPICS[subtest].filter((topic) => !settings.topics.length || settings.topics.includes(topic));
    if (!topics.length) continue;
    const rows = blueprint.filter((row) => row.subtest === subtest);
    const planned = planShares({ rows, items: bankFor(subtest, topics, settings.difficulty, settings.subtopics), packages: settings.packages, seed: settings.seed + '|' + subtest,
      group: (item) => EXCLUSIVE_TWK[item.id],
      ...(subtest === 'TKP' ? { limits: { pola: spreadLimit('pola', counts.TKP), keputusan: spreadLimit('keputusan', counts.TKP), peran: spreadLimit('peran', counts.TKP), tempat: spreadLimit('tempat', counts.TKP) } } : {}) });
    if ('failed' in planned) throw quotaError(subtest, planned.failed.topic, planned.failed.difficulty);
    shares.set(subtest, planned.share);
  }
  const packages: Package[] = [];
  for (let p = 0; p < settings.packages; p++) {
    const random = rng(settings.seed + '|' + p);
    const localUsed = new Set<string>(), localBankUsed = new Set<string>(), usedFamilies = new Set<string>();
    // Undian tersendiri untuk seri penalti sebaran, agar `random` (acak butir lain pada seed yang sama) tidak bergeser.
    const spread = newSpread(), spreadRandom = rng(settings.seed + '|' + p + '|sebaran');
    const questions: Question[] = [];
    const localUsedRecipes = new Set<string>();
    for (const subtest of ['TWK', 'TIU', 'TKP'] as const) {
      if (!counts[subtest]) continue;
      const topics = TOPICS[subtest].filter((topic) => !settings.topics.length || settings.topics.includes(topic));
      if (!topics.length) throw new Error('Pilih setidaknya satu materi untuk ' + subtest + '.');
      const pool = random.shuffle(bankFor(subtest, topics, settings.difficulty, settings.subtopics));
      const familyPool = TIU_FAMILIES.filter((family) => topics.includes(family.topic) &&
        (settings.difficulty === 'campuran' || family.levels.includes(settings.difficulty)) &&
        (!settings.subtopics.length || settings.subtopics.includes(family.topic + '::' + family.name)));
      const availableTopics = subtest === 'TIU' ? topics.filter((topic) => familyPool.some((family) => family.topic === topic)||pool.some((item)=>item.topic===topic)) :
        topics.filter((topic) => usesLocal(settings,subtest)?localRecipes(subtest,[topic],settings.difficulty,settings.subtopics).length:pool.some((item) => item.topic === topic));
      if (!availableTopics.length) throw new Error('Tidak ada soal ' + subtest + ' pada filter kesulitan ini.');
      const plan = random.shuffle(blueprint.filter((row) => row.subtest === subtest).flatMap((row) => Array.from({ length: row.count }, () => ({ topic: row.topic, difficulty: row.difficulty }))));
      // TWK dan TIU: butir yang diacak ditempatkan sesudah seluruh butir subtes tersusun, agar posisi kuncinya bisa diseimbangkan.
      // TKP tidak punya satu kunci tunggal dan tetap diacak langsung.
      const balanced = subtest !== 'TKP', deferred: { at: number; question: Question; mix: number[] }[] = [], fixedKeys = [0, 0, 0, 0, 0];
      for (let index = 0; index < plan.length; index++) {
        let question: Question | undefined;
        const target = plan[index].topic, targetLevel = plan[index].difficulty;
        if (usesLocal(settings,subtest)) {
          const available=localRecipes(subtest,[target],targetLevel,settings.subtopics).filter(x=>!localUsedRecipes.has(x.key)&&(!settings.uniqueAcross||!globalLocalUsed.has(x.key)));
          const recipe=chooseLocal(available,questions,random,packages.flatMap(p=>p.questions));
          if(!recipe)throw new Error('Variasi lokal '+target+' / '+targetLevel+' habis. Perluas filter atau izinkan pengulangan antarpaket.');
          question=makeLocal(recipe,random); question.id+='-p'+p;
          localUsedRecipes.add(recipe.key);globalLocalUsed.add(recipe.key);
        } else if (subtest !== 'TIU') {
          const candidates = pool.filter((item) => !localBankUsed.has(item.id) && (!settings.uniqueAcross || !globalBankUsed.has(item.id)));
          // Kasus TKP baru: skenario tidak pernah berulang (tanpa fallback duplikat) dan dipilih menurut penalti sebaran, bukan urutan pool.
          // Butir lain (TWK, referensi, kerangka TKP lama) tetap memakai urutan pool dan fallback lama, sehingga pilihan TWK dan TIU tidak bergeser.
          // TKP tidak sama: pool TKP diacak dengan `random` (setelah TWK dan TIU), dan isinya berubah bila kasus baru menggantikan kerangka lama, jadi pemilihan
          // TKP topik lain ikut bergeser. TWK dan TIU tetap tidak bergeser karena disusun lebih dahulu dari aliran undian yang sama.
          const choose = (items: BankItem[]) => {
            const fresh = items.filter((item) => !usedFamilies.has(familyFor(item)) && !(settings.uniqueAcross && item.kasus && globalFamilies.has(familyFor(item))));
            const head = fresh[0] ?? items.find((item) => !item.kasus && !EXCLUSIVE_TWK[item.id]);
            return head?.kasus ? chooseSpread(fresh.filter((item) => item.kasus), spread, counts.TKP, spreadRandom) : head;
          };
          // Dengan pembagian lintas paket, butir paket ini sudah ditetapkan per sel; selain itu dipilih seperti biasa.
          const planned = shares.get(subtest)?.[p];
          const item = planned ? planned.get(cellKey(target, targetLevel))?.shift() : choose(candidates.filter((item) => item.topic === target && item.difficulty === targetLevel));
          if (!item) throw quotaError(subtest, target, targetLevel);
          localBankUsed.add(item.id); globalBankUsed.add(item.id); usedFamilies.add(familyFor(item));
          if (item.kasus) { globalFamilies.add(familyFor(item)); noteSpread(item.kasus, spread); }
          question = fromBank(item);
        } else {
          const families = familyPool.filter((family) => family.topic === target && family.levels.includes(targetLevel));
          if(!families.length){
            const item=pool.find((item)=>item.topic===target&&item.difficulty===targetLevel&&!localBankUsed.has(item.id)&&(!settings.uniqueAcross||!globalBankUsed.has(item.id)));
            if(!item)throw new Error('Contoh TIU habis untuk chapter dan kesulitan ini.');
            localBankUsed.add(item.id);globalBankUsed.add(item.id);question=fromBank(item);
          }
          for (let attempt = 0; attempt < 600; attempt++) {
            if(question)break;
            const family = families[(index + attempt) % families.length];
            const level = targetLevel;
            // Silogisme narasi: contoh blueprint dipakai lebih dahulu; banyak butir chapter itu yang sudah ada (semua paket) menentukan contoh berikutnya, dan percobaan ulang memakai pembangkit.
            const slot = attempt === 0 ? { seed: settings.seed, used: (chapter: string) => [...packages.flatMap((pack) => pack.questions), ...questions].filter((placed) => placed.proof.kind === 'model' && placed.proof.model.kind === 'syllogism' && placed.proof.model.chapter === chapter).length } : undefined;
            const draft = makeTiu(family, level, random, slot);
            const candidate: Question = { ...draft, id: 'tiu-' + family.id + '-' + p + '-' + index + '-' + attempt, no: 0 };
            const signature = fingerprint(candidate);
            if (localUsed.has(signature) || (settings.uniqueAcross && globalUsed.has(signature))) continue;
            question = candidate; break;
          }
          if (!question) throw new Error('Variasi TIU untuk filter ini tidak cukup. Kurangi jumlah atau tambahkan materi.');
        }
        const signature = fingerprint(question);
        if (localUsed.has(signature) || (settings.uniqueAcross && globalUsed.has(signature))) {
          throw new Error('Butir berulang ditemukan. Kurangi jumlah paket atau perluas filter.');
        }
        localUsed.add(signature); globalUsed.add(signature);
        // Satu undian pengacakan per butir, pada titik yang sama seperti sebelumnya, sehingga pemilihan butir lain pada seed yang sama tidak
        // bergeser. Butir berurutan baku (kecukupan data, opsi ordinal) tetap mengambil undian itu tetapi tidak memakainya.
        const drawn = question.provenance?.status === 'accepted-example' || question.proof.kind === 'local' ? null : random.shuffle([0, 1, 2, 3, 4]);
        const mix = drawn && !keepsOptionOrder(question) ? drawn : null;
        if (mix && balanced) { deferred.push({ at: questions.length, question, mix }); questions.push({ ...question, no: questions.length + 1 }); continue; }
        if (!mix && balanced) fixedKeys[question.answer]++;
        const final = { ...(mix ? arranged(question, mix) : question), no: questions.length + 1 };
        questions.push({ ...final, binding: validationBinding(final) });
      }
      if (deferred.length) {
        const targets = keyTargets(fixedKeys, deferred.length, rng(settings.seed + '|' + p + '|kunci|' + subtest));
        deferred.forEach((item, i) => {
          const final = { ...arranged(item.question, item.mix, targets[i]), no: item.at + 1 };
          questions[item.at] = { ...final, binding: validationBinding(final) };
        });
      }
    }
    packages.push({ id: 'SKD-' + String(p + 1).padStart(2, '0'), mode: settings.mode, seed: settings.seed + '|' + p,
      duration: settings.duration, questions: constrainNarrativePackage(questions) });
  }
  const audit = auditPackages(packages, settings);
  if (!audit.ok) throw new Error('Paket gagal validasi: ' + audit.errors.slice(0, 3).join('; '));
  return packages;
}
export const sourceItem = (id: string) => BANK_MAP.get(id);
