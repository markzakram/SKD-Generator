import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mathHtml, mathParts, mathSvg, plainMath } from '../lib/math';
import { mathImageHtml, mathImageKey, prepareMathImages } from '../lib/math-raster';
import { documentExplanation, explanationOf, explanationTexts } from '../lib/explanation';
import { questionBlocks, type Raster } from '../lib/export';
import { richHtml } from '../lib/richtext';
import { pdfTextRenderer, type PdfTextLine } from '../lib/pdf-text';
import { tableGrid } from '../lib/table';
import { siaduText, siaduScoreLines } from '../lib/siadu';
import { readBackup } from '../lib/backup';
import type { Workspace } from '../lib/types';
import { boldAnswerLabels } from '../lib/pembahasan';

async function main() {
  let checks = 0;
  const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
  for (const [input, expected] of [['->', '\\to'], ['-->', '\\to'], ['→', '\\to'], ['<->', '\\leftrightarrow'], ['<-->', '\\leftrightarrow'], ['↔', '\\leftrightarrow'], ['⇔', '\\Leftrightarrow'], ['⇒', '\\Rightarrow'], ['←', '\\leftarrow'], ['↑', '\\uparrow'], ['↓', '\\downarrow']]) {
    const raw = 'Hubungan: awal ' + input + ' akhir';
    check(mathParts(raw).some((p) => p.kind === 'math' && p.value === expected), 'Panah prosa menjadi glif: ' + input);
    check(!mathHtml(raw).includes('-&gt;') && mathHtml(raw).includes('role="math"'), 'Layar memakai panah nyata');
    check(siaduText(raw).includes('$$' + expected + '$$'), 'SiAdu menggunakan notasi LaTeX yang sama');
    check(!/->|\\/.test(plainMath(raw)), 'Teks polos tetap panah terbaca');
  }
  check(mathParts(String.raw`\(p->q\)`)[0].value === String.raw`p\to q`, 'Panah ASCII dalam rumus dinormalisasi');
  const url = 'https://example.test/a->b';
  check(mathParts(url).every((p) => p.kind === 'text') && plainMath(url) === url, 'URL dipertahankan');
  check(plainMath('Nilai x < -2') === 'Nilai x < −2', 'Tanda kurang dari bilangan negatif bukan panah');
  check(!mathHtml('<img src=x onerror=alert(1)>').includes('<img'), 'Normalisasi panah tidak membuka HTML');

  const formula = String.raw`p\to q`;
  check(mathSvg(formula).svg !== mathSvg(formula, { bold: true }).svg, 'Bold mengubah glif rumus, bukan hanya pembungkus');
  check(mathSvg(formula, { strike: true }).svg.includes('<line '), 'Coretan juga tergambar pada rumus');
  for (const latex of [formula, String.raw`\frac{2}{3}`, String.raw`\begin{aligned}p&\to q\\q&\to r\end{aligned}`]) {
    for (const bold of [false, true]) for (const strike of [false, true]) {
      check(mathSvg(latex, { bold, strike }).height > 0, 'Rumus bergaya tetap dapat digambar');
    }
  }
  const marked = '**{merah:\\(' + formula + '\\)}**';
  const html = richHtml(marked, mathHtml);
  check(html.includes('<b>') && html.includes('#FF0000') && !html.includes('math-error'), 'Bold dan warna tersalur ke HTML');
  const seen: string[] = [];
  const rasterize = async (svg: string): Promise<Raster> => {
    seen.push(svg);
    return { url: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), data: new Uint8Array(), width: 50, height: 20 };
  };
  const images = await prepareMathImages(['\\(' + formula + '\\)', marked, '~~\\(' + formula + '\\)~~'], rasterize);
  check(images.size === 3 && new Set(seen).size === 3, 'Cache rumus memisahkan normal, bold merah, dan coret');
  check(images.has(mathImageKey(formula, 'merah', { bold: true })), 'Kunci cache menyertakan ketebalan');
  check(mathImageHtml('\\(' + formula + '\\)', images, 'merah', { bold: true }).includes('<img'), 'Clipboard menggunakan gambar rumus bold');
  const tableTexts = explanationTexts('| \\(p\\) |\n|---|\n| ==\\(q\\)== |');
  check(tableTexts.every((text) => text.startsWith('**')), 'Header dan sel sorot menyiapkan rumus bold');

  // PDF (lib/pdf-text.ts): jsPDF menggambar teks tanpa kerning, jadi lebar kata diukur tanpa kerning (diukur dengan kerning, spasi sesudah "Wa", "Yo", "Te" menyempit);
  // dan run yang bersambung tanpa spasi pindah baris bersama ("**lanjutan**" lalu "." atau "(" tidak boleh sendirian di ujung baris). Perbaikan MINOR QA akhir 2 Nov.
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' }), pdfText = pdfTextRenderer(pdf, rasterize), SIZE = 11;
  const widthOf = (text: string, bold = false) => { pdf.setFont('times', bold ? 'bold' : 'normal'); pdf.setFontSize(SIZE); return pdf.getStringUnitWidth(text, { doKerning: false }) * SIZE / pdf.internal.scaleFactor; };
  const rowsOf = (lines: PdfTextLine[]) => lines.map((line) => line.spans.map((span) => span.text ?? '').join(''));
  const [spaced] = await pdfText.layout('Warga menilai Yoga, dan Tono', SIZE, false, 178);
  check(spaced.spans.every((span) => Math.abs(span.width - widthOf(span.text!)) < 1e-6), 'PDF: lebar kata sama dengan yang digambar (tanpa kerning)');
  pdf.setFont('times', 'normal'); pdf.setFontSize(SIZE);
  check(pdf.getTextWidth('Warga') < widthOf('Warga') - .01, 'PDF: pengukuran berkerning memang lebih sempit (uji peka terhadap perbaikan spasi)');
  const dotRows = rowsOf(await pdfText.layout('Ini **pelatihan lanjutan**. Selesai', SIZE, false, widthOf('Ini ') + widthOf('pelatihan lanjutan', true) + widthOf('.') / 2));
  check(dotRows.length > 1 && dotRows.every((row) => !/^[.,;:)]/.test(row)) && dotRows[1].startsWith('lanjutan.'), 'PDF: titik setelah teks tebal pindah baris bersama katanya: ' + JSON.stringify(dotRows));
  const parenRows = rowsOf(await pdfText.layout('Ini (**pelatihan lanjutan**) selesai', SIZE, false, widthOf('(') + widthOf('pelatihan', true) + .1));
  check(parenRows.length > 1 && parenRows.every((row) => !/\($/.test(row.trimEnd())) && parenRows[1].startsWith('(pelatihan'), 'PDF: kurung buka tidak tertinggal sendirian di ujung baris: ' + JSON.stringify(parenRows));
  const longRows = await pdfText.layout('a'.repeat(300), SIZE, false, 178);
  check(longRows.length > 1 && longRows.every((line) => line.width <= 178.01) && rowsOf(longRows).join('').length === 300, 'PDF: kata yang lebih panjang dari baris tetap dipotong per bagian');
  // Tabel: header angka urut polos (1..n) ditulis sebagai teks di Word dan SiAdu (plain), sedangkan angka lain tetap dirumuskan.
  check(tableGrid({ headers: ['1', '2', '3'], rows: [['A', 'B', 'C']] }).header!.every((cell) => cell.plain), 'Tabel: header 1..n ditandai teks polos');
  check(tableGrid({ headers: ['2', '4', '6'], rows: [['A', 'B', 'C']] }).header!.every((cell) => !cell.plain) && tableGrid({ headers: ['Urutan n', 'Nilai'], rows: [['1', '2']] }).header!.every((cell) => !cell.plain)
    && tableGrid({ headers: ['1', '2'], rows: [['1', '2']] }).rows[0].every((cell) => !cell.plain), 'Tabel: angka data dan header numerik lain tetap rumus');

  const fixture = JSON.parse(fs.readFileSync('test-results/academic-fixture.json', 'utf8')) as Workspace;
  const original = fixture.result.packages[0];
  const first = { ...original, id: 'QC-01', seed: 'QC-EXPORT-1', questions: original.questions.map((q) => ({ ...q, binding: undefined,
    source: 'CATATAN-SUMBER-QC', explanation: q.explanation.replace(/→/g, '->') + '\nSumber: CATATAN-SUMBER-QC',
  })) };
  for (const q of first.questions) {
    const snapshot = JSON.stringify(q);
    check(!documentExplanation(q).includes('CATATAN-SUMBER-QC'), 'Sumber tertanam dihapus dari naskah');
    const blocks = questionBlocks(q, 'pembahasan', null);
    check(blocks.tail.every((b) => b.kind !== 'text' || !b.text.includes('CATATAN-SUMBER-QC')), 'PDF/PNG tanpa sumber');
    // TWK gaya Nynda (Nasionalisme, Integritas, Bela Negara, Pilar Negara): label "Jawaban:" dan "Pembahasan:" biasa; subtes lain dan TWK Bahasa Negara (gaya Dhea) tebal.
    check(blocks.tail.slice(0, 2).every((b) => b.kind === 'text' && b.bold === boldAnswerLabels(q) && b.keepNext), 'Jawaban dan Pembahasan melekat ke isi; tebal kecuali TWK gaya Nynda');
    check(explanationOf(q).includes('CATATAN-SUMBER-QC') && JSON.stringify(q) === snapshot, 'Sumber asli tetap tersimpan');
    if (q.subtest === 'TKP') check(siaduScoreLines(q).length === 5, 'Poin TKP tetap utuh');
  }
  check(documentExplanation({ explanation: 'Sumber energi berasal dari matahari.\n**Sumber:** catatan internal\nKesimpulan tetap ada.', answer: 0 }) === 'Sumber energi berasal dari matahari.\nKesimpulan tetap ada.', 'Hanya label metadata, bukan isi materi, yang dibuang');
  fixture.result.packages = [first, { ...original, id: 'QC-02', seed: 'QC-EXPORT-2', questions: original.questions.slice(4, 8) }];
  fixture.result.settings.title = 'QC Ekspor Akademik';
  fixture.name = fixture.result.settings.title;
  fixture.result.settings.packages = 2;
  readBackup(JSON.stringify(fixture));
  fs.writeFileSync('test-results/export-qc-fixture.json', JSON.stringify(fixture));
  console.log(JSON.stringify({ status: 'PASS', checks, questions: fixture.result.packages.flatMap((p) => p.questions).length }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
