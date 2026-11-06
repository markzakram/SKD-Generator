import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('@xmldom/xmldom');
const dir = path.resolve('test-results');
const fixture = JSON.parse(fs.readFileSync(path.join(dir, 'academic-fixture.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
// Tinggi cukup untuk menangkap seluruh pembahasan di dalam panel gulir desktop.
const context = await browser.newContext({ viewport: { width: 1500, height: 3200 }, acceptDownloads: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.setDefaultTimeout(30000);
const queue = page.getByRole('complementary', { name: 'Antrean soal' });
const card = page.locator('.question-card');
const open = async (n) => {
  await queue.getByRole('button', { name: new RegExp('^Buka soal ' + n + ',') }).click();
  await page.waitForFunction((no) => Number(document.querySelector('.question-card .question-number')?.textContent.trim()) === no, n);
};
const dialog = page.getByRole('dialog', { name: 'Ekspor paket soal' });
async function download(filename, button, root = dialog) {
  const event = page.waitForEvent('download', { timeout: 120000 });
  await root.getByRole('button', { name: button, exact: true }).click();
  const file = await event;
  assert.equal(await file.failure(), null);
  await file.saveAs(path.join(dir, filename));
  return fs.readFileSync(path.join(dir, filename));
}
const readWord = (bytes) => {
  const files = unzipSync(bytes), xml = strFromU8(files['word/document.xml']);
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const lines = Array.from(document.getElementsByTagName('w:p')).map((node) => node.textContent ?? '');
  assert.ok(!lines.some((line) => /^@(acuan|gambar|deret|graf) /.test(line)));
  assert.ok(!lines.some((line) => /\*\*|~~|\{merah:/.test(line)), 'Tanpa penanda mentah');
  return { files, xml, lines };
};
try {
  assert.equal((await page.goto(process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107')).status(), 200);
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles(path.join(dir, 'academic-fixture.json'));
  await queue.waitFor();
  assert.equal(await queue.locator('.number-button').count(), fixture.result.packages[0].questions.length);
  for (const no of [1, 2, 3, 4]) {
    await open(no);
    assert.equal(await card.locator('s').count(), 4, 'Hanya empat opsi salah dicoret');
    const typography = await card.locator('.academic-explanation').evaluate((el) => ({ family: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize }));
    assert.match(typography.family, /Times New Roman/); assert.equal(typography.size, '16px');
  }
  await card.screenshot({ path: path.join(dir, 'academic-silogisme.png') });
  await open(5);
  const colors = await card.locator('[data-warna=merah]').evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).color));
  assert.ok(colors.length >= 4 && colors.every((color) => color === 'rgb(255, 0, 0)'));
  const cells = await card.locator('.explanation-table td, .explanation-table th').evaluateAll((nodes) => nodes.map((el) => ({ family: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize })));
  assert.ok(cells.length > 0 && cells.every((cell) => cell.size === '16px' && cell.family.includes('Times New Roman')), 'Sel tabel juga mengikuti font 12 pt');
  await card.screenshot({ path: path.join(dir, 'academic-wowo.png') });
  const png = await download('academic-wowo.png-export.png', 'Unduh PNG', page);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const closeToast = page.getByRole('button', { name: 'Tutup pemberitahuan', exact: true });
  while (await closeToast.count()) await closeToast.first().click();
  for (const no of [6, 7, 8]) {
    await open(no);
    assert.equal(await card.locator('.explanation-guide svg image').count(), 1);
    assert.match(await card.locator('.explanation-guide svg image').getAttribute('href'), /^data:image\/(png|jpeg);base64,/);
    await card.screenshot({ path: path.join(dir, 'academic-guide-' + no + '.png') });
  }
  for (const no of [9, 10]) {
    await open(no);
    assert.ok(await card.locator('.explanation-chain svg').count() > 0);
    await card.screenshot({ path: path.join(dir, 'academic-diagram-' + no + '.png') });
  }
  for (const no of [11, 12]) {
    await open(no);
    assert.equal(await card.locator('.explanation-heading').textContent(), 'Pembahasan:');
    const text = await card.locator('.explanation').textContent();
    assert.ok(text.indexOf('Jawaban:') < text.indexOf('Pembahasan:'));
  }
  await open(8);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await card.screenshot({ path: path.join(dir, 'academic-mobile.png') });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const panel = page.getByRole('region', { name: 'Unduh paket', exact: true });
  await panel.getByRole('button', { name: 'Format lainnya', exact: true }).click();
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  const word = readWord(await download('academic-word.docx', 'Unduh Word biasa'));
  assert.match(word.xml, /<w:color w:val="FF0000"/);
  assert.match(word.xml, /<w:strike\/>/);
  assert.match(word.xml, /w:ascii="Times New Roman"/);
  assert.ok(word.lines.filter((line) => line === 'Pembahasan:').length === 12);
  assert.ok(word.xml.includes('title="Pecahan Istimewa"') && word.xml.includes('title="Segitiga JKW"') && word.xml.includes('title="Segitiga VDW"'));
  assert.ok(!word.lines.some((line) => /\\(frac|times|div|neg|to)\b/.test(line)), 'Rumus Word biasa menjadi gambar, termasuk rumus merah');
  await dialog.getByLabel('Tutup dialog ekspor').click();
  await panel.getByRole('button', { name: /^PDF/ }).click();
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  const pdf = await download('academic-pembahasan.pdf', 'Unduh 1 file PDF');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await dialog.getByLabel('Tutup dialog ekspor').click();
  await panel.getByRole('button', { name: /Word SiAdu/ }).click();
  await dialog.getByRole('radio', { name: /^ZIP per paket dan subtes/ }).check();
  const zip = unzipSync(await download('academic-siadu.zip', 'Unduh ZIP Word SiAdu'));
  for (const [name, bytes] of Object.entries(zip)) {
    fs.writeFileSync(path.join(dir, 'academic-' + path.basename(name)), bytes);
    const doc = readWord(bytes);
    if (name.endsWith('-tiu-siadu.docx')) {
      assert.match(doc.xml, /<w:color w:val="FF0000"/); assert.match(doc.xml, /<w:strike\/>/);
      assert.ok(doc.lines.some((line) => line.includes('$$')), 'LaTeX untuk SiAdu');
    }
    if (name.endsWith('-tkp-siadu.docx')) assert.equal(doc.lines.filter((line) => /^Opsi [A-E] \([1-5] poin\)$/.test(line)).length, 5);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 4 chapter silogisme, warna dan coretan, 3 gambar asli, diagram, label TWK/TKP, mobile, PNG, PDF, Word, Word SiAdu dan poin TKP.');
} finally { await browser.close(); }
