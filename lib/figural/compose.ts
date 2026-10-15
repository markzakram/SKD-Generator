import type { Rng } from '../rng';
import type { Difficulty, Fill, FiguralRule, Part, Scene, Visual } from '../types';
import { glyph, isShapeG } from './glyphs';
import { describeDiff, type Namer } from './text';
import { mk, partRadius, reach, round, sameScene, scene } from './scene';

// Hasil satu penyusunan soal figural sebelum dijadikan butir soal.
export type Built = {
  kind: Visual['kind'];
  columns: number;
  scenes: (Scene | null)[];
  key: Scene;
  wrong: { scene: Scene; rule: string }[]; // empat pengecoh, masing-masing dengan kalimat aturan yang dilanggarnya
  options?: Scene[]; // khusus ketidaksamaan: kelima gambar sudah berurutan dan `answer` menunjuk kunci
  answer?: number;
  rule: FiguralRule;
  explanation: string;
  keyReason: string;
  difficultyReason: string;
  stem: string;
  reasons?: string[]; // khusus ketidaksamaan: alasan tiap opsi
  namer?: Namer;
};

export const polar = (rho: number, theta: number): [number, number] => [round(rho * Math.sin(theta * Math.PI / 180)), round(-rho * Math.cos(theta * Math.PI / 180))];
export const LIMIT = 49;

// Kelompok berhitung: n bagian pada grid `cols` kolom, baris terakhir di tengah, seluruhnya berpusat di (0, 0).
export function packPositions(n: number, cols: number, pitch: number): [number, number][] {
  const rows = Math.ceil(n / cols), out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols), inRow = row === rows - 1 ? n - cols * (rows - 1) : cols, col = i - row * cols;
    out.push([round((col - (inRow - 1) / 2) * pitch), round((row - (rows - 1) / 2) * pitch)]);
  }
  return out;
}
export type PackOptions = { cols: number; pitch: number; radius: number; f?: Fill; r?: number; slots?: [number, number][]; from?: number };
// `slots` + `from` dipakai bila dua kelompok berbagi petak yang sama (campuran dua bentuk).
export function pack(name: string, g: string, n: number, o: PackOptions): Part[] {
  const slots = o.slots ?? packPositions(n, o.cols, o.pitch), from = o.from ?? 0;
  return Array.from({ length: n }, (_, i) => mk(name + '@' + (i + 1), g, slots[from + i][0], slots[from + i][1], { radius: o.radius, f: o.f ?? 2, r: o.r ?? 0 }));
}
export const rest = (s: Scene, ids: string[]): Scene => scene(s.parts.filter((p) => !ids.includes(p.id)));

const layered = (id: string) => /^(inti|batang|hub\d*)$/.test(id);
// Penjaga tata letak: semua bagian di dalam kotak dan tidak saling menimpa (kecuali rangka dan bagian sepusat).
export function layoutOk(s: Scene, limit = LIMIT): boolean {
  for (const p of s.parts) if (reach(p) > limit) return false;
  const solid = s.parts.filter((p) => !p.id.startsWith('rangka') && p.f !== 3);
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i], b = solid[j], gap = Math.hypot(a.x - b.x, a.y - b.y);
    if (gap < 3 && layered(a.id) && layered(b.id)) continue; // hanya bagian bersusun (inti, batang, jari-jari pusat) yang sengaja sepusat
    if (gap < (partRadius(a) + partRadius(b)) * 0.78) return false;
  }
  for (const frame of s.parts.filter((p) => p.id.startsWith('rangka') && !isShapeG(p.g))) {
    const inner = glyph(frame.g).inR * frame.s;
    for (const p of s.parts) if (p !== frame && !p.id.startsWith('rangka') && Math.hypot(p.x, p.y) + partRadius(p) > inner * 0.96) return false;
  }
  return true;
}

// Memilih empat pengecoh berbeda dari daftar calon (sudah berurut prioritas) yang berbeda dari kunci dan satu sama lain.
export function chooseWrong(key: Scene, candidates: { scene: Scene; rule: string; group?: string }[], need: number, r: Rng, spread = true, valid: (s: Scene) => boolean = layoutOk): { scene: Scene; rule: string }[] {
  const chosen: { scene: Scene; rule: string; group?: string }[] = [], used = new Set<number>();
  const accept = (c: { scene: Scene }) => !sameScene(c.scene, key) && valid(c.scene) && !chosen.some((x) => sameScene(x.scene, c.scene));
  const groups = [...new Set(candidates.map((c) => c.group ?? c.rule))];
  const order = r.shuffle(groups);
  // Putaran pertama mengambil satu calon dari tiap kelompok aturan agar setiap aturan terlanggar oleh minimal satu pengecoh.
  for (let round = 0; round < 6 && chosen.length < need; round++) {
    for (const group of order) {
      if (chosen.length >= need) break;
      const index = candidates.findIndex((c, i) => (c.group ?? c.rule) === group && !used.has(i) && accept(c));
      if (index >= 0) { used.add(index); chosen.push(candidates[index]); }
    }
    if (!spread) break;
  }
  return chosen.map(({ scene: s, rule }) => ({ scene: s, rule }));
}
// Alasan pengecoh: selisih konkret terhadap kunci, lalu aturan yang dilanggar.
export function reasonOf(key: Scene, wrong: { scene: Scene; rule: string }, name: Namer): string {
  const diff = describeDiff(key, wrong.scene, name);
  return 'Gambar ini berbeda dari gambar yang benar: ' + diff + '. ' + (wrong.rule ? 'Padahal ' + wrong.rule + '.' : '');
}
export const tierOf = (level: Difficulty) => level === 'mudah' ? 0 : level === 'sedang' ? 1 : level === 'sulit' ? 2 : 3;
