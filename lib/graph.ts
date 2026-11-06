// Diagram pembahasan Verbal Analitis yang digambar dari satu baris `@graf {JSON}` (diperlakukan seragam oleh layar, PDF, PNG, Word, SiAdu, dan salinan lewat lib/diagram.ts):
// 1. Graf rute (Panduan Produksi Soal TIU JadiASN, Rute dan Jalur): simpul berlingkaran dengan panah searah sisi, simpul masuk hijau ("Pintu Masuk"), simpul keluar kuning ("Pintu Keluar"),
//    kotak "Jumlah rute valid = N" berisi daftar rute di sisi kanan, dan kotak keterangan di bawah, seperti gambar contoh panduan. Sisi dua arah (dua sisi berlawanan) digambar satu garis berpanah di kedua
//    ujung; contoh panduan menggambarnya satu arah padahal teksnya "saling terhubung" dan daftar rutenya memakai kedua arah, sehingga tidak ditiru (keterangan "Jalur dua arah" ditambahkan).
// 2. Diagram duduk melingkar (contoh Duduk Melingkar panduan): lingkaran dengan kursi bernomor searah jarum jam (kursi 1 di atas), nama di dalam bulatan kursi, kotak "Petunjuk kunci"
//    berisi petunjuk bernomor, dan kotak kesimpulan di bawahnya. Datanya memakai bidang yang sama: `nodes` = penghuni kursi 1..n, `ring` = petunjuk dan kesimpulan.
// Tata letak rute dihitung saat digambar (per lapisan menurut jalur terpanjang dari simpul masuk), sehingga SVG yang sama dipakai di semua keluaran.
export type GraphDiagram = { nodes: string[]; edges: [number, number][]; entry: number; exit: number; routes?: string[]; ring?: { clues: string[]; note: string } };

export const graphLine = (graph: GraphDiagram) => '@graf ' + JSON.stringify(graph);
export function parseGraphLine(line: string): GraphDiagram | undefined {
  const found = /^@graf (\{.*\})$/.exec(line.trim());
  if (!found) return undefined;
  try {
    const graph = JSON.parse(found[1]) as GraphDiagram, n = graph.nodes?.length;
    const index = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < n;
    const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
    if (!Array.isArray(graph.nodes) || n < 2 || n > 14 || !Array.isArray(graph.edges) || !index(graph.entry) || !index(graph.exit) || graph.entry === graph.exit) return undefined;
    if (graph.ring !== undefined) {
      const ring = graph.ring;
      return n >= 4 && n <= 12 && graph.nodes.every((node) => text(node, 16)) && graph.edges.length === 0 && ring && Array.isArray(ring.clues) && ring.clues.length <= 12 && ring.clues.every((clue) => text(clue, 160)) && text(ring.note, 220) ? graph : undefined;
    }
    if (!graph.nodes.every((node) => text(node, 3)) || !graph.edges.every((edge) => Array.isArray(edge) && edge.length === 2 && index(edge[0]) && index(edge[1]) && edge[0] !== edge[1])) return undefined;
    if (graph.routes !== undefined && !(Array.isArray(graph.routes) && graph.routes.length <= 24 && graph.routes.every((route) => text(route, 48)))) return undefined;
    return graph;
  } catch { return undefined; }
}

const R = 17, STEP_X = 100, STEP_Y = 66, LEFT = 64, RIGHT = 74, INK = '#1d2c4d';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const FONT = 'font-family="Arial, Helvetica, sans-serif"';
// Teks dipecah per kata sesuai perkiraan lebar (SVG tidak membungkus teks sendiri).
const wrap = (text: string, max: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) { if (line && (line + ' ' + word).length > max) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word; }
  if (line) lines.push(line);
  return lines;
};
const box = (x: number, y: number, w: number, h: number) => '<rect x="' + fmt(x) + '" y="' + fmt(y) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" rx="3" fill="#ffffff" stroke="' + INK + '" stroke-width="1.8"/>';
const label = (x: number, y: number, size: number, content: string, extra = '') => '<text x="' + fmt(x) + '" y="' + fmt(y) + '" ' + FONT + ' font-size="' + size + '" fill="' + INK + '"' + extra + '>' + esc(content) + '</text>';
const arrowHead = (px: number, py: number, angle: number) => {
  const back = (d: number, side: number) => (px - d * Math.cos(angle) - side * Math.sin(angle)).toFixed(1) + ',' + (py - d * Math.sin(angle) + side * Math.cos(angle)).toFixed(1);
  return '<polygon points="' + px.toFixed(1) + ',' + py.toFixed(1) + ' ' + back(10, 4.6) + ' ' + back(10, -4.6) + '" fill="' + INK + '"/>';
};
const svgOpen = (width: number, height: number, description: string) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(width) + '" height="' + Math.ceil(height) + '" viewBox="0 0 ' + Math.ceil(width) + ' ' + Math.ceil(height) +
  '" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="' + esc(description) + '"><rect width="100%" height="100%" fill="#ffffff"/>';

// Sisi dua arah (a → b dan b → a) dan sisi satu arah; pasangan dua arah dicatat sekali dengan a < b.
export function splitEdges(graph: GraphDiagram): { oneWay: [number, number][]; both: [number, number][] } {
  const has = (a: number, b: number) => graph.edges.some(([from, to]) => from === a && to === b);
  const oneWay = graph.edges.filter(([a, b]) => !has(b, a)), both = graph.edges.filter(([a, b]) => a < b && has(b, a));
  return { oneWay, both };
}
// Lapisan: jalur terpanjang dari simpul masuk lewat sisi satu arah; kedua ujung sisi dua arah berada pada lapisan yang sama.
export function layersOf(graph: GraphDiagram): number[] {
  const { oneWay, both } = splitEdges(graph), n = graph.nodes.length, layer = new Array<number>(n).fill(-1);
  layer[graph.entry] = 0;
  for (let round = 0; round < n * 2; round++) {
    for (const [a, b] of oneWay) if (layer[a] >= 0) layer[b] = Math.max(layer[b], layer[a] + 1);
    for (const [a, b] of both) { const top = Math.max(layer[a], layer[b]); if (top >= 0) { layer[a] = top; layer[b] = top; } }
  }
  const last = Math.max(0, ...layer);
  return layer.map((value) => value < 0 ? last : value);
}
export function layoutGraph(graph: GraphDiagram): { x: number[]; y: number[]; width: number; height: number } {
  const layer = layersOf(graph), count = Math.max(...layer) + 1, n = graph.nodes.length;
  const columns: number[][] = Array.from({ length: count }, () => []);
  graph.nodes.forEach((_, i) => columns[layer[i]].push(i));
  const rank = new Array<number>(n).fill(0);
  columns.forEach((list) => list.forEach((node, k) => { rank[node] = k; }));
  // Dua sapuan barycenter: simpul diurutkan menurut rata-rata urutan pendahulunya agar garis tidak bersilang tanpa perlu.
  for (let sweep = 0; sweep < 2; sweep++) for (let k = 1; k < count; k++) {
    const mean = (node: number) => { const before = graph.edges.filter(([a, b]) => b === node && layer[a] < layer[b]).map(([a]) => rank[a]); return before.length ? before.reduce((s, v) => s + v, 0) / before.length : rank[node]; };
    columns[k].sort((a, b) => mean(a) - mean(b) || a - b).forEach((node, i) => { rank[node] = i; });
  }
  const tall = Math.max(...columns.map((list) => list.length)), height = 40 + (tall - 1) * STEP_Y + 40;
  const x = graph.nodes.map((_, i) => LEFT + layer[i] * STEP_X), y = graph.nodes.map((_, i) => 20 + (height - 40) / 2 + (rank[i] - (columns[layer[i]].length - 1) / 2) * STEP_Y + 0);
  return { x, y, width: LEFT + (count - 1) * STEP_X + RIGHT, height };
}

function routeSvg(graph: GraphDiagram): string {
  const { x, y, width: graphWidth, height: graphHeight } = layoutGraph(graph), layer = layersOf(graph), { oneWay, both } = splitEdges(graph), parts: string[] = [];
  const line = (a: number, b: number, arrowAtStart: boolean, bend: number) => {
    const mx = (x[a] + x[b]) / 2, my = (y[a] + y[b]) / 2, dx = x[b] - x[a], dy = y[b] - y[a], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const cx = mx + nx * bend, cy = my + ny * bend;
    const start = Math.atan2(cy - y[a], cx - x[a]), end = Math.atan2(y[b] - cy, x[b] - cx);
    const x1 = x[a] + R * Math.cos(start), y1 = y[a] + R * Math.sin(start), x2 = x[b] - (R + 1) * Math.cos(end), y2 = y[b] - (R + 1) * Math.sin(end);
    parts.push('<path d="M' + fmt(x1) + ',' + fmt(y1) + (bend ? ' Q' + fmt(cx) + ',' + fmt(cy) : ' L') + ' ' + fmt(x2) + ',' + fmt(y2) + '" fill="none" stroke="' + INK + '" stroke-width="1.8"/>', arrowHead(x2, y2, end));
    if (arrowAtStart) parts.push(arrowHead(x[a] + (R + 1) * Math.cos(start), y[a] + (R + 1) * Math.sin(start), start + Math.PI));
  };
  // Sisi yang melompati lapisan dilengkungkan ke sisi yang paling jauh dari simpul lain, supaya tidak menimpa garis atau simpul di antaranya.
  const clearance = (a: number, b: number, bend: number) => {
    const mx = (x[a] + x[b]) / 2, my = (y[a] + y[b]) / 2, dx = x[b] - x[a], dy = y[b] - y[a], len = Math.hypot(dx, dy) || 1, cx = mx - dy / len * bend, cy = my + dx / len * bend;
    let least = Infinity;
    for (let t = 0.15; t <= 0.85; t += 0.05) {
      const px = (1 - t) * (1 - t) * x[a] + 2 * t * (1 - t) * cx + t * t * x[b], py = (1 - t) * (1 - t) * y[a] + 2 * t * (1 - t) * cy + t * t * y[b];
      graph.nodes.forEach((_, k) => { if (k !== a && k !== b) least = Math.min(least, Math.hypot(px - x[k], py - y[k])); });
    }
    return least;
  };
  oneWay.forEach(([a, b]) => {
    const skip = layer[b] - layer[a] - 1, plus = 34 * skip + 8;
    line(a, b, false, skip > 0 ? (clearance(a, b, plus) >= clearance(a, b, -plus) ? plus : -plus) : 0);
  });
  // Sisi dua arah antara simpul yang tidak bersebelahan pada satu lapisan dilengkungkan, supaya garisnya tidak menembus simpul di antaranya (terbaca sebagai sisi simpul itu).
  both.forEach(([a, b]) => {
    const gap = Math.round(Math.abs(y[a] - y[b]) / STEP_Y), mag = 48 * (gap - 1) + 16;
    line(a, b, true, gap > 1 ? (clearance(a, b, mag) >= clearance(a, b, -mag) ? mag : -mag) : 0);
  });
  graph.nodes.forEach((node, i) => {
    const fill = i === graph.entry ? '#8fd18f' : i === graph.exit ? '#ffd24d' : '#ffffff';
    parts.push('<circle cx="' + fmt(x[i]) + '" cy="' + fmt(y[i]) + '" r="' + R + '" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.8"/>' + label(x[i], y[i] + 5.5, 16, node, ' font-weight="700" text-anchor="middle"'));
  });
  const note = (text: string[], px: number, py: number, anchor: string) => text.forEach((word, k) => parts.push(label(px, py + k * 13, 12, word, ' text-anchor="' + anchor + '"')));
  note(['Pintu', 'Masuk'], x[graph.entry] - R - 8, y[graph.entry] - 2, 'end');
  note(['Pintu', 'Keluar'], x[graph.exit] + R + 8, y[graph.exit] - 2, 'start');
  // Keterangan di bawah graf (contoh panduan): simpul masuk, simpul keluar, jalur searah, dan jalur dua arah bila ada.
  const legendY = graphHeight + 6, twoWay = both.length > 0, legendWidth = twoWay ? 566 : 400;
  parts.push(box(8, legendY, legendWidth, 44));
  const swatch = (cx: number, fill: string, text: string, textX: number) => parts.push('<circle cx="' + cx + '" cy="' + (legendY + 22) + '" r="10" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.5"/>' + label(textX, legendY + 27, 13, text));
  swatch(32, '#8fd18f', 'Pintu Masuk', 48); swatch(150, '#ffd24d', 'Pintu Keluar', 166);
  parts.push('<path d="M280,' + (legendY + 22) + ' L322,' + (legendY + 22) + '" stroke="' + INK + '" stroke-width="1.8"/>', arrowHead(324, legendY + 22, 0), label(332, legendY + 27, 13, 'Jalur searah'));
  if (twoWay) parts.push('<path d="M424,' + (legendY + 22) + ' L462,' + (legendY + 22) + '" stroke="' + INK + '" stroke-width="1.8"/>', arrowHead(464, legendY + 22, 0), arrowHead(422, legendY + 22, Math.PI), label(476, legendY + 27, 13, 'Dua arah'));
  // Kotak "Jumlah rute valid = N" berisi daftar rute (hanya bila daftar disimpan pada baris graf).
  let width = Math.max(graphWidth, legendWidth + 16), height = legendY + 44 + 10;
  if (graph.routes?.length) {
    const longest = Math.max(...graph.routes.map((route) => route.length)), panelW = Math.max(250, 66 + longest * 9.5), panelX = Math.max(graphWidth, legendWidth + 16) + 10, panelH = 62 + graph.routes.length * 26;
    parts.push(box(panelX, 14, panelW, panelH), label(panelX + 18, 46, 17, 'Jumlah rute valid = ' + graph.routes.length, ' font-weight="700"'));
    graph.routes.forEach((route, i) => parts.push(label(panelX + 18, 82 + i * 26, 16, (i + 1) + '.'), label(panelX + 52, 82 + i * 26, 16, route)));
    width = panelX + panelW + 12; height = Math.max(height, 14 + panelH + 12);
  }
  return svgOpen(width, height, 'Graf rute: ' + graphPlain(graph).replace(/\n/g, '; ')) + parts.join('') + '</svg>';
}

function ringSvg(graph: GraphDiagram): string {
  const ring = graph.ring!, n = graph.nodes.length, parts: string[] = [];
  const CX = 200, CY = 205, RR = n > 8 ? 150 : 130, RS = 31, LABEL = RR + RS + 24;
  const at = (k: number, radius: number) => { const angle = -Math.PI / 2 + 2 * Math.PI * k / n; return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)] as const; };
  parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + RR + '" fill="none" stroke="' + INK + '" stroke-width="1.8"/>');
  graph.nodes.forEach((name, k) => {
    const [sx, sy] = at(k, RR), [nx, ny] = at(k, LABEL);
    parts.push('<circle cx="' + fmt(sx) + '" cy="' + fmt(sy) + '" r="' + RS + '" fill="#ffffff" stroke="' + INK + '" stroke-width="1.8"/>' + label(sx, sy + 4.5, name.length > 8 ? 11 : name.length > 6 ? 13 : 15, name, ' font-weight="700" text-anchor="middle"'), label(nx, ny + 7, 20, String(k + 1), ' font-weight="700" text-anchor="middle"'));
  });
  // Kotak "Petunjuk kunci" (petunjuk bernomor) dan kotak kesimpulan di bawahnya.
  const PX = 410, PW = 340, LINE = 18, items = ring.clues.map((clue) => wrap(clue, 40));
  const panelH = 56 + items.reduce((sum, lines) => sum + lines.length * LINE + 10, 0);
  parts.push(box(PX, 22, PW, panelH), label(PX + PW / 2, 52, 17, 'Petunjuk kunci', ' font-weight="700" text-anchor="middle"'));
  let cursor = 82;
  items.forEach((lines, i) => {
    parts.push(label(PX + 18, cursor, 14, (i + 1) + '.'));
    lines.forEach((text, k) => parts.push(label(PX + 44, cursor + k * LINE, 14, text)));
    cursor += lines.length * LINE + 10;
  });
  const conclusion = wrap(ring.note, 44), boxH = conclusion.length * LINE + 22, boxY = 22 + panelH + 18;
  parts.push(box(PX, boxY, PW, boxH));
  conclusion.forEach((text, k) => parts.push(label(PX + 14, boxY + 26 + k * LINE, 14, text)));
  return svgOpen(PX + PW + 14, Math.max(CY + RR + RS + 40, boxY + boxH + 16), 'Diagram duduk melingkar: ' + graphPlain(graph).replace(/\n/g, '; ')) + parts.join('') + '</svg>';
}

export const graphSvg = (graph: GraphDiagram): string => graph.ring ? ringSvg(graph) : routeSvg(graph);

// Teks polos graf (salinan teks, CSV, keterangan gambar Word): rute = sisi tiap simpul, sisi dua arah dengan "↔", simpul masuk dan keluar, dan daftar rute; melingkar = penghuni tiap kursi,
// petunjuk kunci, dan kesimpulan.
export function graphPlain(graph: GraphDiagram): string {
  const name = (i: number) => graph.nodes[i];
  if (graph.ring) return [graph.nodes.map((node, k) => 'Kursi ' + (k + 1) + ': ' + node).join('; '), 'Petunjuk kunci: ' + graph.ring.clues.map((clue, i) => (i + 1) + '. ' + clue).join(' '), 'Kesimpulan: ' + graph.ring.note].join('\n');
  const { oneWay, both } = splitEdges(graph), lines: string[] = ['Masuk: ' + name(graph.entry) + '; keluar: ' + name(graph.exit)];
  graph.nodes.forEach((_, i) => { const to = oneWay.filter(([a]) => a === i).map(([, b]) => name(b)); if (to.length) lines.push(name(i) + ' → ' + to.join(', ')); });
  if (both.length) lines.push(both.map(([a, b]) => name(a) + ' ↔ ' + name(b)).join('; '));
  if (graph.routes?.length) lines.push('Jumlah rute valid = ' + graph.routes.length + ': ' + graph.routes.join('; '));
  return lines.join('\n');
}
