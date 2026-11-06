// Generator silogisme menurut Blueprint Silogisme Tanpa Logika Kuantor (akademik, 28 Okt 2026, disesuaikan 29 Okt), menggantikan generator berdasarkan Panduan Produksi Soal TIU JadiASN bagian 2.1–2.3.
// Empat chapter: 2 Premis dan 3 Premis (Silogisme Biasa, Bagian A) serta 2 Premis - Narasi dan 3 Premis - Narasi (Bagian B). Rangkaian kerja satu soal:
//   pola formal (lib/silo-spec.ts: katalog 32 + 96 variasi bertanda, bentuk ekuivalen I/D/K, enam urutan) -> bahasa (lib/silo-frames.ts, lib/silo-lang.ts: premis prosa tanpa
//   penghubung bersyarat) -> kunci dan pengecoh DIHITUNG di sini dengan tabel kebenaran (lib/solver.ts) dan tiap pengecoh dipetakan ke jenis kesalahan blueprint
//   ("Pengecoh yang perlu dipetakan") -> pembahasan menurut Bagian 8 blueprint: Silogisme Biasa berakhir pada "Jawaban: kalimat" (tanpa analisis opsi), sedangkan Silogisme Narasi
//   menambahkan analisis kelima opsi (opsi salah dicoret ~~teks~~, huruf opsi lewat penanda {opsi:N} yang diisi saat tampil).
// Silogisme Narasi memakai lebih dahulu 19 contoh blueprint (lib/silo-contoh.ts) bila pemanggil memberi `slot`; pembangkit hanya mengisi kekurangannya.
// Keacakan hanya lewat `Rng` yang diberikan (pengacak turunan dari lib/rng.ts: isolated), jadi pemilihan butir lain pada seed yang sama tidak bergeser.
// Bentuk implikasi (konvers, invers, kontraposisi) ada di lib/tiu-implikasi.ts dan tidak termasuk blueprint ini.
import { analysisBlock, inline } from './explanation';
import type { Model } from './models';
import { mark } from './richtext';
import { rng, type Rng } from './rng';
import { contohAt, contohBuild, type NarasiChapter } from './silo-contoh';
import { rencanaButir, type PaketSlot } from './silo-rencana';
import { BIASA_FRAMES, NARASI_FRAMES } from './silo-frames';
import { definition, fillerRepeated, makeVoice, optionSentence, premiseSentence, repeatedPhrase, segMarked, segText, targetClause, type Made, type Voice } from './silo-lang';
import { COUNT2, COUNT3, EXTRA, L, LAW_NAME, VARS, and, base2, base3, codeOf, flip, formsOf, imp, keyForms, keyLaw, keluargaOfConfig, lit, logicOf, nand, normalization, or, sameStmt, shownOrder, texOf, transform, varsOf,
  type Base, type Config, type Fam2, type Form, type Keluarga, type Lit, type Stmt } from './silo-spec';
import { buildImplikasi, type Asked } from './tiu-implikasi';
import { entails, not, type Logic } from './solver';

export type Chapter = '2 Premis' | '3 Premis' | '2 Premis - Narasi' | '3 Premis - Narasi';
export type LogikaStatus = 'pasti' | 'bertentangan' | 'belum';
export const STATUS_LABEL: Record<LogikaStatus, string> = { pasti: 'Pasti mengikuti premis', bertentangan: 'Bertentangan dengan premis', belum: 'Belum dapat dipastikan' };
// Lima jenis kesalahan pengecoh pada blueprint ("Pengecoh yang perlu dipetakan").
export type ErrorTag = 'konvers-invers' | 'negasi-operator' | 'syarat' | 'kepastian' | 'informasi';
export const ERROR_NAME: Record<ErrorTag, string> = { 'konvers-invers': 'Konvers dan invers', 'negasi-operator': 'Negasi dan operator', syarat: 'Syarat perlu dan cukup', kepastian: 'Kepastian tanpa dukungan', informasi: 'Informasi tambahan' };
// `reason`: alasan singkat per opsi (hanya Silogisme Narasi; Silogisme Biasa tidak memuat analisis opsi sehingga kosong). `ref`: nomor tetap opsi untuk penanda {opsi:N} pada pembahasan.
export type LogikaOption = { text: string; reason: string; status: LogikaStatus; logic?: Logic; error?: ErrorTag; ref?: number };
export type LogikaBuild = { stem: string; options: LogikaOption[]; answer: number; explanation: string; model: Model; bloom: 'C2' | 'C3' | 'C4'; code: string; chapter: Chapter | 'Bentuk Implikasi'; reversed: number; implications: number; difficultyReason?: string; source?: string };
// Pemanggil yang ingin contoh blueprint dipakai lebih dahulu: seed pembuatan dan banyak butir chapter itu yang sudah ada pada pembuatan yang sama (contoh ke-n dipakai bila n < jumlah contoh).
export type ContohSlot = { seed: string; used: (chapter: Chapter) => number };
export const TDS_TEXT = 'Tidak dapat disimpulkan.';

const entailed = (P: Logic[], s: Stmt) => entails(P, [logicOf(s)])[0];
const contradicted = (P: Logic[], s: Stmt) => entails(P, [not(logicOf(s))])[0];
export const statusOf = (P: Logic[], s: Stmt): LogikaStatus => entailed(P, s) ? 'pasti' : contradicted(P, s) ? 'bertentangan' : 'belum';
// Kesetaraan dua pernyataan hanya bergantung pada bentuknya, jadi hasil tabel kebenaran disimpan menurut kunci bentuk (pemilihan pengecoh menanyakannya berulang kali).
const stmtKey = (s: Stmt) => s.op + s.a[0] + (s.a[1] ? '-' : '+') + (s.b ? s.b[0] + (s.b[1] ? '-' : '+') : '');
const equivalentMemo = new Map<string, boolean>();
const equivalent = (a: Stmt, b: Stmt) => {
  const memoKey = stmtKey(a) + '~' + stmtKey(b), known = equivalentMemo.get(memoKey);
  if (known !== undefined) return known;
  const result = entails([logicOf(a)], [logicOf(b)])[0] && entails([logicOf(b)], [logicOf(a)])[0];
  equivalentMemo.set(memoKey, result);
  return result;
};
const lits = (vars: number[]): Lit[] => vars.flatMap((v) => [L(v, false), L(v, true)]);

// ---- Pengecoh ---------------------------------------------------------------------------------------------------------------------------------
type Cand = { stmt: Stmt; tag: ErrorTag; note: (status: LogikaStatus) => string };
// Alasan opsi Silogisme Narasi: redaksi singkat mengikuti analisis opsi contoh blueprint, berbeda menurut jenis kesalahan (status dari tabel kebenaran memilih redaksi yang sesuai).
const NOTE = {
  flip: () => 'Pernyataan ini berlawanan dengan keadaan yang dipastikan oleh premis dan hasil penerapan modus.',
  open: () => 'Premis tidak menetapkan keadaan ini. Kedua kemungkinan masih sesuai dengan bacaan.',
  and: (s: LogikaStatus) => s === 'bertentangan' ? 'Opsi menggabungkan dua keadaan tetapi sedikitnya satu bagiannya bertentangan dengan hasil penalaran. Gabungan itu tidak dapat menjadi kesimpulan.' :
    'Opsi menambahkan kepastian pada keadaan yang belum ditetapkan. Kepastian salah satu bagian tidak cukup membuktikan gabungan kedua bagian.',
  nand: () => 'Bentuk tidak terjadi bersamaan ini menegasikan gabungan yang keliru. Maknanya berbeda dari hasil penalaran.',
  konvers: () => 'Arah hubungan dibalik. Ketentuan dari keadaan awal menuju hasil akhir tidak membuktikan hubungan sebaliknya.',
  invers: () => 'Opsi menyangkal keadaan awal lalu ikut menyangkal hasil akhir. Penyangkalan anteseden tidak membenarkan penyangkalan konsekuen.',
  // side: ruas hubungan yang tandanya diubah (keadaan awal atau hasil akhir); tanpa side dipakai redaksi umum contoh blueprint.
  negImp: (s: LogikaStatus, side?: 'awal' | 'akhir') => s === 'bertentangan' ? 'Pernyataan ini berlawanan dengan hubungan yang dipastikan oleh premis dan hasil penerapan hukum.' :
    side === 'awal' ? 'Tanda keadaan awal diubah. Kondisi yang ditawarkan tidak dijamin oleh rangkaian premis.' :
    side === 'akhir' ? 'Tanda hasil akhir diubah. Hasil yang ditawarkan tidak dijamin oleh rangkaian premis dan masih dapat salah saat seluruh premis benar.' :
    'Hubungan yang ditawarkan memakai kondisi atau hasil yang tidak dijamin oleh rangkaian premis. Pernyataan ini masih dapat salah saat seluruh premis benar.',
  syarat: () => 'Arah hubungan pada salah satu premis dibalik tanpa dasar. Syarat cukup tidak otomatis menjadi syarat perlu.',
  info: () => 'Opsi menyatakan keadaan tambahan yang berbeda dari status atau hak dalam premis. Keadaan tambahan tersebut belum diketahui dari bacaan.',
  infoAnd: (s: LogikaStatus) => s === 'bertentangan' ? 'Opsi menggabungkan pernyataan yang berlawanan dengan hasil penalaran dengan keadaan tambahan yang tidak diberikan dalam premis. Gabungan itu tidak dapat menjadi kesimpulan.' :
    'Opsi menambahkan keadaan tambahan yang tidak diberikan dalam premis. Kepastian hasil penalaran tidak membuktikan keadaan tambahan itu.',
  target: () => 'Opsi menetapkan salah satu nilai kebenaran target. Nilai ini masih mungkin tetapi belum pasti berdasarkan premis yang tersedia.',
};
const TDS_REASON = 'Nilai kebenaran pernyataan yang ditanyakan belum dapat ditetapkan. Premis tidak memastikan pernyataan itu maupun negasinya.';
// Kalimat kedua alasan kunci: peran premis pada langkah penalaran (redaksi mengikuti contoh blueprint N2-05, N2-06, N3-02).
function keyDetail(cfg: Config, shown: number[]): string {
  const { base } = cfg, n = base.premises.length, at = (catalog: number) => catalog === n ? 4 : shown.indexOf(catalog) + 1, tex = (s: Stmt) => inline(texOf(s));
  if (n === 3) return 'Premis 4 berasal dari Premis ' + base.steps[0].use.map(at).join(' dan ') + ' serta dipakai bersama Premis ' + at(base.steps[1].use.find((use) => use !== n)!) + '.';
  const [rule, fact] = base.premises, law = base.steps[0].law;
  if (law === 'mp') return 'Fakta ' + tex(fact) + ' memenuhi pembatas pada aturan ' + tex(rule) + ' dan menghasilkan ' + tex(base.key!) + '.';
  if (law === 'mt') return 'Fakta ' + tex(fact) + ' menolak akibat pada aturan ' + tex(rule) + ' dan menghasilkan ' + tex(base.key!) + '.';
  if (law === 'sd') return 'Fakta ' + tex(fact) + ' menolak satu ruas pada pilihan ' + tex(rule) + '. Atau dibaca inklusif.';
  return 'Tidak ada fakta yang menetapkan keadaan awal. Hasil berupa hubungan dan tidak diubah menjadi kontraposisi atau disjungsi.';
}
// Hubungan A → B beserta turunan kesalahannya: konvers, invers, dan negasi salah satu ruas (dipakai pengecoh soal TDS).
function implicationErrors(ref: Stmt): Cand[] {
  const a = ref.a, b = ref.b!;
  return [{ stmt: imp(b, a), tag: 'konvers-invers', note: NOTE.konvers }, { stmt: imp(flip(a), flip(b)), tag: 'konvers-invers', note: NOTE.invers },
    { stmt: imp(a, flip(b)), tag: 'negasi-operator', note: (s) => NOTE.negImp(s, 'akhir') }, { stmt: imp(flip(a), b), tag: 'negasi-operator', note: (s) => NOTE.negImp(s, 'awal') }];
}
// Kunci berupa hubungan (A → C dalam bentuk I, D, atau K): SEMUA pengecoh juga berupa hubungan (contoh SK pada blueprint), tidak ada literal tunggal, "dan", maupun "tidak terjadi bersamaan".
// Tiap hubungan antara dua proposisi digolongkan menurut kerabatnya dengan hubungan kunci atau premis aturan: ruas yang sama dengan tanda dibalik (negasi), kedua tanda dibalik
// (invers), urutan dibalik (konvers pada kunci, syarat pada premis aturan). Hubungan tambahan memakai proposisi t (informasi tambahan).
function relationPool(base: Base, key: Stmt): Cand[] {
  const ref = base.key!, V = varsOf(base.premises), T = L(EXTRA), rules = base.premises.filter((p) => p.op === 'imp'), out: Cand[] = [];
  const kin = [ref, ...rules.filter((rule) => !sameStmt(rule, ref))];
  for (const a of lits(V)) for (const b of lits(V)) {
    if (a[0] === b[0]) continue;
    let cand: Cand | undefined;
    for (const rule of kin) {
      const isKey = rule === ref;
      if (a[0] === rule.a[0] && b[0] === rule.b![0]) {
        const flips = Number(a[1] !== rule.a[1]) + Number(b[1] !== rule.b![1]);
        if (flips === 1) { const side = a[1] !== rule.a[1] ? 'awal' : 'akhir'; cand = { stmt: imp(a, b), tag: 'negasi-operator', note: (s) => NOTE.negImp(s, side) }; }
        else if (flips === 2) cand = { stmt: imp(a, b), tag: 'konvers-invers', note: NOTE.invers };
      } else if (a[0] === rule.b![0] && b[0] === rule.a[0]) {
        const flips = Number(a[1] !== rule.b![1]) + Number(b[1] !== rule.a[1]);
        if (flips === 0) cand = { stmt: imp(a, b), tag: isKey ? 'konvers-invers' : 'syarat', note: isKey ? NOTE.konvers : NOTE.syarat };
        else if (flips === 1) cand = { stmt: imp(a, b), tag: 'negasi-operator', note: NOTE.negImp };
      }
      if (cand) break;
    }
    out.push(cand ?? { stmt: imp(a, b), tag: 'negasi-operator', note: NOTE.negImp });
  }
  for (const stmt of [imp(ref.a, T), imp(flip(ref.a), T), imp(T, ref.b!), imp(T, flip(ref.b!))]) out.push({ stmt, tag: 'informasi', note: NOTE.info });
  // Kunci berbentuk disjungsi (D): pengecoh ditulis dalam bentuk yang sama (¬A ∨ C setara dengan A → C) supaya bentuk kalimat tidak membedakan kunci.
  return key.op === 'or' ? out.map((c) => ({ ...c, stmt: or(flip(c.stmt.a), c.stmt.b!) })) : out;
}
function candidatePool(cfg: Config, key: Stmt | null, P: Logic[], narasi: boolean): Cand[] {
  const { base } = cfg, V = varsOf(base.premises), out: Cand[] = [], add = (stmt: Stmt, tag: ErrorTag, note: Cand['note']) => out.push({ stmt, tag, note });
  const T = L(EXTRA), determined = (l: Lit) => entailed(P, lit(l)) || contradicted(P, lit(l));
  if (key === null) { // TDS: rujukan hubungan = premis aturan (dua premis) atau Premis 4 (tiga premis); pengecoh berupa turunan hubungan itu dan gabungan dengan fakta
    const ref = base.premises.length === 2 ? base.premises[0] : base.steps[0].out!, target = base.target!;
    out.push(...implicationErrors(ref));
    for (const f of base.premises.filter((p) => p.op === 'lit').map((p) => p.a)) { add(and(target, f), 'negasi-operator', NOTE.and); add(and(flip(target), f), 'negasi-operator', NOTE.and); }
    if (!narasi) { add(nand(ref.b!, flip(ref.a)), 'konvers-invers', NOTE.konvers); add(nand(ref.b!, ref.a), 'negasi-operator', NOTE.nand); }
    return out;
  }
  if (key.op === 'imp' || key.op === 'or') return relationPool(base, key);
  // Kunci literal: semua proposisi premis sudah ditetapkan oleh premis, jadi hubungan (konvers, invers, syarat) antara proposisi itu pasti benar (menjadi kunci kedua) dan tidak
  // dipakai; pengecoh sah berupa kebalikan literal, gabungan "dan", "tidak terjadi bersamaan", serta keadaan tambahan t.
  for (const l of lits(V)) add(lit(l), determined(l) ? 'negasi-operator' : 'kepastian', determined(l) ? NOTE.flip : NOTE.open);
  for (const a of lits(V)) for (const b of lits(V)) if (a[0] < b[0]) {
    add(and(a, b), 'negasi-operator', NOTE.and);
    if (!narasi) add(nand(a, b), 'negasi-operator', NOTE.nand);
  }
  add(lit(T), 'informasi', NOTE.info); add(lit(flip(T)), 'informasi', NOTE.info);
  for (const l of lits(V)) add(and(l, T), 'informasi', NOTE.infoAnd);
  return out;
}

// Bentuk permukaan opsi yang dapat dipakai peserta untuk menyisihkan opsi tanpa bernalar: "dan", "tidak terjadi bersamaan", atau predikat baru (t).
const usesExtra = (s: Stmt) => s.a[0] === EXTRA || s.b?.[0] === EXTRA;
export const isSurfaceForm = (s: Stmt) => s.op === 'and' || s.op === 'nand' || usesExtra(s);
const negatives = (s: Stmt) => Number(s.a[1]) + Number(s.b?.[1] ?? false);
const shapeOf = (s: Stmt) => (usesExtra(s) ? 'info-' : '') + (s.op === 'lit' ? 'lit' : s.op === 'and' ? 'and' : s.op === 'nand' ? 'nand' : 'rel');
export const MAX_TIDAK = 2;
export const tidakCount = (text: string) => (text.match(/\btidak\b/gi) ?? []).length;
const MIN_PURE = 2;

// Memilih `need` pengecoh: komposisi jenis kesalahan diundi acak dari semua pembagian yang mungkin (rencana), lalu bentuk kalimatnya (kebalikan, "dan", hubungan, informasi tambahan) juga acak, sehingga
// komposisi lima jenis kesalahan berbeda antarsoal. Syarat: tidak ada pengecoh yang mengikuti premis (kunci tunggal), tidak ada dua yang setara, "dan" paling banyak dua, "tidak terjadi
// bersamaan" paling banyak satu, dan sedikitnya dua pengecoh (termasuk pernyataan yang ditanyakan pada TDS) tanpa bentuk permukaan, supaya menyisihkan "dan", "tidak terjadi", dan
// predikat baru tidak pernah menyisakan satu opsi.
type Quota = { isShort: (c: Cand) => boolean; shortNeed: number };
// Semua cara membagi `need` pengecoh ke jenis-jenis kesalahan (multiset), dipakai sebagai rencana komposisi.
const compositions = (tags: ErrorTag[], need: number): ErrorTag[][] => need === 0 ? [[]] : tags.flatMap((tag, i) => compositions(tags.slice(i), need - 1).map((rest) => [tag, ...rest]));
// Kelas kesetaraan calon pengecoh (dua calon sekelas tidak boleh sama-sama terpilih).
function equivalenceClasses(cands: Cand[]): Map<Cand, number> {
  const reps: Stmt[] = [], out = new Map<Cand, number>();
  for (const cand of cands) {
    let id = reps.findIndex((rep) => equivalent(rep, cand.stmt));
    if (id < 0) { id = reps.length; reps.push(cand.stmt); }
    out.set(cand, id);
  }
  return out;
}
function sampleSet(usable: Cand[], fixed: Cand[], classOf: Map<Cand, number>, need: number, minPure: number, quota: Quota | undefined, r: Rng): Cand[] | null {
  const byTag = new Map<ErrorTag, Cand[]>();
  for (const cand of usable) byTag.set(cand.tag, [...(byTag.get(cand.tag) ?? []), cand]);
  const plans = compositions([...byTag.keys()], need), pure = (c: Cand) => !isSurfaceForm(c.stmt);
  for (let tries = 0; tries < 10; tries++) {
    const plan = r.shuffle(r.pick(plans)), classes = new Set(fixed.map((c) => classOf.get(c)!)), picked: Cand[] = [];
    let ands = 0, nands = 0, shorts = 0, longs = 0, pures = fixed.filter(pure).length, ok = true;
    for (const [slot, tag] of plan.entries()) {
      const forcePure = minPure - pures >= plan.length - slot; // sisa slot tinggal cukup untuk memenuhi syarat pengecoh tanpa bentuk permukaan
      const list = byTag.get(tag)!.filter((c) => !classes.has(classOf.get(c)!) && !(c.stmt.op === 'and' && ands >= 2) && !(c.stmt.op === 'nand' && nands >= 1) && (!forcePure || pure(c)) &&
        (!quota || (quota.isShort(c) ? shorts < quota.shortNeed : longs < need - quota.shortNeed)));
      if (!list.length) { ok = false; break; }
      const shape = r.pick([...new Set(list.map((c) => shapeOf(c.stmt)))]), cand = r.pick(list.filter((c) => shapeOf(c.stmt) === shape));
      picked.push(cand); classes.add(classOf.get(cand)!);
      if (cand.stmt.op === 'and') ands++;
      if (cand.stmt.op === 'nand') nands++;
      if (pure(cand)) pures++;
      if (quota?.isShort(cand)) shorts++; else longs++;
    }
    if (ok && pures >= minPure) return picked;
  }
  return null;
}
// Kalimat opsi: teks kembar, teks yang mengulang premis, lebih dari dua kata "tidak", dan frasa berulang ditolak dan diminta ulang.
function realizeOptions(voice: Voice, stmts: Stmt[], used: Set<string>, made: Made[], r: Rng): string[] | null {
  const out: string[] = [], local = new Set(used), mask = [voice.subject.c, voice.subject.m];
  for (const stmt of stmts) {
    let text = '';
    for (let attempt = 0; attempt < 12 && !text; attempt++) {
      const candidate = segText(optionSentence(voice, stmt, r));
      if (!local.has(candidate) && !made.some((m) => segText(m.segs) === candidate) && tidakCount(candidate) <= MAX_TIDAK && !repeatedPhrase(candidate, mask)) text = candidate;
    }
    if (!text) return null;
    local.add(text); out.push(text);
  }
  return out;
}
type Chosen = { wrong: Cand[]; texts: string[]; keyText: string };
// Memilih pengecoh beserta kalimatnya. Posisi kunci menurut panjang teks (0 = terpendek … 4 = terpanjang) ditarik acak merata dan percobaan diulang sampai sesuai, sehingga panjang opsi
// tidak membocorkan kunci (blueprint Bagian 8: "panjang tidak menjadi petunjuk"). Pada soal TDS teks kunci berupa "Tidak dapat disimpulkan." atau varian yang menyebut premisnya
// (kalau tidak, kunci TDS selalu terpendek karena kalimat opsi lain memuat subjek).
function chooseOptions(input: { pool: Cand[]; required: Cand[]; key: Stmt | null; P: Logic[]; taken: Stmt[]; voice: Voice; made: Made[]; who: string; whoLong: string }, r: Rng, code: string): Chosen {
  const { required, key, P, taken, voice, made, who, whoLong } = input, need = 4 - required.length, mask = [voice.subject.c, voice.subject.m];
  const usable = input.pool.filter((c) => !entailed(P, c.stmt) && !taken.some((s) => equivalent(s, c.stmt)) && !(c.stmt.op === 'nand' && negatives(c.stmt) > 1));
  const target = r.int(0, 4), dropDot = TDS_TEXT.replace(/\.$/, ''), variants: string[] = [];
  if (key) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const text = segText(optionSentence(voice, key, r));
      if (!variants.includes(text) && !made.some((m) => segText(m.segs) === text) && tidakCount(text) <= MAX_TIDAK && !repeatedPhrase(text, mask)) variants.push(text);
    }
    if (!variants.length) throw new Error('Teks kunci bermasalah (' + code + ').');
  } else variants.push(...[TDS_TEXT, dropDot + ' dari ' + who + '.', dropDot + ' secara pasti dari ' + who + '.', dropDot + ' berdasarkan ' + whoLong + '.'].sort((x, y) => x.length - y.length));
  let keyText = key ? r.pick(variants) : variants[Math.min(target, variants.length - 1)];
  // Panjang perkiraan tiap calon (satu kalimat contoh) menentukan berapa pengecoh yang harus lebih pendek daripada kunci.
  const size = new Map<Cand, number>();
  for (const cand of [...required, ...usable]) size.set(cand, segText(optionSentence(voice, cand.stmt, r)).length);
  const isShort = (c: Cand) => size.get(c)! < keyText.length, fixedShort = required.filter(isShort).length, classOf = equivalenceClasses([...required, ...usable]);
  const used = new Set<string>(variants);
  let best: (Chosen & { gap: number }) | undefined;
  for (let attempt = 0; attempt < 48; attempt++) {
    const phase = attempt < 24 ? 0 : attempt < 36 ? 1 : 2; // 0: panjang diatur; 1: panjang bebas; 2: syarat bentuk permukaan dilonggarkan (hanya bila belum ada hasil)
    if (phase === 2 && best) break;
    const quota: Quota | undefined = phase === 0 ? { isShort, shortNeed: Math.min(need, Math.max(0, target - fixedShort)) } : undefined;
    const picked = sampleSet(usable, required, classOf, need, phase < 2 ? MIN_PURE : 0, quota, r);
    if (!picked) continue;
    const texts = realizeOptions(voice, [...required, ...picked].map((c) => c.stmt), used, made, r);
    if (!texts) continue;
    const lens = texts.map((t) => t.length);
    for (const variant of variants) { // teks kunci yang paling mendekati posisi panjang yang diundi
      const below = lens.filter((n) => n < variant.length).length, tied = lens.filter((n) => n === variant.length).length;
      const gap = target < below ? below - target : target > below + tied ? target - below - tied : 0;
      if (!best || gap < best.gap) best = { wrong: [...required, ...picked], texts, keyText: variant, gap };
    }
    if (best?.gap === 0) break;
  }
  if (!best) throw new Error('Pengecoh silogisme belum cukup (' + code + ').');
  return best;
}

// ---- Konfigurasi acak -------------------------------------------------------------------------------------------------------------------------
// Variasi dasar tiap keluarga modus (lib/silo-spec.ts: keluarga penentu per kode): tiga premis T3-01..T3-11 dan dua premis. NEG (De Morgan atau negasi implikasi) memakai variasi tanpa TDS.
const FAMILY3: Record<Keluarga, number[]> = { MP: [1], MT: [2, 4, 5], SK: [3], SD: [6, 7, 8, 9], TDS: [10, 11], NEG: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
const FAMILY2: Record<Exclude<Keluarga, 'NEG'>, Fam2[]> = { MP: ['MP'], MT: ['MT'], SK: ['SK'], SD: ['SD'], TDS: ['TK', 'TA'] };
// `want`: keluarga modus yang diminta (perencana paket, lib/silo-rencana.ts); tanpa `want` urutan undian sama seperti sebelumnya. Bentuk De Morgan hanya muncul pada keluarga NEG (Silogisme Biasa) supaya keluarga
// yang diminta tidak berubah; keluarga NEG selalu memuat satu premis berbentuk De Morgan atau memakai negasi implikasi (dua premis).
export function randomConfig(chapter: Chapter, mode: 'never' | 'maybe' | 'always', r: Rng, want?: Keluarga): Config {
  const narasi = chapter.endsWith('Narasi'), three = chapter.startsWith('3');
  if (want === 'NEG' && narasi) throw new Error('Blueprint Bagian B melarang De Morgan dan negasi implikasi pada Silogisme Narasi.');
  const useTransform = !narasi && (want === 'NEG' || mode === 'always' || (mode === 'maybe' && r.next() < 0.35));
  let base: Base;
  if (three) { const family = want ? r.pick(FAMILY3[want]) : r.int(1, 11); base = base3(family, r.int(0, COUNT3[family - 1] - 1)); }
  else {
    const family: Fam2 = want ? (want === 'NEG' ? 'NI' : r.pick(FAMILY2[want])) : useTransform && r.next() < 0.1 ? 'NI' : r.pick(['MP', 'MT', 'SK', 'SD', 'TK', 'TA'] as Fam2[]);
    base = base2(family, r.int(0, COUNT2[family] - 1));
  }
  const order = three ? r.int(0, 5) : r.int(0, 1);
  const zero = base.premises.map(() => 0 as Form);
  if (!useTransform) return { base, forms: zero, keyForm: 0, order };
  if (want === 'NEG' && base.fam !== 'NI') { // tiga premis: satu premis aturan berbentuk De Morgan, premis lain boleh berbentuk ekuivalen biasa
    const at = r.pick(base.premises.flatMap((p, i) => p.op === 'imp' || p.op === 'or' ? [i] : []));
    return { base, forms: base.premises.map((p, i) => i === at ? 3 as Form : r.pick(formsOf(p, false))), keyForm: r.pick(keyForms(base)), order };
  }
  const extended = r.next() < 0.15 && (want === undefined || want === 'NEG'); // bentuk De Morgan (perluasan) sesekali
  for (let attempt = 0; attempt < 30; attempt++) {
    const forms = base.premises.map((p) => r.pick(formsOf(p, extended))), keyForm = r.pick(keyForms(base));
    if (forms.some((f) => f !== 0) || keyForm !== 0) return { base, forms, keyForm, order };
  }
  const at = base.premises.findIndex((p) => p.op === 'imp' || p.op === 'or'), forms = [...zero];
  forms[at] = 1;
  return { base, forms, keyForm: 0, order };
}

// ---- Soal dari satu konfigurasi ---------------------------------------------------------------------------------------------------------------
const ELLIPSIS = '…';
function questionLine(cfg: Config, narasi: boolean, voice: Voice, key: Stmt | null, r: Rng): string {
  const three = cfg.base.premises.length === 3;
  if (!key) {
    const clause = 'kebenaran pernyataan bahwa ' + targetClause(voice, cfg.base.target!) + '?';
    return narasi || three ? 'Apa yang dapat disimpulkan mengenai ' + clause : 'Berdasarkan kedua premis tersebut, apa yang dapat ' + r.pick(['disimpulkan', 'dipastikan']) + ' mengenai ' + clause;
  }
  if (cfg.keyForm !== 0 && !narasi && r.next() < 0.5) return 'Pernyataan yang setara dengan simpulan ' + (three ? 'ketiga' : 'kedua') + ' premis adalah ' + ELLIPSIS + '.';
  if (key.op === 'imp' || key.op === 'or') return 'Hubungan yang pasti mengikuti ' + (narasi ? 'ketentuan tersebut' : three ? 'ketiga premis tersebut' : 'kedua ketentuan tersebut') + ' adalah ' + ELLIPSIS + '.';
  // Bagian 5 blueprint (variasi stem MP, MT, SD): "Simpulan yang pasti benar berdasarkan ketentuan tersebut adalah …."; tiga premis Biasa menyebut ketiga premis.
  return 'Simpulan yang pasti benar berdasarkan ' + (three && !narasi ? 'ketiga premis tersebut' : 'ketentuan tersebut') + ' adalah ' + ELLIPSIS + '.';
}
const stripDot = (text: string) => text.replace(/\.$/, '');
const chainOf = (base: Base) => [...new Set(base.steps.filter((s) => s.law !== 'tds').map((s) => LAW_NAME[s.law as keyof typeof LAW_NAME]))].join(' lalu ');
// Alasan tingkat kesulitan menurut pola yang benar-benar dipakai (hukum penalaran tiap langkah, TDS, bentuk ekuivalen, dan narasi); tidak seluruh pola berupa hubungan implikasi.
function reasonOf(cfg: Config, narasi: boolean): string {
  const { base } = cfg, n = base.premises.length === 2 ? 'dua' : 'tiga', laws = base.steps.filter((s) => s.law !== 'tds').map((s) => LAW_NAME[s.law as keyof typeof LAW_NAME]), tds = base.key === null;
  const chain = laws.length === 2 && laws[0] === laws[1] ? 'dua langkah ' + laws[0] : laws.join(' lalu ');
  let text = base.fam === 'NI' ? 'Menurunkan negasi implikasi menjadi konjungsi, menyederhanakannya, lalu menerapkan Modus Ponens pada dua premis' :
    tds ? (laws.length ? 'Menggabungkan ' + n + ' premis lewat ' + chain + ' lalu memastikan bahwa pernyataan yang ditanyakan tidak dapat disimpulkan' :
      'Memastikan bahwa dua premis tidak memenuhi syarat Modus Ponens, Modus Tollens, maupun silogisme sehingga pernyataan yang ditanyakan tidak dapat disimpulkan') :
    base.premises.length === 2 ? 'Menerapkan ' + chain + ' pada dua premis' : 'Menggabungkan tiga premis lewat ' + chain;
  const laws2 = [...new Set([...cfg.forms.flatMap((form, i) => form === 0 ? [] : [normalization(base.premises[i], form).law]), ...(cfg.keyForm !== 0 ? [keyLaw(base.key!, cfg.keyForm).law] : [])])];
  if (laws2.length) text += '; bentuk ekuivalen dinormalkan lebih dahulu dengan ' + laws2.join(' dan ');
  if (narasi) text += '; kata kunci proposisi diambil dari kalimat panjang dan label tidak dinaikkan hanya karena narasi lebih panjang';
  return text + '.';
}

export function buildFromConfig(cfg: Config, chapter: Chapter, r: Rng): LogikaBuild {
  const { base } = cfg, narasi = chapter.endsWith('Narasi'), n = base.premises.length, tds = base.key === null;
  const frame = r.pick(narasi ? NARASI_FRAMES : BIASA_FRAMES), voice = makeVoice(frame, narasi, r, r.shuffle([0, 1, 2, 3]));
  // Premis yang tampil menurut urutan penyajian, dalam bentuk tampil (I/D/K) masing-masing.
  const shown = shownOrder(cfg), shownStmts = shown.map((i) => transform(base.premises[i], cfg.forms[i]));
  const made = shownStmts.map((st) => premiseSentence(voice, st, r)), P = shownStmts.map(logicOf);
  const key = base.key ? transform(base.key, cfg.keyForm) : null;
  if (key && !entailed(P, key)) throw new Error('Kunci tidak mengikuti premis (' + codeOf(cfg) + ').');
  if (key) shown.forEach((_, drop) => { if (entails(P.filter((_p, i) => i !== drop), [logicOf(key)])[0]) throw new Error('Premis ' + (drop + 1) + ' tidak diperlukan (' + codeOf(cfg) + ').'); });
  if (!key) {
    const target = lit(base.target!);
    if (entailed(P, target) || contradicted(P, target)) throw new Error('Target TDS sudah pasti (' + codeOf(cfg) + ').');
  }
  // Frasa berulang pada premis ditolak (kerangka bahasa yang bertabrakan); konfigurasi lain dicoba oleh buildLogika.
  const mask = [voice.subject.c, voice.subject.m];
  for (const m of made) { const phrase = repeatedPhrase(segText(m.segs), mask); if (phrase) throw new Error('Frasa berulang pada premis "' + phrase + '" (' + codeOf(cfg) + ').'); }
  // Narasi: keterangan rujukan atau pembuka konteks yang sama tidak boleh diulang pada premis lain (frasa proposisi penghubung boleh).
  if (narasi) { const filler = fillerRepeated(made.map((m) => segText(m.segs)), voice); if (filler) throw new Error('Frasa pengisi berulang antarpremis "' + filler + '" (' + codeOf(cfg) + ').'); }
  // Pengecoh dihitung dari tabel kebenaran dan dipetakan ke jenis kesalahan; kalimat opsi dibentuk bersamaan dengan pemilihan karena panjangnya ikut diatur.
  const taken: Stmt[] = key ? [key] : [], required: Cand[] = [];
  if (!key) { required.push({ stmt: lit(base.target!), tag: 'kepastian', note: NOTE.target }, { stmt: lit(flip(base.target!)), tag: 'kepastian', note: NOTE.target }); required.forEach((c) => taken.push(c.stmt)); }
  const pool = candidatePool(cfg, key, P, narasi).filter((c) => !required.some((q) => equivalent(q.stmt, c.stmt)));
  const chosen = chooseOptions({ pool, required, key, P, taken, voice, made, who: narasi ? 'ketentuan tersebut' : n === 3 ? 'ketiga premis tersebut' : 'kedua premis tersebut', whoLong: narasi ? 'ketentuan ' + voice.frame.ctx + ' tersebut' : n === 3 ? 'ketiga premis tersebut' : 'kedua premis tersebut' }, r, codeOf(cfg));
  const entries: { stmt: Stmt | null; text: string; cand?: Cand }[] = [{ stmt: key, text: chosen.keyText }, ...chosen.wrong.map((cand, i) => ({ stmt: cand.stmt as Stmt | null, text: chosen.texts[i], cand }))];
  // Tabel kebenaran menentukan status tiap opsi dan alasannya.
  // Alasan per opsi hanya pada Silogisme Narasi (muncul pada analisis opsi); Silogisme Biasa tidak memuat analisis opsi (blueprint Bagian 8), jadi alasannya kosong.
  // Jenis kesalahan tiap pengecoh tetap tersimpan pada model (proof.model.errors).
  const options: LogikaOption[] = r.shuffle(entries).map((entry, ref): LogikaOption => {
    if (entry.stmt === key && entry.cand === undefined) {
      const reason = !narasi ? '' : key ? 'Maknanya sama dengan hasil penalaran langsung. ' + keyDetail(cfg, shown) : TDS_REASON;
      return { text: entry.text, reason, status: 'pasti', ...(key ? { logic: logicOf(key) } : {}), ...(narasi ? { ref } : {}) };
    }
    const cand = entry.cand!, status = statusOf(P, cand.stmt);
    return { text: entry.text, reason: narasi ? cand.note(status) : '', status, logic: logicOf(cand.stmt), error: cand.tag, ...(narasi ? { ref } : {}) };
  });
  const answer = options.findIndex((o) => o.status === 'pasti');
  // Narasi: alasan keempat pengecoh tidak boleh seragam (redaksi berbeda menurut jenis kesalahan); konfigurasi lain dicoba oleh buildLogika.
  if (narasi && new Set(options.flatMap((o, i) => i === answer ? [] : [o.reason])).size < 2) throw new Error('Alasan pengecoh seragam (' + codeOf(cfg) + ').');
  const stmtOf = new Map(entries.map((e) => [e.text, e.stmt]));
  const stem = made.map((m) => segText(m.segs)).join(' ') + '\n' + questionLine(cfg, narasi, voice, key, r);
  const explanation = explain({ cfg, voice, narasi, made: made.map((m) => segMarked(m.segs)), shownStmts, shown, key, options, stmtOf, P });
  const transformed = cfg.forms.some((f) => f !== 0) || cfg.keyForm !== 0;
  const bloom: 'C2' | 'C3' | 'C4' = narasi ? (n === 2 ? 'C3' : 'C4') : transformed || (n === 3 && (tds || base.fam === 'T3-03')) ? 'C4' : n === 3 ? 'C3' : base.fam === 'MP' || base.fam === 'MT' ? 'C2' : 'C3';
  const model: Model = { kind: 'syllogism', premises: P, options: options.map((o) => ({ text: o.text, ...(o.logic ? { logic: o.logic } : {}) })), code: codeOf(cfg), chapter, errors: options.map((o) => o.error ?? null) };
  if (narasi) {
    // Pengacak tersendiri: persiapan padanan tidak menggeser soal lain atau pilihan jawaban pada seed yang sama.
    const forwardRng = rng('narasi-kondisi-dahulu|' + codeOf(cfg) + '|' + stem);
    model.narrative = { implications: shownStmts.filter((s) => s.op === 'imp').length, reversed: made.filter((m) => m.reversed).length,
      forward: made.flatMap((m, i) => {
        if (!m.reversed) return [];
        // Padanan kondisi-lebih-dahulu boleh memakai pembuka konteks bila tidak ada premis lain yang memakainya.
        const forward = premiseSentence({ ...voice, ctx: { used: made.some((other, j) => j !== i && other.ctx) } }, shownStmts[i], forwardRng, false);
        return [{ from: segText(m.segs), to: segText(forward.segs), markedFrom: segMarked(m.segs), markedTo: segMarked(forward.segs) }];
      }) };
  }
  return { stem, options, answer, explanation, model, bloom, code: codeOf(cfg), chapter, reversed: made.filter((m) => m.reversed).length, implications: shownStmts.filter((s) => s.op === 'imp').length, difficultyReason: reasonOf(cfg, narasi) };
}

// ---- Pembahasan --------------------------------------------------------------------------------------------------------------------------------
type ExplainInput = { cfg: Config; voice: Voice; narasi: boolean; made: string[]; shownStmts: Stmt[]; shown: number[]; key: Stmt | null; options: LogikaOption[]; stmtOf: Map<string, Stmt | null>; P: Logic[] };
function explain(x: ExplainInput): string {
  const { cfg, voice, narasi, key } = x, { base } = cfg, n = base.premises.length, lines: string[] = [];
  const at = (catalog: number) => catalog === n ? 4 : x.shown.indexOf(catalog) + 1; // nomor premis menurut urutan tampil; hasil antara = Premis 4
  const law = (id: string) => id === 'sk' && n === 2 && !narasi ? 'rumus silogisme' : LAW_NAME[id as keyof typeof LAW_NAME];
  const tex = (s: Stmt) => inline(texOf(s));
  x.made.forEach((text, k) => lines.push('Premis ' + (k + 1) + ': ' + text));
  lines.push('');
  const used = varsOf(base.premises);
  used.forEach((v) => lines.push(inline(VARS[v]) + ': ' + definition(voice, v)));
  lines.push('');
  if (narasi) { // pasangan makna: lawan kata dibaca sebagai negasi pada domain yang tertulis di soal (Bagian 20)
    for (const v of used) { const prop = voice.propOf(v); if (prop.anto) lines.push(prop.anto, 'Ungkapan ' + prop.neg.split(' ')[0] + ' pada keadaan yang sama: ' + inline('\\neg ' + VARS[v]), ''); }
  }
  const premiseLines = (catalog: number) => { // satu premis: bentuk tampil, hukum normalisasi, bentuk dasar
    const form = cfg.forms[catalog], label = 'Premis ' + at(catalog);
    const out = [label + ': ' + tex(transform(base.premises[catalog], form))];
    if (form !== 0) { const norm = normalization(base.premises[catalog], form); out.push('Gunakan ' + norm.law + ' (' + inline(norm.eq) + ')', label + ': ' + tex(base.premises[catalog])); }
    return out;
  };
  if (base.fam === 'NI') { // E-08: negasi implikasi menjadi konjungsi, disederhanakan, lalu Modus Ponens
    const ni = base.premises[0], rule = base.premises[1], notB = flip(ni.b!), conj = and(ni.a, notB);
    x.shown.forEach((_, k) => lines.push('Premis ' + (k + 1) + ': ' + tex(transform(base.premises[x.shown[k]], cfg.forms[x.shown[k]]))));
    lines.push('Gunakan hukum negasi implikasi (' + inline(texOf(ni) + ' \\equiv ' + texOf(conj)) + ')');
    if (cfg.forms[1] !== 0) { const norm = normalization(rule, cfg.forms[1]); lines.push('Gunakan ' + norm.law + ' (' + inline(norm.eq) + ')'); }
    lines.push('Premis ' + at(0) + ': ' + tex(conj), 'Premis ' + at(1) + ': ' + tex(rule), 'Gunakan penyederhanaan konjungsi', 'Kesimpulan sementara: ' + mark.bold(tex(lit(notB))), '',
      'Gunakan Modus Ponens pada ' + tex(lit(notB)) + ' dan ' + tex(rule), mark.bold('Kesimpulan: ' + tex(base.key!)));
  } else if (n === 2) {
    x.shown.forEach((catalog) => lines.push('Premis ' + at(catalog) + ': ' + tex(transform(base.premises[catalog], cfg.forms[catalog]))));
    const transformed = x.shown.filter((catalog) => cfg.forms[catalog] !== 0);
    transformed.forEach((catalog) => { const norm = normalization(base.premises[catalog], cfg.forms[catalog]); lines.push('Gunakan ' + norm.law + ' (' + inline(norm.eq) + ')'); });
    if (transformed.length) base.premises.forEach((premise, catalog) => lines.push('Premis ' + at(catalog) + ': ' + tex(premise))); // bentuk dasar menurut urutan penerapan rumus
    const step = base.steps[0];
    if (step.law === 'tds') lines.push('Premis 1 dan 2 tidak masuk ke rumus silogisme manapun sehingga tidak dapat disimpulkan.');
    else lines.push('Gunakan ' + law(step.law));
  } else {
    base.steps.forEach((step, s) => {
      if (s > 0) lines.push('');
      lines.push(mark.bold('Langkah ' + (s + 1) + ' (Premis ' + step.use.map(at).join(' + ') + '):'));
      for (const u of step.use) {
        if (u === n) lines.push('Premis 4: ' + tex(base.steps[0].out!));
        else lines.push(...premiseLines(u));
      }
      if (step.law === 'tds') lines.push('Premis ' + step.use.map(at).join(' dan ') + ' tidak masuk ke rumus silogisme manapun sehingga tidak dapat disimpulkan.');
      else lines.push('Gunakan ' + law(step.law));
      if (s === 0) lines.push(mark.bold('Kesimpulan (Premis 4): ' + tex(step.out!)));
    });
  }
  // Kesimpulan, bentuk kunci, dan jawaban.
  const answer = key ? stripDot(x.options.find((o) => o.status === 'pasti')!.text) : stripDot(TDS_TEXT); // TDS: jawaban baku "Tidak dapat disimpulkan" walau teks opsi memuat keterangan premis
  if (base.fam !== 'NI') { // negasi implikasi (NI) sudah memuat kesimpulannya di atas
    if (!key) lines.push(mark.bold('Kesimpulan: Tidak dapat disimpulkan'));
    else if (cfg.keyForm === 0) lines.push(mark.bold('Kesimpulan: ' + tex(base.key!)));
    else {
      const kl = keyLaw(base.key!, cfg.keyForm);
      lines.push('Kesimpulan sementara: ' + mark.bold(tex(base.key!)), '', 'Gunakan ' + kl.law + ' (' + inline(kl.eq) + ')', mark.bold('Kesimpulan: ' + tex(key)));
    }
  }
  lines.push(mark.bold('Jawaban: ' + answer));
  // Silogisme Biasa: format inti berakhir pada jawaban kalimat (blueprint Bagian 8); analisis opsi hanya untuk Silogisme Narasi.
  if (!narasi) return lines.join('\n');
  // Analisis kelima opsi (Narasi): notasi tambahan bila ada, lalu `X. teks` (opsi salah dicoret) dan `→ **rumus** — alasan (**status**)`. Huruf X diisi saat tampil lewat {opsi:ref}.
  const usesExtra = x.options.some((o) => x.stmtOf.get(o.text)?.a?.[0] === EXTRA || x.stmtOf.get(o.text)?.b?.[0] === EXTRA);
  lines.push('', ...analysisBlock(x.options.map((option, i) => ({ ref: option.ref ?? i, text: option.text, symbol: x.stmtOf.get(option.text) ? texOf(x.stmtOf.get(option.text)!) : null, reason: option.reason, key: option.status === 'pasti' })),
    usesExtra ? [{ name: 't', text: definition(voice, EXTRA) }] : []));
  return lines.join('\n');
}

// ---- Pintu masuk ---------------------------------------------------------------------------------------------------------------------------------
const ID_CHAPTER: Record<string, [Chapter, 'never' | 'maybe' | 'always']> = {
  b2: ['2 Premis', 'never'], b2x: ['2 Premis', 'always'], b3: ['3 Premis', 'maybe'], b3x: ['3 Premis', 'always'], n2: ['2 Premis - Narasi', 'never'], n3: ['3 Premis - Narasi', 'never'],
};
export function buildLogika(id: string, r: Rng, slot?: ContohSlot, paket?: PaketSlot): LogikaBuild {
  if (id.startsWith('implikasi-')) return buildImplikasi(id.slice(10) as Asked, r);
  const [chapter, mode] = ID_CHAPTER[id] ?? (() => { throw new Error('Pola silogisme tidak dikenal: ' + id); })();
  // Paket tryout (`paket`): keluarga modus butir ini ditetapkan perencana supaya lima butir silogisme sepaket beragam (lib/silo-rencana.ts); contoh blueprint berkeluarga itu dipakai lebih dahulu,
  // pembangkit mengisi kekurangannya dengan keluarga yang sama.
  const plan = slot && paket ? rencanaButir(slot.seed, paket, slot.used(chapter)) : undefined;
  if (plan?.contoh) return contohBuild(plan.contoh, r);
  // Selain itu, Silogisme Narasi: contoh blueprint dipakai lebih dahulu (urutannya diacak menurut seed); pembangkit di bawah hanya mengisi kekurangan.
  if (slot && !plan && chapter.endsWith('Narasi')) {
    const example = contohAt(chapter as NarasiChapter, slot.seed, slot.used(chapter));
    if (example) return contohBuild(example, r);
  }
  let last: unknown;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const config = randomConfig(chapter, mode, r, plan?.keluarga);
      if (plan && keluargaOfConfig(config) !== plan.keluarga) throw new Error('Keluarga modus konfigurasi berbeda dari rencana (' + codeOf(config) + ').');
      return buildFromConfig(config, chapter, r);
    } catch (error) { last = error; }
  }
  throw last instanceof Error ? last : new Error('Soal silogisme gagal dibangun.');
}
export const LOGIKA_BY_LEVEL: Record<'sedang' | 'sulit', string[]> = {
  sedang: ['b2', 'b2', 'b2', 'n2', 'n2', 'implikasi-konvers', 'implikasi-invers', 'implikasi-kontraposisi'],
  sulit: ['b2x', 'b3', 'b3', 'b3x', 'n3', 'n3'],
};
