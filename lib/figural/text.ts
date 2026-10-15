import type { Part, Scene } from '../types';
import { glyph, isShapeG } from './glyphs';
import { diffScenes, find, groupOf, isGroup, mirrorRotationBetween, norm, orientation, period, rotationBetween, round, turnBetween } from './scene';

export const FILL_WORD = ['putih', 'abu-abu', 'hitam', 'tanpa isi'];
export const fillWord = (f: number) => FILL_WORD[f] ?? 'putih';
export const glyphName = (g: string) => g === 'poligon' ? 'bangun segi banyak' : g === 'garis' ? 'garis' : glyph(g).nama;
export const listText = (items: string[]) => items.length <= 1 ? items.join('') : items.length === 2 ? items.join(' dan ') : items.slice(0, -1).join(', ') + ', dan ' + items[items.length - 1];
const DIRS = ['atas', 'kanan atas', 'kanan', 'kanan bawah', 'bawah', 'kiri bawah', 'kiri', 'kiri atas'];
// Arah mata angin dari sudut (0 = atas, searah jarum jam).
export const dirWord = (deg: number) => DIRS[Math.round(norm(deg) / 45) % 8];
export const dirOfPoint = (x: number, y: number) => Math.hypot(x, y) < 3 ? 'tengah' : dirWord(Math.atan2(x, -y) * 180 / Math.PI);
export const turnWord = (deg: number) => {
  const v = round(Math.abs(deg), 1);
  return v + '° ' + (deg >= 0 ? 'searah' : 'berlawanan arah') + ' jarum jam';
};
// Kalimat arah hadap sebuah bagian, hanya untuk bentuk yang punya hadap alami (panah, bulan sabit, dan sejenisnya).
export function facing(p: Part): string | null {
  if (isShapeG(p.g)) return null;
  const g = glyph(p.g);
  if (!g.hadap || p.m) return null;
  const deg = p.r, aligned = Math.abs(deg / 45 - Math.round(deg / 45)) < 0.01;
  return g.hadap + ' ' + (aligned ? dirWord(deg) : round(norm(deg), 0) + '° dari atas searah jarum jam');
}
// Nama sebuah bagian untuk pembahasan: peran + bentuknya pada gambar yang dimaksud.
export type Namer = (id: string, scene: Scene) => string;
export const ROLES: Record<string, string> = {
  rangka: 'bangun pembingkai', inti: 'bangun di tengah', penanda: 'bangun kecil', satelit: 'bangun kecil yang mengelilingi pusat', batang: 'batang',
  titik: 'bulatan kecil di sudut', panah: 'panah kecil', sudut: 'bangun di sudut',
};
export const makeNamer = (roles: Record<string, string> = {}): Namer => (id, scene) => {
  const key = isGroup(id) ? groupOf(id) : id, p = find(scene, id) ?? scene.parts.find((q) => isGroup(q.id) && groupOf(q.id) === key);
  const base = roles[key] ?? ROLES[key] ?? key;
  // Nama bentuk ditambahkan hanya bila peran belum menyebutnya.
  return p && !base.includes(glyphName(p.g)) ? base + ' (' + glyphName(p.g) + ')' : base;
};

// Uraian selisih konkret antara gambar yang benar dan sebuah pengecoh, dari geometri keduanya.
export function describeDiff(key: Scene, wrong: Scene, name: Namer): string {
  const whole = rotationBetween(key, wrong);
  if (whole !== null && whole !== 0) return 'seluruh gambar berputar ' + turnWord(whole > 180 ? whole - 360 : whole) + ' dari kedudukan yang benar';
  if (mirrorRotationBetween(key, wrong) !== null) return 'gambar ini merupakan bayangan cermin dari gambar yang benar';
  // Bagian yang berpindah mengelilingi pusat ikut berputar; putaran itu bukan selisih tersendiri bagi pembaca.
  const diffs = diffScenes(key, wrong), moved = new Set(diffs.filter((d) => d.aspek === 'letak').map((d) => d.id));
  const items = diffs.filter((d) => {
    if (d.aspek !== 'arah' || !moved.has(d.id)) return true;
    const p = key.parts.find((q) => q.id === d.id)!, q = wrong.parts.find((x) => x.id === d.id)!;
    const shift = norm((Math.atan2(q.y, q.x) - Math.atan2(p.y, p.x)) * 180 / Math.PI), P = period(p) || 360;
    const gap = Math.abs(((Number(d.ke) - shift) % P + P) % P);
    return Math.min(gap, P - gap) > 1;
  }).map((d) => {
    const label = name(d.id, key), now = wrong.parts.find((p) => p.id === d.id), was = key.parts.find((p) => p.id === d.id);
    switch (d.aspek) {
      case 'hilang': return label + ' tidak ada';
      case 'tambah': return 'ada ' + name(d.id, wrong) + ' tambahan';
      case 'bentuk': return d.id.endsWith('@') ? 'bentuk ' + label + ' diganti menjadi ' + glyphName(String(d.ke)) : label + ' berganti menjadi ' + glyphName(String(d.ke));
      case 'isi': return label + ' berwarna ' + fillWord(Number(d.ke)) + ', seharusnya ' + fillWord(Number(d.dari));
      case 'ukuran': return label + ' tampil lebih ' + (Number(d.ke) > Number(d.dari) ? 'besar' : 'kecil') + ' daripada seharusnya';
      case 'arah': return label + ' berputar ' + turnWord(Number(d.ke)) + ' dari kedudukan yang benar';
      case 'cermin': return label + ' tercermin';
      case 'letak': {
        const dx = now!.x - was!.x, dy = now!.y - was!.y, from = dirOfPoint(was!.x, was!.y), to = dirOfPoint(now!.x, now!.y);
        // Bila kedua letak masuk arah mata angin yang sama, selisihnya disebut sebagai pergeseran, bukan "di X, seharusnya di X".
        return from === to ? label + ' bergeser sekitar ' + Math.max(1, Math.round(Math.hypot(dx, dy))) + ' satuan ke ' + dirWord(Math.atan2(dx, -dy) * 180 / Math.PI) : label + ' berada di ' + to + ', seharusnya di ' + from;
      }
      case 'jumlah': return 'jumlah ' + label + ' ada ' + d.ke + ', seharusnya ' + d.dari;
    }
  });
  return listText(items);
}
// Uraian singkat isi sebuah gambar: tiap bagian beserta warna dan arah hadapnya; kelompok berhitung disebut jumlahnya.
export function describeScene(s: Scene, name: Namer): string {
  const items: string[] = [], seen = new Set<string>();
  for (const p of s.parts) {
    if (isGroup(p.id)) {
      const group = groupOf(p.id);
      if (seen.has(group)) continue;
      seen.add(group);
      items.push(s.parts.filter((q) => isGroup(q.id) && groupOf(q.id) === group).length + ' ' + name(p.id, s) + (p.f < 3 ? ' berwarna ' + fillWord(p.f) : ''));
      continue;
    }
    const face = facing(p);
    items.push(name(p.id, s) + (face ? ' ' + face : '') + (p.f < 3 && p.id !== 'rangka' ? ' berwarna ' + fillWord(p.f) : ''));
  }
  return listText(items);
}
export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export { orientation, turnBetween };
