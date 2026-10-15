import type { Part, Scene } from '../types';
import { glyph, isShapeG } from './glyphs';
import { clonePart, flipScene, find, mirrored, norm, orientation, partRadius, rotatePart, rotateScene, round, sameScene, TOL, turnBetween } from './scene';

// Perubahan yang membentuk hubungan "gambar 1 : gambar 2" pada soal analogi.
export type Op =
  | { op: 'putar'; deg: number } // seluruh gambar diputar (searah jarum jam bila positif)
  | { op: 'cermin' } // seluruh gambar dicerminkan terhadap sumbu tegak
  | { op: 'inversi' } // warna putih dan hitam seluruh bagian (kecuali rangka) saling berbalik
  | { op: 'isi'; id: string; mode: 'balik' | 'naik' | 'turun' | 'atur'; f?: number }
  | { op: 'hapus'; id: string }
  | { op: 'tambah'; part: Part }
  | { op: 'skala'; id: string; faktor?: number; radius?: number } // faktor = pengali ukuran; radius = ukuran mutlak (jari-jari lingkaran luar)
  | { op: 'geser'; id: string; deg: number } // satu bagian berpindah mengelilingi pusat gambar
  | { op: 'putarSendiri'; id: string; deg?: number; r?: number }
  | { op: 'tukar'; a: string; b: string }; // dua bagian bertukar tempat

export const isFrame = (id: string) => id.startsWith('rangka');
export const invert = (f: number) => f === 0 ? 2 : f === 2 ? 0 : f;
const nextFill = (f: number, d: number) => f > 2 ? f : (f + d + 3) % 3;
export function applyOp(scene: Scene, op: Op): Scene | null {
  const need = (id: string) => find(scene, id);
  switch (op.op) {
    case 'putar': return rotateScene(scene, op.deg);
    case 'cermin': return flipScene(scene);
    case 'inversi': return { parts: scene.parts.map((p) => ({ ...clonePart(p), f: isFrame(p.id) ? p.f : invert(p.f) as Part['f'] })) };
    case 'hapus': return need(op.id) ? { parts: scene.parts.filter((p) => p.id !== op.id).map(clonePart) } : null;
    case 'tambah': return need(op.part.id) ? null : { parts: [...scene.parts.map(clonePart), clonePart(op.part)] };
    case 'isi': {
      const p = need(op.id); if (!p) return null;
      const f = op.mode === 'atur' ? op.f! : op.mode === 'balik' ? invert(p.f) : nextFill(p.f, op.mode === 'naik' ? 1 : -1);
      return { parts: scene.parts.map((q) => q.id === op.id ? { ...clonePart(q), f: f as Part['f'] } : clonePart(q)) };
    }
    case 'skala': {
      const p = need(op.id); if (!p) return null;
      return { parts: scene.parts.map((q) => q.id === op.id ? { ...clonePart(q), s: round(op.radius !== undefined && !isShapeG(q.g) ? op.radius / glyph(q.g).R : q.s * (op.faktor ?? 1), 3) } : clonePart(q)) };
    }
    case 'geser': { const p = need(op.id); return p ? { parts: scene.parts.map((q) => q.id === op.id ? rotatePart(q, op.deg) : clonePart(q)) } : null; }
    case 'putarSendiri': {
      const p = need(op.id); if (!p) return null;
      return { parts: scene.parts.map((q) => q.id === op.id ? { ...clonePart(q), r: round(norm(op.r ?? q.r + op.deg!), 1) } : clonePart(q)) };
    }
    case 'tukar': {
      const a = need(op.a), b = need(op.b); if (!a || !b) return null;
      return { parts: scene.parts.map((q) => q.id === op.a ? { ...clonePart(q), x: b.x, y: b.y } : q.id === op.b ? { ...clonePart(q), x: a.x, y: a.y } : clonePart(q)) };
    }
  }
}
export function applyOps(scene: Scene, ops: Op[]): Scene | null {
  let out: Scene | null = scene;
  for (const op of ops) { out = out && applyOp(out, op); if (!out) return null; }
  return out;
}

// -------------------------------------------------- penjelasan A -> B (untuk validator)
export type Explanation = { fixed: Op[]; residual: Op[][]; n: number };
const GLOBALS: { flip: boolean; rot: number; inv: boolean }[] = [];
for (const flip of [false, true]) for (const inv of [false, true]) for (let k = 0; k < 8; k++) GLOBALS.push({ flip, inv, rot: k * 45 });
const globalOps = (g: { flip: boolean; rot: number; inv: boolean }): Op[] => [...(g.flip ? [{ op: 'cermin' } as Op] : []), ...(g.rot ? [{ op: 'putar', deg: g.rot } as Op] : []), ...(g.inv ? [{ op: 'inversi' } as Op] : [])];

// Selisih sisa antara a (sesudah perubahan global) dan b. Mengembalikan daftar langkah, tiap langkah berisi tafsir alternatif.
function residual(a: Scene, b: Scene): Op[][] | null {
  const out: Op[][] = [], inB = new Map(b.parts.map((p) => [p.id, p]));
  // Dua bagian yang saling bertukar tempat dikenali lebih dulu: itu satu langkah, bukan dua perpindahan.
  const shifted = a.parts.filter((p) => { const q = inB.get(p.id); return q && Math.hypot(p.x - q.x, p.y - q.y) > TOL * 2; });
  let swapped: Part[] = [];
  for (let i = 0; i < shifted.length && !swapped.length; i++) for (let j = i + 1; j < shifted.length && !swapped.length; j++) {
    const p1 = shifted[i], p2 = shifted[j], q1 = inB.get(p1.id)!, q2 = inB.get(p2.id)!;
    if (Math.hypot(q1.x - p2.x, q1.y - p2.y) <= TOL * 2 && Math.hypot(q2.x - p1.x, q2.y - p1.y) <= TOL * 2 && orientation(p1) === orientation(q1) && orientation(p2) === orientation(q2)) swapped = [p1, p2];
  }
  for (const p of a.parts) {
    const q = inB.get(p.id);
    if (!q) { out.push([{ op: 'hapus', id: p.id }]); continue; }
    if (p.g !== q.g || mirrored(p) !== mirrored(q)) return null;
    if (Math.abs(p.s - q.s) > 0.02) out.push([{ op: 'skala', id: p.id, faktor: round(q.s / p.s, 3) }, { op: 'skala', id: p.id, radius: round(partRadius(q), 2) }]);
    if (p.f !== q.f) {
      const modes: Op[] = [];
      if (p.f < 3 && q.f < 3) {
        if (p.f !== 1 && q.f === invert(p.f)) modes.push({ op: 'isi', id: p.id, mode: 'balik' });
        if (q.f === (p.f + 1) % 3) modes.push({ op: 'isi', id: p.id, mode: 'naik' });
        if (q.f === (p.f + 2) % 3) modes.push({ op: 'isi', id: p.id, mode: 'turun' });
      }
      modes.push({ op: 'isi', id: p.id, mode: 'atur', f: q.f });
      out.push(modes);
    }
    if (swapped.some((x) => x.id === p.id)) continue;
    const shift = Math.hypot(p.x - q.x, p.y - q.y), turn = turnBetween(p, q);
    if (shift <= TOL * 2) { if (orientation(p) !== orientation(q)) out.push([{ op: 'putarSendiri', id: p.id, deg: turn }, { op: 'putarSendiri', id: p.id, r: q.r }]); continue; }
    const step = Math.round(norm((Math.atan2(q.y, q.x) - Math.atan2(p.y, p.x)) * 180 / Math.PI) / 15) * 15 % 360;
    if (step && Math.hypot(p.x, p.y) > 0.5) {
      const turned = rotatePart(p, step);
      if (Math.hypot(turned.x - q.x, turned.y - q.y) <= TOL * 2 && orientation(turned) === orientation(q)) { out.push([{ op: 'geser', id: p.id, deg: step }]); continue; }
    }
    return null;
  }
  for (const q of b.parts) if (!a.parts.some((p) => p.id === q.id)) out.push([{ op: 'tambah', part: clonePart(q) }]);
  if (swapped.length) out.push([{ op: 'tukar', a: swapped[0].id, b: swapped[1].id }]);
  return out;
}
export function explain(a: Scene, b: Scene, limit = 3): Explanation[] {
  const found: Explanation[] = [];
  for (const g of GLOBALS) {
    const fixed = globalOps(g), moved = applyOps(a, fixed);
    if (!moved) continue;
    const rest = residual(moved, b);
    if (rest && fixed.length + rest.length <= limit) found.push({ fixed, residual: rest, n: fixed.length + rest.length });
  }
  const best = Math.min(...found.map((e) => e.n));
  return found.filter((e) => e.n === best);
}
// Semua hasil penerapan penjelasan terminimal pada gambar ketiga, menelusuri seluruh tafsir alternatif.
export function predictAll(c: Scene, explanations: Explanation[]): { scenes: Scene[]; blocked: number } {
  const scenes: Scene[] = []; let blocked = 0;
  for (const e of explanations) {
    let lists: Op[][] = [e.fixed];
    for (const options of e.residual) lists = lists.flatMap((ops) => options.map((op) => [...ops, op]));
    for (const ops of lists) { const out = applyOps(c, ops); if (out) scenes.push(out); else blocked++; }
  }
  return { scenes, blocked };
}
export const uniqueScenes = (scenes: Scene[]) => scenes.reduce<Scene[]>((all, s) => all.some((x) => sameScene(x, s)) ? all : [...all, s], []);
