// Real CKEditor 4, local HTTP + IndexedDB, simulated SiAdu Livewire fields.
// No requests, account data, form submission or saving to the SiAdu server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const editorRoot = path.resolve(process.env.SKD_CKEDITOR_ROOT ?? 'test-results/siadu-ckeditor/package');
if (!fs.existsSync(path.join(editorRoot, 'ckeditor.js'))) throw new Error('Extract npm pack ckeditor4@4.22.1 into test-results/siadu-ckeditor first (or set SKD_CKEDITOR_ROOT).');
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/ckeditor/')) {
    const file = path.resolve(editorRoot, decodeURIComponent(req.url.slice('/ckeditor/'.length).split('?')[0]));
    if (!file.startsWith(editorRoot + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    const type = { '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' }[path.extname(file)] || 'text/plain';
    res.setHeader('Content-Type', type); res.end(fs.readFileSync(file)); return;
  }
  res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><main id="test-root"></main></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
const importBuffer = async (page, buffer, key) => page.evaluate(async ({ data, key }) => {
  const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const parsed = await window.__siaduTest.readSiaduDocx(bytes.buffer);
  window[key] = parsed.items;
  return { errors: parsed.errors, items: parsed.items.map(q => ({ no: q.no, mode: q.answerMode, key: q.correctAnswer, scores: q.scores, errors: q.errors, options: q.optionLettersFound, stem: q.questionStemText, modeErrors: window.__siaduTest.validateItemMode(q) })) };
}, { data: Buffer.from(buffer).toString('base64'), key });
let parsedCount = 0, filledCount = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await context.newPage(), external = [], pageErrors = [];
  await page.route('**/*', route => { if (new URL(route.request().url()).origin === origin) return route.continue(); external.push(route.request().url()); return route.abort(); });
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto(origin + '/admin/detail/1/0');
  await page.addScriptTag({ path: 'test-results/siadu-importer-test.js' });
  const fixture = JSON.parse(fs.readFileSync('test-results/siadu-fixture.json', 'utf8'));
  const expected = fixture.result.packages.flatMap(p => p.questions);
  const combined = await importBuffer(page, fs.readFileSync('test-results/siadu-all-combined.docx'), '__combined');
  assert.equal(combined.items.length, 220); assert.deepEqual(combined.errors, []);
  combined.items.forEach((q, i) => {
    assert.deepEqual(q.errors, []); assert.deepEqual(q.modeErrors, []);
    assert.equal(q.no, String(i + 1)); assert.equal(q.key, String.fromCharCode(65 + expected[i].answer));
    assert.equal(q.mode, expected[i].subtest === 'TKP' ? 'option' : 'option_new');
    assert.equal(q.options.join(''), 'ABCDE');
    if (expected[i].subtest !== 'TIU') assert.equal(q.stem, expected[i].stem.replace(/\s+/g, ' ').trim());
    if (q.mode === 'option') expected[i].options.forEach((o, j) => assert.equal(q.scores[String.fromCharCode(65 + j)], o.score));
  });
  parsedCount += combined.items.length;
  console.log('PASS combined 220: sequential numbers, modes, answers, options, 450 TKP points.');
  const academic = await importBuffer(page, fs.readFileSync('test-results/qc-siadu-combined.docx'), '__academic');
  assert.deepEqual(academic.errors, []); assert.equal(academic.items.length, 12); parsedCount += 12;
  const academicRich = await page.evaluate(() => {
    const html = window.__academic.map(q => q.questionFullHtml + q.explanationHtml).join('');
    const div = document.createElement('div'); div.innerHTML = html;
    return { bold: div.querySelectorAll('strong').length, colors: div.querySelectorAll('span[style*="color"]').length, strikes: div.querySelectorAll('s').length, tables: div.querySelectorAll('table').length, images: div.querySelectorAll('img').length, formulas: div.querySelectorAll('img.siadu-latex-formula').length, answerBold: window.__academic.every(q => /<strong>Jawaban/.test(q.explanationHtml)), remainingLatex: /\$\$/.test(div.textContent) };
  });
  assert.ok(academicRich.bold > 30 && academicRich.colors > 3 && academicRich.strikes > 3 && academicRich.tables > 0 && academicRich.images > 10 && academicRich.formulas > 10);
  assert.equal(academicRich.answerBold, true); assert.equal(academicRich.remainingLatex, false);
  console.log('PASS academic rich DOCX:', academicRich);
  // Legacy localStorage migration and queue > localStorage's ordinary 5 MB quota.
  const storage = await page.evaluate(async () => {
    const api = window.__siaduTest;
    localStorage.setItem(api.APP.queueKey, JSON.stringify([{ no: 'old' }]));
    await api.loadQueue(); const migrated = api.getQueue()[0].no;
    await api.setQueue(window.__combined); const size = JSON.stringify(api.getQueue()).length;
    return { migrated, size, legacyRemoved: localStorage.getItem(api.APP.queueKey) === null };
  });
  assert.equal(storage.migrated, 'old'); assert.equal(storage.legacyRemoved, true); assert.ok(storage.size > 5 * 1024 * 1024);
  await page.evaluate(async () => {
    const api = window.__siaduTest, original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => { throw new DOMException('Simulated full storage', 'QuotaExceededError'); };
    let failed = false; try { await api.setQueue([{ no: 'must not replace' }]); } catch { failed = true; } finally { IDBObjectStore.prototype.put = original; }
    if (!failed || api.getQueue().length !== 220) throw new Error('Failed storage write must retain old queue');
  });
  const reload = await context.newPage(); await reload.goto(origin);
  await reload.addScriptTag({ path: 'test-results/siadu-importer-test.js' });
  assert.equal(await reload.evaluate(async () => { await window.__siaduTest.loadQueue(); return window.__siaduTest.getQueue().length; }), 220); await reload.close();
  console.log('PASS IndexedDB migration and reload:', Math.round(storage.size / 1024 / 1024), 'MB');
  // Test malformed/missing media without a fallback that would silently drop it.
  const original = unzipSync(fs.readFileSync('test-results/qc-siadu-combined.docx'));
  const broken = { ...original }; for (const key of Object.keys(broken)) if (key.startsWith('word/media/')) delete broken[key];
  await assert.rejects(() => importBuffer(page, zipSync(broken), '__bad'), /Gambar hilang/);
  const badMode = { ...original, 'word/document.xml': strToU8(strFromU8(original['word/document.xml']).replaceAll('Option New', 'Unknown Mode')) };
  const modeResult = await importBuffer(page, zipSync(badMode), '__bad'); assert.ok(modeResult.errors.some(e => /Bentuk Soal/.test(e)));
  const externalMedia = { ...original, 'word/_rels/document.xml.rels': strToU8(strFromU8(original['word/_rels/document.xml.rels']).replace(/Target="media\//g, 'TargetMode="External" Target="https://example.invalid/')) };
  await assert.rejects(() => importBuffer(page, zipSync(externalMedia), '__bad'), /Gambar Word harus disematkan/);
  await page.evaluate(() => {
    const api = window.__siaduTest;
    api.setState({ ...api.getState(), answerMode: 'option_new' });
    let blocked = false; try { api.getAnswerMode(window.__combined[65]); } catch { blocked = true; } if (!blocked) throw new Error('Manual New must reject TKP');
    api.setState({ ...api.getState(), answerMode: 'auto' });
    const q = structuredClone(window.__combined[65]); delete q.scores.C; if (!api.validateItemMode(q).length) throw new Error('Missing score accepted');
    const rich = '<p><strong>Tebal</strong><s>Coret</s><span style="color:#ff0000">Merah</span></p><table><tbody><tr><td colspan="2">Sel</td></tr></tbody></table><img src="data:image/png;base64,abc">';
    for (const damaged of [rich.replaceAll('strong', 'span'), rich.replaceAll('<s>', '<span>').replaceAll('</s>', '</span>'), rich.replace('#ff0000', '#000000'), rich.replace('colspan="2"', 'colspan="1"'), rich.replace(/<img[^>]+>/, '')]) {
      let rejected = false; try { api.assertRichContent(rich, damaged, 'Test'); } catch { rejected = true; } if (!rejected) throw new Error('Formatting loss accepted');
    }
  });
  console.log('PASS missing media, invalid mode/points, and formatting-loss guards.');
  // Actual CKEditor; fake only the SiAdu server/Livewire model and selector layout.
  await page.evaluate(() => {
    document.querySelector('#test-root').innerHTML = '<div wire:id="form-test"><form id="form-modal"><select id="level"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><select id="answer_type"><option value="option_new">New</option><option value="option">Legacy</option></select><input id="question_type"><input id="is_carcep"><input id="orientation"><input id="video_player_mode"><textarea id="content_question"></textarea><div id="legacy-fields"><input id="correct_answer">' + ['a','b','c','d','e','f'].map(l => '<input id="score_option_' + l + '">').join('') + '</div><div id="collapseOptionNew" class="show"><div class="input-group"><input id="multiple_choice_rows"><button type="button" wire:click="refreshMcForm">Ubah</button></div><table><tbody id="options"></tbody></table></div><textarea id="content_explanation"></textarea><button type="button" class="save-btn" data-action="store">Simpan Data</button></form></div>';
    window.GM_addStyle = css => { const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el); };
    window.__writes = {}; window.__saves = 0;
    document.querySelector('.save-btn').addEventListener('click', () => window.__saves++);
  });
  await page.addScriptTag({ url: origin + '/ckeditor/ckeditor.js' });
  await page.evaluate(async () => {
    const config = { customConfig: '', versionCheck: false, height: 240, resize_enabled: false, removePlugins: 'exportpdf', toolbar: [['Bold', 'Italic', 'Strike', 'TextColor', 'Table', 'Image', 'Source']] };
    const makeEditor = id => new Promise(resolve => { const editor = CKEDITOR.replace(id, config); editor.on('instanceReady', () => resolve(editor)); });
    window.__rowsReady = Promise.resolve();
    window.__refresh = () => {
      if (document.querySelectorAll('tr.option-row').length === 5) return;
      document.querySelector('#options').innerHTML = ['A','B','C','D','E'].map((l, i) => '<tr class="option-row" id="mc_tr_' + i + '"><td><input type="text" maxlength="5"><input type="checkbox" id="mc-correct-' + i + '"><textarea id="mc-answer-' + i + '"></textarea></td></tr>').join('');
      window.__rowsReady = Promise.all([0,1,2,3,4].map(i => makeEditor('mc-answer-' + i)));
    };
    document.querySelector('[wire\\:click="refreshMcForm"]').addEventListener('click', window.__refresh);
    window.Livewire = { find: () => ({
      set: (prop, value) => { window.__writes[prop] = value; }, get: prop => window.__writes[prop],
      call: name => { if (name === 'refreshMcForm') window.__refresh(); if (name === 'changeAnswerType') {
        const legacy = document.querySelector('#answer_type').value === 'option';
        document.querySelector('#legacy-fields').style.display = legacy ? '' : 'none';
        document.querySelector('#collapseOptionNew').style.display = legacy ? 'none' : '';
      } }
    }) };
    await Promise.all(['content_question', 'content_explanation'].map(makeEditor));
    window.__refresh(); await window.__rowsReady;
    window.__siaduTest.setState({ ...window.__siaduTest.getState(), running: false, answerMode: 'auto' });
  });
  // Ensure fake select matches the actual importer level encoding.
  await page.evaluate(() => { document.querySelector('#level').innerHTML = [...new Set(window.__combined.map(q => q.level))].map(level => `<option value="${level}">${level}</option>`).join(''); });
  for (let index = 0; index < 12; index++) {
    await page.evaluate(async i => { await window.__siaduTest.fillQuestionForm(window.__academic[i]); window.__siaduTest.verifyRichForm(window.__academic[i]); }, index);
    if ([3, 5, 9].includes(index)) {
      await page.locator('#cke_content_explanation').screenshot({ path: `test-results/siadu-imported-academic-${index + 1}.png` });
    }
    filledCount++;
  }
  console.log('PASS real CKEditor: 12 academic questions, styled explanations, formulas, tables and images.');
  if (fs.existsSync('test-results/answer-only-siadu.docx')) {
    const answerOnly = await importBuffer(page, fs.readFileSync('test-results/answer-only-siadu.docx'), '__answerOnly');
    assert.deepEqual(answerOnly.errors, []); assert.equal(answerOnly.items.length, 4);
    parsedCount += answerOnly.items.length;
    for (let i = 0; i < answerOnly.items.length; i++) {
      await page.evaluate(async index => {
        const api = window.__siaduTest, q = window.__answerOnly[index];
        await api.fillQuestionForm(q); api.verifyRichForm(q);
        const html = CKEDITOR.instances.content_explanation.getData();
        if (!html.includes('Jawaban:') || /RAHASIA_|Pembahasan:|Cara cepat/.test(html)) throw new Error('Answer-only content lost or discussion leaked into editor');
      }, i);
      filledCount++;
    }
    console.log('PASS answer-only: four mixed questions filled into real CKEditor with keys and TKP scores.');
  }
  for (let start = 0; start < 220; start += 10) {
    await page.evaluate(async start => {
      for (let i = start; i < Math.min(start + 10, window.__combined.length); i++) {
        try { await window.__siaduTest.fillQuestionForm(window.__combined[i]); }
        catch (error) { throw new Error(`Question ${i + 1}: ${error.message}`); }
      }
    }, start);
    filledCount += 10;
    if (start % 40 === 0) console.log('CKEditor filled through', start + 10);
  }
  // Verify real filtering damage is caught before the save button can be clicked.
  await page.evaluate(async () => {
    const api = window.__siaduTest, q = window.__academic[3];
    await api.setQueue([q]);
    const editor = CKEDITOR.instances.content_explanation, original = editor.getData.bind(editor);
    editor.getData = (...args) => original(...args).replace(/<\/?(?:s|strike)\b[^>]*>/g, '');
    api.setState({ ...api.getState(), running: true, mode: 'autosave', index: 0, phase: 'idle', answerMode: 'auto' });
    await api.processCurrentAuto();
    if (api.getState().phase !== 'error' || window.__saves !== 0) throw new Error('Damaged formatting must stop before saving');
    editor.getData = original;
    await api.setQueue(window.__combined);
    api.createPanel();
    if (document.querySelector('#siadu-answer-mode').value !== 'auto') throw new Error('Default automatic mode missing');
  });
  // Exercise the same file-input -> Parse -> fill-only path used by the user.
  await page.locator('#siadu-file').setInputFiles('test-results/qc-siadu-combined.docx');
  await page.evaluate(async () => { await window.__siaduTest.parseFromPanel(); if (window.__siaduTest.getQueue().length !== 12) throw new Error('Panel did not load DOCX'); });
  await page.locator('#siadu-create-url').fill(origin + '/admin/detail/1/0');
  await page.locator('#siadu-fill-one').click();
  await page.waitForFunction(() => /sudah diisi tanpa simpan/.test(window.__siaduTest.getState().lastMessage));
  await page.evaluate(async () => {
    const api = window.__siaduTest;
    api.setState({ ...api.getState(), running: true });
    let timedOut = false;
    try { await api.waitAfterSave(document.querySelector('.save-btn'), 30, false); } catch (error) { timedOut = /belum terkonfirmasi/.test(error.message); }
    if (!timedOut) throw new Error('A timeout must never be counted as saved');
    const failure = document.createElement('div'); failure.className = 'alert-danger'; failure.textContent = 'Gagal menyimpan gambar'; document.body.appendChild(failure);
    let rejected = false; try { await api.waitAfterSave(null, 30, false); } catch (error) { rejected = /menolak penyimpanan/.test(error.message); } failure.remove();
    if (!rejected) throw new Error('Backend validation error was ignored');
    const success = document.createElement('div'); success.className = 'alert-success'; success.textContent = 'Data berhasil tersimpan'; document.body.appendChild(success);
    await api.waitAfterSave(null, 30, false); success.remove();
    api.setState({ ...api.getState(), running: false });
  });
  assert.equal(await page.evaluate(() => window.__saves), 0);
  assert.deepEqual(external, [], 'No remote formula/media requests');
  assert.deepEqual(pageErrors, []);
  console.log(`PASS SiAdu 2.7.1: ${parsedCount} parsed / ${filledCount} filled into real CKEditor; no server saves or external requests.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
