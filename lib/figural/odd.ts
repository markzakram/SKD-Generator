import type { Rng } from '../rng';
import type { Difficulty, Fill, Part, Scene } from '../types';
import { MARK_GLYPHS } from './glyphs';
import { LIMIT, layoutOk, packPositions, polar, tierOf, type Built } from './compose';
import { flipScene, mk, norm, polygonPart, rotateScene, rotationBetween, scene, worldPoints } from './scene';
import { panel, singled, sidesOf } from './solve';
import { buildLineOdd } from './garis-soal';
import { STEMS } from './stems';
import { dirWord, fillWord, glyphName, listText } from './text';

// Susunan bangun di sekeliling pusat, dibaca searah jarum jam, dimulai dari bangun terkecil menurut nama supaya bisa dibandingkan.
// `start` adalah arah bangun pertama itu (derajat searah jarum jam dari atas) sehingga tiap putaran punya ciri sendiri.
function cyclicOrder(s: Scene): { labels: string[]; start: number } {
  const items = s.parts.filter((p) => p.id.startsWith('obj')).map((p) => ({ angle: norm(Math.atan2(p.x, -p.y) * 180 / Math.PI), label: glyphName(p.g) + ' ' + fillWord(p.f) }))
    .sort((x, y) => x.angle - y.angle);
  let best = items;
  for (let i = 1; i < items.length; i++) { const turned = [...items.slice(i), ...items.slice(0, i)]; if (turned.map((x) => x.label).join('|') < best.map((x) => x.label).join('|')) best = turned; }
  return { labels: best.map((x) => x.label), start: Math.round(best[0].angle) % 360 };
}
const arrow = (list: string[]) => list.join(' → ') + ' → (kembali ke awal)';

// Mekanisme 1: empat gambar adalah susunan yang sama (hanya diputar), satu gambar susunannya berbeda.
function buildOrder(a: Rng, tier: number): Built | null {
  const n = tier === 0 ? 4 : tier === 1 ? 5 : 6;
  const angles: number[] = [];
  for (const k of a.shuffle(Array.from({ length: 24 }, (_, i) => i * 15))) if (angles.length < n && angles.every((x) => { const d = Math.abs(x - k) % 360; return Math.min(d, 360 - d) >= 45; })) angles.push(k);
  if (angles.length < n) return null;
  const glyphs = a.shuffle(MARK_GLYPHS).slice(0, n), fills = glyphs.map(() => a.pick([0, 2]) as Fill);
  if (new Set(fills).size < 2) fills[0] = (fills[1] === 0 ? 2 : 0) as Fill;
  const hubAngle = a.int(0, 11) * 15, hub = [0, 55, 125].map((d, i) => mk('hub' + (i + 1), 'batang', 0, 0, { radius: 25, r: hubAngle + d, f: tier === 0 ? 2 : 1 }));
  const objects = glyphs.map((g, i) => mk('obj' + (i + 1), g, ...polar(33, angles[i]), { radius: 6, f: fills[i] }));
  const base = scene([...hub, ...objects]);
  const order = angles.map((x, i) => ({ x, i })).sort((p, q) => p.x - q.x).map((p) => p.i);
  const modes = tier === 0 ? ['tukar', 'ganti'] : tier === 1 ? ['tukar', 'warna'] : ['tukar-jauh', 'warna', 'cermin'];
  const mode = a.pick(modes);
  let odd: Scene | null = null, explain = '';
  const swapParts = (s: Scene, i: number, j: number) => scene(s.parts.map((p) => p.id === 'obj' + (i + 1) ? { ...p, x: objects[j].x, y: objects[j].y } : p.id === 'obj' + (j + 1) ? { ...p, x: objects[i].x, y: objects[i].y } : p));
  if (mode === 'tukar' || mode === 'tukar-jauh') {
    const gap = mode === 'tukar' ? 1 : 2, at = a.int(0, n - 1), i = order[at], j = order[(at + gap) % n];
    if (n < 4 && gap > 1) return null;
    odd = swapParts(base, i, j);
    explain = 'bangun ' + glyphName(glyphs[i]) + ' dan ' + glyphName(glyphs[j]) + ' bertukar tempat sehingga urutannya berubah';
  } else if (mode === 'warna') {
    const pair = order.filter((i) => order.some((j) => fills[j] !== fills[i]));
    const i = a.pick(pair), j = a.pick(pair.filter((x) => fills[x] !== fills[i]));
    odd = scene(base.parts.map((p) => p.id === 'obj' + (i + 1) ? { ...p, f: fills[j] } : p.id === 'obj' + (j + 1) ? { ...p, f: fills[i] } : p));
    explain = 'bangun ' + glyphName(glyphs[i]) + ' dan ' + glyphName(glyphs[j]) + ' bertukar warna';
  } else if (mode === 'ganti') {
    const i = a.int(0, n - 1), g = a.pick(MARK_GLYPHS.filter((x) => !glyphs.includes(x)));
    odd = scene(base.parts.map((p) => p.id === 'obj' + (i + 1) ? mk(p.id, g, p.x, p.y, { radius: 6, f: p.f }) : p));
    explain = 'bangun ' + glyphName(glyphs[i]) + ' diganti dengan ' + glyphName(g);
  } else {
    odd = flipScene(base);
    explain = 'seluruh susunan tercermin sehingga urutan bangunnya terbalik';
  }
  if (!odd || rotationBetween(base, odd) !== null) return null;
  const choices = tier === 0 ? [0, 90, 180, 270] : tier === 1 ? [0, 45, 90, 135, 180, 225, 270, 315] : Array.from({ length: 24 }, (_, i) => i * 15);
  // Empat salinan memakai sudut yang berbeda; gambar yang berbeda boleh memakai sudut mana pun karena bentuknya sudah beda.
  const oddAt = a.int(0, 4), copies = a.shuffle(choices).slice(0, 4), oddTurn = a.pick(choices);
  const turns = Array.from({ length: 5 }, (_, i) => i === oddAt ? oddTurn : copies[i - (i > oddAt ? 1 : 0)]);
  const scenes = turns.map((deg, i) => rotateScene(i === oddAt ? odd! : base, deg));
  if (scenes.some((s) => !layoutOk(s, LIMIT))) return null;
  const same = arrow(cyclicOrder(base).labels), different = arrow(cyclicOrder(odd).labels);
  if (same === different) return null;
  const reasons = scenes.map((s, i) => {
    const order = cyclicOrder(s);
    return i === oddAt ? 'Urutan bangun searah jarum jam pada gambar ini adalah ' + arrow(order.labels) + ' (bangun pertama, ' + order.labels[0] + ', berada pada arah ' + order.start + '° dari atas), berbeda dari keempat gambar lain: ' + explain + '.' :
      'Urutan bangun searah jarum jam adalah ' + arrow(order.labels) + ' (bangun pertama, ' + order.labels[0] + ', berada pada arah ' + order.start + '° dari atas), sama dengan tiga gambar lain; gambar ini hanya diputar.';
  });
  return {
    kind: 'ketidaksamaan', columns: 5, scenes: [], key: scenes[oddAt], wrong: [], options: scenes, answer: oddAt, reasons, keyReason: reasons[oddAt],
    rule: { mekanisme: 'ketidaksamaan-urutan', aturan: ['Urutan bangun di sekeliling pusat (searah jarum jam) sama pada empat gambar; hanya sudut putarnya yang berbeda'] },
    explanation: 'Perhatikan urutan bangun di sekeliling pusat gambar, dibaca searah jarum jam. Empat gambar memiliki urutan yang sama, yaitu ' + same + '; gambar-gambar itu hanya diputar dengan sudut yang berbeda-beda. ' +
      'Gambar yang berbeda memiliki urutan ' + different + ': ' + explain + '. Jadi gambar yang berbeda adalah gambar dengan urutan tersebut.',
    difficultyReason: tier === 0 ? 'Empat bangun pada pusat yang sama; perbedaan terlihat dari urutan atau bentuk bangun.' : tier === 1 ? 'Lima bangun; perbedaan hanya pada susunan atau warna, sedangkan seluruh bangun tetap sama.' : 'Enam bangun dengan daftar bangun, warna, dan jumlah yang sama pada kelima gambar; hanya susunan yang membedakan.',
    stem: STEMS.ketidaksamaan[0],
  };
}

// Mekanisme 2: banyaknya bangun hitam pada empat gambar bersifat sama (ganjil atau genap), satu gambar berbeda.
function buildParity(a: Rng, tier: number): Built | null {
  const maxBlack = tier === 0 ? 8 : tier === 1 ? 10 : 13, parity = a.int(0, 1);
  const pool = Array.from({ length: maxBlack }, (_, i) => i + 1);
  const same = a.shuffle(pool.filter((v) => v % 2 === parity)).slice(0, 4), other = a.pick(pool.filter((v) => v % 2 !== parity));
  if (same.length < 4) return null;
  const oddAt = a.int(0, 4), arrangedBlack = Array(5).fill(0).map((_, i) => i === oddAt ? other : same[i - (i > oddAt ? 1 : 0)]);
  const glyphs = tier === 2 ? a.shuffle(['lingkaran', 'persegi', 'segitiga', 'bintang']).slice(0, 2) : [a.pick(['lingkaran', 'persegi', 'segitiga', 'bintang'])];
  // Banyaknya bangun putih dan abu-abu diundi ulang sampai tidak ada ciri lain yang ikut menunjuk satu gambar.
  let scenes: Scene[] | null = null;
  for (let attempt = 0; attempt < 40 && !scenes; attempt++) {
    const made = arrangedBlack.map((b) => {
      const white = a.int(tier === 0 ? 0 : 1, tier === 0 ? 4 : 5), gray = tier === 0 ? 0 : a.int(0, tier === 1 ? 3 : 4), total = b + white + gray;
      if (total > 20) return null;
      const cols = total <= 9 ? 3 : total <= 16 ? 4 : 5, pitch = total <= 9 ? 24 : total <= 16 ? 21 : 17, slots = packPositions(total, cols, pitch);
      const fills = a.shuffle([...Array(b).fill(2), ...Array(white).fill(0), ...Array(gray).fill(1)]) as Fill[];
      return scene(slots.map(([x, y], i) => mk('item' + (i + 1), a.pick(glyphs), x, y, { radius: total <= 9 ? 8 : total <= 16 ? 7 : 6, f: fills[i] })));
    });
    if (made.some((s) => !s || !layoutOk(s))) continue;
    const list = made as Scene[], table = panel(list);
    if (singled(table.paritas) !== oddAt) continue;
    if (Object.entries(table).some(([name, values]) => name !== 'paritas' && singled(values) >= 0 && singled(values) !== oddAt)) continue;
    scenes = list;
  }
  if (!scenes) return null;
  const kind = parity ? 'ganjil' : 'genap', opposite = parity ? 'genap' : 'ganjil';
  const reasons = scenes.map((s, i) => {
    const n = s.parts.filter((p) => p.f === 2).length;
    return i === oddAt ? 'Terdapat ' + n + ' bangun hitam pada gambar ini (' + opposite + '), sedangkan keempat gambar lain memuat jumlah bangun hitam ' + kind + '.' :
      'Terdapat ' + n + ' bangun hitam pada gambar ini (' + kind + '), sama seperti tiga gambar lain.';
  });
  return {
    kind: 'ketidaksamaan', columns: 5, scenes: [], key: scenes[oddAt], wrong: [], options: scenes, answer: oddAt, reasons, keyReason: reasons[oddAt],
    rule: { mekanisme: 'ketidaksamaan-paritas', aturan: ['Banyaknya bangun hitam pada empat gambar bersifat ' + kind + '; satu gambar bersifat ' + opposite] },
    explanation: 'Hitung banyaknya bangun berwarna hitam pada kelima gambar; hasilnya (diurutkan dari yang paling sedikit) adalah ' + [...arrangedBlack].sort((x, y) => x - y).join(', ') + '. Empat gambar memuat jumlah bangun hitam ' + kind + ', sedangkan satu gambar memuat jumlah ' + opposite + ' (' + other + ' bangun hitam). ' +
      'Banyaknya bangun putih atau abu-abu dan susunan letaknya berbeda-beda pada tiap gambar dan tidak menentukan kelompok.',
    difficultyReason: tier === 0 ? 'Menghitung bangun hitam dalam jumlah kecil dengan satu warna pembanding.' : tier === 1 ? 'Menghitung bangun hitam di antara bangun putih dan abu-abu yang tersebar acak.' : 'Menghitung bangun hitam dalam jumlah besar di antara dua jenis bangun dan tiga warna.',
    stem: STEMS.ketidaksamaan[0],
  };
}

// Mekanisme 3: banyaknya sisi bangun segi banyak; satu gambar tidak berpasangan dengan yang lain.
function randomPolygon(a: Rng, n: number, radius: number): [number, number][] | null {
  for (let tries = 0; tries < 60; tries++) {
    const pts: [number, number][] = [];
    for (let j = 0; j < n; j++) {
      // Sebagian titik sudut menjorok ke dalam supaya setiap sudut terbaca jelas sebagai sudut.
      const angle = (j + a.next() * 0.5 - 0.25) * 360 / n, rho = radius * (a.next() < 0.45 ? 0.3 + a.next() * 0.25 : 0.78 + a.next() * 0.22);
      pts.push([Math.round(rho * Math.sin(angle * Math.PI / 180) * 100) / 100, Math.round(-rho * Math.cos(angle * Math.PI / 180) * 100) / 100]);
    }
    let ok = true;
    for (let j = 0; j < n && ok; j++) {
      const p = pts[j], q = pts[(j + 1) % n], r = pts[(j + 2) % n], v1 = [q[0] - p[0], q[1] - p[1]], v2 = [r[0] - q[0], r[1] - q[1]];
      const turn = Math.abs(Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]) * 180 / Math.PI);
      if (turn < 24 || Math.hypot(v1[0], v1[1]) < 7) ok = false;
    }
    if (ok) return pts;
  }
  return null;
}
function buildSides(a: Rng, tier: number): Built | null {
  let sides: number[];
  if (tier === 0) { const x = a.int(5, 9), y = a.pick([x + 3, x - 3, x + 4].filter((v) => v >= 4 && v <= 12)); sides = [x, x, x, x, y]; }
  else if (tier === 1) { const x = a.int(6, 10), y = x + a.pick([2, 3]), z = a.pick([x - 2, y + 2, x - 3].filter((v) => v >= 4 && v <= 12 && v !== x && v !== y)); sides = [x, x, y, y, z]; }
  else { const x = a.int(7, 10), y = x + 1, z = a.pick([x - 1, y + 1].filter((v) => v >= 4 && v <= 12)); sides = [x, x, y, y, z]; }
  const order = a.shuffle(sides), polygons = order.map((n, i) => { const pts = randomPolygon(a, n, 38); return pts ? polygonPart('poligon' + (i + 1), pts, 0, 0, { r: a.int(0, 23) * 15, f: 0 }) : null; });
  if (polygons.some((p) => !p)) return null;
  const scenes = polygons.map((p) => scene([p as Part]));
  if (scenes.some((s) => !layoutOk(s, 52))) return null;
  const table = panel(scenes), key = singled(table.sisi);
  if (key < 0 || scenes.map(sidesOf).some((v, i) => v !== order[i])) return null;
  for (const [name, values] of Object.entries(table)) if (name !== 'sisi') { const other = singled(values); if (other >= 0 && other !== key) return null; }
  const count = (v: number) => order.filter((x) => x === v).length;
  const detail = (p: Part) => {
    const w = worldPoints(p), n = w.length, area = w.reduce((sum, q, i) => sum + (q[0] * w[(i + 1) % n][1] - w[(i + 1) % n][0] * q[1]), 0);
    let longest = 0, where = 0, concave = 0;
    w.forEach((q, i) => {
      const r = w[(i + 1) % n], t = w[(i + 2) % n], length = Math.hypot(r[0] - q[0], r[1] - q[1]);
      if (length > longest) { longest = length; where = Math.atan2((q[0] + r[0]) / 2, -(q[1] + r[1]) / 2) * 180 / Math.PI; }
      if (((r[0] - q[0]) * (t[1] - r[1]) - (r[1] - q[1]) * (t[0] - r[0])) * area < 0) concave++;
    });
    return ' (sisi terpanjangnya menghadap ke ' + dirWord(where) + ', sekitar ' + (Math.round(norm(where) / 5) * 5) % 360 + '° dari atas searah jarum jam, dan memiliki ' + concave + ' sudut cekung)';
  };
  const reasons = scenes.map((s, i) => i === key ? 'Gambar ini memiliki ' + order[i] + ' sisi' + detail(s.parts[0]) + ', satu-satunya yang tidak berpasangan dengan gambar lain dalam banyaknya sisi.' :
    'Gambar ini memiliki ' + order[i] + ' sisi' + detail(s.parts[0]) + ', sama dengan ' + (count(order[i]) - 1 === 1 ? 'satu gambar lain' : (count(order[i]) - 1) + ' gambar lain') + '.');
  const groups = [...new Set(order.filter((v) => v !== order[key]))].sort((x, y) => x - y);
  return {
    kind: 'ketidaksamaan', columns: 5, scenes: [], key: scenes[key], wrong: [], options: scenes, answer: key, reasons, keyReason: reasons[key],
    rule: { mekanisme: 'ketidaksamaan-sisi', aturan: ['Gambar-gambar dikelompokkan menurut banyaknya sisi; satu gambar tidak memiliki pasangan'] },
    explanation: 'Hitung banyaknya sisi pada kelima gambar; hasilnya (diurutkan dari yang paling sedikit) adalah ' + [...order].sort((x, y) => x - y).join(', ') + '. Gambar-gambar dengan ' + listText(groups.map(String)) + ' sisi masing-masing berpasangan, sedangkan gambar dengan ' + order[key] + ' sisi tidak memiliki pasangan. Jadi yang berbeda adalah gambar dengan ' + order[key] + ' sisi.',
    difficultyReason: tier === 0 ? 'Empat gambar punya jumlah sisi sama; selisih jumlah sisi dengan gambar yang berbeda besar.' : tier === 1 ? 'Gambar membentuk dua pasangan dan satu gambar tanpa pasangan; selisih jumlah sisi kecil.' : 'Dua pasangan dengan jumlah sisi berurutan dan satu gambar tanpa pasangan; menuntut penghitungan sisi yang teliti.',
    stem: STEMS.ketidaksamaan[0],
  };
}

export function buildOdd(a: Rng, level: Difficulty): Built | null {
  const tier = Math.min(2, tierOf(level)), roll = a.next();
  return roll < 0.3 ? buildOrder(a, tier) : roll < 0.45 ? buildParity(a, tier) : roll < 0.6 ? buildSides(a, tier) : buildLineOdd(a, level);
}
