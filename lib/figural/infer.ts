import type { Part, Scene } from '../types';
import { glyph, isShapeG } from './glyphs';
import { distinct, equal, fitGrid, fitSequence, type Cells, type Fit, type Spec } from './hyp';
import { groupOf, isGroup, mirrored, norm, orientation, partRadius, round } from './scene';

// Ringkasan ciri satu entitas (bagian tunggal, atau kelompok bagian sejenis "nama@nomor") pada satu gambar.
export type Asp = { g: string; f: number; r: number; raw: number; m: number; x: number; y: number; s: number; n: number };
export type Read = { ents: Map<string, Asp>; errors: string[] };
// Ukuran dicatat sebagai jari-jari lingkaran luar supaya tetap sama ketika bentuknya berganti.
const aspOf = (p: Part, n: number): Asp => ({ g: p.g, f: p.f, r: orientation(p), raw: p.r, m: mirrored(p), x: p.x, y: p.y, s: round(partRadius(p), 1), n });
export const periodOf = (g: string) => isShapeG(g) ? 360 : glyph(g).k === 0 ? 0 : 360 / glyph(g).k;
const canon = (g: string, r: number) => { const P = periodOf(g); if (!P) return 0; const v = ((r % P) + P) % P; return v < 0.05 || v > P - 0.05 ? 0 : round(v, 1); };

export function readScene(scene: Scene): Read {
  const ents = new Map<string, Asp>(), errors: string[] = [], groups = new Map<string, Part[]>(), ids = new Set<string>();
  for (const p of scene.parts) {
    if (ids.has(p.id)) errors.push('nama bagian berulang: ' + p.id);
    ids.add(p.id);
    if (isGroup(p.id)) { const key = groupOf(p.id); groups.set(key, [...(groups.get(key) ?? []), p]); continue; }
    ents.set(p.id, aspOf(p, 1));
  }
  for (const [key, items] of groups) {
    const first = items[0], numbers = items.map((p) => Number(p.id.slice(p.id.indexOf('@') + 1))).sort((a, b) => a - b);
    if (items.some((p) => p.g !== first.g || p.f !== first.f || Math.abs(partRadius(p) - partRadius(first)) > 0.1 || orientation(p) !== orientation(first))) errors.push('kelompok ' + key + ' tidak seragam');
    if (numbers.some((v, i) => v !== i + 1)) errors.push('nomor kelompok ' + key + ' harus berurutan mulai dari 1');
    ents.set(key + '@', aspOf(first, items.length));
  }
  return { ents, errors };
}

export type Topology = 'seq' | 'grid';
export type Inferred = { pred: Map<string, Asp | null>; errors: string[]; changes: string[]; varying: number };
type Ctx = { fit: <V>(values: Cells<V>, spec: Spec) => Fit<V>[]; errors: string[]; hidden: number; varying: { count: number } };
const close = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.4;

function settle<V>(ctx: Ctx, label: string, values: Cells<V>, spec: Spec): V | undefined {
  const seen = values.filter((v) => v !== undefined);
  if (seen.length > 1 && seen.some((v) => !equal(v as V, seen[0] as V, spec))) ctx.varying.count++;
  const groups = distinct(ctx.fit(values, spec), spec);
  if (!groups.length) { ctx.errors.push('aturan ' + label + ' tidak dapat dibuktikan dari stimulus'); return undefined; }
  if (groups.length > 1) { ctx.errors.push('aturan ' + label + ' ambigu (' + groups.map((g) => g.nama + ' meramalkan ' + String(g.pred)).join('; ') + ')'); return undefined; }
  return groups[0].pred;
}
// Letak diselesaikan lewat dua model: bergeser lurus (x, y) atau mengelilingi pusat (jari-jari tetap, sudut berubah).
function settlePosition(ctx: Ctx, key: string, asps: (Asp | undefined)[]): [number, number] | undefined {
  const seen = asps.filter((a): a is Asp => a !== undefined), candidates: [number, number][] = [], num: Spec = { kind: 'num' };
  if (seen.some((a) => Math.hypot(a.x - seen[0].x, a.y - seen[0].y) > 0.4)) ctx.varying.count++;
  const fx = distinct(ctx.fit(asps.map((a) => a?.x), num), num), fy = distinct(ctx.fit(asps.map((a) => a?.y), num), num);
  for (const x of fx) for (const y of fy) candidates.push([x.pred, y.pred]);
  const radius = seen.map((a) => Math.hypot(a.x, a.y));
  if (radius[0] > 0.5 && radius.every((v) => Math.abs(v - radius[0]) < 0.35)) {
    const spec: Spec = { kind: 'angle', mod: 360 }, angles = asps.map((a) => a ? norm(Math.atan2(a.y, a.x) * 180 / Math.PI) : undefined);
    for (const fit of distinct(ctx.fit(angles, spec), spec)) candidates.push([round(radius[0] * Math.cos(fit.pred * Math.PI / 180)), round(radius[0] * Math.sin(fit.pred * Math.PI / 180))]);
  }
  const unique: [number, number][] = [];
  for (const c of candidates) if (!unique.some((u) => close(u, c))) unique.push(c);
  if (!unique.length) { ctx.errors.push('aturan ' + key + ' (letak) tidak dapat dibuktikan dari stimulus'); return undefined; }
  if (unique.length > 1) { ctx.errors.push('aturan ' + key + ' (letak) ambigu (' + unique.map((u) => u.join(',')).join(' atau ') + ')'); return undefined; }
  return unique[0];
}
function settleEntity(ctx: Ctx, key: string, asps: (Asp | undefined)[]): Asp | undefined {
  const seen = asps.filter((a): a is Asp => a !== undefined);
  if (!seen.length) return undefined;
  const g = settle(ctx, key + ' (bentuk)', asps.map((a) => a?.g), { kind: 'cat' });
  const f = settle(ctx, key + ' (isi)', asps.map((a) => a?.f), seen.every((a) => a.f < 3) ? { kind: 'num', mod: 3 } : { kind: 'cat' });
  const m = settle(ctx, key + ' (cermin)', asps.map((a) => a?.m), { kind: 'cat' });
  const s = settle(ctx, key + ' (ukuran)', asps.map((a) => a?.s), { kind: 'cat' });
  const sameGlyph = new Set(seen.map((a) => a.g)).size === 1, P = sameGlyph ? periodOf(seen[0].g) : 360;
  const r = sameGlyph && !P ? 0 : settle(ctx, key + ' (arah)', asps.map((a) => a ? (sameGlyph ? a.r : a.raw) : undefined), { kind: 'angle', mod: P || 360 });
  const pos = key.endsWith('@') ? [0, 0] as [number, number] : settlePosition(ctx, key, asps);
  if (g === undefined || f === undefined || m === undefined || s === undefined || r === undefined || !pos) return undefined;
  return { g, f, m, s, r: canon(g, r), raw: r, x: pos[0], y: pos[1], n: 1 };
}

// Menyimpulkan ciri setiap entitas pada kotak tersembunyi dari kotak-kotak yang tampak.
// Bila ada lebih dari satu aturan cocok dengan prediksi berbeda, hal itu dicatat sebagai ambiguitas.
export function inferHidden(cells: (Scene | null)[], hidden: number, topology: Topology): Inferred {
  const reads = cells.map((c) => c ? readScene(c) : null), errors = reads.flatMap((r) => r ? r.errors : []), changes: string[] = [];
  const keys = [...new Set(reads.flatMap((r) => r ? [...r.ents.keys()] : []))].sort(), pred = new Map<string, Asp | null>();
  const ctx: Ctx = { fit: (values, spec) => topology === 'seq' ? fitSequence(values, hidden, spec) : fitGrid(values, hidden, spec), errors, hidden, varying: { count: 0 } };
  const boolSpec: Spec = { kind: 'bool' };
  // Aturan menumpuk berlaku untuk seluruh gambar sekaligus: operasi yang dipakai harus cocok bagi semua bagian yang berubah.
  const presence = new Map<string, Cells<boolean>>(), allowed = new Map<string, Set<string>>();
  for (const key of keys) if (!key.endsWith('@')) presence.set(key, reads.map((r, i) => r ? r.ents.has(key) : undefined) as Cells<boolean>);
  let common = null as Set<string> | null;
  if (topology === 'grid') {
    for (const [key, values] of presence) {
      const known = values.filter((v) => v !== undefined);
      if (known.every((v) => v === known[0])) continue;
      const names = new Set(ctx.fit(values, boolSpec).filter((f) => f.nama.startsWith('kolom ketiga') || f.nama.startsWith('baris ketiga')).map((f) => f.nama));
      if (!names.size) continue; // tidak bisa dijelaskan sebagai tumpukan; biarkan aturan lain yang menilainya
      common = common ? new Set([...common].filter((n) => names.has(n))) : names;
      allowed.set(key, names);
    }
    if (common && !common.size) errors.push('aturan menumpuk gambar tidak konsisten pada semua bagian');
  }
  for (const key of keys) {
    const asps = reads.map((r) => r ? r.ents.get(key) : undefined);
    if (key.endsWith('@')) {
      const counts = asps.map((a, i) => reads[i] ? a?.n ?? 0 : undefined), count = settle(ctx, key + ' (jumlah)', counts, { kind: 'count' });
      if (count === undefined) continue;
      if (new Set(counts.filter((v) => v !== undefined)).size > 1) changes.push(key);
      const out = settleEntity(ctx, key, asps.map((a) => a && a.n > 0 ? a : undefined));
      if (count <= 0) pred.set(key, null); // tidak tampil pada kotak tersembunyi, tetapi ciri-cirinya tetap harus beraturan
      else if (out) pred.set(key, { ...out, n: count });
      continue;
    }
    // Bagian yang bisa dijelaskan sebagai tumpukan dinilai hanya oleh operasi tumpukan yang sama untuk semua bagian; bagian yang
    // kebetulan tampil pada satu baris saja tidak boleh ditafsirkan dengan aturan lain ("tetap per baris").
    const values = presence.get(key)!, restricted: Ctx = common && allowed.has(key) ? { ...ctx, fit: (v, spec) => ctx.fit(v, spec).filter((f) => common!.has(f.nama)) } : ctx;
    const alive = settle(restricted, key + ' (kemunculan)', values, boolSpec);
    if (alive === undefined) continue;
    if (values.some((v) => v === false)) changes.push(key);
    const out = settleEntity(ctx, key, asps);
    if (!alive) pred.set(key, null);
    else if (out) pred.set(key, out);
  }
  return { pred, errors, changes, varying: ctx.varying.count };
}

export function matchPrediction(read: Read, pred: Map<string, Asp | null>): string[] {
  const out: string[] = [];
  for (const [key, expected] of pred) {
    const actual = read.ents.get(key);
    if (!expected) { if (actual) out.push(key + ' seharusnya tidak ada'); continue; }
    if (!actual) { out.push(key + ' hilang'); continue; }
    if (actual.g !== expected.g) out.push(key + ' bentuk');
    if (actual.f !== expected.f) out.push(key + ' isi');
    if (actual.m !== expected.m) out.push(key + ' cermin');
    if (Math.abs(actual.s - expected.s) > 0.25) out.push(key + ' ukuran');
    if (actual.n !== expected.n) out.push(key + ' jumlah');
    const P = periodOf(actual.g);
    if (P) { const d = Math.abs(actual.r - expected.r); if (Math.min(d, P - d) > 0.06) out.push(key + ' arah'); }
    if (!key.endsWith('@') && Math.hypot(actual.x - expected.x, actual.y - expected.y) > 0.4) out.push(key + ' letak');
  }
  for (const key of read.ents.keys()) if (!pred.has(key)) out.push(key + ' tidak diramalkan');
  return out;
}
