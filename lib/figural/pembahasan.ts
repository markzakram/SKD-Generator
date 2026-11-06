// Penyusun pembahasan soal figural menurut Panduan Produksi Soal TIU JadiASN, bagian Figural (PDF 158–178): kalimat pengantar baku, diagram beranotasi
// (lib/figural/annotate.ts) yang memuat gambar-gambar soal itu sendiri, dan penutup "Jadi, jawaban yang benar adalah {kunci}.". Huruf opsi hanya muncul lewat
// penanda {kunci} (diisi saat tampil), sehingga tetap benar setelah opsi diacak. Tidak ada ulasan per opsi. Semua keterangan berasal dari data pembangkit
// (aturan, jumlah, selisih), bukan ditulis tangan per soal.
import { KEY_MARK } from '../explanation';
import type { Scene } from '../types';
import { figureLine, type DiagramCell, type DiagramLink, type FigureDiagram } from './annotate';
import { capital } from './text';

const join = (...lines: string[]) => lines.join('\n');
export const KEY_TAG = 'Sesuai dengan gambar pada opsi ' + KEY_MARK;
export const FIGURAL_CLOSE = 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.';
const answerCell = (scene: Scene | null, extra: Partial<DiagramCell> = {}): DiagramCell => ({ scene, frame: 'green', tag: KEY_TAG, ...extra });

// ---- Analogi (PDF 162): pasangan A → B dan C → jawaban dengan panah biru berlabel hubungan ------------------------------------------------------
// Panah hanya memuat label pendek ("Aturan 1 dan 2"); bunyi tiap aturan ditulis sebagai butir bernomor di bawah gambar (QC akademik 3 Nov: anotasi pada panah terlalu sempit dan
// kecil untuk dibaca). Gambar dibesarkan (zoom) karena hanya memuat dua kotak.
const ANALOGI_ZOOM = 1.7;
const ruleLabel = (n: number) => n === 1 ? 'Aturan 1' : n === 2 ? 'Aturan 1 dan 2' : 'Aturan 1 sampai ' + n;
export function analogiPembahasan(p: { A: Scene; B: Scene; C: Scene; key: Scene; rules: string[]; keyState: string }): string {
  const text = ruleLabel(p.rules.length);
  const pair = (left: Scene, right: Scene, answer: boolean) => figureLine({ columns: 2, zoom: ANALOGI_ZOOM, cells: [{ scene: left }, answer ? answerCell(right) : { scene: right }], links: [{ from: 0, to: 1, text, tone: 'blue', side: 'top' }] });
  const rules = p.rules.length === 1 ? ['Hubungan yang berlaku: ' + p.rules[0].charAt(0).toLowerCase() + p.rules[0].slice(1) + '.'] :
    ['Hubungan yang berlaku terdiri atas ' + p.rules.length + ' aturan:', ...p.rules.map((rule, i) => (i + 1) + '. ' + rule + '.')];
  return join('Berdasarkan pasangan gambar yang diketahui, didapatkan hubungan sebagai berikut:', pair(p.A, p.B, false), '', ...rules, '',
    'Dengan mengaplikasikan hubungan yang sama, didapatkan:', pair(p.C, p.key, true), '',
    'Gambar yang dihasilkan memiliki ' + p.keyState + '.', FIGURAL_CLOSE);
}

// ---- Ketidaksamaan (PDF 163–167) ---------------------------------------------------------------------------------------------------------------
type OddBase = { scenes: Scene[]; oddAt: number };
const optionCells = (p: OddBase, decorate: (cell: DiagramCell, k: number) => void = () => {}): DiagramCell[] => p.scenes.map((scene, k) => { const cell: DiagramCell = { scene, opt: true }; decorate(cell, k); return cell; });
// Putar-putar: empat gambar berurutan sama (hanya diputar), satu gambar urutannya berbeda; bagian yang berbeda dikotaki (biru pada empat gambar, merah pada yang berbeda).
export function oddOrderPembahasan(p: OddBase & { markIds: string[]; same: string; different: string; explain: string }): string {
  const boxed = p.markIds.length > 0;
  const all = figureLine({ columns: 5, cells: optionCells(p, (cell, k) => { if (boxed) cell.boxes = [{ ids: p.markIds, tone: k === p.oddAt ? 'red' : 'blue' }]; }) });
  const odd = figureLine({ columns: 1, cells: [answerCell(p.scenes[p.oddAt], { opt: true })] });
  return join('Kita perhatikan keseluruhan gambar. Perhatikan:', all, '',
    'Objek-objek diputar-putar, dan pada empat gambar urutan objek searah jarum jam sama, yaitu ' + p.same + '.' + (boxed ? ' Kotak biru menandai bagian yang kedudukannya sama pada empat gambar itu, sedangkan kotak merah menandai bagian yang berbeda.' : ''),
    'Gambar yang berbeda memiliki urutan ' + p.different + ': ' + p.explain + '. Maka yang berbeda adalah', odd, '', FIGURAL_CLOSE);
}
// Paritas: label jumlah bangun hitam di atas tiap gambar; hijau untuk empat gambar sejenis, merah untuk yang berbeda.
export function oddParityPembahasan(p: OddBase & { counts: number[]; kind: string; opposite: string }): string {
  const figure = figureLine({ columns: 5, cells: optionCells(p, (cell, k) => { cell.label = { text: p.counts[k] + ' hitam', tone: k === p.oddAt ? 'red' : 'green' }; if (k === p.oddAt) Object.assign(cell, { frame: 'red', tag: KEY_TAG }); }) });
  const others = p.counts.filter((_, k) => k !== p.oddAt).sort((x, y) => x - y);
  return join('Hitung banyaknya bangun berwarna hitam pada setiap gambar:', figure, '',
    'Empat gambar memuat jumlah bangun hitam ' + p.kind + ' (' + others.join(', ') + '), sedangkan satu gambar memuat ' + p.counts[p.oddAt] + ' bangun hitam, yaitu jumlah ' + p.opposite + '. Banyaknya bangun putih atau abu-abu dan susunan letaknya berbeda-beda pada tiap gambar dan tidak menentukan kelompok.',
    'Jadi, gambar yang berbeda adalah gambar dengan jumlah bangun hitam ' + p.opposite + '.', FIGURAL_CLOSE);
}
// Jumlah sisi: label "n sisi" di atas tiap gambar; pasangan pertama hijau, pasangan kedua kuning, gambar tanpa pasangan merah (PDF 167).
export function oddSidesPembahasan(p: OddBase & { sides: number[] }): string {
  const oddSides = p.sides[p.oddAt], groups = [...new Set(p.sides.filter((v) => v !== oddSides))].sort((x, y) => x - y);
  const figure = figureLine({ columns: 5, cells: optionCells(p, (cell, k) => { const tone = k === p.oddAt ? 'red' : groups.indexOf(p.sides[k]) === 0 ? 'green' : 'yellow'; cell.label = { text: p.sides[k] + ' sisi', tone }; if (k === p.oddAt) Object.assign(cell, { frame: 'red', tag: KEY_TAG }); }) });
  // Aturannya dinyatakan tegas (QC akademik 3 Nov): jumlah sisi dikelompokkan, kelompok yang beranggota dua gambar adalah pasangan, dan gambar yang jumlah sisinya
  // tidak sama dengan jumlah sisi gambar mana pun yang lain adalah yang berbeda. Tidak ada huruf opsi di sini; gambarnya dirujuk lewat jumlah sisinya.
  const times = (v: number) => p.sides.filter((x) => x === v).length;
  const lines = [...groups, oddSides].map((v, i) => (i + 1) + '. Jumlah sisi ' + v + ' ' + (times(v) === 1 ? 'hanya muncul pada satu gambar, sehingga tidak berpasangan.' : 'muncul pada ' + times(v) + ' gambar, sehingga gambar-gambar itu berpasangan.'));
  return join('Hitung banyaknya sisi pada setiap gambar:', figure, '',
    'Kelompokkan gambar menurut jumlah sisinya:', ...lines,
    'Aturannya: gambar yang jumlah sisinya sama dengan jumlah sisi gambar lain membentuk pasangan, sedangkan gambar yang jumlah sisinya tidak berpasangan adalah gambar yang berbeda.',
    'Jadi, gambar yang berbeda adalah gambar dengan ' + oddSides + ' sisi.', FIGURAL_CLOSE);
}

// ---- Serial (PDF 167–172): kotak bernomor, panah berlabel tiap aturan, kotak jawaban berbingkai hijau dengan tag -----------------------------------
export type SerialStep = { label: string; side: 'top' | 'bottom'; level: number; tone: DiagramLink['tone'] };
export function serialPembahasan(p: { cells: Scene[]; hidden: number; steps: SerialStep[]; corners?: (k: number) => DiagramCell['corners']; narrative: string }): string {
  // Hanya dua lajur panah (atas dan bawah); aturan lebih dari dua digabung ke label lajur yang sama supaya panah dan tulisan tidak saling menimpa.
  const lanes = (['top', 'bottom'] as const).flatMap((side) => { const mine = p.steps.filter((step) => step.side === side); return mine.length ? [{ side, text: mine.map((step) => step.label).join('\n'), tone: mine[0].tone }] : []; });
  const links: DiagramLink[] = lanes.flatMap((lane) => p.cells.slice(1).map((_, k): DiagramLink => ({ from: k, to: k + 1, text: lane.text, tone: lane.tone, side: lane.side, level: 0 })));
  const cells = p.cells.map((scene, k): DiagramCell => { const cell: DiagramCell = k === p.hidden ? answerCell(scene, { caption: String(k + 1) }) : { scene, caption: String(k + 1) }; const corners = p.corners?.(k); if (corners) cell.corners = corners; return cell; });
  return join('Berlaku pola sebagai berikut:', figureLine({ columns: p.cells.length, cells, links }), '', p.narrative, FIGURAL_CLOSE);
}

// ---- Matriks 3 × 3 (PDF 172–177) -----------------------------------------------------------------------------------------------------------------
export type MatrixInfo = { mekanisme: string; rules: Record<string, string>; roles: Record<string, string>; explain: string; cells: Scene[]; key: Scene; describe: string };
const GROUPS: Record<string, { prefix: string; tone: 'cyan' }[]> = { 'matriks-jumlah': [{ prefix: 'bangun@', tone: 'cyan' }], 'matriks-jumlah-ganda': [{ prefix: 'kiri@', tone: 'cyan' }, { prefix: 'kanan@', tone: 'cyan' }] };
const focusOf = (rule: string) => rule.split(':')[0].replace('@', '').replace(/\d+$/, '');
export function matrixPembahasan(m: MatrixInfo): string {
  const grid = (decorate: (cell: DiagramCell, k: number) => void): string => figureLine({ columns: 3, cells: m.cells.map((scene, k) => { const cell: DiagramCell = k === 8 ? { scene: null } : { scene }; decorate(cell, k); return cell; }) });
  const solved = figureLine({ columns: 3, cells: m.cells.map((scene, k) => k === 8 ? answerCell(m.key) : { scene }) });
  const counting = GROUPS[m.mekanisme];
  if (counting) {
    const count = (scene: Scene, prefix: string) => String(scene.parts.filter((p) => p.id.startsWith(prefix)).length);
    const figure = grid((cell, k) => { cell.corners = counting.map(({ prefix, tone }) => ({ text: count(k === 8 ? m.key : m.cells[k], prefix), tone })); if (k === 8) Object.assign(cell, { frame: 'green', tag: KEY_TAG }); });
    return join('Hitung banyaknya bangun pada setiap kotak (angka berlatar biru muda):', figure, '', m.explain, FIGURAL_CLOSE);
  }
  if (m.mekanisme.startsWith('matriks-tumpuk')) {
    const row = (r: number) => figureLine({ columns: 3, signs: ['+', '='], cells: [{ scene: m.cells[r * 3] }, { scene: m.cells[r * 3 + 1] }, r === 2 ? answerCell(m.key) : { scene: m.cells[r * 3 + 2] }] });
    return join('Perhatikan baris pertama:', row(0), '', 'Perhatikan baris kedua:', row(1), '', 'Maka baris ketiga:', row(2), '', m.explain, FIGURAL_CLOSE);
  }
  // Satu langkah per bagian yang aturannya berbeda: bagian itu dilingkari merah pada semua kotak, lalu aturannya ditulis sebagai butir.
  const focus = new Map<string, string[]>();
  for (const [rule, text] of Object.entries(m.rules)) { const key = focusOf(rule), list = focus.get(key) ?? []; if (!list.includes(text)) list.push(text); focus.set(key, list); }
  const lines: string[] = [];
  [...focus].forEach(([name, rules], i) => {
    const role = m.roles[name] ?? m.roles[name + '1'] ?? (name === 'bangun' ? 'bangun-bangun pada cincin' : name);
    lines.push((i === 0 ? 'Perhatikan ' : 'Sekarang perhatikan ') + role + ' pada masing-masing kotak (yang dilingkari merah). ' + (rules.length > 1 ? 'Aturannya:' : 'Aturannya:'),
      grid((cell, k) => { if (k !== 8) cell.rings = [name + '*']; }), ...rules.map((rule) => '• ' + capital(rule) + '.'), '');
  });
  lines.push('Dengan menggabungkan seluruh aturan, kotak yang hilang memuat ' + m.describe + '.', solved, '', FIGURAL_CLOSE);
  return lines.join('\n');
}
