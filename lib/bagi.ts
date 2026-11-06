import { rng, type Rng } from './rng';
import type { BankItem, BlueprintRow, Difficulty } from './types';

// Pembagian butir TWK dan TKP ke semua paket sekaligus (dipakai generate() bila uniqueAcross aktif dan paket lebih dari satu).
// Memilih butir paket demi paket secara serakah menghabiskan persediaan paket awal tanpa memikirkan paket berikutnya: anggota satu kelompok eksklusif
// tertinggal untuk paket terakhir, dan kasus berstrata sama (mis. tempat "administratif") menumpuk di sana. Di sini seluruh paket dibagi serentak per sel (topik × kesulitan):
// 1. kelompok eksklusif disebar lebih dulu, tiap anggota ke paket berbeda (satu kelompok paling banyak satu butir per paket, lintas sel);
// 2. sisa slot tiap sel diisi dari butir tanpa kelompok;
// 3. untuk TKP, butir dipertukarkan antarpaket (di dalam sel yang sama) sampai batas sebaran strata terpenuhi di semua paket.
// Seluruhnya deterministik dari seed; percobaan diulang dengan undian lain bila satu percobaan buntu.
export type Share = Map<string, BankItem[]>[]; // per paket: sel (cellKey) -> butir menurut urutan pemakaian
export const cellKey = (topic: string, difficulty: string) => topic + '|' + difficulty;
export type SpreadKey = 'pola' | 'keputusan' | 'peran' | 'tempat';
export const SPREAD_KEYS: SpreadKey[] = ['pola', 'keputusan', 'peran', 'tempat'];
export type ShareInput = {
  rows: BlueprintRow[]; // kuota per paket tiap sel
  items: BankItem[]; // seluruh butir bank yang memenuhi filter (satu subtes)
  packages: number;
  seed: string;
  group: (item: BankItem) => string | undefined; // kelompok eksklusif: paling banyak satu butir per paket
  limits?: Record<SpreadKey, number>; // TKP: batas butir kasus per nilai strata per paket
};
export type ShareResult = { share: Share; violations: number } | { failed: { topic: string; difficulty: Difficulty } };

type Cell = { row: BlueprintRow; pool: BankItem[] };
// Biaya satu nilai strata: kelebihan di atas batas (bobot besar) ditambah kuadrat keterpakaian agar sebaran merata.
const part = (count: number, limit: number) => (count > limit ? (count - limit) * 1000 : 0) + count * count / limit;

function attempt(cells: Cell[], input: ShareInput, random: Rng): { share: Share; violations: number } | { failed: BlueprintRow } {
  const P = input.packages;
  const slots = cells.map((cell) => Array<number>(P).fill(cell.row.count));
  const assign = cells.map(() => Array.from({ length: P }, () => [] as BankItem[]));
  const held = Array.from({ length: P }, () => new Set<string>());
  const used = new Set<string>();

  // 1. Kelompok eksklusif lebih dulu. Anggota di sel yang paling kekurangan butir tanpa kelompok didahulukan; tiap anggota ke paket berbeda
  // yang masih punya slot di selnya (paling longgar dahulu); anggota yang tidak mendapat paket tidak dipakai.
  const need = cells.map((cell) => Math.max(0, cell.row.count * P - cell.pool.filter((item) => !input.group(item)).length));
  const members = random.shuffle(cells.flatMap((cell, ci) => cell.pool.flatMap((item) => { const g = input.group(item); return g ? [{ item, ci, g }] : []; })))
    .sort((a, b) => need[b.ci] - need[a.ci]);
  for (const { item, ci, g } of members) {
    let best: number[] = [], most = 0;
    for (let p = 0; p < P; p++) {
      if (held[p].has(g) || slots[ci][p] <= 0) continue;
      if (slots[ci][p] > most) { most = slots[ci][p]; best = [p]; } else if (slots[ci][p] === most) best.push(p);
    }
    if (!best.length) continue;
    const p = random.pick(best);
    assign[ci][p].push(item); slots[ci][p]--; held[p].add(g); used.add(item.id);
  }

  // 2. Sisa slot dari butir tanpa kelompok.
  for (let ci = 0; ci < cells.length; ci++) {
    const singles = random.shuffle(cells[ci].pool.filter((item) => !input.group(item)));
    const order = random.shuffle(Array.from({ length: P }, (_, p) => p));
    let at = 0;
    for (const p of order) for (let k = 0; k < slots[ci][p]; k++) {
      if (at >= singles.length) return { failed: cells[ci].row };
      assign[ci][p].push(singles[at]); used.add(singles[at].id); at++;
    }
    for (let p = 0; p < P; p++) slots[ci][p] = 0;
  }

  // 3. TKP: pertukaran butir antarpaket di dalam sel sampai tidak ada nilai strata di atas batas.
  const limits = input.limits;
  let violations = 0;
  if (limits) {
    const tally = Array.from({ length: P }, () => Object.fromEntries(SPREAD_KEYS.map((key) => [key, new Map<string, number>()])) as Record<SpreadKey, Map<string, number>>);
    const unused = cells.map((cell) => cell.pool.filter((item) => !used.has(item.id)));
    const bump = (p: number, item: BankItem | undefined, by: number) => { if (item?.kasus) for (const key of SPREAD_KEYS) tally[p][key].set(item.kasus[key], (tally[p][key].get(item.kasus[key]) ?? 0) + by); };
    assign.forEach((perPackage) => perPackage.forEach((list, p) => list.forEach((item) => bump(p, item, 1))));
    // Selisih biaya bila `out` keluar dari paket p dan `into` masuk (paket p bernilai -1 = butir tak terpakai: tanpa biaya).
    const delta = (p: number, out: BankItem, into: BankItem) => {
      if (p < 0 || (!out.kasus && !into.kasus)) return 0;
      let d = 0;
      for (const key of SPREAD_KEYS) {
        const a = out.kasus?.[key], b = into.kasus?.[key];
        if (a === b) continue;
        const limit = limits[key], map = tally[p][key];
        if (a !== undefined) { const c = map.get(a) ?? 0; d += part(c - 1, limit) - part(c, limit); }
        if (b !== undefined) { const c = map.get(b) ?? 0; d += part(c + 1, limit) - part(c, limit); }
      }
      return d;
    };
    const total = () => { let v = 0; for (const t of tally) for (const key of SPREAD_KEYS) for (const count of t[key].values()) v += Math.max(0, count - limits[key]); return v; };
    const swappable = cells.map((_, ci) => ci).filter((ci) => cells[ci].pool.some((item) => item.kasus));
    // Pemegang butir: paket 0..P-1 dan "tak terpakai" (indeks P).
    const listOf = (ci: number, h: number) => h === P ? unused[ci] : assign[ci][h];
    const steps = swappable.length ? Math.max(2000, 60 * [...used].length) : 0;
    for (let step = 0; step < steps && swappable.length; step++) {
      if (step % 50 === 0 && total() === 0 && step >= 500) break;
      const ci = random.pick(swappable), a = random.int(0, P), b = random.int(0, P);
      if (a === b) continue;
      const la = listOf(ci, a), lb = listOf(ci, b);
      if (!la.length || !lb.length) continue;
      const ia = random.int(0, la.length - 1), ib = random.int(0, lb.length - 1);
      const x = la[ia], y = lb[ib];
      if (input.group(x) || input.group(y)) continue;
      const d = delta(a === P ? -1 : a, x, y) + delta(b === P ? -1 : b, y, x);
      if (d < 0 || (d === 0 && random.next() < 0.5)) {
        if (a !== P) { bump(a, x, -1); bump(a, y, 1); }
        if (b !== P) { bump(b, y, -1); bump(b, x, 1); }
        la[ia] = y; lb[ib] = x;
      }
    }
    violations = total();
  }

  const share: Share = Array.from({ length: P }, () => new Map<string, BankItem[]>());
  cells.forEach((cell, ci) => { for (let p = 0; p < P; p++) share[p].set(cellKey(cell.row.topic, cell.row.difficulty), random.shuffle(assign[ci][p])); });
  return { share, violations };
}

export function planShares(input: ShareInput): ShareResult {
  const rows = input.rows.filter((row) => row.count > 0);
  const cells: Cell[] = rows.map((row) => ({ row, pool: input.items.filter((item) => item.topic === row.topic && item.difficulty === row.difficulty) }));
  let best: { share: Share; violations: number } | undefined, failed: BlueprintRow | undefined;
  for (let n = 0; n < (input.limits ? 12 : 80); n++) {
    const result = attempt(cells, input, rng(input.seed + '|bagi|' + n));
    if ('failed' in result) { failed ??= result.failed; continue; }
    if (!best || result.violations < best.violations) best = result;
    if (best.violations === 0) break;
  }
  if (best) return best;
  return { failed: { topic: failed!.topic, difficulty: failed!.difficulty } };
}
