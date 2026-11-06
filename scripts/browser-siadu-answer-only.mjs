import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');
const fixture = JSON.parse(fs.readFileSync('test-results/answer-only-fixture.json', 'utf8'));
const questions = fixture.result.packages[0].questions;
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.setDefaultTimeout(45000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107');
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles('test-results/answer-only-fixture.json');
  await page.locator('.question-card').first().waitFor();
  await page.getByRole('region', { name: 'Unduh paket', exact: true }).getByRole('button', { name: /^Word SiAdu/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ekspor paket soal' });
  assert.equal(await dialog.getByLabel('Isi dokumen').inputValue(), 'pembahasan');
  assert.equal(await dialog.getByLabel('Isi dokumen').locator('option').count(), 2);
  await dialog.getByLabel('Isi dokumen').selectOption('soal-jawaban');
  await dialog.locator('.siadu-format-note > summary').click();
  assert.ok(await dialog.getByRole('link', { name: /Unduh importir SiAdu v2.7.1/ }).count());
  async function download(name, file) {
    const pending = page.waitForEvent('download'); await dialog.getByRole('button', { name, exact: true }).click();
    const result = await pending; assert.equal(await result.failure(), null);
    assert.match(result.suggestedFilename(), /tanpa-pembahasan\.(docx|zip)$/);
    await result.saveAs('test-results/' + file); return fs.readFileSync('test-results/' + file);
  }
  const combined = await download('Unduh 1 file Word SiAdu', 'answer-only-siadu.docx');
  const parts = unzipSync(combined), xml = strFromU8(parts['word/document.xml']);
  assert.equal((xml.match(/Jawaban: /g) ?? []).length, questions.length);
  assert.ok(!/RAHASIA_|Pembahasan:|Cara cepat|Sumber:/.test(xml));
  assert.ok(xml.includes('Isi dokumen: Soal + jawaban tanpa pembahasan'));
  assert.ok(xml.includes('<w:tbl>')); assert.ok(Object.keys(parts).some(p => p.startsWith('word/media/')));
  await page.addScriptTag({ path: 'test-results/siadu-importer-test.js' });
  async function read(buffer) {
    return page.evaluate(async data => {
      const result = await window.__siaduTest.readSiaduDocx(Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer);
      return { errors: result.errors, items: result.items.map(q => ({
        no: q.no, key: q.correctAnswer, mode: q.answerMode, scores: q.scores,
        explanation: q.explanationText, html: q.explanationHtml, stem: q.questionStemText,
        questionHtml: q.questionFullHtml, letters: q.optionLettersFound,
        errors: q.errors, modeErrors: window.__siaduTest.validateItemMode(q),
      })) };
    }, Buffer.from(buffer).toString('base64'));
  }
  function check(parsed, expected) {
    assert.deepEqual(parsed.errors, []); assert.equal(parsed.items.length, expected.length);
    parsed.items.forEach((item, i) => {
      const q = expected[i], key = String.fromCharCode(65 + q.answer);
      assert.deepEqual(item.errors, []); assert.deepEqual(item.modeErrors, []);
      assert.equal(item.no, String(i + 1)); assert.equal(item.key, key);
      assert.equal(item.mode, q.subtest === 'TKP' ? 'option' : 'option_new');
      assert.equal(item.letters.join(''), 'ABCDE');
      assert.ok(!/RAHASIA_|Pembahasan:|Cara cepat|Sumber:/.test(item.explanation + item.html + item.questionHtml));
      assert.match(item.html, /<strong>Jawaban:/);
      if (q.subtest === 'TKP') {
        q.options.forEach((o, j) => assert.equal(item.scores[String.fromCharCode(65 + j)], o.score));
        assert.equal(item.explanation.split('\n').length, 7);
      } else assert.equal(item.explanation, 'Jawaban: ' + key);
      if (q.table) assert.match(item.questionHtml, /<table\b/);
      if (q.visual) assert.match(item.questionHtml, /<img\b/);
    });
  }
  check(await read(combined), questions);
  // Preserve detection of incomplete full-format files and missing TKP scores.
  const missingMode = zipSync({ ...parts, 'word/document.xml': strToU8(xml.replace('Isi dokumen: Soal + jawaban tanpa pembahasan', 'Format input Word SiAdu')) });
  assert.ok((await read(missingMode)).errors.some(e => /Penanda Pembahasan/.test(e)));
  const missingScore = zipSync({ ...parts, 'word/document.xml': strToU8(xml.replace(/Opsi A \(\d+ poin\)/, '')) });
  assert.ok((await read(missingScore)).items.some(q => q.modeErrors.length));
  await dialog.getByRole('radio', { name: /^ZIP per paket dan subtes/ }).check();
  const archive = unzipSync(await download('Unduh ZIP Word SiAdu', 'answer-only-siadu.zip'));
  assert.equal(Object.keys(archive).length, 3);
  for (const [name, bytes] of Object.entries(archive)) {
    const subtest = name.match(/-(twk|tiu|tkp)-siadu-/)[1].toUpperCase();
    assert.match(name, /tanpa-pembahasan\.docx$/);
    check(await read(bytes), questions.filter(q => q.subtest === subtest));
  }
  await dialog.getByLabel('Subtes untuk Word SiAdu').selectOption('TKP');
  check(await read(await download('Unduh 1 file Word SiAdu', 'answer-only-siadu-tkp.docx')), questions.filter(q => q.subtest === 'TKP'));
  await dialog.getByRole('button', { name: /^PDF/ }).click();
  assert.equal(await dialog.getByLabel('Isi dokumen').inputValue(), 'soal-jawaban');
  await dialog.getByLabel('Isi dokumen').selectOption('soal');
  await dialog.getByRole('button', { name: /^Word SiAdu/ }).click();
  assert.equal(await dialog.getByLabel('Isi dokumen').inputValue(), 'pembahasan');
  assert.deepEqual(errors, []);
  console.log('PASS: SiAdu answer-only single/ZIP/TKP downloads; importer modes, keys, points, figures and tables; no discussion leakage; incomplete full files and missing scores still rejected.');
} finally { await browser.close(); }
