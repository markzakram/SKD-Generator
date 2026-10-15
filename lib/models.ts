import { calculate } from './solver';
import type { Question } from './types';

export type Constraint = { a: string; b?: string; op: 'before' | 'adjacent' | 'distance' | 'at' | 'notAt'; value?: number };
export type Condition = { op: 'sum' | 'difference' | 'product' | 'x' | 'y' | 'xGt' | 'yGt'; value: number };
export type Model =
  | { kind: 'ordering'; names: string[]; constraints: Constraint[]; query: { position?: number; person?: string }; labels?: string[] }
  | { kind: 'equality' }
  | { kind: 'route'; nodes: string[]; edges: string[][] }
  | { kind: 'data'; domain: number; first: Condition[]; second: Condition[]; target: 'x' | 'sum' | 'product' }
  | { kind: 'cost'; capacities: number[]; prices: number[]; target: number; spare: number }
  | { kind: 'statements'; prices: number[]; amounts: number[][]; offered: number[] }
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
  if (m.kind === 'equality') return q.options.map((o) => {
    const sides = o.text.replaceAll('×', '*').replaceAll('÷', '/').split('=');
    return sides.length === 2 && Math.abs(calculate(sides[0]) - calculate(sides[1])) < 1e-8;
  });
  if (m.kind === 'route') {
    const visit = (node: string, seen: Set<string>): number => {
      if (node === m.nodes.at(-1)) return 1;
      if (seen.has(node)) throw new Error('Siklus rute tidak didukung.');
      return m.edges.filter(([from]) => from === node).reduce((n, [, to]) => n + visit(to, new Set([...seen, node])), 0);
    };
    const answer = visit(m.nodes[0], new Set());
    return q.options.map((o) => Number(o.text) === answer);
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
  const worlds = Array.from({ length: 2 ** m.names.length }, (_, mask) => m.names.filter((_, i) => mask & 1 << i))
    .filter((set) => set.length === m.total && m.yes.every((n) => set.includes(n)) && m.no.every((n) => !set.includes(n)));
  if (!worlds.length) throw new Error('Kategori tidak konsisten.');
  return q.options.map((o) => {
    const claim = m.claims.find((c) => c.text === o.text);
    return !!claim && worlds.every((set) => set.includes(claim.person) === claim.first && m.second.includes(claim.person) === claim.second);
  });
}
