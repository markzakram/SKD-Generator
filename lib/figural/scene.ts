import type { Fill, Part, Scene } from '../types';
import { glyph, isShapeG } from './glyphs';

export const TOL = 0.08;
export const round = (value: number, digits = 2) => { const m = 10 ** digits; return Math.round(value * m) / m; };
export const norm = (deg: number) => ((deg % 360) + 360) % 360;
const rad = (deg: number) => deg * Math.PI / 180;
const turn = (x: number, y: number, deg: number): [number, number] => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [round(x * c - y * s), round(x * s + y * c)];
};
const isPoly = (p: Part) => isShapeG(p.g);

export type PartOptions = { s?: number; radius?: number; r?: number; f?: Fill; m?: 1 };
// `radius` menentukan ukuran lewat jari-jari lingkaran luar bentuknya, bukan lewat skala mentah.
export function mk(id: string, g: string, x: number, y: number, o: PartOptions = {}): Part {
  const s = o.radius !== undefined ? o.radius / glyph(g).R : o.s ?? 1;
  return { id, g, x: round(x), y: round(y), s: round(s, 3), r: round(norm(o.r ?? 0), 1), f: o.f ?? 0, ...(o.m ? { m: 1 as const } : {}) };
}
export function polygonPart(id: string, points: [number, number][], x: number, y: number, o: { r?: number; f?: Fill } = {}): Part {
  return { id, g: 'poligon', x: round(x), y: round(y), s: 1, r: round(norm(o.r ?? 0), 1), f: o.f ?? 0, p: points.flatMap(([px, py]) => [round(px), round(py)]) };
}
// Garis terbuka (dengan kepala opsional) atau poligon tertutup yang titiknya relatif terhadap pusat (x, y) bagian itu.
export function strokePart(id: string, closed: boolean, points: [number, number][], x: number, y: number, o: { r?: number; f?: Fill; h?: 1 | 2 } = {}): Part {
  return { id, g: closed ? 'poligon' : 'garis', x: round(x), y: round(y), s: 1, r: round(norm(o.r ?? 0), 1), f: o.f ?? 3, p: points.flatMap(([px, py]) => [round(px, 3), round(py, 3)]), ...(o.h ? { h: o.h } : {}) };
}
export const scene = (parts: Part[]): Scene => ({ parts });
export const clonePart = (p: Part): Part => ({ ...p, ...(p.p ? { p: [...p.p] } : {}) });
export const cloneScene = (s: Scene): Scene => ({ parts: s.parts.map(clonePart) });

// Jari-jari lingkaran luar bagian (setelah diskalakan) dari pusat bagian itu sendiri.
export function partRadius(p: Part): number {
  if (!isPoly(p)) return glyph(p.g).R * p.s;
  const pts = p.p ?? []; let max = 0;
  for (let i = 0; i < pts.length; i += 2) max = Math.max(max, Math.hypot(pts[i], pts[i + 1]));
  return max * p.s;
}
// Titik bentuk berbasis titik pada koordinat gambar tanpa pembulatan (untuk pengukuran dan pembanding putaran).
export function exactPoints(p: Part): [number, number][] {
  const pts = p.p ?? [], out: [number, number][] = [], c = Math.cos(rad(p.r)), s = Math.sin(rad(p.r));
  for (let i = 0; i < pts.length; i += 2) {
    const x = (p.m ? -pts[i] : pts[i]) * p.s, y = pts[i + 1] * p.s;
    out.push([x * c - y * s + p.x, x * s + y * c + p.y]);
  }
  return out;
}
// Jangkauan terjauh dari pusat gambar: tepat untuk bentuk berbasis titik, sedangkan bentuk katalog memakai lingkaran luarnya.
export const reach = (p: Part) => isPoly(p) ? Math.max(0, ...exactPoints(p).map(([x, y]) => Math.hypot(x, y))) : Math.hypot(p.x, p.y) + partRadius(p);
// Orde simetri putar: 0 = bulat sempurna (arah tidak terbaca).
const order = (p: Part) => isPoly(p) ? 1 : glyph(p.g).k;
export const period = (p: Part) => { const k = order(p); return k === 0 ? 0 : 360 / k; };
export function orientation(p: Part): number {
  const P = period(p);
  if (!P) return 0;
  const v = ((p.r % P) + P) % P;
  return v < 0.05 || v > P - 0.05 ? 0 : round(v, 1);
}
export const mirrored = (p: Part) => (isPoly(p) || glyph(p.g).chiral) && p.m ? 1 : 0;

// Titik poligon di koordinat gambar (setelah skala, cermin, putaran, dan geser).
export function worldPoints(p: Part): [number, number][] {
  const pts = p.p ?? [], out: [number, number][] = [];
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = turn((p.m ? -pts[i] : pts[i]) * p.s, pts[i + 1] * p.s, p.r);
    out.push([round(x + p.x), round(y + p.y)]);
  }
  return out;
}
function samePolygon(a: Part, b: Part, tol: number): boolean {
  const A = worldPoints(a), B = worldPoints(b), n = A.length, open = a.g === 'garis';
  if (n !== B.length || !n || a.g !== b.g || (a.h ?? 0) !== (b.h ?? 0)) return false;
  // Garis terbuka tanpa kepala sama bila ditelusuri dari ujung lain; yang berkepala hanya sama bila searah. Poligon tertutup boleh mulai dari sudut mana pun.
  for (const direction of open ? (a.h ? [1] : [1, -1]) : [1, -1]) for (let shift = 0; shift < (open ? 1 : n); shift++) {
    let ok = true;
    for (let i = 0; i < n && ok; i++) {
      const q = open && direction === -1 ? B[n - 1 - i] : B[((direction * i + shift) % n + n) % n];
      ok = Math.abs(A[i][0] - q[0]) <= tol * 2 && Math.abs(A[i][1] - q[1]) <= tol * 2;
    }
    if (ok) return true;
  }
  return false;
}
// Kunci ciri sebuah bagian tanpa letak: bentuk, isi, ukuran, arah, dan cermin (bila bentuknya kiral).
export const partKey = (p: Part) => [p.g, p.f, round(p.s, 2).toFixed(2), isPoly(p) ? (p.p?.length ?? 0) + (p.h ? 'h' + p.h : '') : orientation(p), isPoly(p) ? 0 : mirrored(p)].join('|');
const near = (a: Part, b: Part, tol: number) => isPoly(a) ? samePolygon(a, b, tol) : Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;

export function sameScene(a: Scene, b: Scene, tol = TOL): boolean {
  if (a.parts.length !== b.parts.length) return false;
  const left = a.parts.map((p) => ({ p, key: partKey(p) })), right = b.parts.map((p) => ({ p, key: partKey(p) })), used = new Array(right.length).fill(false);
  const match = (i: number): boolean => {
    if (i === left.length) return true;
    for (let j = 0; j < right.length; j++) {
      if (used[j] || left[i].key !== right[j].key || !near(left[i].p, right[j].p, tol)) continue;
      used[j] = true;
      if (match(i + 1)) return true;
      used[j] = false;
    }
    return false;
  };
  return match(0);
}
// Sidik gambar untuk deteksi soal kembar: murni dari bentuknya, tidak bergantung pada nama peran.
export function sceneSignature(s: Scene): string {
  return s.parts.map((p) => partKey(p) + '@' + (isPoly(p) ? worldPoints(p).map(([x, y]) => Math.round(x) + '.' + Math.round(y)).sort().join('_') : Math.round(p.x) + ',' + Math.round(p.y))).sort().join(';');
}

// --------------------------------------------------------------- transformasi
export function rotatePart(p: Part, deg: number): Part {
  const [x, y] = turn(p.x, p.y, deg);
  return { ...clonePart(p), x, y, r: round(norm(p.r + deg), 1) };
}
export const rotateScene = (s: Scene, deg: number): Scene => ({ parts: s.parts.map((p) => rotatePart(p, deg)) });
// Cermin terhadap sumbu tegak (x menjadi -x). Putaran bagian ikut berbalik arah.
export function flipPart(p: Part): Part {
  const q = clonePart(p);
  q.x = round(-p.x); q.r = round(norm(-p.r), 1);
  if (p.m) delete q.m; else q.m = 1;
  return q;
}
export const flipScene = (s: Scene): Scene => ({ parts: s.parts.map(flipPart) });
export const mapScene = (s: Scene, change: (p: Part) => Part): Scene => ({ parts: s.parts.map((p) => change(clonePart(p))) });
export const withPart = (s: Scene, id: string, change: (p: Part) => Part): Scene => ({ parts: s.parts.map((p) => p.id === id ? change(clonePart(p)) : clonePart(p)) });
export const without = (s: Scene, id: string): Scene => ({ parts: s.parts.filter((p) => p.id !== id).map(clonePart) });
export const find = (s: Scene, id: string) => s.parts.find((p) => p.id === id);
export const isGroup = (id: string) => id.includes('@');
export const groupOf = (id: string) => id.slice(0, id.indexOf('@'));

// Semua sudut putar searah jarum jam yang memetakan a ke b (kosong bila b bukan putaran a). Calonnya lengkap secara geometri:
// titik terjauh a pasti jatuh pada salah satu titik b yang sama jauhnya dari pusat, lalu setiap calon diuji sampai ke bagian terkecil.
function rotationSearch(a: Scene, b: Scene, all: boolean): number[] {
  if (a.parts.length !== b.parts.length) return [];
  if (!a.parts.length) return [0];
  const anchors = (s: Scene): [number, number][] => s.parts.flatMap((p) => isPoly(p) ? exactPoints(p) : [[p.x, p.y] as [number, number]]);
  const A = anchors(a), B = anchors(b), radius = (q: [number, number]) => Math.hypot(q[0], q[1]);
  const far = A.reduce((best, q) => radius(q) > radius(best) ? q : best), reachA = radius(far), raw: number[] = [];
  if (reachA > 1) {
    for (const q of B) if (Math.abs(radius(q) - reachA) < 0.3) raw.push(norm((Math.atan2(q[1], q[0]) - Math.atan2(far[1], far[0])) * 180 / Math.PI));
  } else {
    // Semua titik berada di pusat: arah hanya terbaca dari putaran bagian itu sendiri.
    const ref = a.parts[0], loose = (p: Part) => [p.g, p.f, round(p.s, 2)].join('|');
    for (const q of b.parts) {
      if (loose(q) !== loose(ref) || mirrored(q) !== mirrored(ref)) continue;
      const P = period(ref);
      if (!P) raw.push(0); else for (let shift = 0; shift < 360; shift += P) raw.push(norm(q.r - ref.r + shift));
    }
  }
  const found: number[] = [], seen: number[] = [];
  for (const angle of raw) {
    if (seen.some((x) => Math.min(Math.abs(x - angle), 360 - Math.abs(x - angle)) < 0.05)) continue;
    seen.push(angle);
    const theta = Math.abs(angle - Math.round(angle)) < 0.05 ? Math.round(angle) : angle;
    if (sameScene(rotateScene(a, theta), b)) { found.push(norm(theta)); if (!all) break; }
  }
  return found;
}
export const rotationAngles = (a: Scene, b: Scene) => rotationSearch(a, b, true);
// Sudut putar searah jarum jam yang memetakan a ke b, atau null bila b bukan putaran a.
export function rotationBetween(a: Scene, b: Scene): number | null {
  const found = rotationSearch(a, b, false);
  return found.length ? found[0] : null;
}
// Apakah b adalah bayangan cermin dari putaran a (dan bukan putaran murni)?
export const mirrorRotationBetween = (a: Scene, b: Scene) => rotationBetween(flipScene(a), b);

// ------------------------------------------------------------------- selisih
export type Diff = { id: string; aspek: 'hilang' | 'tambah' | 'bentuk' | 'isi' | 'ukuran' | 'arah' | 'cermin' | 'letak' | 'jumlah'; dari?: number | string; ke?: number | string };
// Selisih arah terkecil dari `a` ke `b` memperhitungkan orde simetri bentuknya.
export function turnBetween(p: Part, q: Part): number {
  const P = period(p) || 360;
  let d = ((q.r - p.r) % P + P) % P;
  if (d > P / 2) d -= P;
  return round(d, 1);
}
export function diffScenes(expected: Scene, actual: Scene): Diff[] {
  const out: Diff[] = [], groups = new Map<string, [Part[], Part[]]>();
  const solo = (s: Scene) => new Map(s.parts.filter((p) => !isGroup(p.id)).map((p) => [p.id, p]));
  for (const [side, s] of [[0, expected], [1, actual]] as const) for (const p of s.parts) if (isGroup(p.id)) {
    const key = groupOf(p.id), entry = groups.get(key) ?? [[], []];
    entry[side].push(p); groups.set(key, entry);
  }
  const e = solo(expected), a = solo(actual);
  for (const [id, p] of e) {
    const q = a.get(id);
    if (!q) { out.push({ id, aspek: 'hilang' }); continue; }
    if (p.g !== q.g) { out.push({ id, aspek: 'bentuk', dari: p.g, ke: q.g }); continue; }
    if (p.f !== q.f) out.push({ id, aspek: 'isi', dari: p.f, ke: q.f });
    if (Math.abs(p.s - q.s) > 0.02) out.push({ id, aspek: 'ukuran', dari: p.s, ke: q.s });
    if (Math.hypot(p.x - q.x, p.y - q.y) > TOL * 2) out.push({ id, aspek: 'letak', dari: p.x + ',' + p.y, ke: q.x + ',' + q.y });
    if (orientation(p) !== orientation(q)) out.push({ id, aspek: 'arah', dari: p.r, ke: turnBetween(p, q) });
    if (mirrored(p) !== mirrored(q)) out.push({ id, aspek: 'cermin' });
  }
  for (const id of a.keys()) if (!e.has(id)) out.push({ id, aspek: 'tambah' });
  for (const [name, [ex, ac]] of groups) {
    if (ex.length !== ac.length) out.push({ id: name + '@', aspek: 'jumlah', dari: ex.length, ke: ac.length });
    else if (ex.length && (ex[0].g !== ac[0].g || ex[0].f !== ac[0].f)) out.push({ id: name + '@', aspek: ex[0].g !== ac[0].g ? 'bentuk' : 'isi', dari: ex[0].g !== ac[0].g ? ex[0].g : ex[0].f, ke: ex[0].g !== ac[0].g ? ac[0].g : ac[0].f });
  }
  return out;
}
