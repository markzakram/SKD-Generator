import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { build } from 'esbuild';

const basePath = 'integrations/siadu/SiaduInput-2.6.1.txt';
let source = fs.readFileSync(basePath, 'utf8').replaceAll('\r\n', '\n');
const upgrade = fs.readFileSync('integrations/siadu/upgrade.js', 'utf8');
const replacements = new Set(ts.createSourceFile('upgrade.js', upgrade, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS).statements.filter(ts.isFunctionDeclaration).map(n => n.name.text));
const ast = ts.createSourceFile('base.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const body = ast.statements[0].expression.expression.expression.body;
for (const statement of [...body.statements].reverse()) if (ts.isFunctionDeclaration(statement) && replacements.has(statement.name.text)) source = source.slice(0, statement.getStart(ast)) + source.slice(statement.end);
function replace(before, after) {
  if (!source.includes(before)) throw new Error('Importer build anchor missing: ' + before.slice(0, 100));
  source = source.replace(before, after);
}
replace('// @version      2.6.1', '// @version      2.7.1');
replace('// @description  Auto input dari Excel/DOCX/TXT. Mendukung $$LaTeX$$, equation Word, tabel Word/Markdown/HTML, dan PILIHAN mode jawaban: Option New atau Option (Legacy).', '// @description  DOCX gabungan TWK/TIU/TKP: mode per soal, gambar, tebal, warna, coretan, tabel, rumus lokal, dan poin opsi. Antrean IndexedDB.');
replace("defaultAnswerMode: 'option_new'", "defaultAnswerMode: 'auto'");
replace('no, level, correctAnswer,\n        questionText:', "no, level, correctAnswer,\n        answerMode: /Bentuk\\s+Soal\\s*:\\s*Option.*Legacy/i.test(block) ? 'option' : /Bentuk\\s+Soal\\s*:\\s*Option\\s+New/i.test(block) ? 'option_new' : undefined,\n        questionText:");
replace("if (needsRichInsert(optionText)) {", "if (item.richDocx) {\n        await setRichEditorHtml(`mc-answer-${i}`, item.optionHtmls[letter], `multiple_choices.${i}`);\n      } else if (needsRichInsert(optionText)) {");
replace("if (!stripHtml(editorData) && !stripHtml(livewireData || '') && optionText)", "if (!editorContentFilled(editorData) && !editorContentFilled(livewireData || '') && (optionText || item.richDocx))");
replace("if (correctCheckbox) {\n        const expected", "if (!correctCheckbox) problems.push(`Checkbox opsi ${letter} tidak ditemukan`);\n      if (correctCheckbox) {\n        const expected");
replace("const modeLabel = (state.answerMode === 'option') ? 'Option (Legacy)' : 'Option New';", "const modeLabel = state.answerMode === 'auto' ? 'Otomatis per soal' : state.answerMode === 'option' ? 'Option (Legacy)' : 'Option New';");
replace("if (modeSel) modeSel.value = (state.answerMode === 'option') ? 'option' : 'option_new';", "if (modeSel) modeSel.value = selectedAnswerMode(state.answerMode);");
replace("st.answerMode = (modeSel.value === 'option') ? 'option' : 'option_new';", "st.answerMode = selectedAnswerMode(modeSel.value);");
replace("const answerMode = (modeSel && modeSel.value === 'option') ? 'option' : 'option_new';", "const answerMode = selectedAnswerMode(modeSel?.value);\n    for (const item of queue) { if (answerMode === 'option_new' && detectedAnswerMode(item) === 'option') throw new Error('Antrean berisi TKP. Gunakan mode Otomatis agar poin tersimpan.'); }");
replace('async function startAuto(mode) {', "async function startAuto(mode) {\n    if (parsingQueue || processingQuestion || getState().running) throw new Error('Tunggu proses berjalan selesai atau jeda terlebih dahulu.');");
replace("const invalid = queue.filter((q) => q.errors && q.errors.length);", "const invalid = queue.filter(q => q.errors?.length || validateItemMode(q).length);\n    if (invalid.length) throw new Error(`Ada ${invalid.length} soal bermasalah. Perbaiki berkas dan Parse ulang sebelum mengisi.`);");
replace("running: true,\n      mode,", "running: true,\n      importerVersion: '2.7.1',\n      mode,");
replace("      const age = Date.now() - Number(state.lastSaveAt || 0);\n      if (age < 7000) { setTimeout(processCurrentAuto, 7500 - age); return; }\n      advanceToNext('Terdeteksi halaman selesai simpan. Lanjut soal berikutnya.');", "      const feedback = saveFeedback();\n      if (!feedback.error && (state.saveConfirmed || feedback.success)) advanceToNext('SiAdu mengonfirmasi penyimpanan. Lanjut soal berikutnya.');\n      else { state.running = false; state.phase = 'error'; state.lastMessage = feedback.error || 'Halaman dimuat ulang saat menyimpan. Periksa status soal terakhir sebelum melanjutkan dari urutan berikutnya.'; setState(state); }");
replace("      state.lastSaveAt = Date.now();", "      state.lastSaveAt = Date.now();\n      state.saveConfirmed = false;");
replace("getAnswerMode() === 'option' ? 'Legacy'", "getAnswerMode(item) === 'option' ? 'Legacy'");
replace("const item = queue[state.index];\n    try {", "const item = queue[state.index];\n    if (processingQuestion) return;\n    processingQuestion = true; lockQueueControls(true);\n    try {");
replace("      // Flush final non-defer sebelum validasi/simpan.\n      try {", "      // Rich DOCX already has complete HTML; never rebuild it from plain text.\n      if (item.richDocx) await flushRichForm(item);\n      else try {");
replace("      saveButton.scrollIntoView({ behavior: 'instant', block: 'center' });", "      if (!getState().running) return;\n      if (item.richDocx) verifyRichForm(item);\n      saveButton.scrollIntoView({ behavior: 'instant', block: 'center' });");
replace('      saveButton.click();', "      if (!getState().running) return;\n      saveMessagesBeforeClick = new Map(Array.from(document.querySelectorAll('.alert-success, .swal2-popup.swal2-show, .toast, .notify, .notification')).filter(isVisible).map(el => [el, el.textContent]));\n      saveButton.click();");
replace('advanceToNext(`SOAL ${item.no} dianggap tersimpan.`);', 'advanceToNext(`SOAL ${item.no} dikonfirmasi tersimpan oleh SiAdu.`);');
replace("console.error('[SiAdu Auto Input] Error:', err);\n    }\n  }", "console.error('[SiAdu Auto Input] Error:', err);\n    } finally { processingQuestion = false; lockQueueControls(false); }\n  }");
replace('SiAdu Auto Input (Option New / Legacy)', 'SiAdu Auto Input 2.7.1');
replace('Excel memakai template kolom. DOCX/TXT juga didukung. Tabel Word/Markdown/HTML/TSV dimasukkan ke CKEditor; isi sel bisa **bold** dan $$LaTeX$$.', 'Unggah satu Word SiAdu gabungan. Gambar, tebal, warna, coretan, tabel, dan rumus dibaca langsung. Antrean tersimpan di browser ini.');
replace('Mode Jawaban (pilih setelah / sebelum parsing)', 'Mode Jawaban');
replace('<option value="option_new">Option New', '<option value="auto">Otomatis per soal (TWK/TIU + TKP)</option>\n            <option value="option_new">Option New');
replace('Option New: tiap opsi punya editor sendiri, jawaban benar via centang. Legacy: opsi ditulis di editor soal, isi #Jawaban Benar dan skor per opsi (skor dibaca dari pembahasan "Opsi A (5 poin)" atau kolom skor_a..f Excel).', 'Otomatis: TWK/TIU → Option New; TKP → Legacy dengan poin A–E. Periksa lewat Isi 1 Soal Tanpa Simpan, lalu mulai antrean. Mode manual tetap tersedia untuk file lama.');
replace("panel.querySelector('#siadu-reset').addEventListener('click', () => {", "panel.querySelector('#siadu-reset').addEventListener('click', async () => {");
replace('if (ok) resetAll();', 'if (ok) { try { await resetAll(); } catch (error) { alert(error.message); } }');
replace('  init();\n})();', upgrade + '\n  init();\n})();');
// Metadata belongs at the very start of a userscript, before the bundler wrapper.
const header = source.slice(0, source.indexOf('// ==/UserScript==') + '// ==/UserScript=='.length);
source = source.slice(header.length);
const test = process.argv.includes('--test');
if (test) {
  source = source.replace('  init();\n})();', `  window.__siaduTest = { readSiaduDocx: buffer => readSiaduDocx(buffer, {ommlToLatex,mapLevel,parseScores}), parseQuestions, parseQuestionsFromExcel, validateItemMode, getAnswerMode, detectedAnswerMode, fillQuestionForm, verifyRichForm, assertRichContent, richSignature, setState, getState, setQueue, getQueue, loadQueue, resetAll, createPanel, parseFromPanel, processCurrentAuto, waitAfterSave, init, APP };\n})();`);
  source = source.replace('const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));', 'const sleep = ms => new Promise(resolve => setTimeout(resolve, Math.min(ms, 5)));');
}
const out = test ? 'test-results/siadu-importer-test.js' : 'public/siadu-auto-input.user.js';
fs.mkdirSync(path.dirname(out), { recursive: true });
await build({ stdin: { contents: `import {readSiaduDocx} from './docx.js';\n${source}`, resolveDir: path.resolve('integrations/siadu'), sourcefile: 'siadu-entry.js' }, outfile: out, bundle: true, platform: 'browser', format: 'iife', target: 'es2020', minify: false, legalComments: 'eof', banner: { js: header } });
console.log(`${out}: ${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MB`);
