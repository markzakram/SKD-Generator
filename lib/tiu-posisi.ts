// Pembangkit soal Susunan dan Posisi menurut Panduan Produksi Soal TIU JadiASN (Verbal Analitis): tiga subbentuk (susunan linear, duduk melingkar, baris-kolom),
// petunjuk dalam paragraf, nama diperkenalkan seperti "(A, B, C, D, dan E)" atau "yaitu ... dan ...", pertanyaan yang bervariasi (posisi tertentu, siapa di samping atau
// berhadapan, pernyataan yang pasti benar, susunan lengkap), dan pembahasan yang mengalir dari petunjuk pasti sampai susunan akhir.
// Kebenaran: petunjuk dipilih dari fakta yang benar pada susunan acuan, ditambah satu per satu sampai jawaban pertanyaan tunggal pada SEMUA susunan yang memenuhi petunjuk
// (brute force, lib/posisi-model.ts), lalu dikurangi sampai tidak ada petunjuk berlebih. Pembahasan berasal dari penalaran langkah demi langkah (lib/posisi-deduce.ts) yang
// diperiksa ulang terhadap pemecah. Kesulitan dan level Bloom diturunkan dari kebutuhan penalaran (uji andaian, pernyataan yang dievaluasi, susunan lengkap).
import type { Rng } from './rng';
import { KEY_MARK, tableLines } from './explanation';
import { mark } from './richtext';
import { graphLine } from './graph';
import { deduce, neededSteps } from './posisi-deduce';
import { holds, holdsAll, holdsNone, isTheme, persons, rowOf, colOf, sameFact, seatCount, solve, type Fact, type Geo, type Linear } from './posisi-model';
import { chain, clause, clueSentences, formedText, linearWords, mid, NUM, ORD, seatText, stepSentences, themeAsk, type TextCtx } from './posisi-text';

export type PosisiLevel = 'sedang' | 'sulit';
export type Form = 'linear' | 'circular' | 'grid';
export type PosisiBuild = {
  stem: string; options: { text: string; fact: Fact }[]; answer: number; explanation: string; names: string[]; anchor?: string; geo: Geo; clues: Fact[];
  difficulty: PosisiLevel; bloom: 'C4' | 'C5' | 'C6'; difficultyReason: string; form: Form; kind: string; refutations: number;
};

// Tema untuk Urutan dan Peringkat serta Jadwal (lib/tiu-urutan.ts): gaya linear bertema, banyak unsur, nama, kalimat pembuka, bentuk petunjuk, dan bobot jenis pertanyaan.
export type Theme = {
  style: Linear; who?: string; labels?: boolean; numbered: boolean; size: Record<PosisiLevel, number[]>;
  names: (count: number, r: Rng) => { names: string[]; letters: boolean }; intro: (names: string[], letters: boolean, r: Rng) => string;
  kinds: { kind: string; w: Record<PosisiLevel, number> }[];
};
export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const NAMES = ['Adit', 'Bima', 'Citra', 'Dewi', 'Eka', 'Fani', 'Gita', 'Hani', 'Indra', 'Joko', 'Kiki', 'Lina', 'Maya', 'Nando', 'Omar', 'Putri', 'Rani', 'Sari', 'Tono', 'Uli', 'Vina', 'Wawan', 'Yudi', 'Zaki',
  'Angga', 'Bayu', 'Candra', 'Dika', 'Endang', 'Faisal', 'Gilang', 'Hasan', 'Intan', 'Jihan', 'Kania', 'Lukman', 'Mira', 'Nadia', 'Rina', 'Santi', 'Tari', 'Vera', 'Wulan', 'Yoga'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: string[], last = 'dan') => items.length > 2 ? items.slice(0, -1).join(', ') + ', ' + last + ' ' + items[items.length - 1] : items.join(' ' + last + ' ');
const weighted = <T,>(items: { item: T; w: number }[], r: Rng): T[] =>
  items.map(({ item, w }) => ({ item, key: -Math.log(Math.max(r.next(), 1e-9)) / w })).sort((a, b) => a.key - b.key).map((x) => x.item);
const CAP = 400; // batas susunan yang dikumpulkan saat menguji ketunggalan

// ---- Susunan acuan dan calon petunjuk --------------------------------------------------------------------------------------------------
type Cand = { f: Fact; w: number };
function candidates(geo: Geo, names: string[], seat: Record<string, number>, r: Rng): Cand[] {
  const out: Cand[] = [], n = seatCount(geo), flip = () => (r.next() < 0.5 ? 0 : 1) as 0 | 1;
  const add = (f: Fact, w: number) => out.push({ f, w });
  const not = (f: Fact): Fact => ({ k: 'not', f });
  const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));
  if (geo.form === 'linear') {
    for (const a of names) {
      const s = seat[a];
      add({ k: 'at', a, seats: [s] }, 1);
      if (s > 0 && s < n - 1) add(not({ k: 'at', a, seats: [0, n - 1] }), 2.5);
      for (let k = 2; k <= n - 3; k++) { if (s >= k) add(not({ k: 'at', a, seats: Array.from({ length: k }, (_, i) => i) }), 2); if (s <= n - 1 - k) add(not({ k: 'at', a, seats: Array.from({ length: k }, (_, i) => n - k + i) }), 2); }
      const other = r.pick(Array.from({ length: n }, (_, i) => i).filter((i) => i !== s));
      add(not({ k: 'at', a, seats: [other] }), 0.6);
      if (s > 0 && s < n - 1) for (const b of names) for (const c of names) if (b < c && seat[b] === s - 1 && seat[c] === s + 1 || b < c && seat[c] === s - 1 && seat[b] === s + 1) add({ k: 'between', a, b, c }, 3);
    }
    for (const [a, b] of pairs) {
      const d = seat[b] - seat[a], low = d > 0 ? a : b, high = d > 0 ? b : a, gap = Math.abs(d);
      if (gap === 1) { add({ k: 'next', a: high, b: low, w: flip() }, 3); add({ k: 'beside', a, b }, 1.5); }
      else { add({ k: 'before', a: low, b: high, w: flip() }, 2); add({ k: 'gap', a: low, b: high, n: gap - 1 }, 2); add(not({ k: 'beside', a, b }), 1.2); }
    }
  } else if (geo.form === 'circular') {
    for (const [a, b] of pairs) {
      const d = (seat[b] - seat[a] + n) % n;
      if (d === n / 2) add({ k: 'opposite', a, b }, 3); else add(not({ k: 'opposite', a, b }), 1);
      if (d === 1) add({ k: 'next', a: b, b: a, w: flip() }, 3); else if (d === n - 1) add({ k: 'next', a, b, w: flip() }, 3);
      if (d === 1 || d === n - 1) add({ k: 'beside', a, b }, 1.5); else add(not({ k: 'beside', a, b }), 1.2);
    }
    for (const a of names) {
      const next = names.find((x) => seat[x] === (seat[a] + 1) % n)!, prev = names.find((x) => seat[x] === (seat[a] - 1 + n) % n)!;
      add({ k: 'between', a, b: next, c: prev }, 3);
    }
  } else {
    const rows = geo.rows, cols = geo.cols;
    for (const a of names) {
      const ra = rowOf(geo, seat[a]), ca = colOf(geo, seat[a]);
      add({ k: 'row', who: [a], rows: [ra] }, 2.5); add({ k: 'col', who: [a], cols: [ca] }, 1.5);
      for (let k = 1; k < rows; k++) { if (ra >= k) add(not({ k: 'row', who: [a], rows: Array.from({ length: k }, (_, i) => i) }), 1); if (ra <= rows - 1 - k) add(not({ k: 'row', who: [a], rows: Array.from({ length: k }, (_, i) => rows - k + i) }), 1); }
      add(not({ k: 'row', who: [a], rows: [r.pick(Array.from({ length: rows }, (_, i) => i).filter((i) => i !== ra))] }), 0.5);
    }
    for (const [a, b] of pairs) {
      const ra = rowOf(geo, seat[a]), rb = rowOf(geo, seat[b]), ca = colOf(geo, seat[a]), cb = colOf(geo, seat[b]);
      if (ra === rb) { add({ k: 'sameRow', a, b }, 3); add({ k: 'row', who: [a, b], rows: [ra] }, 2.5); if (Math.abs(ca - cb) === 1) add({ k: 'beside', a, b }, 2.5); else add(not({ k: 'beside', a, b }), 0.3); }
      else { add(not({ k: 'sameRow', a, b }), 0.8); if (ra < rb) add({ k: 'before', a, b, w: flip() }, 1); else add({ k: 'before', a: b, b: a, w: flip() }, 1); }
      if (ca === cb) { add({ k: 'sameCol', a, b }, 1.5); if (Math.abs(ra - rb) === 1) add({ k: 'next', a: ra > rb ? a : b, b: ra > rb ? b : a, w: flip() }, 3); } else add(not({ k: 'sameCol', a, b }), 0.4);
    }
  }
  return out;
}

// ---- Rencana pertanyaan ----------------------------------------------------------------------------------------------------------------------------
type Plan = { kind: string; fact?: Fact; unique: boolean; ask?: string; person?: string; answer?: string; side?: 'lo' | 'hi'; seat?: number };
const KINDS: Record<Form, { kind: string; w: Record<PosisiLevel, number> }[]> = {
  linear: [{ kind: 'siapa-posisi', w: { sedang: 3, sulit: 1 } }, { kind: 'siapa-samping', w: { sedang: 2, sulit: 1 } }, { kind: 'posisi-orang', w: { sedang: 2, sulit: 1 } }, { kind: 'pernyataan', w: { sedang: 0, sulit: 2 } }, { kind: 'urutan', w: { sedang: 0, sulit: 1.5 } }],
  circular: [{ kind: 'berhadapan', w: { sedang: 3, sulit: 1 } }, { kind: 'samping', w: { sedang: 2, sulit: 1 } }, { kind: 'di-antara', w: { sedang: 2, sulit: 1 } }, { kind: 'pernyataan', w: { sedang: 0, sulit: 2 } }, { kind: 'urutan', w: { sedang: 0, sulit: 1.5 } }],
  grid: [{ kind: 'baris', w: { sedang: 2, sulit: 1 } }, { kind: 'satu-baris', w: { sedang: 2, sulit: 1 } }, { kind: 'belakang', w: { sedang: 2, sulit: 1 } }, { kind: 'kursi', w: { sedang: 2, sulit: 1 } }, { kind: 'pernyataan', w: { sedang: 0, sulit: 2 } }],
};
function planFor(geo: Geo, names: string[], seat: Record<string, number>, level: PosisiLevel, r: Rng, theme?: Theme): Plan | null {
  const n = seatCount(geo), at = (s: number) => names.find((x) => seat[x] === s);
  const usable = (theme ? theme.kinds : KINDS[geo.form]).filter(({ kind }) => !(kind === 'baris' && geo.form === 'grid' && geo.rows < 5) && !(kind === 'satu-baris' && geo.form === 'grid' && geo.cols !== 2));
  const kind = weighted(usable.map((u) => ({ item: u.kind, w: u.w[level] })).filter((u) => u.w > 0), r)[0];
  if (kind === 'pernyataan' || kind === 'urutan') return { kind, unique: true };
  if (geo.form === 'linear') {
    if (kind === 'siapa-posisi') { const s = r.int(0, n - 1), x = at(s)!; return { kind, unique: false, fact: { k: 'at', a: x, seats: [s] }, answer: x, seat: s }; }
    if (kind === 'posisi-orang') { const x = r.pick(names); return { kind, unique: false, fact: { k: 'at', a: x, seats: [seat[x]] }, person: x, answer: x, seat: seat[x] }; }
    const c = r.pick(names.filter((x) => seat[x] > 0 && seat[x] < n)), side = r.pick(['lo', 'hi'] as const), x = at(seat[c] + (side === 'hi' ? 1 : -1));
    if (!x) { const c2 = names.find((y) => seat[y] > 0 && seat[y] < n - 1)!, y = at(seat[c2] + (side === 'hi' ? 1 : -1))!; return { kind, unique: false, fact: side === 'hi' ? { k: 'next', a: y, b: c2 } : { k: 'next', a: c2, b: y }, person: c2, answer: y, side }; }
    return { kind, unique: false, fact: side === 'hi' ? { k: 'next', a: x, b: c } : { k: 'next', a: c, b: x }, person: c, answer: x, side };
  }
  if (geo.form === 'circular') {
    const c = r.pick(names);
    if (kind === 'berhadapan') { const x = at((seat[c] + n / 2) % n)!; return { kind, unique: false, fact: { k: 'opposite', a: x, b: c }, person: c, answer: x }; }
    if (kind === 'samping') { const side = r.pick(['lo', 'hi'] as const), x = at((seat[c] + (side === 'lo' ? 1 : n - 1)) % n)!; return { kind, unique: false, fact: side === 'lo' ? { k: 'next', a: x, b: c } : { k: 'next', a: c, b: x }, person: c, side, answer: x }; }
    const p = at((seat[c] + 1) % n)!, q = at((seat[c] + n - 1) % n)!;
    return { kind, unique: false, fact: { k: 'between', a: c, b: p, c: q }, person: c };
  }
  const c = r.pick(names), rc = rowOf(geo, seat[c]);
  if (kind === 'baris') return { kind, unique: false, fact: { k: 'row', who: [c], rows: [rc] }, person: c };
  if (kind === 'kursi') return { kind, unique: false, fact: { k: 'at', a: c, seats: [seat[c]] }, person: c, seat: seat[c] };
  if (kind === 'satu-baris') {
    const withMate = names.filter((x) => names.some((y) => y !== x && rowOf(geo, seat[y]) === rowOf(geo, seat[x])));
    if (!withMate.length) return null;
    const x0 = r.pick(withMate), y0 = names.find((y) => y !== x0 && rowOf(geo, seat[y]) === rowOf(geo, seat[x0]))!;
    return { kind, unique: false, fact: { k: 'sameRow', a: y0, b: x0 }, person: x0, answer: y0 };
  }
  const links = names.flatMap((x) => names.filter((y) => y !== x && colOf(geo, seat[y]) === colOf(geo, seat[x]) && rowOf(geo, seat[y]) === rowOf(geo, seat[x]) + 1).map((y) => [x, y] as const));
  if (!links.length) return null;
  const [front, back] = r.pick(links), side = r.pick(['lo', 'hi'] as const);
  return side === 'hi' ? { kind, unique: false, fact: { k: 'next', a: back, b: front }, person: front, side, answer: back } : { kind, unique: false, fact: { k: 'next', a: back, b: front }, person: back, side, answer: front };
}

// ---- Pembentukan petunjuk ------------------------------------------------------------------------------------------------------------------
// Linear dan melingkar: susunan harus tunggal (tabel akhir lengkap). Baris-kolom boleh menyisakan kursi yang belum pasti selama jawaban pertanyaan tunggal (seperti contoh panduan).
const fullArrangement = (plan: Plan, geo: Geo) => plan.unique || geo.form !== 'grid';
const determined = (plan: Plan, geo: Geo, names: string[], sols: number[][]) => sols.length > 0 && sols.length <= CAP && (fullArrangement(plan, geo) ? sols.length === 1 : holdsAll(plan.fact!, names, sols, geo));
const trivial = (plan: Plan, clues: Fact[]) => !!plan.fact && clues.some((c) => sameFact(c, plan.fact!) || (plan.fact!.k === 'at' && (c.k === 'at' || c.k === 'row') && persons(c).includes(plan.fact!.a)) || (plan.fact!.k === 'row' && c.k === 'row' && c.who.some((x) => persons(plan.fact!).includes(x)))
  || (plan.fact!.k === 'at' && c.k === 'col' && c.who.includes(plan.fact!.a) && false));
// Petunjuk ditambah acak (menurut bobot jenis) sampai penerapan petunjuk berantai cukup untuk menempatkan semua orang yang diperlukan (sedang) atau sampai jawaban tunggal
// menurut pemecah (sulit); kemudian petunjuk berlebih dibuang. Penempatan oleh penalaran selalu sahih, sehingga ketunggalan jawaban terjamin; pemecah memeriksanya sekali lagi.
function selectClues(geo: Geo, names: string[], pool: Cand[], plan: Plan, anchor: string | undefined, r: Rng, max: number, level: PosisiLevel, required: string[]): { clues: Fact[]; sols: number[][] } | null {
  const usable = pool.filter(({ f }) => !trivial(plan, [f]));
  const placed = (list: Fact[]) => { const d = deduce(geo, names, list, anchor, false); return required.every((name) => name in d.positions); };
  const exact = (list: Fact[]) => determined(plan, geo, names, solve(geo, names, list, anchor, CAP));
  // Tingkat sulit pada susunan linear dan melingkar juga menerima himpunan petunjuk yang hanya dapat diselesaikan dengan menguji andaian (jawaban tunggal menurut pemecah).
  const useExact = level === 'sulit' && geo.form !== 'grid', clues: Fact[] = [];
  for (const cand of usable) {
    clues.push(cand.f);
    if (clues.length < 3) continue;
    if (placed(clues) || (useExact && clues.length >= 5 && clues.length % 2 === 1 && exact(clues))) break;
    if (clues.length >= max) return null;
  }
  if (!(placed(clues) || (useExact && exact(clues)))) return null;
  // Buang petunjuk berlebih: petunjuk yang dapat dilepas tanpa mengubah ketunggalan jawaban dihapus (sedang: tanpa kehilangan penalaran berantai).
  for (const f of r.shuffle(clues)) {
    const rest = clues.filter((c) => c !== f);
    if (rest.length >= 2 && (useExact ? placed(rest) || exact(rest) : placed(rest))) clues.splice(clues.indexOf(f), 1);
  }
  const sols = solve(geo, names, clues, anchor, CAP);
  return determined(plan, geo, names, sols) ? { clues, sols } : null;
}

// ---- Opsi tiap jenis pertanyaan ---------------------------------------------------------------------------------------------------------------
type Opt = { text: string; fact: Fact };
type Question = { ask: string; conclusion: string; options: Opt[]; key: number; keep: boolean };
const nameOpts = (geo: Geo, names: string[], plan: Plan, r: Rng, make: (x: string) => Fact, sols: number[][]): Opt[] | null => {
  const wrong = names.filter((x) => x !== plan.answer && holdsNone(make(x), names, sols, geo));
  if (wrong.length < 4) return null;
  const chosen = [plan.answer!, ...r.shuffle(wrong).slice(0, 4)];
  return [...chosen].sort((a, b) => a.localeCompare(b)).map((x) => ({ text: x, fact: make(x) }));
};
const pickSeats = (n: number, key: number, r: Rng) => [key, ...r.shuffle(Array.from({ length: n }, (_, i) => i).filter((i) => i !== key)).slice(0, 4)].sort((a, b) => a - b);
function statementPool(geo: Geo, names: string[], seat: Record<string, number>, r: Rng): Fact[] {
  const out: Fact[] = [], n = seatCount(geo), not = (f: Fact): Fact => ({ k: 'not', f });
  const pairs = names.flatMap((a) => names.filter((b) => b !== a).map((b) => [a, b] as const)), unordered = pairs.filter(([a, b]) => a < b);
  if (geo.form === 'linear') {
    for (const a of names) { for (let s = 0; s < n; s++) out.push({ k: 'at', a, seats: [s] }); out.push({ k: 'at', a, seats: [0, n - 1] }); out.push(not({ k: 'at', a, seats: [0, n - 1] })); }
    for (const [a, b] of pairs) { out.push({ k: 'next', a, b, w: r.pick([0, 1]) }); out.push({ k: 'before', a, b, w: r.pick([0, 1]) }); }
    for (const [a, b] of unordered) { out.push({ k: 'beside', a, b }); out.push(not({ k: 'beside', a, b })); for (let k = 1; k <= n - 2; k++) out.push({ k: 'gap', a, b, n: k }); }
    for (const a of names) for (const [b, c] of unordered) if (a !== b && a !== c) out.push({ k: 'between', a, b, c });
  } else if (geo.form === 'circular') {
    for (const [a, b] of pairs) out.push({ k: 'next', a, b, w: r.pick([0, 1]) });
    for (const [a, b] of unordered) { out.push({ k: 'opposite', a, b }); out.push(not({ k: 'opposite', a, b })); out.push({ k: 'beside', a, b }); out.push(not({ k: 'beside', a, b })); }
    for (const a of names) for (const [b, c] of unordered) if (a !== b && a !== c) out.push({ k: 'between', a, b, c });
  } else {
    for (const a of names) { for (let row = 0; row < geo.rows; row++) out.push({ k: 'row', who: [a], rows: [row] }); for (let c = 0; c < geo.cols; c++) out.push({ k: 'col', who: [a], cols: [c] }); }
    for (const [a, b] of pairs) { out.push({ k: 'next', a, b, w: r.pick([0, 1]) }); out.push({ k: 'before', a, b, w: r.pick([0, 1]) }); }
    for (const [a, b] of unordered) { out.push({ k: 'sameRow', a, b }); out.push(not({ k: 'sameRow', a, b })); out.push({ k: 'beside', a, b }); out.push(not({ k: 'beside', a, b })); out.push({ k: 'sameCol', a, b }); }
  }
  void seat;
  return out;
}
const kindOfFact = (f: Fact) => f.k === 'not' ? 'not-' + f.f.k : f.k;
function askAbout(geo: Geo, names: string[], seat: Record<string, number>, sols: number[][], plan: Plan, clues: Fact[], anchor: string | undefined, r: Rng): Question | null {
  const n = seatCount(geo), shuffleOpts = (opts: Opt[], keyText: string) => { const o = r.shuffle(opts); return { options: o, key: o.findIndex((x) => x.text === keyText) }; };
  const linear = geo.form === 'linear' ? linearWords(geo) : undefined, v = geo.form === 'linear' ? linear!.v : 'duduk';
  const order = names.slice().sort((a, b) => seat[a] - seat[b]);
  // Pernyataan dan susunan lengkap
  if (plan.kind === 'pernyataan') {
    const pool = statementPool(geo, names, seat, r).filter((f) => !clues.some((c) => sameFact(c, f)) && clause(f, geo));
    const truths = r.shuffle(pool.filter((f) => holdsAll(f, names, sols, geo))), falses = r.shuffle(pool.filter((f) => holdsNone(f, names, sols, geo)));
    const keyFact = truths.find((f) => kindOfFact(f) !== 'at') ?? truths[0];
    if (!keyFact) return null;
    const distract: Fact[] = [], kinds = new Set<string>([kindOfFact(keyFact)]);
    for (const f of falses) { if (distract.length < 4 && !kinds.has(kindOfFact(f))) { distract.push(f); kinds.add(kindOfFact(f)); } }
    for (const f of falses) if (distract.length < 4 && !distract.includes(f)) distract.push(f);
    if (distract.length < 4) return null;
    const opts = [keyFact, ...distract].map((f) => ({ text: cap(clause(f, geo)), fact: f }));
    if (new Set(opts.map((o) => o.text)).size < 5) return null;
    const { options, key } = shuffleOpts(opts, opts[0].text);
    return { ask: 'Pernyataan yang pasti benar adalah ...', conclusion: 'Dengan demikian, ' + mid(clause(keyFact, geo)) + '.', options, key, keep: false };
  }
  if (plan.kind === 'urutan') {
    const seq = geo.form === 'circular' ? names.slice().sort((a, b) => ((seat[a] - seat[anchor!]) + n) % n - ((seat[b] - seat[anchor!]) + n) % n) : order;
    const distinct = new Map<string, string[]>();
    const tryAdd = (cand: string[]) => { if (cand[0] === (geo.form === 'circular' ? anchor : cand[0])) distinct.set(cand.join(' - '), cand); };
    const swaps = r.shuffle(seq.flatMap((_, i) => seq.slice(i + 1).map((__, j) => [i, i + 1 + j] as const)));
    for (const [i, j] of swaps) {
      if (geo.form === 'circular' && i === 0) continue;
      const cand = [...seq]; [cand[i], cand[j]] = [cand[j], cand[i]]; tryAdd(cand);
    }
    const falsePerms = [...distinct.values()].filter((cand) => holdsNone({ k: 'order', seq: cand }, names, sols, geo));
    if (falsePerms.length < 4) return null;
    // Pengecoh: campuran tukar dua tetangga dan tukar jauh, supaya tidak semuanya "hampir benar".
    const near = falsePerms.filter((cand) => cand.filter((x, i) => x !== seq[i]).length === 2 && Math.abs(cand.findIndex((x, i) => x !== seq[i]) - cand.length + 1 + cand.slice().reverse().findIndex((x, i) => x !== seq[seq.length - 1 - i])) <= 1);
    const chosen = [...r.shuffle(near).slice(0, 2), ...r.shuffle(falsePerms.filter((x) => !near.includes(x)))].slice(0, 4);
    if (chosen.length < 4) chosen.push(...falsePerms.filter((x) => !chosen.includes(x)).slice(0, 4 - chosen.length));
    const opts = [seq, ...chosen].map((cand) => ({ text: chain(cand), fact: { k: 'order', seq: cand } as Fact }));
    const { options, key } = shuffleOpts(opts, opts[0].text);
    if (geo.form === 'linear' && isTheme(geo.style)) return { ...themeAsk(geo, 'urutan', { seq }), options, key, keep: false };
    const dir = geo.form === 'circular' ? 'Urutan duduk searah jarum jam, dimulai dari ' + anchor + ', yang sesuai dengan seluruh petunjuk adalah ...'
      : 'Susunan dari ' + (linear!.lo === 'kiri' ? 'kiri ke kanan' : 'depan ke belakang') + ' yang sesuai dengan seluruh petunjuk adalah ...';
    return { ask: dir, conclusion: geo.form === 'circular' ? 'Dengan demikian, urutan searah jarum jam dimulai dari ' + anchor + ' adalah ' + chain(seq) + '.' : 'Dengan demikian, susunan dari ' + (linear!.lo === 'kiri' ? 'kiri ke kanan' : 'depan ke belakang') + ' adalah ' + chain(seq) + '.', options, key, keep: false };
  }
  // Pertanyaan dengan fakta kunci tunggal
  const F = plan.fact!, x = plan.answer, c = plan.person;
  if (geo.form === 'linear') {
    const w = linear!, themed = isTheme(geo.style);
    if (plan.kind === 'siapa-posisi') {
      const s = plan.seat!, where = s === 0 ? 'di ' + w.noun + ' ' + w.loEnd : s === n - 1 ? 'di ' + w.noun + ' ' + w.hiEnd : n % 2 && s === (n - 1) / 2 ? 'tepat di tengah' : 'di ' + w.noun + ' ke-' + (s + 1);
      const options = nameOpts(geo, names, plan, r, (y) => ({ k: 'at', a: y, seats: [s] }), sols);
      if (themed) return options && { ...themeAsk(geo, 'siapa-posisi', { seat: s, answer: x }), options, key: options.findIndex((o) => o.text === x), keep: true };
      return options && { ask: 'Siapakah yang ' + v + ' ' + where + '?', conclusion: 'Dengan demikian, orang yang ' + v + ' ' + where + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
    }
    if (plan.kind === 'posisi-orang') {
      const s = plan.seat!, seats = pickSeats(n, s, r), options = seats.map((t) => ({ text: geo.labels ? geo.labels[t] : cap(w.noun) + ' ke-' + (t + 1), fact: { k: 'at', a: c!, seats: [t] } as Fact }));
      if (themed) return { ...themeAsk(geo, 'posisi-orang', { seat: s, person: c }), options, key: seats.indexOf(s), keep: true };
      return { ask: 'Di ' + w.noun + ' keberapakah ' + c + ' ' + v + '?', conclusion: 'Dengan demikian, ' + c + ' ' + v + ' di ' + w.noun + ' ke-' + (s + 1) + '.', options, key: seats.indexOf(s), keep: true };
    }
    const side = plan.side!, make = (y: string): Fact => side === 'hi' ? { k: 'next', a: y, b: c! } : { k: 'next', a: c!, b: y }, options = nameOpts(geo, names, plan, r, make, sols);
    if (themed) return options && { ...themeAsk(geo, 'siapa-samping', { person: c, side, answer: x }), options, key: options.findIndex((o) => o.text === x), keep: true };
    const rel = (linear!.noun === 'urutan' ? 'tepat di ' + (side === 'hi' ? w.hi : w.lo) : 'tepat di sebelah ' + (side === 'hi' ? w.hi : w.lo)) + ' ' + c;
    return options && { ask: 'Siapakah yang ' + v + ' ' + rel + '?', conclusion: 'Dengan demikian, orang yang ' + v + ' ' + rel + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
  }
  if (geo.form === 'circular') {
    if (plan.kind === 'berhadapan') {
      const options = nameOpts(geo, names, plan, r, (y) => ({ k: 'opposite', a: y, b: c! }), sols);
      return options && { ask: 'Siapakah yang duduk berhadapan dengan ' + c + '?', conclusion: 'Dengan demikian, orang yang duduk berhadapan dengan ' + c + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
    }
    if (plan.kind === 'samping') {
      const side = plan.side!, make = (y: string): Fact => side === 'lo' ? { k: 'next', a: y, b: c! } : { k: 'next', a: c!, b: y }, options = nameOpts(geo, names, plan, r, make, sols);
      const rel = 'tepat di sebelah ' + (side === 'lo' ? 'kiri ' : 'kanan ') + c;
      return options && { ask: 'Siapakah yang duduk ' + rel + '?', conclusion: 'Dengan demikian, orang yang duduk ' + rel + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
    }
    const keyF = F as Extract<Fact, { k: 'between' }>, others = names.filter((y) => y !== c && y !== keyF.b && y !== keyF.c);
    const pairsText = (p: string, q: string) => 'Di antara ' + [p, q].sort((a, b) => a.localeCompare(b)).join(' dan '), make = (p: string, q: string): Fact => ({ k: 'between', a: c!, b: p, c: q });
    const picks: [string, string][] = [[keyF.b, keyF.c], [keyF.b, r.pick(others)], [r.pick(others), keyF.c]];
    for (const [p, q] of r.shuffle(others.flatMap((p) => others.filter((q) => p < q).map((q) => [p, q] as [string, string])))) { if (picks.length >= 5) break; if (!picks.some(([a, b]) => pairsText(a, b) === pairsText(p, q))) picks.push([p, q]); }
    const opts = picks.map(([p, q]) => ({ text: pairsText(p, q), fact: make(p, q) }));
    if (new Set(opts.map((o) => o.text)).size < 5 || opts.slice(1).some((o) => !holdsNone(o.fact, names, sols, geo))) return null;
    const { options, key } = shuffleOpts(opts, opts[0].text);
    return { ask: 'Di manakah posisi ' + c + ' duduk?', conclusion: 'Dengan demikian, ' + c + ' duduk ' + pairsText(keyF.b, keyF.c).replace(/^Di/, 'di') + '.', options, key, keep: false };
  }
  // Baris-kolom
  const g = geo as Extract<Geo, { form: 'grid' }>, colName = g.cols === 2 ? ['kursi kiri', 'kursi kanan'] : ['kursi kiri', 'kursi tengah', 'kursi kanan'];
  if (plan.kind === 'baris') {
    const row = (F as Extract<Fact, { k: 'row' }>).rows[0], rows = pickSeats(g.rows, row, r), options = rows.map((t) => ({ text: 'Baris ' + (t + 1), fact: { k: 'row', who: [c!], rows: [t] } as Fact }));
    return { ask: 'Di baris berapakah ' + c + ' duduk?', conclusion: 'Dengan demikian, ' + c + ' duduk di baris ' + (row + 1) + '.', options, key: rows.indexOf(row), keep: true };
  }
  if (plan.kind === 'kursi') {
    const s = plan.seat!, row = rowOf(g, s), col = colOf(g, s);
    const cells = [s, ...r.shuffle(Array.from({ length: seatCount(g) }, (_, i) => i).filter((i) => i !== s && (rowOf(g, i) === row || colOf(g, i) === col || Math.abs(rowOf(g, i) - row) <= 1))).slice(0, 4)].sort((a, b) => a - b);
    const options = cells.map((t) => ({ text: 'Baris ' + (rowOf(g, t) + 1) + ', ' + colName[colOf(g, t)], fact: { k: 'at', a: c!, seats: [t] } as Fact }));
    return { ask: 'Di manakah ' + c + ' duduk?', conclusion: 'Dengan demikian, ' + c + ' duduk di baris ' + (row + 1) + ' pada ' + colName[col] + '.', options, key: cells.indexOf(s), keep: true };
  }
  if (plan.kind === 'satu-baris') {
    const options = nameOpts(geo, names, plan, r, (y) => ({ k: 'sameRow', a: y, b: c! }), sols);
    return options && { ask: 'Siapakah yang duduk satu baris dengan ' + c + '?', conclusion: 'Dengan demikian, orang yang duduk satu baris dengan ' + c + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
  }
  const side = plan.side!, make = (y: string): Fact => side === 'hi' ? { k: 'next', a: y, b: c! } : { k: 'next', a: c!, b: y }, options = nameOpts(geo, names, plan, r, make, sols);
  const rel = side === 'hi' ? 'tepat di belakang ' + c : 'tepat di depan ' + c;
  return options && { ask: 'Siapakah yang duduk ' + rel + '?', conclusion: 'Dengan demikian, orang yang duduk ' + rel + ' adalah ' + x + '.', options, key: options.findIndex((o) => o.text === x), keep: true };
}

// ---- Pembahasan ---------------------------------------------------------------------------------------------------------------------------------
// Duduk melingkar tidak memakai tabel: pembahasan menutup dengan diagram lingkaran seperti contoh panduan (lib/graph.ts, baris `@graf` dengan `ring`).
function tableFor(geo: Exclude<Geo, { form: 'circular' }>, names: string[], sols: number[][], anchor?: string): string[] {
  const occupant = (s: number) => new Set(sols.map((sol) => { const i = sol.indexOf(s); return i < 0 ? '' : names[i]; }));
  const cell = (s: number) => { const o = occupant(s); return o.size === 1 ? ([...o][0] ? mark.bold([...o][0]) : 'kosong') : '?'; };
  if (geo.form === 'linear') return tableLines({ headers: Array.from({ length: geo.n }, (_, i) => geo.labels ? geo.labels[i] : String(i + 1)), rows: [Array.from({ length: geo.n }, (_, i) => cell(i))] });
  void anchor;
  const cols = geo.cols === 2 ? ['Kursi Kiri', 'Kursi Kanan'] : ['Kursi Kiri', 'Kursi Tengah', 'Kursi Kanan'];
  return tableLines({ headers: ['', ...cols], rows: Array.from({ length: geo.rows }, (_, row) => ['Baris ' + (row + 1), ...Array.from({ length: geo.cols }, (_, col) => cell(row * geo.cols + col))]) });
}
function explain(c: TextCtx, steps: ReturnType<typeof neededSteps>, sols: number[][], anchor: string | undefined, conclusion: string, formed: boolean, clueTexts: string[]): string {
  const geo = c.geo, sentences = stepSentences(c, steps), blocks: string[] = [];
  const order = (s: (name: string) => number) => c.names.slice().sort((a, b) => s(a) - s(b));
  const sol = sols[0], seatOf = (name: string) => sol[c.names.indexOf(name)];
  if (geo.form === 'circular') blocks.push('Susunan melingkar tidak mempunyai posisi awal yang tetap, sehingga ' + anchor + ' dijadikan acuan di kursi 1. Kursi lain dinomori searah jarum jam; kiri seseorang adalah kursi berikutnya.');
  // Paragraf pendek: satu paragraf memuat paling banyak tiga kalimat (satu langkah dapat memuat dua kalimat).
  let block: string[] = [], count = 0;
  for (const sentence of sentences) { block.push(sentence); count += sentence.split(/(?<=\.)\s+/).length; if (count >= 3) { blocks.push(block.join(' ')); block = []; count = 0; } }
  if (block.length) blocks.push(block.join(' '));
  const determinedAll = c.names.every((name) => sols.every((s) => s[c.names.indexOf(name)] === seatOf(name)));
  if (determinedAll && formed) {
    const seq = order(seatOf);
    if (geo.form === 'linear') blocks.push(formedText(geo, seq));
    if (geo.form === 'circular') blocks.push('Urutan searah jarum jam adalah ' + chain([...seq, seq[0]], ' > ') + '.');
  }
  blocks.push(conclusion, 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.');
  // Diagram lingkaran: kursi 1 di atas dan searah jarum jam, nama di dalam kursi, petunjuk kunci (kalimat petunjuk soal), dan kotak kesimpulan.
  // Tabel yang memuat kursi belum pasti diberi judul (QC akademik #2, soal 41): tabel tidak boleh terbaca seolah seluruh posisi sudah pasti.
  const caption = determinedAll ? [] : ['**Kedudukan yang dapat dipastikan** (tanda ? berarti kursi itu belum dapat dipastikan dari informasi yang ada)'];
  const closing = geo.form === 'circular' ? [graphLine({ nodes: order(seatOf), edges: [], entry: 0, exit: geo.n - 1, ring: { clues: clueTexts, note: cap(conclusion.replace(/^Dengan demikian, /, '')) } })] : [...caption, ...tableFor(geo, c.names, sols, anchor)];
  return [...blocks.flatMap((b, i) => i === blocks.length - 1 ? [b] : [b, '']), '', ...closing].join('\n');
}

// ---- Teks soal ----------------------------------------------------------------------------------------------------------------------------------
function intro(geo: Geo, names: string[], letters: boolean, noun: string, place: string, r: Rng): string {
  const count = NUM[names.length], listed = list(names);
  const lead = (verb: string) => letters ? 'Terdapat ' + count + ' ' + noun + ' (' + listed + ') ' + verb + '.' : cap(count) + ' ' + noun + ', yaitu ' + listed + ', ' + verb + '.';
  if (geo.form === 'linear') {
    const verb = geo.style === 'berdiri' ? 'berdiri berjejer dari kiri ke kanan' : geo.style === 'duduk' ? 'duduk berderet pada satu baris kursi dari kiri ke kanan' : 'mengantre dalam satu barisan dari depan ke belakang';
    return lead(verb);
  }
  if (geo.form === 'circular') return lead(r.pick(['duduk melingkar menghadap pusat meja', 'duduk mengelilingi sebuah meja bundar dan menghadap ke tengah'])) + ' Dalam soal ini, kiri seseorang berarti kursi tepat setelahnya searah jarum jam.';
  return lead('duduk pada ' + place + ' yang tersusun dalam ' + geo.rows + ' baris dan ' + geo.cols + ' kursi pada setiap baris') + ' Baris pertama adalah baris paling depan.';
}
function orderClues(clues: Fact[], r: Rng): Fact[] {
  const direct = (f: Fact) => f.k === 'at' || f.k === 'row' || f.k === 'col';
  return [...r.shuffle(clues.filter(direct)), ...r.shuffle(clues.filter((f) => !direct(f)))];
}
const NOUNS: Record<Form, string[]> = { linear: ['orang', 'siswa', 'peserta', 'pegawai'], circular: ['peserta', 'anggota tim', 'tamu undangan', 'pegawai'], grid: ['siswa', 'peserta', 'penumpang'] };
const PLACES = ['wahana', 'bus wisata', 'ruang pelatihan', 'kendaraan antar-jemput'];

// ---- Pembangkit ------------------------------------------------------------------------------------------------------------------------------------
// Bentuk dipilih sekali per butir menurut bobot 4:3:3 (linear, melingkar, baris-kolom); percobaan diulang di dalam bentuk yang sama, sehingga sebaran bentuk mengikuti bobot.
// Hanya bila satu bentuk tidak menghasilkan butir sama sekali, bentuk berikutnya (urutan undian bobot) dicoba. `theme` = Urutan dan Peringkat atau Jadwal (selalu linear).
export function buildPosisi(level: PosisiLevel, r: Rng, wanted?: Form, theme?: Theme): PosisiBuild {
  let best: PosisiBuild | undefined;
  const forms: Form[] = theme ? ['linear'] : wanted ? [wanted] : weighted([{ item: 'linear' as Form, w: 4 }, { item: 'circular' as Form, w: 3 }, { item: 'grid' as Form, w: 3 }], r);
  for (const [turn, form] of forms.entries()) {
    for (let attempt = 0; attempt < (turn === 0 ? 120 : 60); attempt++) {
      const linearN = theme ? r.pick(theme.size[level]) : level === 'sedang' ? r.int(5, 6) : r.int(5, 7);
      const geo: Geo = form === 'linear' ? (theme ? { form, n: linearN, style: theme.style, ...(theme.labels ? { labels: DAYS.slice(0, linearN) } : {}), ...(theme.who ? { who: theme.who } : {}) } : { form, n: linearN, style: r.pick(['berdiri', 'berdiri', 'duduk', 'antre'] as Linear[]) })
        : form === 'circular' ? { form, n: level === 'sedang' ? 6 : r.pick([6, 8]) }
          : (() => { const [rows, cols] = r.pick([[4, 2], [4, 2], [3, 3]]), people = rows * cols - (r.next() < 0.3 ? 1 : 0); return { form, rows, cols, people } as Geo; })();
      const people = geo.form === 'grid' ? geo.people : geo.n;
      let names: string[], letters: boolean;
      if (theme) ({ names, letters } = theme.names(people, r));
      else {
        letters = form !== 'grid' && r.next() < 0.45;
        const pool = r.shuffle(NAMES), picked: string[] = [];
        for (const name of pool) if (picked.length < people && !picked.some((p) => p[0] === name[0])) picked.push(name);
        names = letters ? Array.from({ length: people }, (_, i) => String.fromCharCode(65 + i)) : picked.sort((a, b) => a.localeCompare(b));
      }
      // Susunan acuan
      const seats = Array.from({ length: seatCount(geo) }, (_, i) => i), shuffled = r.shuffle(seats), seat: Record<string, number> = {};
      names.forEach((name, i) => { seat[name] = shuffled[i]; });
      // Acuan melingkar dipilih lebih dahulu (kursi 1); penalaran dan pemecah memakai acuan yang sama dengan pembahasan.
      const anchor = geo.form === 'circular' ? r.pick(names) : undefined;
      if (anchor !== undefined) { const shift = seat[anchor]; for (const name of names) seat[name] = (seat[name] - shift + (geo as { n: number }).n) % (geo as { n: number }).n; }
      const plan = planFor(geo, names, seat, level, r, theme);
      if (!plan) continue;
      const required = fullArrangement(plan, geo) ? names : persons(plan.fact!);
      const pool2 = weighted(candidates(geo, names, seat, r).map((cand) => ({ item: cand, w: cand.w })), r);
      const picked2 = selectClues(geo, names, pool2, plan, anchor, r, geo.form === 'grid' ? 14 : 9, level, required);
      if (!picked2) continue;
      const { clues, sols } = picked2;
      const minimum = geo.form === 'circular' && geo.n >= 8 ? 5 : 4;
      if (clues.length < minimum || trivial(plan, clues)) continue;
      const relational = clues.filter((f) => f.k !== 'at' && f.k !== 'row' && f.k !== 'col' && !(f.k === 'not' && (f.f.k === 'at' || f.f.k === 'row' || f.f.k === 'col'))).length;
      if (relational < 2) continue;
      if (anchor !== undefined && clues.filter((f) => persons(f).includes(anchor)).length < 2) continue;
      if (!sols.length || sols.length > CAP) continue;
      const d = deduce(geo, names, clues, anchor);
      if (!required.every((name) => name in d.positions)) continue;
      for (const [name, s] of Object.entries(d.positions)) if (!sols.every((sol) => sol[names.indexOf(name)] === s)) throw new Error('Penalaran susunan tidak sejalan dengan pemecah: ' + name);
      const q = askAbout(geo, names, seat, sols, plan, clues, anchor, r);
      if (!q || q.key < 0 || q.options.length !== 5) continue;
      // Pembahasan harus tetap ringkas: panjang uraian sebelum penutup dibatasi menurut tingkat.
      const sentences = clueSentences(orderClues(clues, r), geo);
      const c: TextCtx = { geo, clues, names }, explanation = explain(c, neededSteps(d), sols, anchor, q.conclusion, plan.kind !== 'urutan', sentences);
      if (explanation.split('\nJadi,')[0].split(/\s+/).length > (level === 'sedang' ? 340 : 480)) continue;
      const hard = d.refutations > 0 || plan.kind === 'pernyataan' || plan.kind === 'urutan' || clues.length >= 7;
      const difficulty: PosisiLevel = hard ? 'sulit' : 'sedang';
      const bloom = plan.kind === 'urutan' ? 'C6' : plan.kind === 'pernyataan' || d.refutations > 0 ? 'C5' : 'C4';
      const grid = geo.form === 'grid' ? geo : undefined;
      const reason = [people + ' ' + (theme ? 'unsur dalam ' + (theme.style === 'jadwal' ? 'jadwal harian' : 'urutan peringkat') : grid ? 'orang pada ' + grid.rows * grid.cols + ' kursi' : 'orang dalam susunan ' + (form === 'linear' ? 'garis' : 'melingkar')) + ' dengan ' + clues.length + ' petunjuk yang saling bergantung',
        d.refutations ? 'memerlukan pengujian ' + d.refutations + ' kemungkinan yang gugur' : 'dapat diselesaikan dengan menurunkan petunjuk berantai',
        plan.kind === 'urutan' ? 'peserta merekonstruksi susunan lengkap' : plan.kind === 'pernyataan' ? 'peserta mengevaluasi pernyataan terhadap susunan lengkap' : 'peserta menentukan satu kedudukan dari hubungan antarpetunjuk'].join('; ') + '.';
      let stem: string;
      if (theme) {
        const lead = theme.intro(names, letters, r), ask = theme.numbered && ['siapa-posisi', 'posisi-orang', 'siapa-samping'].includes(plan.kind) ? 'Berdasarkan informasi tersebut, ' + q.ask.charAt(0).toLowerCase() + q.ask.slice(1) : q.ask;
        stem = theme.numbered ? lead + ' Terdapat beberapa informasi sebagai berikut:\n' + sentences.map((text, i) => (i + 1) + '. ' + text).join('\n') + '\n' + ask : lead + ' ' + sentences.join(' ') + '\n' + ask;
      } else stem = intro(geo, names, letters, r.pick(NOUNS[form]), r.pick(PLACES), r) + ' ' + sentences.join(' ') + '\n' + q.ask;
      const build: PosisiBuild = {
        stem, options: q.options, answer: q.key, geo, names, anchor, clues, form, kind: plan.kind, refutations: d.refutations, difficulty, bloom, difficultyReason: reason,
        explanation,
      };
      if (difficulty === level) return build;
      best = best ?? build;
    }
    if (best) return best;
  }
  throw new Error('Pembangkit susunan dan posisi gagal membentuk soal ' + level + '.');
}

export { seatText, ORD };
void holds;
