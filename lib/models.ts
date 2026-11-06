import { optionNumber } from './option-number';
import { calculate, entails, type Logic } from './solver';
import { holdsAll, solve, type Fact, type Geo } from './posisi-model';
import type { Question } from './types';

export type ArgumentRole = 'kunci' | 'terbalik' | 'tidak-relevan' | 'sebagian' | 'luar-cakupan' | 'ulang-premis';
export type Constraint = { a: string; b?: string; op: 'before' | 'adjacent' | 'distance' | 'at' | 'notAt'; value?: number };
export type Condition = { op: 'sum' | 'difference' | 'product' | 'x' | 'y' | 'xGt' | 'yGt'; value: number };
export type Model =
  | { kind: 'ordering'; names: string[]; constraints: Constraint[]; query: { position?: number; person?: string }; labels?: string[] }
  | { kind: 'arrangement'; geo: Geo; names: string[]; anchor?: string; clues: Fact[]; options: { text: string; fact: Fact }[] } // susunan dan posisi (lib/tiu-posisi.ts): kunci = satu-satunya opsi yang benar pada semua susunan yang memenuhi petunjuk
  | { kind: 'argument'; direction: 'perkuat' | 'lemahkan'; scenario?: string; options: { text: string; role: ArgumentRole }[] } // memperkuat/memperlemah argumen (lib/tiu-argumen.ts): kunci = opsi berperan 'kunci'; sisanya pengecoh dengan perannya
  | { kind: 'equality' }
  | { kind: 'analogy'; target: string; options: { text: string; rel: string; reversed: boolean }[] } // analogi verbal: kunci = pasangan berjenis hubungan sama (target) dan arah yang sama
  | { kind: 'implication'; asked: 'konvers' | 'invers' | 'kontraposisi'; premise: Logic; options: { text: string; logic: Logic }[] } // bentuk turunan "jika p maka q" menurut namanya
  | { kind: 'syllogism'; premises: Logic[]; options: { text: string; logic?: Logic }[]; code?: string; chapter?: string; errors?: (string | null)[]; narrative?: { implications: number; reversed: number; forward: { from: string; to: string; markedFrom: string; markedTo: string }[] } } // narrative menyimpan padanan kalimat dengan kondisi lebih dahulu untuk batas produksi Bagian 25; makna formal dan kunci tidak berubah.
  | { kind: 'route'; nodes: string[]; edges: string[][]; distractors?: { value: number; source: string; reason: string }[] } // rute sederhana (simpul tidak diulang) dari nodes[0] ke simpul terakhir; arah dua arah = dua sisi
  | { kind: 'data'; domain: number; first: Condition[]; second: Condition[]; target: 'x' | 'sum' | 'product' }
  | { kind: 'cost'; capacities: number[]; prices: number[]; target: number; spare: number }
  | { kind: 'statements'; prices: number[]; amounts: number[][]; offered: number[] }
  | { kind: 'availability'; stores: string[]; items: string[]; absent: number[][] }
  | { kind: 'category'; names: string[]; total: number; yes: string[]; no: string[]; second: string[]; claims: { text: string; person: string; first: boolean; second: boolean }[] };

export function permutations<T>(values: T[]): T[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, i) => permutations(values.filter((_, j) => j !== i)).map((rest) => [value, ...rest]));
}
export function orders(model: Extract<Model, { kind: 'ordering' }>): string[][] {
  if (model.names.length > 7) throw new Error('Batas solver susunan adalah tujuh objek.');
  return permutations(model.names).filter((order) => model.constraints.every((c) => {
    const a = order.indexOf(c.a), b = c.b ? order.indexOf(c.b) : -1;
    if (a < 0 || (c.b && b < 0)) return false;
    if (c.op === 'before') return a < b;
    if (c.op === 'adjacent') return b - a === 1;
    if (c.op === 'distance') return b - a === c.value;
    return c.op === 'at' ? a + 1 === c.value : a + 1 !== c.value;
  }));
}
export function dataCategory(model: Extract<Model, { kind: 'data' }>): number {
  const worlds = Array.from({ length: model.domain ** 2 }, (_, i) => ({ x: Math.floor(i / model.domain) + 1, y: i % model.domain + 1 }));
  const match = ({ x, y }: { x: number; y: number }, cs: Condition[]) => cs.every((c) => {
    if (c.op === 'xGt') return x > c.value;
    if (c.op === 'yGt') return y > c.value;
    return (c.op === 'x' ? x : c.op === 'y' ? y : c.op === 'sum' ? x + y : c.op === 'difference' ? x - y : x * y) === c.value;
  });
  const enough = (cs: Condition[]) => {
    const possible = worlds.filter((w) => match(w, cs));
    if (!possible.length) throw new Error('Pernyataan kecukupan data tidak konsisten.');
    return new Set(possible.map(({ x, y }) => model.target === 'x' ? x : model.target === 'sum' ? x + y : x * y)).size === 1;
  };
  const a = enough(model.first), b = enough(model.second), both = enough([...model.first, ...model.second]);
  return a && b ? 3 : a ? 0 : b ? 1 : both ? 2 : 4;
}
export const DATA_LABELS = ['(1) saja cukup, (2) saja tidak cukup.', '(2) saja cukup, (1) saja tidak cukup.',
  'Keduanya bersama cukup, masing-masing tidak cukup.', 'Masing-masing pernyataan cukup.', 'Keduanya bersama tetap tidak cukup.'];

export function solveModel(q: Question): boolean[] {
  if (q.proof.kind !== 'model') throw new Error('Model tidak ditemukan.');
  const m = q.proof.model;
  if (m.kind === 'ordering') {
    const possible = orders(m);
    if (!possible.length) throw new Error('Petunjuk susunan tidak konsisten.');
    const values = new Set(possible.map((order) => m.query.person ? (m.labels ?? ['1', '2', '3', '4', '5', '6', '7'])[order.indexOf(m.query.person)] : order[m.query.position! - 1]));
    const answer = values.size === 1 ? [...values][0] : 'Tidak dapat ditentukan';
    return q.options.map((o) => o.text === answer);
  }
  if (m.kind === 'arrangement') {
    const found = solve(m.geo, m.names, m.clues, m.anchor, 20000);
    if (!found.length) throw new Error('Petunjuk susunan tidak konsisten.');
    if (found.length > 20000) throw new Error('Petunjuk susunan menghasilkan terlalu banyak susunan.');
    return q.options.map((o) => { const option = m.options.find((x) => x.text === o.text); return !!option && holdsAll(option.fact, m.names, found, m.geo); });
  }
  if (m.kind === 'argument') return q.options.map((o) => m.options.find((x) => x.text === o.text)?.role === 'kunci');
  if (m.kind === 'equality') return q.options.map((o) => {
    const sides = o.text.replaceAll(' dibandingkan dengan ', '=').replaceAll('×', '*').replaceAll('÷', '/').split('=');
    return sides.length === 2 && Math.abs(calculate(sides[0]) - calculate(sides[1])) < 1e-8;
  });
  if (m.kind === 'analogy') return q.options.map((o) => { const found = m.options.find((x) => x.text === o.text); return !!found && found.rel === m.target && !found.reversed; });
  if (m.kind === 'implication') {
    const p = m.premise;
    if (p.op !== 'implies') throw new Error('Premis bentuk implikasi tidak valid.');
    const wanted = m.asked === 'konvers' ? { op: 'implies', left: p.right, right: p.left } : m.asked === 'invers' ? { op: 'implies', left: { op: 'not', item: p.left }, right: { op: 'not', item: p.right } } :
      { op: 'implies', left: { op: 'not', item: p.right }, right: { op: 'not', item: p.left } };
    return q.options.map((o) => { const found = m.options.find((x) => x.text === o.text); return !!found && JSON.stringify(found.logic) === JSON.stringify(wanted); });
  }
  if (m.kind === 'syllogism') {
    const claims = m.options.filter((o) => o.logic), entailed = entails(m.premises, claims.map((o) => o.logic!)), holds = new Map(claims.map((o, i) => [o.text, entailed[i]]));
    return q.options.map((o) => { const found = m.options.find((x) => x.text === o.text); return !found ? false : found.logic ? !!holds.get(found.text) : !entailed.some(Boolean); });
  }
  if (m.kind === 'route') {
    // Rute sederhana: simpul yang sudah dilewati tidak boleh dilewati lagi (sisi dua arah tidak menimbulkan putaran).
    const visit = (node: string, seen: Set<string>): number => {
      if (node === m.nodes.at(-1)) return 1;
      return m.edges.filter(([from, to]) => from === node && !seen.has(to)).reduce((n, [, to]) => n + visit(to, new Set([...seen, node])), 0);
    };
    const answer = visit(m.nodes[0], new Set());
    return q.options.map((o) => optionNumber(o.text) === answer);
  }
  if (m.kind === 'data') return q.options.map((o) => o.text === DATA_LABELS[dataCategory(m)]);
  if (m.kind === 'cost') {
    const values = q.options.map((o) => {
      const match = o.text.match(/^(\d+) bus A, (\d+) bus B, (\d+) bus C$/);
      if (!match) throw new Error('Format kombinasi bus berubah.');
      const amounts = match.slice(1).map(Number);
      const seats = amounts.reduce((n, a, i) => n + a * m.capacities[i], 0);
      return seats >= m.target && seats <= m.target + m.spare ? amounts.reduce((n, a, i) => n + a * m.prices[i], 0) : Infinity;
    });
    return values.map((v) => Number.isFinite(v) && v === Math.min(...values));
  }
  if (m.kind === 'statements') {
    const correct = m.amounts.map((amounts, i) => amounts.reduce((n, a, j) => n + a * m.prices[j], 0) === m.offered[i] ? i + 1 : 0).filter(Boolean);
    return q.options.map((o) => o.text === correct.join(' dan '));
  }
  if (m.kind === 'availability') {
    // Toko yang dapat dikunjungi: tidak ada barang dibutuhkan yang pasti tidak tersedia (tanda x) di toko itu; kunci hanya bila tepat satu.
    const open = m.stores.filter((_, store) => m.absent.every((list) => !list.includes(store)));
    return q.options.map((o) => open.length === 1 && o.text === open[0]);
  }
  const worlds = Array.from({ length: 2 ** m.names.length }, (_, mask) => m.names.filter((_, i) => mask & 1 << i))
    .filter((set) => set.length === m.total && m.yes.every((n) => set.includes(n)) && m.no.every((n) => !set.includes(n)));
  if (!worlds.length) throw new Error('Kategori tidak konsisten.');
  return q.options.map((o) => {
    const claim = m.claims.find((c) => c.text === o.text);
    return !!claim && worlds.every((set) => set.includes(claim.person) === claim.first && m.second.includes(claim.person) === claim.second);
  });
}
