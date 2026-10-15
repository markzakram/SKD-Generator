import type { Rng } from '../rng';
import type { Difficulty, Fill, Part, Scene } from '../types';
import { buildLineAnalogi } from './garis-soal';
import { MARK_GLYPHS } from './glyphs';
import { chooseWrong, layoutOk, polar, tierOf, type Built } from './compose';
import { applyOps, type Op } from './ops';
import { find, mk, sameScene, scene } from './scene';
import { STEMS } from './stems';
import { capital, dirOfPoint, facing, fillWord, glyphName, listText, turnWord } from './text';

const ROLE: Record<string, string> = { rangka: 'bangun pembingkai', inti: 'bangun di tengah', penanda: 'bangun kecil', panah: 'panah kecil', titik: 'bulatan kecil' };
export const analogiName = (id: string, s: Scene) => {
  const p = find(s, id), base = ROLE[id] ?? id;
  return !p ? base : base + (Math.hypot(p.x, p.y) > 3 ? ' di ' + dirOfPoint(p.x, p.y) : '') + ' (' + glyphName(p.g) + ')';
};
const stateText = (p: Part, s: Scene) => {
  const parts = [analogiName(p.id, s)], f = facing(p);
  if (f) parts.push(f);
  if (p.f < 3 && p.id !== 'rangka') parts.push('berwarna ' + fillWord(p.f));
  return parts.join(' ');
};
function describeOp(op: Op, s: Scene): string {
  const n = (id: string) => analogiName(id, s);
  switch (op.op) {
    case 'putar': return 'seluruh gambar diputar ' + turnWord(op.deg);
    case 'cermin': return 'seluruh gambar dicerminkan terhadap sumbu tegak (sisi kiri dan kanan saling bertukar)';
    case 'inversi': return 'warna putih dan hitam pada semua bagian (selain bangun pembingkai) saling berbalik, sedangkan warna abu-abu tetap';
    case 'isi': return 'warna ' + n(op.id) + ' berubah';
    case 'hapus': return n(op.id) + ' dihilangkan';
    case 'tambah': return 'ditambahkan ' + glyphName(op.part.g) + ' ' + fillWord(op.part.f) + ' di ' + dirOfPoint(op.part.x, op.part.y);
    case 'skala': return n(op.id) + (op.faktor! > 1 ? ' diperbesar' : ' diperkecil') + ' menjadi ' + op.faktor + ' kali ukuran semula';
    case 'geser': return n(op.id) + ' berpindah ' + turnWord(op.deg) + ' mengelilingi pusat gambar';
    case 'putarSendiri': return n(op.id) + ' diputar ' + turnWord(op.deg ?? 0) + ' pada tempatnya';
    case 'tukar': return n(op.a) + ' dan ' + n(op.b) + ' bertukar tempat';
  }
}

const FRAMES = ['lingkaran', 'persegi', 'segienam'];
const CORES = ['panah', 'bulan', 'rumah', 'siku', 'bendera', 'segitigasiku', 'layang', 'trapesium', 'tetes', 'setengah', 'busur'];
const T90 = [90, -90, 180], T45 = [45, -45, 90, -90, 135, -135, 180];

function pickOps(a: Rng, tier: number): Op[] {
  const put = (set: number[]): Op => ({ op: 'putar', deg: a.pick(set) });
  const orbit = (): Op => ({ op: 'geser', id: 'penanda', deg: a.pick([90, -90, 180]) });
  const pools: (() => Op[])[][] = [
    [() => [put(T90)], () => [put(T90)], () => [{ op: 'inversi' }], () => [{ op: 'hapus', id: 'penanda' }]],
    [() => [put(T45)], () => [put(T45)], () => [{ op: 'cermin' }], () => [put(T90), { op: 'inversi' }], () => [put(T45), { op: 'hapus', id: 'penanda' }]],
    [() => [put(T45), { op: 'inversi' }], () => [put(T45), orbit()], () => [{ op: 'cermin' }, { op: 'inversi' }], () => [put(T45), { op: 'skala', id: 'inti', faktor: a.pick([1.5, 0.6]) }], () => [{ op: 'cermin' }, orbit()]],
    [() => [{ op: 'cermin' }, put(T45), { op: 'inversi' }], () => [put(T45), { op: 'inversi' }, { op: 'hapus', id: 'titik' }], () => [{ op: 'cermin' }, put(T45), orbit()], () => [put(T45), { op: 'inversi' }, { op: 'tukar', a: 'penanda', b: 'panah' }], () => [put(T45), { op: 'skala', id: 'inti', faktor: a.pick([1.5, 0.6]) }, { op: 'inversi' }]],
  ];
  return a.pick(pools[tier])();
}
// Penukar alternatif untuk satu langkah (parameter keliru) yang masih masuk akal.
function altOps(op: Op, others: string[]): Op[] {
  switch (op.op) {
    case 'putar': return [-op.deg, op.deg + 45, op.deg - 45, 90, -90, 180, 45, -45].filter((d, i, all) => d !== op.deg && d % 360 !== 0 && all.indexOf(d) === i).map((deg) => ({ op: 'putar', deg }));
    case 'skala': return [op.faktor! > 1 ? 0.6 : 1.5, 1 / op.faktor!].filter((f) => Math.abs(f - op.faktor!) > 0.05).map((faktor) => ({ op: 'skala', id: op.id, faktor: Math.round(faktor * 100) / 100 }));
    case 'geser': return [-op.deg, 90, -90, 180].filter((d, i, all) => d !== op.deg && all.indexOf(d) === i).map((deg) => ({ op: 'geser', id: op.id, deg }));
    case 'hapus': return others.filter((id) => id !== op.id).map((id) => ({ op: 'hapus', id }));
    default: return [];
  }
}

export function buildAnalogi(a: Rng, level: Difficulty): Built | null {
  // Sebagian soal memakai gambar garis dari benih (hubungan putaran/pencerminan), sisanya gambar bagian berwarna.
  if (a.next() < 0.3) return buildLineAnalogi(a, level);
  const tier = tierOf(level), ops = pickOps(a, tier);
  const thetas = a.shuffle([0, 45, 90, 135, 180, 225, 270, 315]).slice(0, 3);
  const [frameA, frameC] = a.shuffle(FRAMES).slice(0, 2), [coreA, coreC] = a.shuffle(CORES).slice(0, 2), [markA, markC] = a.shuffle(MARK_GLYPHS).slice(0, 2);
  const hasArrow = tier >= 1, hasDot = tier >= 2;
  const make = (frame: string, core: string, mark: string): Scene => scene([
    mk('rangka', frame, 0, 0, { radius: 44, f: 0 }),
    mk('inti', core, 0, 0, { radius: 13, r: a.int(0, 7) * 45, f: a.pick([0, 2]) as Fill }),
    mk('penanda', mark, ...polar(20, thetas[0]), { radius: 6, r: a.int(0, 3) * 90, f: a.pick([0, 1, 2]) as Fill }),
    ...(hasArrow ? [mk('panah', 'panah', ...polar(20, thetas[1]), { radius: 8, r: thetas[1] + (a.next() < 0.5 ? 0 : 180), f: 2 })] : []),
    ...(hasDot ? [mk('titik', 'lingkaran', ...polar(20, thetas[2]), { radius: 5, f: a.pick([0, 2]) as Fill })] : []),
  ]);
  const A = make(frameA, coreA, markA), C = make(frameC, coreC, markC), B = applyOps(A, ops), D = applyOps(C, ops);
  if (!B || !D || sameScene(A, B) || sameScene(C, D) || [A, B, C, D].some((s) => !layoutOk(s))) return null;
  const ids = A.parts.map((p) => p.id).filter((id) => id !== 'rangka' && id !== 'inti');
  const sentence = (op: Op) => describeOp(op, A), because = (op: Op) => 'pada pasangan pertama ' + sentence(op);
  const candidates: { scene: Scene; rule: string; group: string }[] = [];
  const addOps = (list: Op[], rule: string, group: string) => { const out = applyOps(C, list); if (out) candidates.push({ scene: out, rule, group }); };
  ops.forEach((op, i) => {
    addOps(ops.filter((_, j) => j !== i), because(op), 'op' + i);
    for (const alt of altOps(op, ids)) addOps(ops.map((x, j) => j === i ? alt : x), because(op), 'op' + i);
  });
  if (!ops.some((o) => o.op === 'cermin')) addOps([{ op: 'cermin' }, ...ops], 'pasangan pertama tidak memperlihatkan pencerminan', 'ekstra');
  if (!ops.some((o) => o.op === 'inversi')) addOps([...ops, { op: 'inversi' }], 'pasangan pertama tidak memperlihatkan pembalikan warna', 'ekstra');
  if (!ops.some((o) => o.op === 'putar')) addOps([{ op: 'putar', deg: a.pick([90, -90, 45, -45]) }, ...ops], 'pasangan pertama tidak memperlihatkan perputaran seluruh gambar', 'ekstra');
  const wrong = chooseWrong(D, candidates, 4, a);
  if (wrong.length < 4) return null;
  const rules = ops.map((op) => capital(sentence(op)));
  const keyState = listText(D.parts.map((p) => stateText(p, D)));
  return {
    kind: 'analogi', columns: 4, scenes: [A, B, C, null], key: D, wrong, namer: analogiName,
    rule: { mekanisme: 'analogi-' + ops.map((o) => o.op).join('+'), aturan: rules, ops: ops as unknown as Record<string, unknown>[] },
    explanation: 'Berdasarkan pasangan gambar yang diketahui, hubungan gambar pertama terhadap gambar kedua adalah:\n' + rules.map((r, i) => (i + 1) + '. ' + r + '.').join('\n') +
      '\nDengan menerapkan hubungan yang sama pada gambar ketiga, diperoleh gambar dengan ' + keyState + '.',
    keyReason: 'Memenuhi seluruh hubungan: ' + listText(ops.map(sentence)) + '. Hasilnya: ' + keyState + '.',
    difficultyReason: ops.length === 1 ? 'Satu hubungan sederhana yang tampak jelas pada pasangan pertama.' : ops.length === 2 ? 'Dua perubahan berbeda terjadi bersamaan; pengecoh hanya melanggar salah satunya.' : 'Tiga perubahan terjadi bersamaan dan harus diterapkan berurutan; setiap pengecoh hanya melanggar satu perubahan.',
    stem: STEMS.analogi[0],
  };
}
