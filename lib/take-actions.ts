// Penghubung antara tombol "ambil soal" dan modul yang sudah ada: rasterisasi (lib/export.ts), clipboard (lib/clipboard.ts),
// dan serialisasi murni (lib/take.ts). Dipanggil dari komponen; hanya berjalan di browser.
import { copyPng, copyRich, type CopyKind } from './clipboard';
import { download, pdfBlob, pngBlob, questionPngBlob, rasterizeSvg } from './export';
import { hasStimulus, optionSvg, questionSvg } from './figures';
import { joinHtml, joinTexts, pngEntryNames, sectionSlots, sectionsHtml, sectionsText, slotSvg, takeFileName, takeSections, type TakeContext, type TakeImages, type TakePart } from './take';
import type { Package, Question } from './types';

// Menyalin bagian soal (satu atau beberapa soal) sebagai teks + HTML dengan gambar. `heading` menambahkan baris "Soal N | ...".
export function copyQuestions(questions: readonly Question[], parts: readonly TakePart[], heading: boolean): Promise<CopyKind> {
  const sections = questions.map((q) => takeSections(q, parts, heading));
  return copyRich(joinTexts(sections.map(sectionsText)), async () => {
    const htmls: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const images: TakeImages = {};
      for (const slot of sectionSlots(sections[i])) {
        const raster = await rasterizeSvg(slotSvg(questions[i], slot));
        images[slot] = { url: raster.url, width: raster.width, height: raster.height };
      }
      htmls.push(sectionsHtml(sections[i], images));
    }
    return joinHtml(htmls);
  });
}
// Satu gambar soal atau opsi sebagai image/png: 'stimulus' atau nomor opsi (mulai 0).
export function copyQuestionImage(q: Question, target: 'stimulus' | number): Promise<void> {
  const svg = target === 'stimulus' ? (q.visual && hasStimulus(q) ? questionSvg(q, false) : '') : q.options[target] ? optionSvg(q.options[target]) : '';
  if (!svg) return Promise.reject(new Error('Gambar tidak tersedia pada soal ini.'));
  return copyPng(rasterizeSvg(svg).then(pngBlob));
}

// Unduh PDF: satu soal tanpa judul, beberapa soal dengan judul ringkas. Isi dan gaya sama dengan ekspor paket (pdfBlob).
export async function downloadPdf(pack: Package, questions: readonly Question[], context: TakeContext, withKey: boolean): Promise<string> {
  const blob = await pdfBlob([{ ...pack, questions: [...questions] }], { title: context.title }, withKey ? 'pembahasan' : 'soal', questions.length === 1 ? 'tanpa' : 'ringkas');
  const filename = takeFileName(context, questions, withKey, 'pdf');
  download(blob, filename);
  return filename;
}
// Unduh PNG: satu soal langsung PNG, beberapa soal satu PNG per soal dalam ZIP. `onProgress(selesai, total)` untuk label tombol.
export async function downloadPng(questions: readonly Question[], context: TakeContext, withKey: boolean, onProgress?: (done: number, total: number) => void): Promise<string> {
  const content = withKey ? 'pembahasan' : 'soal';
  if (questions.length === 1) {
    const filename = takeFileName(context, questions, withKey, 'png');
    download(await questionPngBlob(questions[0], content), filename);
    return filename;
  }
  const { zipSync } = await import('fflate');
  const names = pngEntryNames(questions), files: Record<string, Uint8Array> = {};
  for (let i = 0; i < questions.length; i++) {
    onProgress?.(i, questions.length);
    files[names[i]] = new Uint8Array(await (await questionPngBlob(questions[i], content)).arrayBuffer());
  }
  const filename = takeFileName(context, questions, withKey, 'zip');
  download(new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), filename); // PNG sudah terkompresi
  return filename;
}
