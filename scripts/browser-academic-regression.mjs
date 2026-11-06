import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('@xmldom/xmldom');
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(90000);
const dialog = page.getByRole('dialog', { name: 'Ekspor paket soal' });
async function download(filename, buttonName) {
  const pending = page.waitForEvent('download', { timeout: 120000 });
  await dialog.getByRole('button', { name: buttonName, exact: true }).click();
  const file = await pending; await file.saveAs('test-results/' + filename);
  await dialog.locator('.export-success').waitFor();
  assert.equal(await dialog.locator('.error-message').count(), 0);
  return fs.readFileSync('test-results/' + filename);
}
try {
  await page.goto(process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107');
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles('test-results/academic-regression-fixture.json');
  const card = page.locator('.question-card').first();
  await page.getByRole('button', { name: /^Buka soal 1,/ }).click();
  await card.locator('.explanation-body').waitFor();
  assert.ok(await card.locator('.explanation-body b').filter({ hasText: 'Terpenuhinya standar kandungan kimia' }).count());
  assert.ok(await card.locator('.explanation-body b').filter({ hasText: 'perolehan status aman untuk saluran pembuangan' }).count());
  await card.screenshot({ path: 'test-results/academic-restored-silogisme.png' });
  await page.getByRole('button', { name: /^Buka soal 2,/ }).click();
  const table = card.locator('.explanation-table');
  await table.waitFor();
  assert.deepEqual(await table.locator('th').allTextContents(), ['Baris', 'Kiri', 'Kanan']);
  assert.equal(await table.locator('tbody tr').count(), 4);
  assert.match(await table.textContent(), /GaniHira/);
  await table.screenshot({ path: 'test-results/academic-restored-table.png' });
  const panel = page.getByRole('region', { name: 'Unduh paket', exact: true });
  await panel.getByRole('button', { name: /^PDF/ }).click();
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  await dialog.getByRole('button', { name: 'Lihat pratinjau PDF', exact: true }).click();
  await dialog.getByTitle('Pratinjau naskah PDF').waitFor();
  const preview = await page.evaluate(async () => {
    const url = document.querySelector('iframe[title="Pratinjau naskah PDF"]').src.split('#')[0];
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.slice(i, i + 16384));
    return btoa(binary);
  });
  const bytes = await download('academic-restored.pdf', 'Unduh 1 file PDF');
  assert.deepEqual(bytes, Buffer.from(preview, 'base64'), 'Preview and single-file download must be identical bytes');
  assert.ok(bytes.toString('latin1').startsWith('%PDF'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'Preview must fit mobile dialog');
  await dialog.getByTitle('Pratinjau naskah PDF').screenshot({ path: 'test-results/academic-pdf-preview-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await dialog.getByLabel('Isi dokumen').selectOption('soal');
  assert.equal(await dialog.getByTitle('Pratinjau naskah PDF').count(), 0, 'Hide stale preview when content changes');
  await download('academic-restored-soal.pdf', 'Unduh 1 file PDF');
  await dialog.getByRole('button', { name: /^Word SiAdu/ }).click();
  const word = await download('academic-restored-siadu.docx', 'Unduh 1 file Word SiAdu');
  const files = unzipSync(word), xml = strFromU8(files['word/document.xml']);
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const runs = Array.from(doc.getElementsByTagName('w:r'));
  for (const phrase of ['Terpenuhinya standar kandungan kimia', 'perolehan status aman untuk saluran pembuangan']) {
    assert.ok(runs.some(run => run.textContent.includes(phrase) && run.getElementsByTagName('w:b').length), phrase + ' must be bold in DOCX');
  }
  const tables = Array.from(doc.getElementsByTagName('w:tbl'));
  const seating = tables.find(t => /Gani/.test(t.textContent) && /Hira/.test(t.textContent));
  assert.ok(seating); assert.equal(seating.getElementsByTagName('w:tr').length, 5); assert.equal(seating.getElementsByTagName('w:tc').length, 15);
  assert.ok(!Array.from(doc.getElementsByTagName('w:p')).some(p => /Baris \| Kiri \| Kanan/.test(p.textContent)));
  const styles = strFromU8(files['word/styles.xml']);
  assert.match(styles, /w:ascii="Times New Roman"/); assert.match(styles, /w:sz w:val="24"/);
  assert.ok(Object.keys(files).some(key => key.startsWith('word/media/')));
  assert.deepEqual(errors, []);
  console.log('PASS: user screenshots reproduced from old bank; actual UI bold/table, selectable PDF preview/download equality, content invalidation, mobile, and real Word table + original bold.');
} finally { await browser.close(); }
