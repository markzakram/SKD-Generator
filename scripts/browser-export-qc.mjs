import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('@xmldom/xmldom');
const dir = path.resolve('test-results');
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1800 }, acceptDownloads: true });
const page = await context.newPage(), errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.setDefaultTimeout(30000);
const dialog = page.getByRole('dialog', { name: 'Ekspor paket soal' });
async function download(filename, button) {
  const pending = page.waitForEvent('download', { timeout: 180000 });
  await dialog.getByRole('button', { name: button, exact: true }).click();
  const file = await pending;
  assert.equal(await file.failure(), null);
  await file.saveAs(path.join(dir, filename));
  await dialog.locator('.export-success').waitFor();
  assert.equal(await dialog.locator('.error-message').count(), 0);
  return { name: file.suggestedFilename(), bytes: fs.readFileSync(path.join(dir, filename)) };
}
function word(bytes, expected) {
  const files = unzipSync(bytes), xml = strFromU8(files['word/document.xml']);
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const lines = Array.from(document.getElementsByTagName('w:p')).map((p) => p.textContent ?? '');
  assert.equal(lines.filter((line) => line === 'Pembahasan:').length, expected);
  assert.ok(!lines.some((line) => /CATATAN-SUMBER-QC|^Sumber:|->|\*\*|~~|\{merah:/.test(line)));
  assert.match(strFromU8(files['word/styles.xml']), /w:ascii="Times New Roman"/);
  return { files, xml, lines };
}
try {
  assert.equal((await page.goto(process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107/')).status(), 200);
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles(path.join(dir, 'export-qc-fixture.json'));
  const card = page.locator('.question-card');
  await page.getByRole('complementary', { name: 'Antrean soal' }).getByRole('button', { name: /^Buka soal 1,/ }).click();
  await card.waitFor();
  assert.ok(!((await card.locator('.explanation-body').innerText()).includes('->')));
  assert.ok((await card.locator('.explanation-body [role=math]').evaluateAll((nodes) => nodes.map((el) => el.getAttribute('aria-label')))).includes('\\to'));
  assert.ok(await card.locator('.explanation-body b [role=math]').count() > 0);
  assert.equal(await card.locator('.math-error').count(), 0);
  assert.equal(await card.locator('.explanation-body s').count(), 4);
  await card.screenshot({ path: path.join(dir, 'qc-explanation.png') });

  const panel = page.getByRole('region', { name: 'Unduh paket', exact: true });
  await panel.getByRole('button', { name: /^PDF/ }).click();
  assert.ok(await dialog.getByRole('radio', { name: /^Satu file PDF/ }).isChecked());
  assert.ok(await dialog.getByRole('radio', { name: /^ZIP per paket/ }).isDisabled());
  await dialog.getByLabel('Paket yang diunduh').selectOption('all');
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  assert.ok((await dialog.locator('.export-preview').innerText()).includes('16 soal · 2 paket'));
  await dialog.screenshot({ path: path.join(dir, 'qc-pdf-dialog.png') });
  const combined = await download('qc-combined.pdf', 'Unduh 1 file PDF');
  assert.match(combined.name, /\.pdf$/); assert.equal(combined.bytes.subarray(0, 5).toString(), '%PDF-');

  await dialog.getByRole('radio', { name: /^ZIP per paket/ }).check();
  await dialog.getByLabel('Isi dokumen').selectOption('kunci');
  const archive = unzipSync((await download('qc-pdf-packets.zip', 'Unduh ZIP PDF')).bytes);
  assert.equal(Object.keys(archive).length, 2);
  assert.ok(Object.values(archive).every((bytes) => Buffer.from(bytes).subarray(0, 5).toString() === '%PDF-'));
  await dialog.getByLabel('Paket yang diunduh').selectOption('active');
  assert.ok(await dialog.getByRole('radio', { name: /^Satu file PDF/ }).isChecked());

  await dialog.getByRole('button', { name: /^Word biasa/ }).click();
  await dialog.getByLabel('Paket yang diunduh').selectOption('all');
  assert.ok(await dialog.getByRole('radio', { name: /^Satu file Word/ }).isChecked(), 'Pilihan ZIP PDF tidak merembet ke Word');
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  const ordinary = word((await download('qc-combined.docx', 'Unduh Word biasa')).bytes, 16);
  assert.match(ordinary.xml, /<w:color w:val="FF0000"/); assert.match(ordinary.xml, /<w:strike\/>/);
  assert.ok(ordinary.lines.includes('QC-01 · 12 soal · 100 menit') && ordinary.lines.includes('QC-02 · 4 soal · 100 menit'));
  assert.ok(!ordinary.lines.some((line) => /\\(?:to|frac|begin|neg)\b/.test(line)), 'Word biasa tidak membocorkan LaTeX');
  const formulaXml = new DOMParser().parseFromString(ordinary.xml, 'text/xml');
  const mediaByFormula = new Map();
  for (const image of Array.from(formulaXml.getElementsByTagName('w:drawing'))) {
    const title = image.getElementsByTagName('wp:docPr')[0]?.getAttribute('title');
    const id = image.getElementsByTagName('a:blip')[0]?.getAttribute('r:embed');
    if (!title || !id) continue;
    const ids = mediaByFormula.get(title) ?? new Set(); ids.add(id); mediaByFormula.set(title, ids);
  }
  assert.ok([...mediaByFormula.values()].some((ids) => ids.size > 1), 'Rumus normal dan bold memiliki media berbeda di Word');

  await dialog.getByRole('button', { name: /^Word SiAdu/ }).click();
  await dialog.getByLabel('Paket yang diunduh').selectOption('active');
  const siaduCombined = word((await download('qc-siadu-combined.docx', 'Unduh 1 file Word SiAdu')).bytes, 12);
  assert.equal(siaduCombined.lines.filter(line => /^Soal \d+$/.test(line)).length, 12);
  assert.match(siaduCombined.xml, /<w:color w:val="FF0000"/); assert.match(siaduCombined.xml, /<w:strike\/>/);
  await dialog.getByRole('radio', { name: /^ZIP per paket dan subtes/ }).check();
  const siadu = unzipSync((await download('qc-siadu.zip', 'Unduh ZIP Word SiAdu')).bytes);
  assert.equal(Object.keys(siadu).length, 3);
  for (const [name, bytes] of Object.entries(siadu)) {
    const subtest = name.endsWith('-tiu-siadu.docx') ? 'TIU' : name.endsWith('-tkp-siadu.docx') ? 'TKP' : 'TWK';
    fs.writeFileSync(path.join(dir, 'qc-' + subtest.toLowerCase() + '-siadu.docx'), bytes);
    const doc = word(bytes, subtest === 'TIU' ? 10 : 1);
    if (subtest === 'TIU') {
      assert.ok(doc.lines.some((line) => line.includes('$$\\to$$')));
      assert.match(doc.xml, /<w:color w:val="FF0000"/); assert.match(doc.xml, /<w:strike\/>/);
    }
    if (subtest === 'TKP') assert.equal(doc.lines.filter((line) => /^Opsi [A-E] \([1-5] poin\)$/.test(line)).length, 5);
  }
  await dialog.getByLabel('Subtes untuk Word SiAdu').selectOption('TWK');
  assert.match((await download('qc-twk-single.docx', 'Unduh 1 file Word SiAdu')).name, /\.docx$/);

  await dialog.getByRole('button', { name: /^PDF/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
  const button = await dialog.getByRole('button', { name: 'Unduh 1 file PDF', exact: true }).boundingBox();
  assert.ok(button && button.y >= 0 && button.y + button.height <= 844, 'Tombol PDF tetap terlihat di ponsel');
  await page.screenshot({ path: path.join(dir, 'qc-pdf-mobile.png') });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.textContent?.includes('PDF'));
  assert.deepEqual(errors, []);
  console.log('PASS: panah, glif bold, coretan, PDF gabungan 2 paket, ZIP opsional, Word, Word SiAdu, sumber dihapus, poin TKP, mobile dan fokus.');
} finally { await browser.close(); }
