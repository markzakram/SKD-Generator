// Katalog bentuk dasar (glyph) untuk figural. Semua bentuk tertutup, berpusat di (0, 0), y ke bawah.
// Orientasi baku "menghadap atas". Bentuk yang punya sumbu cermin selalu digambar simetris terhadap
// sumbu tegak, sehingga perbandingan arah cukup memakai putaran modulo orde simetrinya.
export type Pt = [number, number];
export type Glyph = {
  id: string;
  nama: string;
  d: string; // data path SVG pada koordinat glyph
  pts: Pt[]; // pendekatan kontur untuk ukuran dan uji simetri
  k: number; // orde simetri putar; 0 = bulat sempurna
  chiral: boolean; // true = tidak punya sumbu cermin
  R: number; // jari-jari lingkaran luar
  inR: number; // jarak terdekat dari pusat ke tepi (jari-jari dalam)
  hadap?: string; // kata kerja arah untuk pembahasan, mis. "menunjuk"
};

const f = (v: number) => String(Math.round(v * 1000) / 1000);
const rad = (deg: number) => deg * Math.PI / 180;
const pathOf = (pts: Pt[]) => 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join('L') + 'Z';
const regular = (n: number, R: number, start = -90): Pt[] => Array.from({ length: n }, (_, i) => [R * Math.cos(rad(start + i * 360 / n)), R * Math.sin(rad(start + i * 360 / n))] as Pt);
const star = (n: number, R: number, r: number, start = -90): Pt[] => Array.from({ length: n * 2 }, (_, i) => {
  const radius = i % 2 ? r : R, angle = rad(start + i * 180 / n);
  return [radius * Math.cos(angle), radius * Math.sin(angle)] as Pt;
});
// Titik sepanjang busur dari sudut a0 ke a1 (derajat, bertambah = searah jarum jam di layar).
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, steps = 24): Pt[] =>
  Array.from({ length: steps + 1 }, (_, i) => { const a = rad(a0 + (a1 - a0) * i / steps); return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt; });
const edgeDistance = (pts: Pt[]) => {
  let min = Infinity;
  pts.forEach(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length], dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len)) : 0;
    min = Math.min(min, Math.hypot(x1 + dx * t, y1 + dy * t));
  });
  return min;
};
const make = (id: string, nama: string, d: string, pts: Pt[], k: number, chiral: boolean, hadap?: string): Glyph =>
  ({ id, nama, d, pts, k, chiral, R: Math.max(...pts.map(([x, y]) => Math.hypot(x, y))), inR: edgeDistance(pts), ...(hadap ? { hadap } : {}) });
const polygon = (id: string, nama: string, pts: Pt[], k: number, chiral = false, hadap?: string) => make(id, nama, pathOf(pts), pts, k, chiral, hadap);

// Bulan sabit terbuka ke atas: lingkaran besar dikurangi lingkaran yang digeser ke atas.
const crescent = (() => {
  const R1 = 10, r2 = 8, cy = -4.5, y = (R1 * R1 - r2 * r2 + cy * cy) / (2 * cy), x = Math.sqrt(R1 * R1 - y * y);
  const a1 = Math.atan2(y, x) * 180 / Math.PI;
  const outer = arc(0, 0, R1, 180 - a1, a1, 40), inner = arc(0, cy, r2, Math.atan2(y - cy, x) * 180 / Math.PI, 180 - Math.atan2(y - cy, x) * 180 / Math.PI, 40);
  return make('bulan', 'bulan sabit', 'M' + f(-x) + ' ' + f(y) + 'A' + R1 + ' ' + R1 + ' 0 1 0 ' + f(x) + ' ' + f(y) + 'A' + r2 + ' ' + r2 + ' 0 1 1 ' + f(-x) + ' ' + f(y) + 'Z', [...outer, ...inner], 1, false, 'terbuka ke');
})();
const dome = make('setengah', 'setengah lingkaran', 'M-10 5A10 10 0 0 1 10 5Z', arc(0, 5, 10, 180, 360, 30), 1, false, 'melengkung ke');
const band = (() => {
  const outer = arc(0, 0, 12, -135, -45, 20), inner = arc(0, 0, 7.5, -45, -135, 20), pts = [...outer, ...inner];
  const shift = -(Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2, moved = pts.map(([x, y]) => [x, y + shift] as Pt);
  const [o1, o2, i2, i1] = [outer[0], outer[outer.length - 1], inner[0], inner[inner.length - 1]].map(([x, y]) => [x, y + shift] as Pt);
  return make('busur', 'busur', 'M' + f(o1[0]) + ' ' + f(o1[1]) + 'A12 12 0 0 1 ' + f(o2[0]) + ' ' + f(o2[1]) + 'L' + f(i2[0]) + ' ' + f(i2[1]) + 'A7.5 7.5 0 0 0 ' + f(i1[0]) + ' ' + f(i1[1]) + 'Z', moved, 1, false, 'melengkung ke');
})();
const drop = (() => {
  const apex = -11, cy = 3.5, r = 6.5, d = cy - apex, alpha = Math.asin(r / d), len = Math.sqrt(d * d - r * r);
  const tx = len * Math.sin(alpha), ty = apex + len * Math.cos(alpha), a = Math.atan2(ty - cy, tx) * 180 / Math.PI;
  return make('tetes', 'tetesan', 'M0 ' + apex + 'L' + f(tx) + ' ' + f(ty) + 'A' + r + ' ' + r + ' 0 1 1 ' + f(-tx) + ' ' + f(ty) + 'Z', [[0, apex], ...arc(0, cy, r, a, 180 - a, 28)], 1, false, 'runcing ke');
})();
const circle = make('lingkaran', 'lingkaran', 'M-10 0A10 10 0 1 0 10 0A10 10 0 1 0 -10 0Z', arc(0, 0, 10, 0, 360, 48), 0, false);

export const GLYPH_LIST: Glyph[] = [
  circle,
  polygon('persegi', 'persegi', [[-9, -9], [9, -9], [9, 9], [-9, 9]], 4),
  polygon('segitiga', 'segitiga', [[0, -10.392], [9, 5.196], [-9, 5.196]], 3, false, 'runcing ke'),
  polygon('belah', 'belah ketupat', [[0, -11], [7, 0], [0, 11], [-7, 0]], 2),
  polygon('bintang', 'bintang', star(5, 11, 4.5), 5),
  polygon('kilau', 'bintang bersudut empat', star(4, 11, 3.2), 4),
  crescent,
  polygon('panah', 'panah', [[0, -11], [8, -1], [3, -1], [3, 11], [-3, 11], [-3, -1], [-8, -1]], 1, false, 'menunjuk ke'),
  polygon('batang', 'batang', [[-2.5, -11], [2.5, -11], [2.5, 11], [-2.5, 11]], 2),
  polygon('tambah', 'tanda tambah', [[-3, -10], [3, -10], [3, -3], [10, -3], [10, 3], [3, 3], [3, 10], [-3, 10], [-3, 3], [-10, 3], [-10, -3], [-3, -3]], 4),
  polygon('rumah', 'segi lima runcing', [[0, -11], [9, -3], [9, 9], [-9, 9], [-9, -3]], 1, false, 'runcing ke'),
  polygon('segienam', 'segienam', regular(6, 10), 6),
  dome,
  polygon('layang', 'layang-layang', [[0, -11], [7, -3], [0, 11], [-7, -3]], 1, false, 'runcing ke'),
  polygon('trapesium', 'trapesium', [[-6, -6], [6, -6], [11, 6], [-11, 6]], 1, false, 'sisi pendek ke'),
  band,
  drop,
  polygon('siku', 'bentuk L', [[-8, -10], [-2, -10], [-2, 4], [9, 4], [9, 10], [-8, 10]], 1, true),
  polygon('jajar', 'jajar genjang', [[-3, -8], [11, -8], [3, 8], [-11, 8]], 2, true),
  polygon('segitigasiku', 'segitiga siku-siku', [[-8, -9], [-8, 7], [10, 7]], 1, true),
  polygon('baling', 'baling-baling', Array.from({ length: 6 }, (_, i) => {
    const angle = rad(-90 + Math.floor(i / 2) * 120 + (i % 2 ? 42 : 0)), radius = i % 2 ? 3.4 : 11;
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as Pt;
  }), 3, true),
  polygon('zigzag', 'bentuk S', [[-3, -10], [9, -10], [9, 0], [3, 0], [3, 10], [-9, 10], [-9, 0], [-3, 0]], 2, true),
  polygon('bendera', 'bendera', [[-6, -11], [9, -5.5], [-4.5, 0], [-4.5, 11], [-6, 11]], 1, true),
];
export const GLYPHS: Record<string, Glyph> = Object.fromEntries(GLYPH_LIST.map((glyph) => [glyph.id, glyph]));
// Bagian yang bentuknya ditentukan oleh titik (poligon tertutup, garis terbuka), bukan oleh katalog.
export const isShapeG = (g: string) => g === 'poligon' || g === 'garis';
export const glyph = (id: string): Glyph => {
  const found = GLYPHS[id];
  if (!found) throw new Error('Bentuk figural tidak dikenal: ' + id);
  return found;
};
// Kelompok bentuk menurut peran dalam soal.
export const FRAME_GLYPHS = ['lingkaran', 'persegi', 'belah', 'segienam', 'segitiga'];
export const CORE_GLYPHS = ['panah', 'bulan', 'rumah', 'siku', 'jajar', 'baling', 'bendera', 'segitigasiku', 'zigzag', 'layang', 'trapesium', 'tetes'];
export const MARK_GLYPHS = ['lingkaran', 'persegi', 'segitiga', 'bintang', 'kilau', 'belah', 'bulan', 'tambah', 'segienam'];
export const PLAIN_GLYPHS = ['lingkaran', 'persegi', 'segitiga', 'bintang', 'belah', 'segienam', 'tambah', 'kilau'];
