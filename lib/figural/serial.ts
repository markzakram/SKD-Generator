import type { Rng } from '../rng';
import type { Difficulty, Fill, Part, Scene } from '../types';
import { MARK_GLYPHS, PLAIN_GLYPHS } from './glyphs';
import { chooseWrong, layoutOk, pack, packPositions, polar, tierOf, type Built } from './compose';
import { mk, sameScene, scene } from './scene';
import { STEMS } from './stems';
import { capital, dirOfPoint, facing, fillWord, glyphName, listText, makeNamer, turnWord } from './text';

// Satu bagian yang berubah mengikuti aturan tetap dari kotak ke kotak.
type Ent = {
  id: string; role: string; g: string; radius: number; x: number; y: number; r0: number; f0: Fill;
  rot?: number; // putaran pada tempat per kotak
  orbit?: { rho: number; theta0: number; delta: number }; // mengelilingi pusat sambil ikut berputar
  fill?: { mode: 'alt' | 'cycle'; a: Fill; b: Fill; d: number };
  cycle?: string[]; // bentuk bergantian
};
const wrap = (n: number, m: number) => ((n % m) + m) % m;
function stateAt(e: Ent, k: number): Part {
  const [x, y] = e.orbit ? polar(e.orbit.rho, e.orbit.theta0 + e.orbit.delta * k) : [e.x, e.y];
  const f = !e.fill ? e.f0 : e.fill.mode === 'alt' ? (k % 2 ? e.fill.b : e.fill.a) : wrap(e.f0 + e.fill.d * k, 3);
  return mk(e.id, e.cycle ? e.cycle[wrap(k, e.cycle.length)] : e.g, x, y, { radius: e.radius, r: e.r0 + (e.rot ?? 0) * k + (e.orbit?.delta ?? 0) * k, f: f as Fill });
}
type Variant = { part: Part; rule: string; group: string; hint: number };
function variants(e: Ent, k: number, label: string): Variant[] {
  const right = stateAt(e, k), out: Variant[] = [];
  const add = (patch: Partial<Part>, rule: string, aspect: string, hint: number) => out.push({ part: { ...right, ...patch }, rule, group: e.id + ':' + aspect, hint });
  if (e.rot) {
    const rule = label + ' berputar ' + turnWord(e.rot) + ' pada setiap kotak';
    add({ r: stateAt(e, k - 1).r }, rule, 'rot', 0); add({ r: stateAt(e, k + 1).r }, rule, 'rot', 0);
    add({ r: ((e.r0 - e.rot * k) % 360 + 360) % 360 }, rule, 'rot', 1); add({ r: (right.r + 180) % 360 }, rule, 'rot', 2); add({ r: (right.r + 90) % 360 }, rule, 'rot', 2);
  }
  if (e.orbit) {
    const o = e.orbit, rule = label + ' berpindah ' + turnWord(o.delta) + ' mengelilingi pusat gambar pada setiap kotak';
    for (const step of [k - 1, k + 1]) { const [x, y] = polar(o.rho, o.theta0 + o.delta * step); add({ x, y, r: stateAt(e, step).r }, rule, 'orbit', 0); }
    const [ox, oy] = polar(o.rho, o.theta0 - o.delta * k); add({ x: ox, y: oy, r: (e.r0 - o.delta * k + 720) % 360 }, rule, 'orbit', 1);
    add({ r: e.r0 }, rule, 'orbit', 1);
  }
  if (e.fill?.mode === 'alt') {
    const rule = 'warna ' + label + ' berganti-ganti antara ' + fillWord(e.fill.a) + ' dan ' + fillWord(e.fill.b);
    add({ f: (right.f === e.fill.a ? e.fill.b : e.fill.a) as Fill }, rule, 'fill', 0);
    const third = ([0, 1, 2] as Fill[]).find((f) => f !== e.fill!.a && f !== e.fill!.b); if (third !== undefined) add({ f: third }, rule, 'fill', 2);
  }
  if (e.fill?.mode === 'cycle') {
    const rule = 'warna ' + label + ' bergeser ' + (e.fill.d === 1 ? 'maju' : 'mundur') + ' satu langkah pada siklus putih, abu-abu, hitam pada setiap kotak';
    for (const f of ([0, 1, 2] as Fill[]).filter((x) => x !== right.f)) add({ f }, rule, 'fill', f === wrap(right.f + (e.fill.d === 1 ? -1 : 1), 3) ? 0 : 1);
  }
  if (e.cycle) {
    const rule = 'bentuk ' + label + ' berganti mengikuti urutan ' + listText(e.cycle.map(glyphName));
    for (const g of e.cycle.filter((x) => x !== right.g)) add(mk(e.id, g, right.x, right.y, { radius: e.radius, r: right.r, f: right.f }), rule, 'cycle', 0);
  }
  return out;
}
const ruleTexts = (e: Ent, label: string) => variants(e, 0, label).map((v) => v.rule).filter((r, i, all) => all.indexOf(r) === i);
const swap = (s: Scene, part: Part) => scene(s.parts.map((p) => p.id === part.id ? part : p));

function describeAt(e: Ent, key: Part, label: string, k: number): string {
  const parts: string[] = [];
  if (e.rot || (e.orbit && !e.fill)) {
    const f = facing(key);
    const total = ((e.rot ?? 0) * k % 360 + 360) % 360;
    parts.push(e.orbit ? label + ' berada di ' + dirOfPoint(key.x, key.y) + (f ? ' dan ' + f : '') : label + ' ' + (f ?? 'terputar ' + turnWord(total > 180 ? total - 360 : total) + ' dari kedudukannya pada kotak pertama'));
  }
  if (e.fill) parts.push(label + ' berwarna ' + fillWord(key.f));
  if (e.cycle) parts.push(label + ' berbentuk ' + glyphName(key.g));
  if (e.orbit && e.fill) parts.push(label + ' berada di ' + dirOfPoint(key.x, key.y));
  return parts.join(', ');
}

const ROLE: Record<string, string> = { inti: 'bangun di tengah', batang: 'batang yang melintang di tengah', satelit: 'bangun kecil di tepi', titik: 'bulatan kecil di sudut' };
const CORNERS: [number, number][] = [[-29, -29], [29, -29], [29, 29], [-29, 29]];
const coreGlyphs = ['panah', 'bulan', 'rumah', 'siku', 'bendera', 'segitigasiku', 'layang', 'trapesium', 'tetes', 'setengah'];
const turns = [45, 90, 135, -45, -90, -135];

type Plan = { ents: Ent[]; statics: Part[]; total: number; hidden: number };
function plan(a: Rng, tier: number): Plan | null {
  const sign = () => a.next() < 0.5 ? 1 : -1;
  const core = (radius: number, rot?: number): Ent => ({ id: 'inti', role: ROLE.inti, g: a.pick(coreGlyphs), radius, x: 0, y: 0, r0: a.int(0, 7) * 45, f0: a.pick([0, 2]) as Fill, ...(rot ? { rot } : {}) });
  const corners = a.shuffle([0, 1, 2, 3]);
  const staticMarks = (n: number, from: number): Part[] => corners.slice(from, from + n).map((c, i) => mk('penanda' + (i + 1), a.pick(MARK_GLYPHS), CORNERS[c][0], CORNERS[c][1], { radius: 5.5, f: a.pick([0, 1, 2]) as Fill }));
  const dot = (cornerIndex: number, fill: Ent['fill'], f0: Fill = 0): Ent => ({ id: 'titik', role: ROLE.titik, g: 'lingkaran', radius: 5.5, x: CORNERS[corners[cornerIndex]][0], y: CORNERS[corners[cornerIndex]][1], r0: 0, f0, fill });
  const track = (): Part[] => [mk('jalur', 'lingkaran', 0, 0, { radius: 31, f: 3 })]; // lintasan bangun yang mengelilingi pusat
  const total = tier >= 2 ? 6 : 5;
  const hiddenMiddle = tier >= 2 && a.next() < (tier === 3 ? 1 : 0.4), hidden = hiddenMiddle ? a.pick([2, 3]) : total - 1;
  // Pada deret satu aturan, putaran yang kembali ke arah semula tepat pada kotak jawaban membuat jawaban sama dengan kotak lain.
  const usable = turns.filter((t) => tier > 0 || [...Array(total).keys()].every((j) => j === hidden || ((hidden - j) * t) % 360 !== 0));
  const delta = a.pick(usable), other = a.pick(turns.filter((t) => Math.sign(t) !== Math.sign(delta) || Math.abs(t) !== Math.abs(delta)));
  const variant = a.int(0, 2);
  if (tier === 0) {
    if (variant === 0) return { ents: [core(18, delta)], statics: staticMarks(a.int(1, 2), 0), total, hidden };
    if (variant === 1) return { ents: [core(15), { id: 'satelit', role: ROLE.satelit, g: a.pick(MARK_GLYPHS), radius: 6, x: 0, y: 0, r0: 0, f0: a.pick([0, 2]) as Fill, orbit: { rho: 31, theta0: a.int(0, 7) * 45, delta: a.pick([45, -45, 90, -90]) } }], statics: track(), total, hidden };
    return { ents: [core(16, delta), dot(0, undefined, a.pick([0, 2]) as Fill)], statics: staticMarks(1, 1), total, hidden };
  }
  if (tier === 1) {
    if (variant === 0) return { ents: [core(16, delta), dot(0, { mode: 'alt', a: 0, b: 2, d: 0 })], statics: staticMarks(1, 1), total, hidden };
    if (variant === 1) return { ents: [core(13, delta), { id: 'batang', role: ROLE.batang, g: 'batang', radius: 26, x: 0, y: 0, r0: a.int(0, 3) * 45, f0: 1, rot: other }], statics: staticMarks(1, 0), total, hidden };
    return { ents: [{ ...core(15), fill: { mode: 'alt', a: 0, b: 2, d: 0 } }, { id: 'satelit', role: ROLE.satelit, g: a.pick(MARK_GLYPHS), radius: 6, x: 0, y: 0, r0: 0, f0: a.pick([0, 2]) as Fill, orbit: { rho: 31, theta0: a.int(0, 7) * 45, delta: a.pick([45, -45, 90, -90]) } }], statics: track(), total, hidden };
  }
  const cycleFill = tier === 3 || a.next() < 0.5;
  // Tingkat tertinggi: bangun di tengah berputar sekaligus berganti warna, batang berputar dengan kecepatan lain, dan bulatan sudut berganti warna.
  if (tier === 3) return { ents: [{ ...core(13, delta), fill: { mode: 'alt', a: 0, b: 2, d: 0 } }, { id: 'batang', role: ROLE.batang, g: 'batang', radius: 26, x: 0, y: 0, r0: a.int(0, 3) * 45, f0: 1, rot: other }, dot(0, { mode: 'cycle', a: 0, b: 2, d: sign() })], statics: staticMarks(1, 1), total, hidden };
  if (variant === 0) return { ents: [{ ...core(15, delta), fill: cycleFill ? { mode: 'cycle', a: 0, b: 2, d: sign() } : { mode: 'alt', a: 0, b: 2, d: 0 } }, { id: 'satelit', role: ROLE.satelit, g: a.pick(MARK_GLYPHS), radius: 6, x: 0, y: 0, r0: 0, f0: a.pick([0, 2]) as Fill, orbit: { rho: 31, theta0: a.int(0, 7) * 45, delta: -Math.sign(delta) * a.pick([45, 90]) } }], statics: track(), total, hidden };
  return { ents: [core(13, delta), { id: 'batang', role: ROLE.batang, g: 'batang', radius: 26, x: 0, y: 0, r0: a.int(0, 3) * 45, f0: 1, rot: other }, dot(0, cycleFill ? { mode: 'cycle', a: 0, b: 2, d: sign() } : { mode: 'alt', a: 0, b: 2, d: 0 })], statics: staticMarks(a.int(0, 1), 1), total, hidden };
}

export function buildSerial(a: Rng, level: Difficulty): Built | null {
  const tier = tierOf(level);
  if (tier <= 1 && a.next() < 0.28) return tier === 0 ? buildSwap(a) : buildDuo(a);
  const p = plan(a, tier);
  if (!p) return null;
  const { ents, statics, total, hidden } = p, name = makeNamer(Object.fromEntries(ents.map((e) => [e.id, e.role])));
  const at = (k: number) => scene([...statics, ...ents.map((e) => stateAt(e, k))]);
  const cells = Array.from({ length: total }, (_, k) => at(k)), key = cells[hidden];
  if (cells.some((s) => !layoutOk(s)) || cells.some((s, k) => k !== hidden && sameScene(s, key))) return null;
  for (const e of ents) if (e.rot && (Math.abs(e.rot) % 360 === 0)) return null;
  // Pada tingkat sulit pengecoh hanya berupa kesalahan yang paling wajar (salah satu langkah, arah berlawanan), bukan perubahan acak.
  const candidates = ents.flatMap((e) => variants(e, hidden, name(e.id, key).replace(/ \(.*\)$/, '')).filter((v) => tier <= 1 || v.hint <= 1)
    .sort((x, y) => x.hint - y.hint).map((v) => ({ scene: swap(key, v.part), rule: v.rule, group: v.group })));
  const wrong = chooseWrong(key, candidates, 4, a);
  if (wrong.length < 4) return null;
  const labels = new Map(ents.map((e) => [e.id, name(e.id, key).replace(/ \(.*\)$/, '')]));
  const rules = ents.flatMap((e) => ruleTexts(e, labels.get(e.id)!));
  const order = hidden + 1, where = hidden === total - 1 ? 'kotak berikutnya (kotak ke-' + order + ')' : 'kotak bertanda tanya (kotak ke-' + order + ')';
  const finals = ents.map((e) => describeAt(e, key.parts.find((q) => q.id === e.id)!, name(e.id, key), hidden)).filter(Boolean);
  const explanation = (rules.length === 1 ? 'Aturan yang berlaku dari kotak ke kotak:\n' : 'Terdapat ' + rules.length + ' aturan yang berjalan bersamaan dari kotak ke kotak:\n') + rules.map((r, i) => (i + 1) + '. ' + capital(r) + '.').join('\n') +
    '\n' + (rules.length === 1 ? 'Meneruskan aturan itu ke ' : 'Meneruskan semua aturan itu ke ') + where + ': ' + listText(finals) + '. Bagian lain tidak berubah.';
  return {
    kind: 'serial', columns: total, scenes: cells.map((s, k) => k === hidden ? null : s), key, wrong: wrong.map((w) => ({ ...w })),
    rule: { mekanisme: 'serial-' + (tier === 0 ? 'satu-aturan' : tier === 1 ? 'dua-aturan' : tier === 2 ? 'tiga-aturan' : 'empat-aturan'), aturan: rules.map(capital) },
    explanation, keyReason: 'Memenuhi seluruh aturan: ' + listText(finals) + '.',
    difficultyReason: rules.length === 1 ? 'Satu aturan yang berjalan stabil dari kotak ke kotak.' : rules.length === 2 ? 'Dua aturan berjalan bersamaan pada bagian yang berbeda; pengecoh hanya melanggar salah satunya.' :
      (rules.length === 3 ? 'Tiga' : 'Empat') + ' aturan berjalan bersamaan pada bagian yang berbeda' + (hidden < total - 1 ? ', dan kotak yang hilang berada di tengah deret' : '') + '; setiap pengecoh hanya berbeda satu aspek dari jawaban.',
    stem: hidden === total - 1 ? STEMS.serial[0] : STEMS.serial[1], namer: name,
  };
}

// Dua bentuk berbagi petak yang sama: tiap kotak satu bentuk pertama berganti menjadi bentuk kedua.
function buildSwap(a: Rng): Built | null {
  const K = a.pick([4, 6]), [x, y] = a.shuffle(PLAIN_GLYPHS).slice(0, 2), cols = K === 4 ? 2 : 3, pitch = K === 4 ? 26 : 24, radius = K === 4 ? 9 : 8;
  const slots = packPositions(K, cols, pitch), total = 5, m0 = K === 4 ? 0 : a.pick([0, 1]);
  const at = (m: number) => scene([...pack('x', x, K - m, { cols, pitch, radius, slots, from: m }), ...pack('y', y, m, { cols, pitch, radius, slots, from: 0 })]);
  const cells = Array.from({ length: total }, (_, k) => at(m0 + k)), key = cells[total - 1], name = makeNamer({ x: 'bangun ' + glyphName(x), y: 'bangun ' + glyphName(y) });
  const rule = 'setiap kotak, satu ' + glyphName(x) + ' berganti menjadi ' + glyphName(y) + ' sehingga jumlah ' + glyphName(y) + ' bertambah satu dan jumlah ' + glyphName(x) + ' berkurang satu (jumlah seluruh bangun tetap ' + K + ')';
  const nearest = (m: number) => Math.abs(m - (m0 + total - 1));
  const candidates = Array.from({ length: K + 1 }, (_, m) => m).filter((m) => m !== m0 + total - 1).sort((p, q) => nearest(p) - nearest(q)).map((m) => ({ scene: at(m), rule, group: 'jumlah' }));
  const wrong = chooseWrong(key, candidates, 4, a);
  if (wrong.length < 4) return null;
  const nY = m0 + total - 1;
  return {
    kind: 'serial', columns: total, scenes: cells.map((s, k) => k === total - 1 ? null : s), key, wrong, namer: name,
    rule: { mekanisme: 'serial-jumlah', aturan: [capital(rule)] },
    explanation: 'Perhatikan banyaknya tiap bangun pada setiap kotak. ' + capital(rule) + '. Jumlah ' + glyphName(y) + ' pada kotak-kotak itu adalah ' + cells.slice(0, total - 1).map((_, k) => m0 + k).join(', ') + ', sehingga pada kotak kelima terdapat ' + nY + ' ' + glyphName(y) + ' dan ' + (K - nY) + ' ' + glyphName(x) + '.',
    keyReason: 'Memenuhi aturan: terdapat ' + nY + ' ' + glyphName(y) + ' dan ' + (K - nY) + ' ' + glyphName(x) + '.',
    difficultyReason: 'Satu aturan berupa perubahan jumlah dua jenis bangun yang saling bertukar tempat.', stem: STEMS.serial[0],
  };
}
// Dua kelompok terpisah: jumlah yang satu berkurang dan jumlah yang lain bertambah dengan laju berbeda.
function buildDuo(a: Rng): Built | null {
  const [x, y] = a.shuffle(PLAIN_GLYPHS).slice(0, 2), total = 5, dx = a.pick([1, 1, 2]), dy = a.pick([1, 2]);
  const x0 = dx * 4 + a.int(0, Math.min(1, 8 - dx * 4)), y0 = a.int(0, Math.min(1, 8 - dy * 4));
  const half = (name: string, g: string, n: number, side: number) => pack(name, g, n, { cols: 2, pitch: 17, radius: 6.5, slots: packPositions(n, 2, 17).map(([px, py]) => [px + side * 22, py] as [number, number]) });
  const at = (k: number) => scene([...half('x', x, x0 - dx * k, -1), ...half('y', y, y0 + dy * k, 1)]);
  const cells = Array.from({ length: total }, (_, k) => at(k)), key = cells[total - 1], name = makeNamer({ x: 'bangun ' + glyphName(x), y: 'bangun ' + glyphName(y) });
  const ruleX = 'jumlah ' + glyphName(x) + ' berkurang ' + dx + ' pada setiap kotak', ruleY = 'jumlah ' + glyphName(y) + ' bertambah ' + dy + ' pada setiap kotak';
  const nx = x0 - dx * 4, ny = y0 + dy * 4;
  const around = (n: number) => [-1, 1, -2, 2].map((d) => n + d).filter((v) => v >= 0 && v <= 8);
  const candidates = [
    ...around(nx).map((n) => ({ scene: scene([...half('x', x, n, -1), ...half('y', y, ny, 1)]), rule: ruleX, group: 'x' })),
    ...around(ny).map((n) => ({ scene: scene([...half('x', x, nx, -1), ...half('y', y, n, 1)]), rule: ruleY, group: 'y' })),
  ];
  const wrong = chooseWrong(key, candidates, 4, a);
  if (wrong.length < 4) return null;
  return {
    kind: 'serial', columns: total, scenes: cells.map((s, k) => k === total - 1 ? null : s), key, wrong, namer: name,
    rule: { mekanisme: 'serial-jumlah-ganda', aturan: [capital(ruleX), capital(ruleY)] },
    explanation: 'Terdapat dua pola jumlah yang berjalan bersamaan.\n1. ' + capital(ruleX) + ': ' + Array.from({ length: total }, (_, k) => x0 - dx * k).join(', ') + '.\n2. ' + capital(ruleY) + ': ' + Array.from({ length: total }, (_, k) => y0 + dy * k).join(', ') + '.\nJadi kotak kelima memuat ' + nx + ' ' + glyphName(x) + ' dan ' + ny + ' ' + glyphName(y) + '.',
    keyReason: 'Memenuhi kedua aturan: terdapat ' + nx + ' ' + glyphName(x) + ' dan ' + ny + ' ' + glyphName(y) + '.',
    difficultyReason: 'Dua aturan jumlah berjalan bersamaan dengan laju berbeda.', stem: STEMS.serial[0],
  };
}
