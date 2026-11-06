import { rasterizeSvg, type Raster } from './export';
import { mathLines, tableRaster } from './math-raster';
import { diagramResult } from './diagram';
import { VIDEO, STAGE_LABEL, videoSections, videoWords, type VideoBlock, type VideoSlide } from './video-plan';
import type { Question } from './types';
import { auditQuestion } from './validate';

type Item = { image: Raster; width: number; height: number; gap: number; words: number; diagram: boolean; keepNext?: boolean };
type Placed = Item & { y: number };
type Page = { items: Placed[]; words: number; hasDiagram: boolean };
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const raster = (svg: string) => rasterizeSvg(svg, 2);
const loadImage = async (src: string) => { const image = new Image(); image.src = src; await image.decode(); return image; };
const asItem = (image: Raster, gap = 8, words = 0, diagram = false): Item => {
  const scale = Math.min(1, VIDEO.contentWidth / image.width, VIDEO.contentHeight / image.height);
  return { image, width: image.width * scale, height: image.height * scale, gap, words, diagram };
};
async function textItems(value: string, bold = false, keepNext = false): Promise<Item[]> {
  const lines = await mathLines(value, 28, bold, VIDEO.contentWidth, raster);
  return lines.map((image, i) => ({ ...asItem(image, i === lines.length - 1 ? 12 : 0, videoWords(value) / Math.max(1, lines.length)), keepNext: keepNext && i === lines.length - 1 }));
}

// Split tall tables by row with the real heading repeated. Very tall cells become labelled text,
// so a manual edit cannot produce unreadable microtext or silently cut away content.
async function tableItems(block: Extract<VideoBlock, { kind: 'table' }>, signal: AbortSignal): Promise<Item[]> {
  const out: Item[] = []; let rows: string[][] = [], last: Raster | null = null;
  const flush = () => { if (last) out.push(asItem(last, 12, videoWords([...block.headers, ...rows.flat()].join(' ')))); rows = []; last = null; };
  for (const row of block.rows) {
    signal.throwIfAborted();
    const image = await tableRaster({ headers: block.headers, rows: [...rows, row] }, 26, VIDEO.contentWidth, raster, block.box);
    if (image.height <= VIDEO.contentHeight) { rows.push(row); last = image; continue; }
    flush();
    const single = await tableRaster({ headers: block.headers, rows: [row] }, 26, VIDEO.contentWidth, raster, block.box);
    if (single.height <= VIDEO.contentHeight) { rows = [row]; last = single; }
    else for (const [i, cell] of row.entries()) out.push(...await textItems((block.headers[i] ? '**' + block.headers[i] + ':** ' : '') + cell));
  }
  flush();
  if (!block.rows.length && block.headers.length) out.push(...await textItems(block.headers.join(' · '), true));
  return out;
}
async function itemsFor(block: VideoBlock, signal: AbortSignal): Promise<Item[]> {
  signal.throwIfAborted();
  if (block.kind === 'gap') return [];
  if (block.kind === 'text') return textItems(block.text, block.bold, block.keepNext);
  if (block.kind === 'table') return tableItems(block, signal);
  if (block.kind === 'image') return [asItem(block.image, 12, 0, true)];
  const made = block.kind === 'svg' ? { svg: block.svg } : diagramResult(block.block);
  if ('error' in made) throw new Error('Gambar pembahasan tidak dapat disiapkan: ' + made.error);
  const image = await raster(made.svg);
  // Diagrams use their intrinsic resolution up to the available width; small answer figures stay crisp and compact.
  const scale = Math.min(VIDEO.contentWidth / image.width, VIDEO.contentHeight / image.height, 1.5);
  return [{ ...asItem(image, 12, 0, true), width: image.width * scale, height: image.height * scale }];
}
function paginate(items: Item[]): Page[] {
  const pages: Page[] = []; let current: Placed[] = [], y = 0;
  const flush = () => { if (current.length) pages.push({ items: current, words: Math.ceil(current.reduce((n, item) => n + item.words, 0)), hasDiagram: current.some(item => item.diagram) }); current = []; y = 0; };
  items.forEach((item, i) => {
    const keep = item.keepNext && items[i + 1] ? Math.min(VIDEO.contentHeight, item.height + item.gap + items[i + 1].height) : item.height;
    if (y + keep > VIDEO.contentHeight) flush();
    current.push({ ...item, y }); y += item.height + item.gap;
  });
  flush(); return pages;
}
async function paint(page: Page, q: Question, stage: VideoSlide['stage'], index: number, count: number): Promise<Blob> {
  const canvas = document.createElement('canvas'); canvas.width = VIDEO.width; canvas.height = VIDEO.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas tidak tersedia di browser ini.');
  ctx.fillStyle = '#f3f7fc'; ctx.fillRect(0, 0, VIDEO.width, VIDEO.height);
  ctx.fillStyle = stage === 'jawaban' ? '#146653' : '#07356b'; ctx.fillRect(0, 0, 10, VIDEO.height);
  ctx.font = 'bold 18px Arial'; ctx.fillStyle = '#476382'; ctx.fillText('JadiASN  /  SKD STUDIO', 48, 42);
  ctx.textAlign = 'right'; ctx.fillText('PEMBAHASAN TANPA SUARA', 1232, 42); ctx.textAlign = 'left';
  ctx.font = 'bold 36px Arial'; ctx.fillStyle = '#07356b'; ctx.fillText(STAGE_LABEL[stage], 48, 96);
  ctx.font = '20px Arial'; ctx.fillStyle = '#476382';
  let meta = `Soal ${q.no} · ${q.subtest} · ${q.subtopic}`;
  while (ctx.measureText(meta).width > 1080) meta = meta.slice(0, -2);
  ctx.fillText(meta, 48, 130);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(48, 152, 1184, 500, 16); ctx.fill();
  for (const item of page.items) {
    const image = await loadImage(item.image.url);
    ctx.drawImage(image, VIDEO.x + (item.diagram ? (VIDEO.contentWidth - item.width) / 2 : 0), VIDEO.y + item.y, item.width, item.height);
  }
  ctx.fillStyle = '#476382'; ctx.font = '18px Arial';
  ctx.fillText(stage === 'pilihan' ? 'Pilih jawaban sebelum kunci ditampilkan.' : stage === 'pembahasan' ? 'Ikuti langkah dan alasan pada pembahasan.' : 'Soal → Pilihan → Jawaban → Pembahasan', 48, 686);
  ctx.textAlign = 'right'; ctx.fillText(`${index + 1} / ${count}`, 1232, 686);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Layar video gagal dibuat.')), 'image/png'));
}

export async function prepareVideoSlides(questions: Question[], signal: AbortSignal, onProgress: (done: number, total: number, slides: number) => void): Promise<VideoSlide[]> {
  const slides: VideoSlide[] = [];
  try {
    signal.throwIfAborted();
    const errors = questions.flatMap(auditQuestion);
    if (errors.length) throw new Error('Video belum dapat dibuat karena validasi soal gagal: ' + errors[0]);
    for (const [qi, q] of questions.entries()) {
      signal.throwIfAborted(); onProgress(qi, questions.length, slides.length); await tick();
      for (const section of videoSections(q)) {
        const items: Item[] = [];
        for (const block of section.blocks) { items.push(...await itemsFor(block, signal)); await tick(); }
        const pages = paginate(items);
        for (const [i, page] of pages.entries()) {
          signal.throwIfAborted();
          const blob = await paint(page, q, section.stage, i, pages.length);
          slides.push({ src: URL.createObjectURL(blob), questionId: q.id, questionNo: q.no, subtest: q.subtest, stage: section.stage, page: i + 1, pages: pages.length,
            words: page.words, hasDiagram: page.hasDiagram, think: section.stage === 'pilihan' && i === pages.length - 1, from: 0, durationInFrames: 0 });
        }
      }
      onProgress(qi + 1, questions.length, slides.length);
    }
    signal.throwIfAborted();
    if (!slides.length) throw new Error('Tidak ada soal aktif untuk dijadikan video.');
    return slides;
  } catch (error) { releaseVideoSlides(slides); throw error; }
}
export const releaseVideoSlides = (slides: VideoSlide[]) => slides.forEach(slide => URL.revokeObjectURL(slide.src));
