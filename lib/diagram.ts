// Diagram pada pembahasan (deret, figural beranotasi, graf rute) diperlakukan seragam oleh layar, ekspor, dan salinan: satu SVG, satu teks polos, satu judul.
import { chainPlain, chainSvg } from './chain';
import type { ExplanationBlock } from './explanation';
import { figurePlain, figureSvg } from './figural/annotate';
import { graphPlain, graphSvg } from './graph';
import { guideImage, guideSvg } from './guide-images';

export type DiagramBlock = Extract<ExplanationBlock, { k: 'chain' | 'figure' | 'graph' | 'guide' }>;
export const isDiagramBlock = (block: ExplanationBlock): block is DiagramBlock => block.k === 'chain' || block.k === 'figure' || block.k === 'graph' || block.k === 'guide';
export const diagramSvg = (block: DiagramBlock) => block.k === 'chain' ? chainSvg(block.chain) : block.k === 'figure' ? figureSvg(block.figure) : block.k === 'guide' ? guideSvg(block.id) : graphSvg(block.graph);
export const diagramPlain = (block: DiagramBlock) => block.k === 'chain' ? chainPlain(block.chain) : block.k === 'figure' ? figurePlain(block.figure) : block.k === 'guide' ? guideImage(block.id).text : graphPlain(block.graph);
// Judul gambar (keterangan alternatif Word dan salinan) dan nama berkasnya.
export const diagramTitle = (block: DiagramBlock) => block.k === 'chain' ? 'Diagram pola deret' : block.k === 'figure' ? 'Diagram pembahasan figural' : block.k === 'guide' ? guideImage(block.id).title : block.graph.ring ? 'Diagram duduk melingkar' : 'Graf rute';
export const diagramName = (block: DiagramBlock) => block.k === 'chain' ? 'deret' : block.k === 'figure' ? 'figural' : block.k === 'guide' ? block.id : block.graph.ring ? 'melingkar' : 'graf';
// Digambar dengan aman: JSON hasil suntingan yang terbaca tetapi berisi bentuk tak dikenal (mis. glyph figural) menghasilkan pesan galat, bukan membuat halaman gagal tampil.
export function diagramResult(block: DiagramBlock): { svg: string } | { error: string } {
  try { return { svg: diagramSvg(block) }; } catch (error) { return { error: error instanceof Error ? error.message : 'gambar tidak dapat dibuat' }; }
}
// Keterangan pengganti di ekspor (PDF, PNG, Word) dan salinan bila sebuah diagram tidak dapat digambar: ekspor tetap berjalan, bukan gagal total.
export const diagramNote = (error: string) => 'Diagram tidak dapat digambar: ' + error + '.';
