// Gambar garis dari benih: delapan keluarga bentuk, penyaring keterbacaan, dan pengecoh dengan satu beda konkret.
// Port dari mesin figural milik user ("Figural Kesesuaian Generator", figure.js / families.js / quiz.js) ke model bagian (Part).
//
// Sebuah gambar garis adalah kumpulan unsur: garis terbuka (boleh berkepala), poligon tertutup, atau lingkaran. Pada model Part,
// setiap unsur menjadi satu bagian yang berpusat di titik-rata-rata sudutnya; memutar seluruh gambar berarti memutar tiap bagian
// terhadap pusat gambar, sedangkan memutar satu unsur pada tempatnya hanya mengubah `r` bagian itu.
import type { Rng } from '../rng';
import { rng } from '../rng';
import type { Fill, Part, Scene } from '../types';
import { exactPoints, flipScene, mk, norm, partRadius, rotatePart, rotationAngles, rotationBetween, round, scene, strokePart } from './scene';

type Pt = [number, number];
export type Unsur = { jenis: 'garis'; titik: Pt[]; tutup: boolean; isi: boolean; kepala: number } | { jenis: 'bulat'; pusat: Pt; jari: number; isi: boolean };
export type UnsurN = Unsur & { nama: string };
export const R = 46; // jangkauan baku: semua gambar dipaskan ke jari-jari ini
const COBA_MAKS = 24;
const AMBANG = { ruas: 0.13, pipih: 0.5, rapat: 0.11, tintaMin: 3.4, tintaMaks: 26, bedaCermin: 0.045 };
const rad = (deg: number) => deg * Math.PI / 180;

// ----------------------------------------------------------------- pengubah Part <-> Unsur
export function unsurOf(s: Scene): Unsur[] {
  return s.parts.map((p): Unsur => {
    if (p.g === 'garis' || p.g === 'poligon') return { jenis: 'garis', titik: exactPoints(p), tutup: p.g === 'poligon', isi: p.f === 2, kepala: p.h ?? 0 };
    if (p.g === 'lingkaran') return { jenis: 'bulat', pusat: [p.x, p.y], jari: partRadius(p), isi: p.f === 2 };
    throw new Error('Bentuk ' + p.g + ' bukan unsur gambar garis.');
  });
}
const meanPoint = (points: Pt[]): Pt => [points.reduce((sum, p) => sum + p[0], 0) / points.length, points.reduce((sum, p) => sum + p[1], 0) / points.length];
// Nama unsur menjadi id bagian; nama kembar diberi nomor urut ("tali busur ke-2") agar tetap unik.
export function sceneOf(list: UnsurN[]): Scene {
  const seen = new Map<string, number>(), total = new Map<string, number>();
  list.forEach((u) => total.set(u.nama, (total.get(u.nama) ?? 0) + 1));
  return scene(list.map((u): Part => {
    const nth = (seen.get(u.nama) ?? 0) + 1;
    seen.set(u.nama, nth);
    const id = (total.get(u.nama)! > 1 ? u.nama + ' ke-' + nth : u.nama).slice(0, 40);
    if (u.jenis === 'bulat') return mk(id, 'lingkaran', u.pusat[0], u.pusat[1], { radius: u.jari, f: (u.isi ? 2 : 3) as Fill });
    const c = meanPoint(u.titik);
    return strokePart(id, u.tutup, u.titik.map(([x, y]) => [x - c[0], y - c[1]] as Pt), c[0], c[1], { f: (u.tutup && u.isi ? 2 : 3) as Fill, h: u.kepala === 1 || u.kepala === 2 ? u.kepala : undefined });
  }));
}

// ----------------------------------------------------------------- ukuran dan pencuplikan
const panjangUnsur = (u: Unsur) => {
  if (u.jenis === 'bulat') return 2 * Math.PI * u.jari;
  const m = u.titik.length, batas = u.tutup ? m : m - 1;
  let sum = 0;
  for (let k = 0; k < batas; k++) sum += Math.hypot(u.titik[(k + 1) % m][0] - u.titik[k][0], u.titik[(k + 1) % m][1] - u.titik[k][1]);
  return sum;
};
const panjangTotal = (list: Unsur[]) => list.reduce((sum, u) => sum + panjangUnsur(u), 0);
// Awan titik rapat sepanjang seluruh unsur; jaraknya tetap supaya unsur panjang menyumbang lebih banyak titik.
export function sampel(list: Unsur[], langkah = 2): Pt[] {
  const out: Pt[] = [];
  for (const u of list) {
    if (u.jenis === 'bulat') {
      const n = Math.max(8, Math.round(2 * Math.PI * u.jari / langkah));
      for (let i = 0; i < n; i++) out.push([u.pusat[0] + u.jari * Math.cos(2 * Math.PI * i / n), u.pusat[1] + u.jari * Math.sin(2 * Math.PI * i / n)]);
      continue;
    }
    const t = u.titik, m = t.length, batas = u.tutup ? m : m - 1;
    for (let k = 0; k < batas; k++) {
      const p = t[k], q = t[(k + 1) % m], n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / langkah));
      for (let j = 0; j < n; j++) out.push([p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n]);
    }
    if (!u.tutup) out.push([t[m - 1][0], t[m - 1][1]]);
  }
  return out;
}
const sampelBatas = (list: Unsur[], maks: number) => sampel(list, Math.max(2, panjangTotal(list) / maks));
export const jangkauan = (list: Unsur[]) => sampel(list, 1.5).reduce((max, p) => Math.max(max, Math.hypot(p[0], p[1])), 0);
function ruasTerpendek(list: Unsur[]): number {
  let min = Infinity;
  for (const u of list) {
    if (u.jenis === 'bulat') { min = Math.min(min, 2 * u.jari); continue; }
    const m = u.titik.length, batas = u.tutup ? m : m - 1;
    for (let k = 0; k < batas; k++) min = Math.min(min, Math.hypot(u.titik[(k + 1) % m][0] - u.titik[k][0], u.titik[(k + 1) % m][1] - u.titik[k][1]));
  }
  return min === Infinity ? 0 : min;
}
function kotak(list: Unsur[]) {
  const s = sampel(list, 1.5);
  if (!s.length) return { w: 0, h: 0 };
  const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}
function chamfer(p: Pt[], q: Pt[]): number {
  let sum = 0;
  for (const [x, y] of p) { let min = Infinity; for (const [u, v] of q) { const d = (x - u) ** 2 + (y - v) ** 2; if (d < min) min = d; } sum += Math.sqrt(min); }
  return sum / p.length;
}
// Beda dua gambar SETELAH diputar sepas mungkin, dalam satuan jangkauan: jarak chamfer dua arah pada putaran terbaik.
export function bedaBentuk(A: Unsur[], B: Unsur[]): number {
  const a = sampelBatas(A, 44), b = sampelBatas(B, 44);
  if (!a.length || !b.length) return 1;
  const ukuran = Math.max(jangkauan(A), jangkauan(B), 1e-6);
  const jarakPada = (deg: number) => {
    const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), ap = a.map(([x, y]) => [x * c - y * s, x * s + y * c] as Pt);
    return (chamfer(ap, b) + chamfer(b, ap)) / 2;
  };
  let terbaik = Infinity, sudutTerbaik = 0;
  for (let d = 0; d < 360; d += 6) { const v = jarakPada(d); if (v < terbaik) { terbaik = v; sudutTerbaik = d; } }
  for (let d = sudutTerbaik - 5; d <= sudutTerbaik + 5; d++) terbaik = Math.min(terbaik, jarakPada(d));
  return terbaik / ukuran;
}
const bedaUnsur = (u1: Unsur, u2: Unsur) => { const a = sampelBatas([u1], 30), b = sampelBatas([u2], 30); return a.length && b.length ? (chamfer(a, b) + chamfer(b, a)) / 2 : Infinity; };

// ----------------------------------------------------------------- struktur hubungan antar unsur
const didalam = (p: Pt, w: Unsur): boolean => {
  if (w.jenis === 'bulat') return Math.hypot(p[0] - w.pusat[0], p[1] - w.pusat[1]) < w.jari;
  const t = w.titik, n = t.length;
  let masuk = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if ((t[i][1] > p[1]) === (t[j][1] > p[1])) continue;
    const x = (t[j][0] - t[i][0]) * (p[1] - t[i][1]) / (t[j][1] - t[i][1]) + t[i][0];
    if (p[0] < x) masuk = !masuk;
  }
  return masuk;
};
const bisaMewadahi = (u: Unsur) => u.jenis === 'bulat' || u.tutup;
const jarakKeRuas = (p: Pt, a: Pt, b: Pt) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], pjg = vx * vx + vy * vy, t = pjg < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / pjg));
  return Math.hypot(p[0] - (a[0] + vx * t), p[1] - (a[1] + vy * t));
};
// Jarak titik ke goresan sebuah unsur, dihitung tepat (bukan ke titik cuplikan) agar kebal putaran.
const jarakKeUnsur = (p: Pt, u: Unsur): number => {
  if (u.jenis === 'bulat') return Math.abs(Math.hypot(p[0] - u.pusat[0], p[1] - u.pusat[1]) - u.jari);
  const m = u.titik.length, batas = u.tutup ? m : m - 1;
  let min = Infinity;
  for (let k = 0; k < batas; k++) min = Math.min(min, jarakKeRuas(p, u.titik[k], u.titik[(k + 1) % m]));
  return min;
};
export function tandaUnsur(u: Unsur): string {
  if (u.jenis === 'bulat') return 'b|' + (u.isi ? 'i' : 'k') + '|' + u.jari.toFixed(2);
  return 'g|' + (u.tutup ? 't' : 'b') + '|' + (u.isi ? 'i' : 'k') + '|' + u.kepala + '|' + u.titik.length + '|' + panjangUnsur(u).toFixed(1);
}
const tandaBentuk = (list: Unsur[]) => list.map(tandaUnsur).sort().join(';');
// Struktur hubungan: mana bersambung di ujung dengan mana, dan apa di dalam apa. Terbaca sekilas tanpa memutar gambar.
export function strukturKey(list: Unsur[]): string {
  const n = list.length;
  if (!n) return '';
  const jang = jangkauan(list) || 1, tau = jang * 0.05;
  const cuplik = list.map((u) => sampelBatas([u], 44));
  const ujung = list.map((u): Pt[] => u.jenis === 'bulat' || u.tutup ? [] : [u.titik[0], u.titik[u.titik.length - 1]]);
  const simpul = (iA: number, iB: number): number => {
    const uA = list[iA], uB = list[iB];
    if (uA.jenis === 'bulat' && uB.jenis === 'bulat') return 0;
    const [a, lawan] = uA.jenis === 'bulat' ? [cuplik[iB], uA] : [cuplik[iA], uB], tepi = [...ujung[iA], ...ujung[iB]];
    if (!tepi.length) return 0;
    const dekat = a.filter((p) => jarakKeUnsur(p, lawan) < tau && tepi.some((e) => Math.hypot(p[0] - e[0], p[1] - e[1]) < tau * 2));
    if (!dekat.length) return 0;
    const sisa = dekat.slice(); let gugus = 0;
    while (sisa.length) {
      const antre = [sisa.pop()!]; gugus++;
      while (antre.length) {
        const p = antre.pop()!;
        for (let k = sisa.length - 1; k >= 0; k--) if (Math.hypot(sisa[k][0] - p[0], sisa[k][1] - p[1]) < tau * 2.5) { antre.push(sisa[k]); sisa.splice(k, 1); }
      }
    }
    return Math.min(gugus, 4);
  };
  const wadah = (iA: number, uB: Unsur): string => {
    if (!bisaMewadahi(uB)) return '-';
    const uA = list[iA];
    if (uA.jenis === 'bulat') {
      if (uB.jenis === 'bulat') { const d = Math.hypot(uA.pusat[0] - uB.pusat[0], uA.pusat[1] - uB.pusat[1]); return d + uA.jari <= uB.jari ? 'd' : d >= uA.jari + uB.jari ? 'l' : 's'; }
      let tepiMin = Infinity;
      for (let k = 0; k < uB.titik.length; k++) tepiMin = Math.min(tepiMin, jarakKeRuas(uA.pusat, uB.titik[k], uB.titik[(k + 1) % uB.titik.length]));
      return tepiMin >= uA.jari ? (didalam(uA.pusat, uB) ? 'd' : 'l') : 's';
    }
    // Titik yang persis di tepi dihitung sebagai di dalam: ujung tali busur BERAKHIR di keliling, bukan melewatinya.
    const masuk = cuplik[iA].filter((p) => didalam(p, uB) || jarakKeUnsur(p, uB) < jang * 0.01).length, f = masuk / cuplik[iA].length;
    return f >= 0.9 ? 'd' : f <= 0.1 ? 'l' : 's';
  };
  const uraian: string[] = [];
  for (let i = 0; i < n; i++) {
    const relasi: string[] = [];
    for (let j = 0; j < n; j++) if (i !== j) relasi.push(tandaUnsur(list[j]) + '~' + simpul(i, j) + '~' + wadah(i, list[j]));
    uraian.push(tandaUnsur(list[i]) + '[' + relasi.sort().join(',') + ']');
  }
  return uraian.sort().join(';');
}
// Titik tumpu sebuah unsur: pusat daerah sentuhnya dengan unsur lain; memutar terhadapnya mempertahankan sentuhan itu.
function titikTumpu(list: Unsur[], idx: number): Pt | null {
  const jang = jangkauan(list) || 1, tau = jang * 0.05, a = sampelBatas([list[idx]], 44), kena: Pt[] = [];
  list.forEach((u, j) => { if (j !== idx) a.forEach((p) => { if (jarakKeUnsur(p, u) < tau) kena.push(p); }); });
  if (!kena.length) return null;
  const pusat = meanPoint(kena);
  return kena.some((p) => Math.hypot(p[0] - pusat[0], p[1] - pusat[1]) > jang * 0.18) ? null : pusat;
}

// ----------------------------------------------------------------- operasi gambar utuh
const geserList = (list: UnsurN[], dx: number, dy: number): UnsurN[] => list.map((u) => u.jenis === 'bulat' ? { ...u, pusat: [u.pusat[0] + dx, u.pusat[1] + dy] as Pt } : { ...u, titik: u.titik.map(([x, y]) => [x + dx, y + dy] as Pt) });
const skalaList = (list: UnsurN[], k: number): UnsurN[] => list.map((u) => u.jenis === 'bulat' ? { ...u, pusat: [u.pusat[0] * k, u.pusat[1] * k] as Pt, jari: u.jari * k } : { ...u, titik: u.titik.map(([x, y]) => [x * k, y * k] as Pt) });
// Pusat tinta: rata-rata letak goresan berbobot panjangnya. Dihitung langsung dari geometri (bukan dari cuplikan titik) sehingga kebal putaran,
// pencerminan, dan pembulatan; pusat dari cuplikan bergeser sampai 0,2 satuan hanya karena jumlah titik pada satu lingkaran berubah satu.
function pusatTinta(list: Unsur[]): Pt {
  let bobot = 0, sx = 0, sy = 0;
  for (const u of list) {
    if (u.jenis === 'bulat') { const w = 2 * Math.PI * u.jari; bobot += w; sx += w * u.pusat[0]; sy += w * u.pusat[1]; continue; }
    const m = u.titik.length, batas = u.tutup ? m : m - 1;
    for (let k = 0; k < batas; k++) {
      const p = u.titik[k], q = u.titik[(k + 1) % m], w = Math.hypot(q[0] - p[0], q[1] - p[1]);
      bobot += w; sx += w * (p[0] + q[0]) / 2; sy += w * (p[1] + q[1]) / 2;
    }
  }
  return bobot ? [sx / bobot, sy / bobot] : [0, 0];
}
function pusatkanList(list: UnsurN[]): UnsurN[] {
  const [cx, cy] = pusatTinta(list);
  return geserList(list, -cx, -cy);
}
export function pusatkanScene(s: Scene): Scene {
  if (!s.parts.length) return s;
  const [cx, cy] = pusatTinta(unsurOf(s));
  return scene(s.parts.map((p) => ({ ...p, x: round(p.x - cx), y: round(p.y - cy) })));
}
const mirrorList = (list: UnsurN[]): UnsurN[] => list.map((u) => u.jenis === 'bulat' ? { ...u, pusat: [-u.pusat[0], u.pusat[1]] as Pt } : { ...u, titik: u.titik.map(([x, y]) => [-x, y] as Pt).reverse() });

// ----------------------------------------------------------------- keluarga bentuk
const KELUARGA = [
  { id: 'sarang', nama: 'Garis bersarang' }, { id: 'datar', nama: 'Bangun datar + penanda' }, { id: 'kisi', nama: 'Kisi titik & penghubung' }, { id: 'panah', nama: 'Panah, sirip & kait' },
  { id: 'zigzag', nama: 'Pita zigzag menyilang' }, { id: 'sisir', nama: 'Tulang & gigi sisir' }, { id: 'blok', nama: 'Blok bertumpuk' }, { id: 'silang', nama: 'Lingkaran & tali silang' },
];
export const KELUARGA_GARIS = KELUARGA.map((k) => k.id);
type Alat = { antara: (lo: number, hi: number) => number; bulat: (lo: number, hi: number) => number; pick: <T>(list: readonly T[]) => T; untung: (p: number) => boolean; tanda: () => 1 | -1; kocok: <T>(list: readonly T[]) => T[] };
const alatOf = (r: Rng): Alat => ({ antara: (lo, hi) => lo + r.next() * (hi - lo), bulat: (lo, hi) => r.int(lo, hi), pick: (list) => r.pick(list), untung: (p) => r.next() < p, tanda: () => r.next() < 0.5 ? -1 : 1, kocok: (list) => r.shuffle(list) });
const putarTitik = (p: Pt, deg: number): Pt => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
const garis = (titik: Pt[], nama: string, o: { tutup?: boolean; isi?: boolean; kepala?: number } = {}): UnsurN => ({ jenis: 'garis', titik, tutup: !!o.tutup, isi: !!o.isi, kepala: o.kepala ?? 0, nama });
const bulat = (pusat: Pt, jari: number, isi: boolean, nama: string): UnsurN => ({ jenis: 'bulat', pusat, jari, isi, nama });
const poligonBeraturan = (n: number, jari: number, awal: number): Pt[] => Array.from({ length: n }, (_, i) => [jari * Math.cos(rad(awal + i * 360 / n)), jari * Math.sin(rad(awal + i * 360 / n))] as Pt);
const putarList = (u: UnsurN, deg: number): UnsurN => u.jenis === 'bulat' ? { ...u, pusat: putarTitik(u.pusat, deg) } : { ...u, titik: u.titik.map((p) => putarTitik(p, deg)) };
const geserSatu = (u: UnsurN, dx: number, dy: number): UnsurN => geserList([u], dx, dy)[0];
function bingkai(a: number, b: number, varian: string, nama: string): UnsurN {
  const s: Pt[] = [[-a, b], [-a, -b], [a, -b], [a, b]];
  if (varian === 'L') return garis(s.slice(0, 3), nama);
  if (varian === 'C') return garis(s, nama);
  if (varian === 'K') return garis(s, nama, { tutup: true });
  return garis([...s, [-a + a * 0.55, b]], nama);
}
const sarang = (a: Alat): UnsurN[] => {
  const n = a.bulat(3, 5), sudut: number[] = []; let pakai = a.antara(0, 360);
  for (let i = 0; i < n; i++) { sudut.push(pakai); pakai += a.antara(22, 62) * (a.untung(0.75) ? 1 : -1); }
  const out: UnsurN[] = [];
  for (let i = 0; i < n; i++) {
    const s = 0.4 + 0.6 * (i / (n - 1)), u = putarList(bingkai(R * s * a.antara(0.8, 1), R * s * a.antara(0.68, 1), a.pick(['L', 'C', 'C', 'G', 'G']), i === 0 ? 'bingkai terdalam' : i === n - 1 ? 'bingkai terluar' : 'bingkai tengah'), sudut[i]);
    const d = R * a.antara(0, 0.09), ar = rad(a.antara(0, 360));
    out.push(geserSatu(u, d * Math.cos(ar), d * Math.sin(ar)));
  }
  if (a.untung(0.35)) out.push(bulat([a.antara(-8, 8), a.antara(-8, 8)], a.antara(3, 5), a.untung(0.6), 'titik pusat'));
  return out;
};
const datar = (a: Alat): UnsurN[] => {
  const sisi = a.pick([3, 4, 5, 6]), jari = R * a.antara(0.88, 1), sudut = poligonBeraturan(sisi, jari, a.antara(0, 360));
  const out: UnsurN[] = [garis(sudut, 'bangun luar', { tutup: true })];
  const tengah = sudut.map((p, i) => [(p[0] + sudut[(i + 1) % sisi][0]) / 2, (p[1] + sudut[(i + 1) % sisi][1]) / 2] as Pt);
  const jenis = a.kocok(['titik', 'tali', 'jari', 'takik', 'segitiga', 'panah']), n = a.bulat(2, 4);
  for (let k = 0; k < n; k++) {
    const j = jenis[k % jenis.length], iv = a.bulat(0, sisi - 1), it = a.bulat(0, sisi - 1);
    if (j === 'titik') { const arah = a.untung(0.5) ? sudut[iv] : tengah[it], f = a.antara(0.34, 0.62); out.push(bulat([arah[0] * f, arah[1] * f], jari * a.antara(0.09, 0.14), a.untung(0.55), 'titik penanda')); }
    else if (j === 'tali' && sisi >= 4) out.push(garis([sudut[iv], sudut[(iv + a.bulat(2, sisi - 2)) % sisi]], 'tali busur'));
    else if (j === 'jari') { const ujung = a.untung(0.5) ? sudut[iv] : tengah[it]; out.push(garis([[0, 0], [ujung[0] * a.antara(0.82, 1), ujung[1] * a.antara(0.82, 1)]], 'jari-jari')); }
    else if (j === 'takik') { const m = tengah[it], pj = Math.hypot(m[0], m[1]) || 1, nx = m[0] / pj, ny = m[1] / pj, t = jari * 0.18; out.push(garis([[m[0] - nx * t, m[1] - ny * t], [m[0] + nx * t, m[1] + ny * t]], 'takik tepi')); }
    else if (j === 'segitiga') { const pus: Pt = [sudut[iv][0] * 0.5, sudut[iv][1] * 0.5]; out.push(garis(poligonBeraturan(3, jari * a.antara(0.2, 0.3), a.antara(0, 360)).map((p) => [p[0] + pus[0], p[1] + pus[1]] as Pt), 'segitiga kecil', { tutup: true })); }
    else if (j !== 'tali') { const uj = tengah[it]; out.push(garis([[0, 0], [uj[0] * a.antara(0.62, 0.85), uj[1] * a.antara(0.62, 0.85)]], 'panah dalam', { kepala: 1 })); }
  }
  return out;
};
const kisi = (a: Alat): UnsurN[] => {
  const n = a.pick([3, 3, 4]), jarak = 2 * R * 0.86 / (n - 1);
  let sisa: Pt[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) sisa.push([-R * 0.86 + j * jarak, -R * 0.86 + i * jarak]);
  sisa = a.kocok(sisa);
  const jalur = sisa.splice(0, a.bulat(4, Math.min(6, sisa.length - 2))), pusat = meanPoint(jalur);
  jalur.sort((p, q) => Math.atan2(p[1] - pusat[1], p[0] - pusat[0]) - Math.atan2(q[1] - pusat[1], q[0] - pusat[0]));
  const tutup = a.untung(0.35), out: UnsurN[] = [garis(jalur, tutup ? 'jalur tertutup' : 'jalur penghubung', { tutup })];
  for (let i = 0, m = a.bulat(1, 3); i < m && sisa.length; i++) out.push(bulat(sisa.shift()!, jarak * a.antara(0.16, 0.24), a.untung(0.55), 'titik kisi'));
  if (a.untung(0.45) && sisa.length >= 2) out.push(garis([sisa[0], sisa[1]], 'ruas lepas'));
  return out;
};
const panah = (a: Alat): UnsurN[] => {
  const n = a.bulat(3, 5), mulai = a.antara(0, 360), langkah = 360 / n, out: UnsurN[] = [];
  for (let i = 0; i < n; i++) {
    const arah = mulai + i * langkah + a.antara(-langkah * 0.28, langkah * 0.28), pj = R * a.antara(0.55, 1), p0 = putarTitik([R * a.antara(0, 0.18), 0], arah);
    let pts: Pt[] = [p0, putarTitik([pj, 0], arah)];
    if (a.untung(0.35)) {
      const tekuk = arah + a.antara(30, 70) * a.tanda(), pt = putarTitik([pj * a.antara(0.5, 0.7), 0], arah), ujung = putarTitik([pj * a.antara(0.42, 0.62), 0], tekuk);
      pts = [p0, pt, [pt[0] + ujung[0], pt[1] + ujung[1]]];
    }
    const kepala = a.pick([0, 1, 1, 2]);
    out.push(garis(pts, kepala === 1 ? 'batang berpanah' : kepala === 2 ? 'batang berkait' : 'batang polos', { kepala }));
  }
  if (a.untung(0.55)) {
    const bentuk = a.pick(['segitiga', 'persegi', 'bulat']);
    if (bentuk === 'bulat') out.push(bulat([0, 0], R * a.antara(0.11, 0.17), a.untung(0.5), 'inti bulat'));
    else out.push(garis(poligonBeraturan(bentuk === 'segitiga' ? 3 : 4, R * a.antara(0.15, 0.22), a.antara(0, 360)), 'inti ' + bentuk, { tutup: true }));
  }
  return out;
};
const zigzag = (a: Alat): UnsurN[] => {
  const n = a.bulat(2, 3), arah = a.antara(0, 360), out: UnsurN[] = [];
  for (let i = 0; i < n; i++) {
    const m = a.bulat(3, 5), panjang = R * a.antara(1.1, 1.7), amp = R * a.antara(0.16, 0.34), pts: Pt[] = [];
    for (let k = 0; k < m; k++) pts.push([-panjang / 2 + panjang * (k / (m - 1)), (k % 2 ? 1 : -1) * amp * a.antara(0.7, 1)]);
    const u = putarList(garis(pts, i === 0 ? 'pita utama' : 'pita silang'), arah + i * a.antara(48, 96) * (a.untung(0.7) ? 1 : -1)), d = R * a.antara(0, 0.22), ar = rad(a.antara(0, 360));
    out.push(geserSatu(u, d * Math.cos(ar), d * Math.sin(ar)));
  }
  if (a.untung(0.5)) out.push(bulat([a.antara(-14, 14), a.antara(-14, 14)], R * a.antara(0.09, 0.14), a.untung(0.55), 'titik penanda'));
  return out;
};
const sisir = (a: Alat): UnsurN[] => {
  const arah = a.antara(0, 360), panjang = R * a.antara(1.25, 1.7), n = a.bulat(3, 5), sisi = a.tanda();
  const out: UnsurN[] = [garis([[-panjang / 2, 0], [panjang / 2, 0]], 'tulang')];
  for (let i = 0; i < n; i++) {
    const t = -panjang / 2 + panjang * ((i + a.antara(0.35, 0.75)) / n);
    let tinggi = R * a.antara(0.32, 0.78) * sisi;
    if (i > 0 && a.untung(0.22)) tinggi = -tinggi * a.antara(0.5, 0.85);
    out.push(garis([[t, 0], [t + a.antara(-0.35, 0.35) * Math.abs(tinggi), tinggi]], 'gigi'));
  }
  if (a.untung(0.45)) out.push(bulat([panjang / 2 * a.antara(0.7, 0.95), 0], R * a.antara(0.09, 0.13), a.untung(0.5), 'titik ujung'));
  return out.map((u) => putarList(u, arah));
};
const blok = (a: Alat): UnsurN[] => {
  const n = a.bulat(2, 4), out: UnsurN[] = [];
  for (let i = 0; i < n; i++) {
    const l = R * a.antara(0.34, 0.62), t = R * a.antara(0.3, 0.62), u = putarList(garis([[-l, -t], [l, -t], [l, t], [-l, t]], 'blok', { tutup: true }), a.antara(0, 360));
    const d = R * a.antara(0.24, 0.62), ar = rad(a.antara(0, 360) + i * 360 / n);
    out.push(geserSatu(u, d * Math.cos(ar), d * Math.sin(ar)));
  }
  if (a.untung(0.55)) { const ar = rad(a.antara(0, 360)), d = R * a.antara(0.2, 0.5); out.push(bulat([d * Math.cos(ar), d * Math.sin(ar)], R * a.antara(0.1, 0.16), a.untung(0.5), 'titik penanda')); }
  return out;
};
const silang = (a: Alat): UnsurN[] => {
  const jari = R * a.antara(0.88, 1), out: UnsurN[] = [bulat([0, 0], jari, false, 'lingkaran luar')], n = a.bulat(3, 4);
  const sudut = Array.from({ length: n * 2 }, () => a.antara(0, 360));
  for (let i = 0; i < n; i++) {
    const a1 = rad(sudut[i * 2]); let a2 = rad(sudut[i * 2 + 1]);
    if (Math.abs(sudut[i * 2] - sudut[i * 2 + 1]) % 360 < 50) a2 += Math.PI * a.antara(0.35, 0.9);
    out.push(garis([[jari * Math.cos(a1), jari * Math.sin(a1)], [jari * Math.cos(a2), jari * Math.sin(a2)]], 'tali busur'));
  }
  for (let i = 0, m = a.bulat(1, 2); i < m; i++) { const ar = rad(a.antara(0, 360)), d = jari * a.antara(0.25, 0.6); out.push(bulat([d * Math.cos(ar), d * Math.sin(ar)], jari * a.antara(0.09, 0.14), a.untung(0.55), 'titik dalam')); }
  return out;
};
const PEMBANGKIT: Record<string, (a: Alat) => UnsurN[]> = { sarang, datar, kisi, panah, zigzag, sisir, blok, silang };

// Penyaring: daftar alasan penolakan (kosong = layak). Syarat pokoknya agar soal sah: simetri putar tunggal dan kiral.
export function periksa(list: UnsurN[]): string[] {
  const gagal: string[] = [], jang = jangkauan(list);
  if (!(jang > 1)) return ['bentuk kosong'];
  if (list.length < 2) gagal.push('unsurnya terlalu sedikit');
  const s = sceneOf(list);
  if (rotationAngles(s, s).some((d) => d > 0.5 && d < 359.5)) gagal.push('simetri putar: sudutnya tidak tunggal');
  if (rotationBetween(flipScene(s), s) !== null) gagal.push('tidak kiral: pengecoh cermin akan ikut benar');
  if (ruasTerpendek(list) < AMBANG.ruas * jang) gagal.push('ada ruas sehalus rambut');
  const k = kotak(list);
  if (Math.min(k.w, k.h) / Math.max(k.w, k.h, 1e-6) < AMBANG.pipih) gagal.push('bentuknya gepeng seperti bilah');
  const tinta = panjangTotal(list) / jang;
  if (tinta < AMBANG.tintaMin) gagal.push('garisnya terlalu sedikit');
  if (tinta > AMBANG.tintaMaks) gagal.push('garisnya terlalu padat');
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (bedaUnsur(list[i], list[j]) < AMBANG.rapat * jang) { gagal.push('dua unsur berhimpit'); return gagal; }
  if (bedaBentuk(unsurOf(sceneOf(mirrorList(list))), list) < AMBANG.bedaCermin) gagal.push('cerminnya nyaris kembar');
  return gagal;
}
const normalkan = (list: UnsurN[]): UnsurN[] => { const tengah = pusatkanList(list), jang = jangkauan(tengah); return jang < 1e-6 ? tengah : pusatkanList(skalaList(tengah, R / jang)); };
function cadangan(): UnsurN[] {
  const u = [putarList(bingkai(R * 0.4, R * 0.32, 'C', 'bingkai terdalam'), 12), putarList(bingkai(R * 0.66, R * 0.54, 'G', 'bingkai tengah'), 47), putarList(bingkai(R * 0.94, R * 0.8, 'C', 'bingkai terluar'), 96)];
  return normalkan(u);
}
export type GambarGaris = { keluarga: string; scene: Scene };
// Satu gambar garis yang PASTI lolos penyaring. Keluarga diundi sekali di luar gelung percobaan agar sebarannya tidak melenceng.
export function bangkitkan(r: Rng, keluarga: string[] = KELUARGA_GARIS): GambarGaris {
  const seed = r.int(0, 0x3fffffff), id = keluarga.length === 1 ? keluarga[0] : keluarga[(seed ^ 0x5bf03635) % keluarga.length];
  for (let c = 0; c < COBA_MAKS; c++) {
    const list = normalkan(PEMBANGKIT[id](alatOf(rng('garis|' + id + '|' + seed + '|' + c))));
    if (!periksa(list).length) return { keluarga: id, scene: sceneOf(list) };
  }
  return { keluarga: 'sarang', scene: sceneOf(cadangan()) };
}

// ----------------------------------------------------------------- pengecoh
export type Tingkat = 'mudah' | 'sedang' | 'sulit';
export type Cacat = { scene: Scene; jenis: string; prinsip: string; beda?: number };
const SUDUT: Record<Tingkat, number[]> = { mudah: [90, 180, 270], sedang: [45, 90, 135, 180, 225, 270, 315], sulit: [45, 135, 225, 315] };
export const sudutDari = (t: Tingkat) => SUDUT[t];
const AMBANG_BEDA = { min: 0.045, maks: 0.42, minSulit: 0.03, minMudah: 0.075, jangkauan: 0.06, coba: 60, cobaProfil: 150 };
const CACAT_KAKU = ['cermin', 'putarTumpu', 'putarUnsur', 'putarSendiri', 'geserUnsur', 'cerminUnsur'];
const PRIORITAS: Record<Tingkat, string[]> = {
  mudah: ['hapusUnsur', 'tambahUnsur', 'skalaUnsur', 'cermin', 'geserUnsur', 'putarUnsur', 'isiUnsur', 'putarSendiri', 'cerminUnsur', 'putarTumpu'],
  sedang: ['cermin', 'putarTumpu', 'putarUnsur', 'skalaUnsur', 'geserUnsur', 'isiUnsur', 'hapusUnsur', 'putarSendiri', 'tambahUnsur', 'cerminUnsur'],
  sulit: ['putarTumpu', 'cermin', 'putarSendiri', 'cerminUnsur', 'putarUnsur', 'geserUnsur', 'isiUnsur', 'skalaUnsur', 'tambahUnsur', 'hapusUnsur'],
};
const minBeda = (t: Tingkat) => t === 'sulit' ? AMBANG_BEDA.minSulit : t === 'mudah' ? AMBANG_BEDA.minMudah : AMBANG_BEDA.min;
export function profilCocok(a: Scene, b: Scene): boolean {
  const A = unsurOf(a), B = unsurOf(b);
  if (tandaBentuk(A) !== tandaBentuk(B)) return false;
  const ja = jangkauan(A), jb = jangkauan(B);
  return Math.abs(ja - jb) <= AMBANG_BEDA.jangkauan * Math.max(ja, jb) && strukturKey(A) === strukturKey(B);
}
// Pengecoh tidak perlu lolos semua penyaring bentuk, tetapi tetap harus terbaca.
function layakPengecoh(s: Scene): boolean {
  const list = unsurOf(s);
  if (list.length < 2) return false;
  const jang = jangkauan(list);
  if (!(jang > 1) || ruasTerpendek(list) < AMBANG.ruas * jang * 0.8) return false;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (bedaUnsur(list[i], list[j]) < AMBANG.rapat * jang * 0.8) return false;
  return true;
}
const ganti = (s: Scene, id: string, change: (p: Part) => Part): Scene => scene(s.parts.map((p) => p.id === id ? change(p) : p));
const pusatUnsur = (u: Unsur): Pt => u.jenis === 'bulat' ? u.pusat : meanPoint(u.titik);
// Putar bagian terhadap titik tumpu: pusat bagian ikut berputar mengelilingi titik itu dan arahnya bertambah sebesar sudutnya.
const putarSekitar = (p: Part, titik: Pt, deg: number): Part => {
  const [dx, dy] = putarTitik([p.x - titik[0], p.y - titik[1]], deg);
  return { ...p, x: round(titik[0] + dx), y: round(titik[1] + dy), r: round(norm(p.r + deg), 1) };
};
type Pembuat = (s: Scene, a: Alat) => Cacat | null;
const PEMBUAT: Record<string, Pembuat> = {
  cermin: (s) => ({ scene: pusatkanScene(flipScene(s)), jenis: 'cermin', prinsip: 'putaran tidak membalik urutan unsur, sehingga bayangan cermin tidak pernah bertumpuk tepat dengan gambar acuan' }),
  putarUnsur: (s, a) => {
    const id = a.pick(s.parts).id, deg = a.pick([40, 55, 70, 90, 110, 130]) * a.tanda();
    return { scene: pusatkanScene(ganti(s, id, (p) => rotatePart(p, deg))), jenis: 'putarUnsur', prinsip: 'pada putaran seluruh unsur bergerak bersama-sama sehingga kedudukan relatifnya tetap' };
  },
  putarSendiri: (s, a) => {
    const calon = s.parts.filter((p) => p.g !== 'lingkaran');
    if (!calon.length) return null;
    const id = a.pick(calon).id, deg = a.pick([30, 45, 60, 75, 90]) * a.tanda();
    return { scene: pusatkanScene(ganti(s, id, (p) => ({ ...p, r: round(norm(p.r + deg), 1) }))), jenis: 'putarSendiri', prinsip: 'pada putaran yang benar sudut antara satu unsur dan unsur lain tidak berubah' };
  },
  skalaUnsur: (s, a) => {
    const id = a.pick(s.parts).id, k = a.pick([0.62, 0.72, 1.28, 1.4]);
    return { scene: pusatkanScene(ganti(s, id, (p) => ({ ...p, s: round(p.s * k, 3) }))), jenis: 'skalaUnsur', prinsip: 'putaran tidak mengubah ukuran apa pun, jadi perbandingan ukuran antar unsur tetap' };
  },
  // Yang boleh dihapus hanya penanda (panjang garisnya di bawah 40% seluruh gambar), bukan rangka gambar.
  hapusUnsur: (s, a) => {
    if (s.parts.length < 3) return null;
    const list = unsurOf(s), total = panjangTotal(list), calon = s.parts.filter((_, i) => panjangUnsur(list[i]) <= total * 0.4);
    if (!calon.length) return null;
    const id = a.pick(calon).id;
    return { scene: pusatkanScene(scene(s.parts.filter((p) => p.id !== id))), jenis: 'hapusUnsur', prinsip: 'putaran tidak menambah maupun mengurangi unsur' };
  },
  tambahUnsur: (s, a) => {
    const asal = a.pick(s.parts), deg = a.pick([70, 100, 130, 160, 200]) * a.tanda(), salinan = { ...rotatePart(asal, deg), id: ('salinan ' + asal.id).slice(0, 40) };
    return { scene: pusatkanScene(scene([...s.parts, salinan])), jenis: 'tambahUnsur', prinsip: 'putaran tidak menambah maupun mengurangi unsur' };
  },
  isiUnsur: (s, a) => {
    const calon = s.parts.filter((p) => p.g === 'lingkaran' || p.g === 'poligon');
    if (!calon.length) return null;
    const id = a.pick(calon).id;
    return { scene: ganti(s, id, (p) => ({ ...p, f: (p.f === 2 ? 3 : 2) as Fill })), jenis: 'isiUnsur', prinsip: 'putaran tidak mengubah isi sebuah unsur' };
  },
  geserUnsur: (s, a) => {
    const jang = jangkauan(unsurOf(s)), id = a.pick(s.parts).id, d = jang * a.antara(0.16, 0.3), ar = rad(a.antara(0, 360));
    const hasil = pusatkanScene(ganti(s, id, (p) => ({ ...p, x: round(p.x + d * Math.cos(ar)), y: round(p.y + d * Math.sin(ar)) })));
    return jangkauan(unsurOf(hasil)) > jang * 1.08 ? null : { scene: hasil, jenis: 'geserUnsur', prinsip: 'putaran mempertahankan jarak antar unsur' };
  },
  cerminUnsur: (s, a) => {
    const calon = s.parts.filter((p) => (p.g === 'garis' || p.g === 'poligon') && (p.p?.length ?? 0) > 4);
    if (!calon.length) return null;
    const id = a.pick(calon).id;
    return { scene: pusatkanScene(ganti(s, id, (p) => { const q = { ...p }; if (q.m) delete q.m; else q.m = 1; return q; })), jenis: 'cerminUnsur', prinsip: 'putaran tidak mencerminkan sebagian unsur saja' };
  },
  // Memutar sebuah unsur terhadap titik putar yang mempertahankan sentuhannya, sehingga yang berubah hanya sudutnya terhadap unsur lain.
  putarTumpu: (s, a) => {
    const list = unsurOf(s), idx = a.bulat(0, s.parts.length - 1), u = list[idx];
    if (u.jenis === 'bulat') return null;
    const bebas = [25, 35, 45, 60, 75, 90, 110], jang = jangkauan(list), tau = jang * 0.05, titikU = sampelBatas([u], 40);
    const calon: { p: Pt; sudut: number[] }[] = [], tumpu = titikTumpu(list, idx);
    if (tumpu) calon.push({ p: tumpu, sudut: bebas });
    list.forEach((v, j) => {
      if (j === idx || !bisaMewadahi(v)) return;
      const titikV = sampelBatas([v], 40);
      const dalam = titikU.filter((q) => didalam(q, v)).length, sentuh = titikU.some((q) => titikV.some((w) => Math.hypot(q[0] - w[0], q[1] - w[1]) < tau));
      if (!sentuh && dalam < titikU.length * 0.9) return;
      const sudut = v.jenis === 'garis' ? Array.from({ length: v.titik.length - 1 }, (_, m) => 360 / v.titik.length * (m + 1)) : bebas;
      calon.push({ p: pusatUnsur(v), sudut });
    });
    if (!calon.length) calon.push({ p: [0, 0], sudut: bebas });
    const pilih = a.pick(calon), deg = a.pick(pilih.sudut) * a.tanda();
    return { scene: pusatkanScene(ganti(s, s.parts[idx].id, (p) => putarSekitar(p, pilih.p, deg))), jenis: 'putarTumpu', prinsip: 'pada putaran yang benar sudut antar unsur tidak boleh berubah sama sekali' };
  },
};
export const DAFTAR_CACAT = Object.keys(PEMBUAT);

// Cari satu pengecoh yang DIJAMIN bukan hasil putaran `acuan`: bukan putarannya, tidak kembar dengan pilihan lain,
// tetap terbaca, bedanya terlihat tetapi tidak mencolok, dan (bila diminta) berprofil sama dengan `profil`.
export function cariPengecoh(acuan: Scene, sudahAda: Scene[], r: Rng, tingkat: Tingkat, o: { profil?: Scene | null; bandingPutaran?: boolean; tanpa?: string[] } = {}): Cacat | null {
  const a = alatOf(r), urut = (o.profil ? PRIORITAS[tingkat].filter((n) => CACAT_KAKU.includes(n)) : PRIORITAS[tingkat]).filter((n) => !o.tanpa?.includes(n)), gagalBeruntun: Record<string, number> = {}, mati = new Set<string>();
  const cobaMaks = o.profil ? AMBANG_BEDA.cobaProfil : AMBANG_BEDA.coba, tanda = (n: string) => { gagalBeruntun[n] = (gagalBeruntun[n] ?? 0) + 1; if (gagalBeruntun[n] >= 7) mati.add(n); };
  for (let c = 0; c < cobaMaks; c++) {
    const hidup = urut.filter((n) => !mati.has(n));
    if (!hidup.length) return null;
    const daftar = c < hidup.length * 2 ? hidup : a.kocok(hidup), nama = daftar[c % daftar.length];
    const hasil = PEMBUAT[nama](acuan, a);
    if (!hasil) { tanda(nama); continue; }
    if (o.profil && !profilCocok(hasil.scene, o.profil)) { tanda(nama); continue; }
    if (rotationBetween(hasil.scene, acuan) !== null) { tanda(nama); continue; }
    if (sudahAda.some((x) => o.bandingPutaran === false ? sameLook(hasil.scene, x) : rotationBetween(hasil.scene, x) !== null)) { tanda(nama); continue; }
    if (!layakPengecoh(hasil.scene)) { tanda(nama); continue; }
    const ambang = c < cobaMaks * 0.67 ? minBeda(tingkat) : AMBANG_BEDA.minSulit, beda = bedaBentuk(unsurOf(hasil.scene), unsurOf(acuan));
    if (beda < ambang || beda > AMBANG_BEDA.maks) { tanda(nama); continue; }
    gagalBeruntun[nama] = 0;
    return { ...hasil, beda };
  }
  return null;
}
// Dua gambar tampak sama persis (tanpa memutar) — dipakai analogi, tempat putaran tidak boleh dianggap sama.
const sameLook = (a: Scene, b: Scene) => a.parts.length === b.parts.length && rotationAngles(a, b).includes(0);

// Sudut tampil yang berbeda-beda untuk tiap gambar. Tingkat mudah hanya punya tiga sudut sehingga kekurangannya ditambal sudut antara.
export function sudutTampil(a: Rng, n: number, tingkat: Tingkat): number[] {
  const semua = a.shuffle(SUDUT[tingkat]), sisip = [30, 60, 120, 150, 210, 240, 300, 330, 15, 75, 105, 165];
  for (let k = 0; semua.length < n && k < sisip.length; k++) if (!semua.includes(sisip[k])) semua.push(sisip[k]);
  return semua.slice(0, n);
}
// Penanda letak untuk membedakan salinan yang sama persis: arah titik terjauh dari pusat (derajat searah jarum jam dari atas).
export function arahTerjauh(s: Scene): number {
  const titik = s.parts.flatMap((p) => p.g === 'garis' || p.g === 'poligon' ? exactPoints(p) : [[p.x, p.y] as Pt]);
  const jauh = titik.reduce((best, p) => Math.hypot(p[0], p[1]) > Math.hypot(best[0], best[1]) ? p : best, [0, 0] as Pt);
  return Math.round(norm(Math.atan2(jauh[0], -jauh[1]) * 180 / Math.PI)) % 360;
}
