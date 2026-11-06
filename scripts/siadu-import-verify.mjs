// Compatibility test against the user's actual Auto Input implementation.
// Only function declarations and inert constants are loaded into an offline
// page; its startup, navigation, submit, and queue loop are never executed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const { unzipSync, strFromU8 } = require('fflate');
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const importerPath = path.resolve(process.env.SKD_SIADU_IMPORTER ?? 'integrations/siadu/SiaduInput-2.6.1.txt');
const source = fs.readFileSync(importerPath, 'utf8');
assert.match(source, /@version\s+2\.6\.1/, 'Uji ini memverifikasi kontrak Auto Input v2.6.1');
const ast = ts.createSourceFile('importer.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const statements = ast.statements[0].expression.expression.expression.body.statements;
const constants = new Set(['APP', 'LETTERS', 'TRAILING_EDITOR_HTML', 'TABLE_MARKER_PREFIX', 'TABLE_MARKER_RE']);
const declarations = statements.filter((statement) => ts.isFunctionDeclaration(statement) ||
  ts.isVariableStatement(statement) && statement.declarationList.declarations.every((d) => constants.has(d.name.getText(ast)))).map((statement) => statement.getText(ast)).join('\n');
const code = '(function(){const PAGE=window;const sleep=async()=>{};\n' + declarations +
  '\nwindow.__siaduTest={docxDocumentXmlToText,parseQuestions,chooseAnswerTypeOptionLegacy,fillOptionScores,checkOptionScores,ensureOptionScores};})();';
const fixture = JSON.parse(fs.readFileSync('test-results/siadu-fixture.json', 'utf8'));
const cases = [
  { filename: process.env.SKD_SIADU_DOCX ?? 'test-results/siadu-tkp-unit.docx', questions: fixture.result.packages[Number(process.env.SKD_SIADU_PACKAGE ?? 0)].questions.filter((q) => q.subtest === 'TKP') },
  { filename: 'test-results/siadu-tkp-edge.docx', questions: JSON.parse(fs.readFileSync('test-results/siadu-tkp-edge.json', 'utf8')) },
];
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
let count = 0;
try {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.abort());
  await page.setContent('<div wire:id="test-form"><select id="answer_type"><option value="option_new">Option New</option><option value="option">Option (Legacy)</option></select><input id="correct_answer">' +
    ['a', 'b', 'c', 'd', 'e', 'f'].map((letter) => '<input type="number" id="score_option_' + letter + '">').join('') + '</div>');
  await page.evaluate(() => {
    window.__writes = {};
    window.Livewire = { find: () => ({ set: (prop, value) => { window.__writes[prop] = value; }, call: () => {} }) };
  });
  await page.addScriptTag({ content: code });
  for (const entry of cases) {
    const xml = strFromU8(unzipSync(fs.readFileSync(entry.filename))['word/document.xml']);
    const result = await page.evaluate(async (xml) => {
      const api = window.__siaduTest;
      const text = api.docxDocumentXmlToText(xml);
      let parsed;
      try { parsed = api.parseQuestions(text); }
      catch (error) { throw new Error(error.message + ' Cuplikan pembaca Word: ' + text.slice(0, 900)); }
      await api.chooseAnswerTypeOptionLegacy();
      const items = [];
      for (const item of parsed.items) {
        window.__writes = {};
        await api.fillOptionScores(item);
        const values = () => Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => [letter, document.querySelector('#score_option_' + letter.toLowerCase()).value]));
        const fields = values(), errors = api.checkOptionScores(item);
        const synced = { ...window.__writes };
        // SiAdu can rerender a field; its own recovery function must refill it.
        document.querySelector('#score_option_c').value = '';
        const retryErrors = await api.ensureOptionScores(item);
        items.push({ item, fields, errors, retryErrors, repaired: values(), synced });
      }
      return { errors: parsed.errors, items, answerType: document.querySelector('#answer_type').value };
    }, xml);
    assert.deepEqual(result.errors, []); assert.equal(result.answerType, 'option');
    assert.equal(result.items.length, entry.questions.length);
    result.items.forEach(({ item, fields, errors, retryErrors, repaired, synced }, i) => {
      const q = entry.questions[i];
      assert.deepEqual(item.errors, []); assert.deepEqual(errors, []); assert.deepEqual(retryErrors, []);
      assert.equal(item.correctAnswer, String.fromCharCode(65 + q.answer));
      assert.ok(!item.questionText.includes('Bentuk Soal:'), 'Metadata bukan bagian stimulus TKP');
      assert.equal(item.questionStemText, q.stem.replace(/\s+/g, ' ').trim());
      for (const [j, option] of q.options.entries()) {
        const letter = String.fromCharCode(65 + j);
        assert.equal(item.scores[letter], option.score);
        assert.equal(fields[letter], String(option.score));
        assert.equal(repaired[letter], String(option.score));
        assert.equal(synced['table.score_option_' + letter.toLowerCase()], String(option.score));
        assert.equal(item.optionTexts[letter], option.text);
      }
      assert.equal(fields.F, '');
      count++;
    });
  }
  if (process.env.SKD_SIADU_COMBINED_DOCX) {
    const xml = strFromU8(unzipSync(fs.readFileSync(process.env.SKD_SIADU_COMBINED_DOCX))['word/document.xml']);
    const expected = fixture.result.packages[Number(process.env.SKD_SIADU_PACKAGE ?? 0)].questions;
    const parsed = await page.evaluate(xml => window.__siaduTest.parseQuestions(window.__siaduTest.docxDocumentXmlToText(xml)), xml);
    assert.deepEqual(parsed.errors, []); assert.equal(parsed.items.length, expected.length);
    parsed.items.forEach((item, i) => {
      const q = expected[i];
      assert.deepEqual(item.errors, []); assert.equal(item.no, String(i + 1));
      assert.equal(item.correctAnswer, String.fromCharCode(65 + q.answer));
      assert.equal(item.optionCount, 5);
      assert.ok(!/Bentuk Soal:|Category:|Chapter:/.test(item.questionStemText));
      if (q.subtest === 'TKP') q.options.forEach((o, j) => assert.equal(item.scores[String.fromCharCode(65 + j)], o.score));
    });
    console.log('LULUS baca berkas gabungan: ' + expected.length + ' nomor/kunci/opsi, metadata tidak bocor ke soal, poin TKP tetap utuh. Uji ini tidak menyatakan dukungan pergantian mode otomatis atau media pada importir lama.');
  }
  console.log('LULUS Auto Input v2.6.1 asli: ' + count + ' soal / ' + count * 5 + ' bobot, baca DOCX, kunci, urutan opsi, sunting poin, catatan skor lama, pengisian form dan sinkronisasi model (simulasi lokal, tanpa menyimpan ke SiAdu).');
} finally { await browser.close(); }
