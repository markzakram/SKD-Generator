// Diagram pembahasan soal figural dengan anotasi (Panduan Produksi Soal TIU JadiASN, bagian Figural, PDF 158–178): kotak gambar yang disusun
// berbaris, lingkaran merah atau kotak biru pada bagian yang dimaksud, panah melengkung berlabel antarkotak, kotak label berwarna di atas kotak,
// angka berlatar di sudut kotak, bingkai hijau pada kotak jawaban, dan tag kuning "Sesuai dengan gambar pada opsi X" dengan panah hijau.
// Pembahasan menyimpannya sebagai satu baris `@gambar {JSON}` yang memuat gambar-gambarnya sendiri (tidak bergantung pada urutan opsi); SVG dibuat dari
// data itu sehingga layar, PDF, PNG, Word, dan salinan memakai gambar yang sama. Kotak bertanda `opt` adalah salah satu gambar opsi: saat ditampilkan,
// huruf opsinya diisi dan kotak-kotak itu diurutkan menurut susunan opsi soal (resolveOptionCells), jadi tetap benar setelah opsi diacak.
import type { Scene } from '../types';
import { sceneCell } from './render';
import { partRadius, sameScene, worldPoints } from './scene';

export type Tone = 'blue' | 'green' | 'red' | 'yellow' | 'cyan' | 'ink';
export type Badge = { text: string; tone: Tone };
export type DiagramCell = {
  scene: Scene | null; // null: kotak tanda tanya
  frame?: 'green' | 'red'; // bingkai tebal (hijau: kotak jawaban, merah: kotak yang berbeda)
  label?: Badge; // kotak berwarna di atas kotak, mis. "10 sisi"
  caption?: string; // huruf atau nomor di bawah kotak
  corners?: Badge[]; // angka berlatar di sudut bawah kotak (kiri, lalu kanan)
  rings?: string[]; // id bagian ("nama@" untuk kelompok, "awalan*" untuk semua id berawalan itu) yang dilingkari merah
  boxes?: { ids: string[]; tone: 'blue' | 'red' }[]; // kotak bergaris di sekeliling bagian
  tag?: string; // tag kuning di bawah kotak dengan panah hijau
  opt?: true; // gambar ini adalah salah satu opsi soal
};
export type DiagramLink = { from: number; to: number; text?: string; tone: Tone; side: 'top' | 'bottom'; level?: number };
export type FigureDiagram = { columns: number; cells: DiagramCell[]; signs?: string[]; links?: DiagramLink[]; zoom?: number }; // zoom: pembesaran tampilan (1–2,5) untuk diagram sempit; nilai lain dianggap 1 // signs[i]: tanda antara kotak ke-i dan ke-(i+1) pada baris yang sama

// Warna bidang/garis dari gambar anotasi panduan (blue image59, ring image95).
const TONES: Record<Tone, string> = { blue: '#0070c0', green: '#4da82c', red: '#e7191f', yellow: '#ffff00', cyan: '#00ffff', ink: '#000000' };
const BADGE_FILL: Record<Tone, string> = { blue: '#0070c0', green: '#00ff03', red: '#ff0000', yellow: '#ffff00', cyan: '#00ffff', ink: '#e5e7eb' };
const FONT = 'Arial, Helvetica, sans-serif';
const CELL = 100, MARGIN = 2;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => String(Math.round(n * 10) / 10);

export const figureLine = (figure: FigureDiagram) => '@gambar ' + JSON.stringify(figure);
export function parseFigureLine(line: string): FigureDiagram | undefined {
  const found = /^@gambar (\{.*\})$/.exec(line.trim());
  if (!found) return undefined;
  try {
    const figure = JSON.parse(found[1]) as FigureDiagram, n = figure.cells?.length;
    const index = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < n;
    if (!Array.isArray(figure.cells) || !n || !Number.isInteger(figure.columns) || figure.columns < 1 || figure.columns > 6 ||
      !figure.cells.every((c) => c && (c.scene === null || Array.isArray(c.scene?.parts)))) return undefined;
    if (figure.links && !figure.links.every((l) => index(l.from) && index(l.to) && l.tone in TONES && (l.side === 'top' || l.side === 'bottom'))) return undefined;
    if (figure.zoom !== undefined && !(typeof figure.zoom === 'number' && figure.zoom >= 1 && figure.zoom <= 2.5)) return undefined;
    return figure;
  } catch { return undefined; }
}

// Memecah teks menjadi baris pendek tanpa memotong kata.
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (line && (line + ' ' + word).length > width) { out.push(line); line = word; } else line = line ? line + ' ' + word : word;
    }
    if (line) out.push(line);
  }
  return out;
}
// Persegi pembatas sekumpulan bagian pada koordinat kotak (pusat kotak = 0, 0).
function boundsOf(scene: Scene, ids: string[]): { x0: number; y0: number; x1: number; y1: number } | undefined {
  const parts = scene.parts.filter((p) => ids.some((id) => id.endsWith('@') ? p.id.startsWith(id) : id.endsWith('*') ? p.id.startsWith(id.slice(0, -1)) : p.id === id)); // "nama@" = kelompok, "awalan*" = semua id berawalan itu
  if (!parts.length) return undefined;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of parts) {
    if (p.g === 'poligon' || p.g === 'garis') for (const [x, y] of worldPoints(p)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    else { const r = partRadius(p); x0 = Math.min(x0, p.x - r); x1 = Math.max(x1, p.x + r); y0 = Math.min(y0, p.y - r); y1 = Math.max(y1, p.y + r); }
  }
  return { x0, y0, x1, y1 };
}

export function figureSvg(figure: FigureDiagram): string {
  const { columns, cells } = figure, rows = Math.ceil(cells.length / columns), signs = figure.signs ?? [];
  const gap = signs.some(Boolean) ? 44 : figure.links?.length ? 22 : 12, rowGap = 18;
  const innerWidth = columns * CELL + (columns - 1) * gap;
  const topLinks = (figure.links ?? []).filter((l) => l.side === 'top'), bottomLinks = (figure.links ?? []).filter((l) => l.side === 'bottom');
  const linkLines = (l: DiagramLink) => l.text ? wrap(l.text, 16) : [];
  const labelLines = (l: DiagramLink) => linkLines(l).length * 12;
  const levelStep = (side: DiagramLink['side']) => 2 * (10 + Math.max(0, ...(figure.links ?? []).filter((l) => l.side === side).map(labelLines))); // jarak antartingkat panah = tinggi label tertinggi
  const arcRise = (l: DiagramLink) => 22 + levelStep(l.side) * (l.level ?? 0) + 9 * Math.abs(l.to - l.from - 1);
  const topLabels = cells.some((c) => c.label) ? 28 : 0;
  const topNeed = Math.max(topLabels, ...topLinks.map((l) => arcRise(l) / 2 + labelLines(l) + 14), 4);
  const hasCaption = cells.some((c) => c.caption), captionH = hasCaption ? 22 : 0;
  const bottomNeed = Math.max(...bottomLinks.map((l) => arcRise(l) / 2 + labelLines(l) + 16), 0);
  const tagged = cells.map((c, i) => ({ c, i })).filter(({ c }) => c.tag);
  const width = Math.max(innerWidth + MARGIN * 2, tagged.length ? 156 : 0), shiftX = (width - innerWidth - MARGIN * 2) / 2; // diagram sempit dilebarkan agar tag kuning utuh
  const rowTop = (row: number) => MARGIN + topNeed + row * (CELL + rowGap + captionH);
  const cellX = (i: number) => MARGIN + shiftX + (i % columns) * (CELL + gap), cellY = (i: number) => rowTop(Math.floor(i / columns));
  // Tata letak tag kuning: di samping kanan panah bila muat, selain itu di bawah kotak; tinggi gambar mengikuti dasar tag ditambah margin (tag tidak boleh terpotong).
  const tagLayout = (c: DiagramCell, i: number) => {
    const lines = wrap(c.tag!, 22), w = Math.min(width - 4, 148), h = lines.length * 14 + 10, cx = cellX(i) + CELL / 2, top = cellY(i) + CELL + captionH + bottomNeed + 8;
    const sideways = cx + 16 + w <= width - 2, tx = sideways ? cx + 16 : Math.max(2, Math.min(width - w - 2, cx - w / 2)), ty = sideways ? top + 6 : top + 22;
    return { lines, w, h, cx, sideways, tx, ty };
  };
  const totalHeight = Math.max(rowTop(rows - 1) + CELL + captionH + bottomNeed, ...tagged.map(({ c, i }) => { const t = tagLayout(c, i); return t.ty + t.h; })) + MARGIN + 10;
  const parts: string[] = [];
  const head = (x: number, y: number, angle: number, color: string) => {
    const back = (d: number, side: number) => (x - d * Math.cos(angle) - side * Math.sin(angle)).toFixed(1) + ',' + (y - d * Math.sin(angle) + side * Math.cos(angle)).toFixed(1);
    return '<polygon points="' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + back(9, 4.6) + ' ' + back(9, -4.6) + '" fill="' + color + '"/>';
  };
  cells.forEach((c, i) => {
    const x = cellX(i), y = cellY(i);
    parts.push('<g transform="translate(' + fmt(x) + ' ' + fmt(y) + ')">' + sceneCell(c.scene, 0, 0));
    if (c.frame) parts.push('<rect x="1" y="1" width="98" height="98" rx="3" fill="none" stroke="' + TONES[c.frame] + '" stroke-width="5"/>');
    const scene = c.scene;
    for (const id of c.rings ?? []) {
      const b = scene && boundsOf(scene, [id]);
      if (b) parts.push('<ellipse cx="' + fmt(50 + (b.x0 + b.x1) / 2) + '" cy="' + fmt(50 + (b.y0 + b.y1) / 2) + '" rx="' + fmt((b.x1 - b.x0) / 2 * 1.08 + 5) + '" ry="' + fmt((b.y1 - b.y0) / 2 * 1.08 + 5) + '" fill="none" stroke="' + TONES.red + '" stroke-width="2.6"/>');
    }
    for (const box of c.boxes ?? []) {
      const b = scene && boundsOf(scene, box.ids);
      if (b) parts.push('<rect x="' + fmt(50 + b.x0 - 4) + '" y="' + fmt(50 + b.y0 - 4) + '" width="' + fmt(b.x1 - b.x0 + 8) + '" height="' + fmt(b.y1 - b.y0 + 8) + '" rx="5" fill="none" stroke="' + TONES[box.tone] + '" stroke-width="2.6"/>');
    }
    (c.corners ?? []).slice(0, 2).forEach((badge, k) => {
      const w = Math.max(18, badge.text.length * 9 + 8), bx = k === 0 ? 4 : 96 - w;
      parts.push('<rect x="' + bx + '" y="76" width="' + w + '" height="19" rx="2" fill="' + BADGE_FILL[badge.tone] + '"/><text x="' + fmt(bx + w / 2) + '" y="90.5" font-family="' + FONT + '" font-weight="700" font-size="14" text-anchor="middle" fill="#111111">' + esc(badge.text) + '</text>');
    });
    parts.push('</g>');
    if (c.label) {
      const w = Math.min(CELL, Math.max(60, c.label.text.length * 9 + 14)), lx = x + (CELL - w) / 2;
      parts.push('<rect x="' + fmt(lx) + '" y="' + fmt(y - 25) + '" width="' + fmt(w) + '" height="21" rx="2" fill="' + BADGE_FILL[c.label.tone] + '"/><text x="' + fmt(x + CELL / 2) + '" y="' + fmt(y - 10) + '" font-family="' + FONT + '" font-weight="700" font-size="14" text-anchor="middle" fill="' + (c.label.tone === 'blue' ? '#ffffff' : '#111111') + '">' + esc(c.label.text) + '</text>');
    }
    if (c.caption) parts.push('<text x="' + fmt(x + CELL / 2) + '" y="' + fmt(y + CELL + 17) + '" font-family="' + FONT + '" font-weight="700" font-size="16" text-anchor="middle" fill="#111111">' + esc(c.caption) + '</text>');
  });
  signs.forEach((sign, i) => {
    if (!sign || i + 1 >= cells.length || (i + 1) % columns === 0) return;
    parts.push('<text x="' + fmt(cellX(i) + CELL + gap / 2) + '" y="' + fmt(cellY(i) + 64) + '" font-family="' + FONT + '" font-weight="700" font-size="40" text-anchor="middle" fill="#111111">' + esc(sign) + '</text>');
  });
  for (const l of figure.links ?? []) {
    const up = l.side === 'top', color = TONES[l.tone], y = up ? cellY(l.from) - 4 : cellY(l.from) + CELL + captionH + 2, rise = arcRise(l), sign = up ? -1 : 1;
    const out = (l.level ?? 0) * 22, x1 = cellX(l.from) + CELL / 2 + (l.to > l.from ? 18 - out : -18 + out), x2 = cellX(l.to) + CELL / 2 + (l.to > l.from ? -22 + out : 22 - out), // tingkat lebih luar melebar supaya melingkupi label tingkat dalam
      cx = (x1 + x2) / 2, cy = y + sign * rise;
    parts.push('<path d="M' + fmt(x1) + ',' + fmt(y) + ' Q' + fmt(cx) + ',' + fmt(cy) + ' ' + fmt(x2) + ',' + fmt(y) + '" fill="none" stroke="' + color + '" stroke-width="2.2" stroke-linecap="round"/>', head(x2, y, Math.atan2(y - cy, x2 - cx), color));
    const lines = linkLines(l), apex = y + sign * rise / 2;
    lines.forEach((line, k) => parts.push('<text x="' + fmt(cx) + '" y="' + fmt(up ? apex - 6 - (lines.length - 1 - k) * 12 : apex + 14 + k * 12) + '" font-family="' + FONT + '" font-weight="700" font-size="11" text-anchor="middle" fill="' + color + '" stroke="#ffffff" stroke-width="3" paint-order="stroke" stroke-linejoin="round">' + esc(line) + '</text>'));
  }
  for (const { c, i } of tagged) {
    const { lines, w, h, cx, sideways, tx, ty } = tagLayout(c, i);
    parts.push('<rect x="' + fmt(tx) + '" y="' + fmt(ty) + '" width="' + fmt(w) + '" height="' + fmt(h) + '" rx="2" fill="' + TONES.yellow + '"/>');
    lines.forEach((line, k) => parts.push('<text x="' + fmt(tx + w / 2) + '" y="' + fmt(ty + 15 + k * 14) + '" font-family="' + FONT + '" font-weight="700" font-size="12" text-anchor="middle" fill="#111111">' + esc(line) + '</text>'));
    const from = cellY(i) + CELL + (c.caption ? 22 : 3);
    if (sideways) parts.push('<path d="M' + fmt(cx) + ',' + fmt(from) + ' L' + fmt(cx) + ',' + fmt(ty + h / 2) + ' L' + fmt(tx - 8) + ',' + fmt(ty + h / 2) + '" fill="none" stroke="' + TONES.green + '" stroke-width="4"/>', head(tx - 1, ty + h / 2, 0, TONES.green));
    else parts.push('<path d="M' + fmt(cx) + ',' + fmt(from) + ' L' + fmt(cx) + ',' + fmt(ty - 8) + '" fill="none" stroke="' + TONES.green + '" stroke-width="4"/>', head(cx, ty - 1, Math.PI / 2, TONES.green));
  }
  const label = 'Diagram pembahasan: ' + figurePlain(figure).replace(/\n/g, '; ');
  const zoom = figure.zoom ?? 1; // viewBox tetap; hanya ukuran tampil yang dibesarkan, sehingga layar, PDF, dan Word memakai gambar yang sama
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(width * zoom) + '" height="' + Math.ceil(totalHeight * zoom) + '" viewBox="0 0 ' + Math.ceil(width) + ' ' + Math.ceil(totalHeight) +
    '" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="' + esc(label) + '"><rect width="100%" height="100%" fill="#ffffff"/>' + parts.join('') + '</svg>';
}

// Teks polos diagram (salinan teks, CSV, keterangan gambar Word): nama kotak, label, angka, panah berlabel (panah berurutan sama label digabung satu baris), bagian yang
// dilingkari, dan tag.
export function figurePlain(figure: FigureDiagram): string {
  const name = (i: number) => figure.cells[i].caption ? 'Gambar ' + figure.cells[i].caption : 'Kotak ' + (i + 1);
  const lines: string[] = [];
  figure.cells.forEach((c, i) => {
    const bits = [c.scene === null ? 'kotak tanda tanya' : '', c.label?.text ?? '', ...(c.corners ?? []).map((badge) => badge.text), c.tag ?? ''].filter(Boolean);
    if (bits.length) lines.push(name(i) + ': ' + bits.join('; '));
  });
  const ringed = figure.cells.flatMap((c, i) => c.rings?.length ? [i + 1] : []);
  if (ringed.length) lines.push('Bagian yang dilingkari merah pada kotak ' + ringed.join(', '));
  const boxed = figure.cells.flatMap((c, i) => c.boxes?.length ? [c.caption ?? String(i + 1)] : []);
  if (boxed.length) lines.push('Bagian yang dikotaki pada gambar ' + boxed.join(', '));
  const groups = new Map<string, DiagramLink[]>();
  for (const l of figure.links ?? []) { const key = [l.text, l.tone, l.side, l.level ?? 0].join('|'); groups.set(key, [...(groups.get(key) ?? []), l]); }
  for (const list of groups.values()) {
    const sorted = [...list].sort((x, y) => x.from - y.from);
    let text = '';
    sorted.forEach((l, i) => { const label = ' →(' + (l.text ?? '').replace(/\n/g, '; ') + ') '; text += (i && sorted[i - 1].to === l.from ? '' : (i ? '\n' : '') + name(l.from)) + label + name(l.to); });
    lines.push(text);
  }
  return lines.length ? lines.join('\n') : 'Gambar: ' + figure.cells.map((_, i) => name(i)).join(', ');
}

// Kotak `opt`: isi huruf opsinya dan urutkan menurut susunan opsi soal (opsi diacak setelah soal dibuat). Baris tanpa kotak opsi tidak berubah.
export function resolveOptionCells(line: string, options: { scene?: Scene }[]): string {
  const figure = parseFigureLine(line);
  if (!figure || !figure.cells.some((c) => c.opt)) return line;
  const place = (c: DiagramCell) => c.opt && c.scene ? options.findIndex((o) => o.scene && sameScene(o.scene, c.scene!)) : -1;
  try {
    const cells = figure.cells.map((c) => ({ ...c, caption: place(c) >= 0 ? String.fromCharCode(65 + place(c)) : c.caption }));
    const ordered = cells.every((c) => !c.opt || place(c) >= 0) ? [...cells].sort((a, b) => (a.opt ? place(a) : 99) - (b.opt ? place(b) : 99)) : cells;
    return figureLine({ ...figure, cells: ordered });
  } catch { return line; } // bentuk tak dikenal pada JSON hasil suntingan: baris dibiarkan; penggambaran melaporkan galatnya (diagramResult), bukan membuat halaman gagal
}
