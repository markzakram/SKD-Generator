import type { Part, Question, Scene } from '../types';
import { GLYPHS } from './glyphs';
import { inferHidden, matchPrediction, readScene } from './infer';
import { applyOps, explain, predictAll, uniqueScenes, type Op } from './ops';
import { reach, rotationBetween, sameScene } from './scene';
import { LEAK, STEMS } from './stems';

// Pembuktian kunci soal figural. Semua dihitung dari gambar stimulus dan kelima opsi, bukan dari catatan pembuatnya:
// aturan disimpulkan ulang dari stimulus, setiap aturan yang cocok harus meramalkan jawaban yang sama,
// dan tepat satu opsi boleh memenuhi seluruh ramalan itu.
export type SolveResult = { answer: number; errors: string[] };

export function checkScene(scene: Scene, label: string, errors: string[]) {
  if (!scene || !Array.isArray(scene.parts) || !scene.parts.length || scene.parts.length > 90) { errors.push(label + ': jumlah bagian gambar tidak valid'); return; }
  for (const p of scene.parts as Part[]) {
    const shape = p.g === 'poligon' || p.g === 'garis', least = p.g === 'poligon' ? 6 : 4;
    const ok = typeof p.id === 'string' && p.id.length > 0 && p.id.length <= 40 && (shape ? Array.isArray(p.p) && p.p.length >= least && p.p.length <= 60 && p.p.length % 2 === 0 && p.p.every(Number.isFinite) : Boolean(GLYPHS[p.g])) &&
      [p.x, p.y, p.s, p.r].every(Number.isFinite) && p.s > 0 && p.s <= 8 && Math.abs(p.x) <= 60 && Math.abs(p.y) <= 60 && [0, 1, 2, 3].includes(p.f) && (p.m === undefined || p.m === 1) && (p.h === undefined || (shape && (p.h === 1 || p.h === 2)));
    if (!ok) { errors.push(label + ': atribut bagian "' + String(p.id) + '" tidak valid'); return; }
    if (reach(p) > 60) { errors.push(label + ': bagian "' + p.id + '" keluar dari kotak gambar'); return; }
  }
}

// ----------------------------------------------------------------- ketidaksamaan
const turning = (pts: number[]) => {
  let corners = 0; const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const a = [pts[i * 2], pts[i * 2 + 1]], b = [pts[((i + 1) % n) * 2], pts[((i + 1) % n) * 2 + 1]], c = [pts[((i + 2) % n) * 2], pts[((i + 2) % n) * 2 + 1]];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]], angle = Math.abs(Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]) * 180 / Math.PI);
    if (angle > 14) corners++;
  }
  return corners;
};
export const sidesOf = (scene: Scene) => scene.parts.filter((p) => p.g === 'poligon').reduce((sum, p) => sum + turning(p.p ?? []), 0);
export type Panel = Record<string, (number | string)[]>;
// Ciri yang bisa dijadikan dasar "gambar yang berbeda". Hanya yang dinyatakan aturan yang boleh menunjuk kunci.
export function panel(scenes: Scene[]): Panel {
  const count = (s: Scene, f: number) => s.parts.filter((p) => p.f === f).length;
  const cls = scenes.map((s, i) => { for (let j = 0; j <= i; j++) if (rotationBetween(scenes[j], s) !== null) return j; return i; });
  const kinds = (s: Scene) => { const map: Record<string, number> = {}; s.parts.forEach((p) => { map[p.g] = (map[p.g] ?? 0) + 1; }); return Object.keys(map).sort().map((k) => k + map[k]).join(','); };
  return {
    urutan: cls, 'jumlah-hitam': scenes.map((s) => count(s, 2)), paritas: scenes.map((s) => count(s, 2) % 2), 'jumlah-abu': scenes.map((s) => count(s, 1)), 'jumlah-putih': scenes.map((s) => count(s, 0)),
    'jumlah-bagian': scenes.map((s) => s.parts.length), 'paritas-bagian': scenes.map((s) => s.parts.length % 2), sisi: scenes.map(sidesOf), bentuk: scenes.map(kinds),
  };
}
// Indeks satu-satunya nilai yang muncul sekali sementara semua nilai lain muncul paling sedikit dua kali.
export function singled(values: (number | string)[]): number {
  const tally = new Map<number | string, number>();
  values.forEach((v) => tally.set(v, (tally.get(v) ?? 0) + 1));
  const lone = values.map((v, i) => tally.get(v) === 1 ? i : -1).filter((i) => i >= 0);
  return lone.length === 1 ? lone[0] : -1;
}
export const ODD_FEATURE: Record<string, string> = { 'ketidaksamaan-urutan': 'urutan', 'ketidaksamaan-garis': 'urutan', 'ketidaksamaan-paritas': 'paritas', 'ketidaksamaan-sisi': 'sisi' };
function solveOdd(q: Question, scenes: Scene[], errors: string[]): number {
  const feature = ODD_FEATURE[q.visual?.rule?.mekanisme ?? ''];
  if (!feature) { errors.push('mekanisme ketidaksamaan tidak dikenal'); return -1; }
  const table = panel(scenes), key = singled(table[feature]);
  if (key < 0) { errors.push('ciri "' + feature + '" tidak menunjuk tepat satu gambar yang berbeda'); return -1; }
  for (const [name, values] of Object.entries(table)) {
    if (name === feature) continue;
    const other = singled(values);
    if (other >= 0 && other !== key) errors.push('ciri "' + name + '" menunjuk gambar lain sebagai yang berbeda (jawaban ganda)');
  }
  return key;
}

// ------------------------------------------------------------------- analogi
function solveAnalogy(q: Question, scenes: (Scene | null)[], options: Scene[], errors: string[]): number {
  const [a, b, c] = scenes;
  if (scenes.length !== 4 || !a || !b || !c || scenes[3] !== null) { errors.push('soal analogi harus memuat tiga gambar dan satu tanda tanya'); return -1; }
  const found = explain(a, b);
  if (!found.length) { errors.push('hubungan gambar pertama dan kedua tidak dapat dibuktikan'); return -1; }
  const { scenes: predicted, blocked } = predictAll(c, found), unique = uniqueScenes(predicted);
  if (blocked || !unique.length) { errors.push('hubungan gambar pertama dan kedua tidak dapat diterapkan pada gambar ketiga'); return -1; }
  if (unique.length > 1) { errors.push('hubungan analogi ambigu: ' + unique.length + ' hasil berbeda untuk gambar ketiga'); return -1; }
  const ops = q.visual?.rule?.ops as Op[] | undefined;
  if (ops) {
    const first = applyOps(a, ops), second = applyOps(c, ops);
    if (!first || !sameScene(first, b)) errors.push('aturan yang dinyatakan tidak menghasilkan gambar kedua dari gambar pertama');
    if (!second || !sameScene(second, unique[0])) errors.push('aturan yang dinyatakan tidak sama dengan hasil pembuktian');
    if (found[0].n !== ops.length) errors.push('banyak aturan yang dinyatakan (' + ops.length + ') berbeda dari hubungan terpendek yang terbukti (' + found[0].n + ')');
  }
  const matches = options.flatMap((s, i) => sameScene(s, unique[0]) ? [i] : []);
  if (matches.length !== 1) { errors.push('jawaban analogi harus tepat satu opsi, ditemukan ' + matches.length); return -1; }
  return matches[0];
}

// ------------------------------------------------------------------ deret dan kisi
function solveByInference(scenes: (Scene | null)[], options: Scene[], topology: 'seq' | 'grid', errors: string[]): number {
  const hidden = scenes.findIndex((s) => s === null);
  if (hidden < 0 || scenes.filter((s) => s === null).length !== 1) { errors.push('stimulus harus memuat tepat satu tanda tanya'); return -1; }
  if (topology === 'grid' && (scenes.length !== 9 || hidden !== 8)) { errors.push('matriks harus berukuran 3 × 3 dengan tanda tanya di kanan bawah'); return -1; }
  if (topology === 'seq' && (scenes.length < 4 || scenes.length > 7)) { errors.push('deret harus terdiri atas empat sampai tujuh kotak'); return -1; }
  const inferred = inferHidden(scenes, hidden, topology);
  if (inferred.errors.length) { errors.push(...inferred.errors); return -1; }
  const matches = options.flatMap((s, i) => {
    const read = readScene(s);
    return read.errors.length === 0 && matchPrediction(read, inferred.pred).length === 0 ? [i] : [];
  });
  if (matches.length !== 1) { errors.push('jawaban harus tepat satu opsi yang memenuhi semua aturan, ditemukan ' + matches.length); return -1; }
  return matches[0];
}

export function solveScene(q: Question): SolveResult {
  const errors: string[] = [], visual = q.visual;
  if (!visual || !Array.isArray(visual.scenes) && visual.kind !== 'ketidaksamaan') return { answer: -1, errors: ['stimulus figural tidak tersedia'] };
  const stems = STEMS[visual.kind] ?? [];
  if (!stems.includes(q.stem.trim())) errors.push('kalimat soal figural harus memakai rumusan baku');
  if (LEAK.test(q.stem)) errors.push('kalimat soal figural membocorkan aturan');
  if (q.options.length !== 5 || q.options.some((o) => !o.scene)) return { answer: -1, errors: [...errors, 'kelima opsi figural harus berupa gambar'] };
  const options = q.options.map((o) => o.scene!), scenes = visual.scenes ?? [];
  scenes.forEach((s, i) => { if (s) checkScene(s, 'kotak ' + (i + 1), errors); });
  options.forEach((s, i) => checkScene(s, 'opsi ' + String.fromCharCode(65 + i), errors));
  if (errors.some((e) => e.includes('tidak valid') || e.includes('keluar dari kotak'))) return { answer: -1, errors };
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (sameScene(options[i], options[j])) errors.push('opsi ' + String.fromCharCode(65 + i) + ' dan ' + String.fromCharCode(65 + j) + ' tampak sebagai gambar yang sama');
  const reasons = q.options.map((o) => o.reason.trim());
  if (new Set(reasons).size !== reasons.length) errors.push('alasan antaropsi tidak boleh sama');
  let answer = -1;
  if (visual.kind === 'analogi') answer = solveAnalogy(q, scenes, options, errors);
  else if (visual.kind === 'serial') answer = solveByInference(scenes, options, 'seq', errors);
  else if (visual.kind === 'matriks') answer = solveByInference(scenes, options, 'grid', errors);
  else answer = solveOdd(q, options, errors);
  return { answer, errors };
}
