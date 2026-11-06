// Soal "Rute dan Jalur" (Panduan Produksi Soal TIU JadiASN, Verbal Analitis, Rute dan Jalur): cerita pendek tentang seseorang yang menelusuri tempat-tempat yang saling terhubung
// ("Dari gerai A dapat pergi ke gerai B dan C. ... Gerai D dan gerai E saling terhubung. ..."), pertanyaan "Berapa banyak rute ... jika tidak diperbolehkan mengunjungi gerai
// sebelumnya?", dan pembahasan yang mendaftar semua rute, menyimpulkan banyak rute, lalu menggambar grafnya. Rute dihitung sebagai rute sederhana (simpul tidak boleh dilewati dua
// kali). Daftar rute memakai tanda pisah "–" (bukan "-") supaya tidak terbaca sebagai pengurangan oleh penata rumus. Contoh panduan tidak ditiru pada dua hal: grafnya satu arah
// padahal teksnya "saling terhubung" (lib/graph.ts), dan jumlah simpul dibatasi supaya daftar rute tetap terbaca.
import { KEY_MARK } from './explanation';
import { graphLine } from './graph';
import type { Rng } from './rng';

export type RouteNet = { nodes: string[]; edges: [number, number][] }; // simpul 0 = masuk, simpul terakhir = keluar; sisi searah (dua arah = dua sisi)
const LETTERS = 'ABCDEFGHIJKL';

// Semua rute sederhana dari simpul masuk ke simpul keluar, berurutan menurut urutan sisi.
export function enumerateRoutes(net: RouteNet): number[][] {
  const out: number[][] = [], exit = net.nodes.length - 1;
  const walk = (path: number[]) => {
    const here = path[path.length - 1];
    if (here === exit) { out.push(path); return; }
    for (const [from, to] of net.edges) if (from === here && !path.includes(to)) walk([...path, to]);
  };
  walk([0]);
  return out;
}
// Jaringan dari panduan: dipakai bila undian tidak menghasilkan jaringan yang memenuhi batas jumlah rute.
export const GUIDE_NET: RouteNet = { nodes: ['A', 'B', 'C', 'D', 'E', 'G', 'H', 'I', 'J'], edges: [[0, 1], [0, 2], [1, 3], [1, 4], [3, 4], [4, 3], [3, 7], [4, 7], [4, 6], [2, 5], [5, 6], [6, 8], [7, 8]] };

export function drawNet(level: 'sedang' | 'sulit', r: Rng): RouteNet {
  for (let attempt = 0; attempt < 400; attempt++) {
    const shape = level === 'sedang' ? r.pick([[1, 2, 2, 1], [1, 2, 3, 1], [1, 3, 2, 1]]) : r.pick([[1, 2, 3, 2, 1], [1, 2, 2, 2, 1], [1, 3, 3, 1, 1]]);
    const layers: number[][] = [];
    let at = 0;
    for (const size of shape) { layers.push(Array.from({ length: size }, () => at++)); }
    const edges: [number, number][] = [];
    const add = (a: number, b: number) => { if (!edges.some(([x, y]) => x === a && y === b)) edges.push([a, b]); };
    for (let k = 0; k < layers.length - 1; k++) {
      for (const node of layers[k + 1]) add(r.pick(layers[k]), node);
      for (const node of layers[k]) if (!edges.some(([from]) => from === node)) add(node, r.pick(layers[k + 1]));
      for (const node of layers[k]) for (const next of layers[k + 1]) if (r.next() < 0.3) add(node, next);
      if (k + 2 < layers.length && r.next() < 0.12) add(r.pick(layers[k]), r.pick(layers[k + 2]));
    }
    // Sisi dua arah ("saling terhubung") antara dua simpul pada lapisan yang sama.
    const wide = layers.map((list, k) => ({ list, k })).filter(({ list, k }) => k > 0 && k < layers.length - 1 && list.length >= 2);
    if (wide.length && r.next() < (level === 'sedang' ? 0.4 : 0.7)) { const { list } = r.pick(wide), [a, b] = r.shuffle(list); add(a, b); add(b, a); }
    const net: RouteNet = { nodes: LETTERS.slice(0, at).split(''), edges: edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]) };
    const count = enumerateRoutes(net).length;
    if (count >= (level === 'sedang' ? 3 : 5) && count <= (level === 'sedang' ? 8 : 12)) return net;
  }
  return GUIDE_NET;
}

// ---- Cerita soal ---------------------------------------------------------------------------------------------------------------------------------
export type RoutePlace = { person: string; event: string; unit: string };
export const ROUTE_PLACES: RoutePlace[] = [
  { person: 'Risa', event: 'festival makanan', unit: 'gerai' }, { person: 'Dion', event: 'bazar buku', unit: 'stan' },
  { person: 'Nadia', event: 'pameran teknologi', unit: 'anjungan' }, { person: 'Bagas', event: 'taman rekreasi', unit: 'wahana' },
];
const list = (items: string[]) => items.length > 2 ? items.slice(0, -1).join(', ') + ', dan ' + items[items.length - 1] : items.join(' dan ');
// Sisi ditulis sebagai kalimat: sisi searah "Dari gerai A dapat pergi ke gerai B dan C." ("dapat menuju" untuk kalimat berikutnya), sisi dua arah "Gerai D dan gerai E saling terhubung.",
// dan semua sisi ke simpul keluar dalam satu kalimat penutup. Urutan kalimat mengikuti urutan simpul asal.
export function routeParagraph(net: RouteNet, place: RoutePlace): string {
  const exit = net.nodes.length - 1, name = (i: number) => net.nodes[i], has = (a: number, b: number) => net.edges.some(([x, y]) => x === a && y === b), unit = place.unit;
  const sentences = [place.person + ' pergi ke ' + place.event + '. Di dekat pintu masuk, ia melihat ' + unit + ' ' + name(0) + '.'];
  let first = true;
  for (let i = 0; i < exit; i++) {
    const out = net.edges.filter(([from, to]) => from === i && to !== exit && !has(to, i)).map(([, to]) => name(to));
    if (out.length) { sentences.push('Dari ' + unit + ' ' + name(i) + ' dapat ' + (first ? 'pergi ke ' : 'menuju ') + unit + ' ' + list(out) + '.'); first = false; }
    for (const [a, b] of net.edges) if (a === i && b !== exit && b > i && has(b, a)) sentences.push(unit.charAt(0).toUpperCase() + unit.slice(1) + ' ' + name(a) + ' dan ' + unit + ' ' + name(b) + ' saling terhubung.');
  }
  sentences.push('Dari ' + unit + ' ' + list(net.edges.filter(([, to]) => to === exit).map(([from]) => name(from))) + ' langsung dapat menuju ' + unit + ' ' + name(exit) + ' yang berada di dekat pintu keluar.');
  return sentences.join(' ');
}
export const routeQuestion = (place: RoutePlace) => 'Berapa banyak rute yang dapat dilewati ' + place.person + ' dari pintu masuk hingga pintu keluar jika tidak diperbolehkan mengunjungi ' + place.unit + ' sebelumnya?';

export function ruteExplanation(net: RouteNet, routes: number[][]): string {
  const name = (i: number) => net.nodes[i];
  return [
    'Daftar rute yang mungkin adalah sebagai berikut:', ...routes.map((route, i) => (i + 1) + '. ' + route.map(name).join(' – ')), '',
    'Jadi, terdapat ' + routes.length + ' rute yang dapat dilewati.', 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.', '',
    graphLine({ nodes: net.nodes, edges: net.edges, entry: 0, exit: net.nodes.length - 1, routes: routes.map((route) => route.map(name).join('-')) }),
  ].join('\n');
}
