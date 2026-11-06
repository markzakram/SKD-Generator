// Injected into the original importer scope by build-siadu-importer.mjs.
// Named declarations replace their v2.6.1 counterparts; other helpers remain intact.
let queueCache = [];
let queueDbPromise;
let parsingQueue = false;
let processingQuestion = false;
let saveMessagesBeforeClick = new Map();

function queueDatabase() {
  if (!queueDbPromise) queueDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('siadu-auto-input-rich', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('queue');
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(new Error('Antrean gambar tidak dapat disimpan: ' + request.error?.message));
    request.onblocked = () => reject(new Error('Tutup tab SiAdu lain agar penyimpanan antrean dapat diperbarui.'));
  });
  return queueDbPromise;
}
async function loadQueue() {
  const db = await queueDatabase();
  const stored = await new Promise((resolve, reject) => { const req = db.transaction('queue').objectStore('queue').get('active'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  if (stored !== undefined) queueCache = stored;
  else {
    const legacy = loadJSON(APP.queueKey, []);
    await setQueue(legacy);
    localStorage.removeItem(APP.queueKey);
  }
}
function getQueue() { return queueCache; }
async function setQueue(queue) {
  const next = queue || [], db = await queueDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite'); tx.objectStore('queue').put(next, 'active');
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(new Error('Antrean belum tersimpan. Ruang penyimpanan browser mungkin penuh. Antrean sebelumnya dipertahankan.'));
  });
  queueCache = next;
}
async function resetAll() {
  if (processingQuestion || parsingQueue) throw new Error('Tunggu proses mengisi/membaca selesai sebelum Reset.');
  await setQueue([]); localStorage.removeItem(APP.queueKey); localStorage.removeItem(APP.stateKey); updatePanel();
}
function selectedAnswerMode(value) { return ['auto', 'option', 'option_new'].includes(value) ? value : 'auto'; }
function detectedAnswerMode(item) {
  if (item.answerMode === 'option' || item.answerMode === 'option_new') return item.answerMode;
  const scores = Object.values(item.scores || {});
  return scores.some(score => Number(score) > 0 && Number(score) < 5) ? 'option' : 'option_new';
}
function getAnswerMode(item) {
  const mode = selectedAnswerMode(getState().answerMode);
  if (!item) return mode;
  const detected = detectedAnswerMode(item);
  if (detected === 'option' && mode === 'option_new') throw new Error(`Soal ${item.no}: memiliki poin per pilihan. Gunakan Otomatis atau Option Legacy agar poin tidak hilang.`);
  return mode === 'auto' ? detected : mode;
}
function validateItemMode(item) {
  const errors = [], letters = optionLettersForItem(item), scores = letters.map(letter => item.scores?.[letter]);
  if (detectedAnswerMode(item) === 'option') {
    if (letters.join('') !== 'ABCDE' || scores.some(score => !Number.isInteger(score) || score < 1 || score > 5) || new Set(scores).size !== 5) errors.push('TKP membutuhkan poin 1–5, masing-masing satu kali, pada opsi A–E');
    if (item.scores?.[item.correctAnswer] !== 5) errors.push('Kunci TKP harus menunjuk opsi bernilai 5');
  } else if (scores.some(score => Number(score) > 0 && Number(score) < 5)) errors.push('Bentuk Soal Option New bertentangan dengan poin bertingkat');
  return errors;
}
function editorContentFilled(html) { return !!stripHtml(html || '') || /<(?:img|table)\b/i.test(html || '') || hasMathTypeHtml(html); }
function isVisible(el) {
  if (!el || !el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}
function optionLettersForItem(item) {
  if (item?.richDocx) return LETTERS.filter(letter => editorContentFilled(item.optionHtmls?.[letter]));
  const fromTexts = LETTERS.filter(letter => item?.optionTexts?.[letter]?.trim());
  return fromTexts.length ? fromTexts : (item?.optionLettersFound || []).filter(letter => LETTERS.includes(letter));
}

// Compare semantic formatting, independent of CKEditor's equivalent tag spelling,
// whitespace, style order and <tbody> normalization. Images must remain embedded.
function richSignature(html) {
  const root = document.createElement('div'); root.innerHTML = html || '';
  const text = [], images = [], tables = [];
  function visit(node, style) {
    if (node.nodeType === 3) {
      for (const character of node.textContent.replace(/\s/g, '')) text.push([character, style.bold, style.strike, style.italic, style.color]);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase(), next = { ...style };
    if (tag === 'strong' || tag === 'b' || /^(bold|[7-9]00)$/.test(node.style.fontWeight)) next.bold = true;
    if (tag === 's' || tag === 'strike' || /line-through/.test(node.style.textDecoration)) next.strike = true;
    if (tag === 'em' || tag === 'i' || node.style.fontStyle === 'italic') next.italic = true;
    if (node.style.color) next.color = node.style.color;
    if (tag === 'img') images.push(node.getAttribute('src'));
    if (tag === 'table') tables.push(Array.from(node.rows).map(row => Array.from(row.cells).map(cell => [cell.tagName, cell.colSpan, cell.rowSpan])));
    for (const c of node.childNodes) visit(c, next);
  }
  visit(root, { bold: false, strike: false, italic: false, color: 'rgb(0, 0, 0)' });
  return { text: JSON.stringify(text), images: JSON.stringify(images), tables: JSON.stringify(tables) };
}
function assertRichContent(expected, actual, label) {
  const a = richSignature(expected), b = richSignature(actual);
  if (a.images !== b.images) throw new Error(`${label}: gambar/rumus berubah atau hilang. Penyimpanan dihentikan.`);
  if (a.tables !== b.tables) throw new Error(`${label}: struktur tabel berubah atau hilang. Penyimpanan dihentikan.`);
  if (a.text !== b.text) throw new Error(`${label}: teks, tebal, warna, atau coretan berubah. Penyimpanan dihentikan.`);
}
async function setRichEditorHtml(id, html, model = id) {
  await waitForEditorReady(id);
  const editor = getCkeditorInstance(id);
  if (!editor) throw new Error('CKEditor belum tersedia: ' + id);
  if (editor.status !== 'ready') await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('CKEditor belum siap: ' + id)), 10000);
    editor.once('instanceReady', () => { clearTimeout(timeout); resolve(); });
  });
  allowRichContent(editor);
  // Extend existing filters as well as config; changing config alone is too late.
  const rules = 'p{font-family,font-size,line-height,margin,text-align};strong;b;em;i;s;strike;br;span{color,font-weight,font-style,text-decoration};img[!src,alt,title,width,height,class]{max-width,height,vertical-align};table[border,cellpadding,cellspacing]{border-collapse,width};thead;tbody;tfoot;tr;td th[colspan,rowspan]{border,padding,vertical-align}';
  editor.filter?.allow?.(rules, 'siadu-import', true); editor.activeFilter?.allow?.(rules, 'siadu-import', true);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Editor tidak selesai menerima isi: ' + id)), 10000);
    editor.setData(html, { callback() { clearTimeout(timeout); resolve(); } });
  });
  editor.updateElement(); editor.fire('change'); editor.fire('blur');
  const stored = editor.getData(); assertRichContent(html, stored, id);
  if (!livewireFindSet(model, stored, true)) throw new Error('Model SiAdu tidak dapat diisi: ' + model);
  const modelData = livewireGet(model);
  if (typeof modelData !== 'string') throw new Error('Model SiAdu tidak dapat diverifikasi: ' + model);
  assertRichContent(html, modelData, model);
}
function verifyRichForm(item) {
  const mode = getAnswerMode(item), expected = [['content_question', mode === 'option' ? item.questionFullHtml : item.questionHtml], ['content_explanation', item.explanationHtml]];
  if (mode === 'option_new') optionLettersForItem(item).forEach((letter, i) => expected.push([`mc-answer-${i}`, item.optionHtmls[letter], `multiple_choices.${i}`]));
  for (const [id, html, model = id] of expected) {
    assertRichContent(html, getEditorData(id), id);
    assertRichContent(html, livewireGet(model), 'Model ' + model);
  }
  const check = mode === 'option' ? verifyFilledFormLegacy(item) : verifyFilledFormOptionNew(item);
  if (!check.ok) throw new Error(check.message);
  if (mode === 'option') {
    const mismatched = checkOptionScores(item);
    for (const letter of relevantLetters(item)) if (String(livewireGet('table.score_option_' + letter.toLowerCase())) !== String(item.scores[letter])) mismatched.push(letter + ' (model)');
    if (mismatched.length) throw new Error('Poin belum sesuai: ' + mismatched.join(', '));
  } else {
    for (const [i, letter] of optionLettersForItem(item).entries()) {
      if (livewireGet(`multiple_labels.${i}`) !== letter || !!livewireGet(`multiple_correct_answers.${i}`) !== (letter === item.correctAnswer)) throw new Error('Label/kunci opsi ' + letter + ' belum tersinkron');
    }
  }
  if (livewireGet('table.answer_type') !== mode) throw new Error('Mode jawaban belum tersinkron');
  return true;
}
async function flushRichForm(item) {
  const ids = ['content_question', 'content_explanation', ...(getAnswerMode(item) === 'option_new' ? optionLettersForItem(item).map((_, i) => `mc-answer-${i}`) : [])];
  for (const id of ids) {
    const editor = getCkeditorInstance(id); if (!editor) throw new Error('Editor hilang sebelum simpan: ' + id);
    editor.updateElement(); editor.fire('change'); editor.fire('blur');
    const model = id.startsWith('mc-answer-') ? 'multiple_choices.' + id.slice(10) : id;
    if (!livewireFindSet(model, editor.getData(), true)) throw new Error('Sinkronisasi gagal: ' + id);
  }
  await waitForLivewireIdle(7000); verifyRichForm(item);
}
async function fillRichQuestion(item, mode) {
  if (mode === 'option') await chooseAnswerTypeOptionLegacy(); else await chooseAnswerTypeOptionNew(item);
  await setRichEditorHtml('content_question', mode === 'option' ? item.questionFullHtml : item.questionHtml);
  await setRichEditorHtml('content_explanation', item.explanationHtml);
  if (mode === 'option') {
    await setFieldValue('#correct_answer', item.correctAnswer, 'table.correct_answer');
    await fillOptionScores(item);
    if ((await ensureOptionScores(item)).length) throw new Error('Poin TKP belum terisi lengkap.');
  } else {
    await fillOptionNewRows(item);
    // Some SiAdu forms retain hidden Legacy fields after switching mode.
    await fillLegacyAnswerAndScoresIfPresent(item);
  }
  await flushRichForm(item);
}
async function fillQuestionForm(item) {
  const errors = [...(item.errors || []), ...validateItemMode(item)];
  if (errors.length) throw new Error(`Soal ${item.no}: ${errors.join('; ')}`);
  const mode = getAnswerMode(item);
  await waitForFormReady();
  await setFieldValue('#level', item.level, 'table.level');
  await setFieldValue('#question_type', 'text', 'table.question_type');
  await setFieldValue('#is_carcep', '0', 'table.is_carcep');
  await setFieldValue('#orientation', 'portrait', 'table.orientation');
  await setFieldValue('#video_player_mode', 'youtube', 'table.video_player_mode');
  if (item.richDocx) await fillRichQuestion(item, mode);
  else if (mode === 'option') await fillFormOptionLegacy(item);
  else await fillFormOptionNew(item);
  return true;
}
function lockQueueControls(locked) {
  for (const id of ['siadu-parse', 'siadu-start', 'siadu-fill-one', 'siadu-reset', 'siadu-file', 'siadu-answer-mode']) {
    const el = document.getElementById(id); if (el) el.disabled = locked;
  }
}
function saveFeedback() {
  const visible = selector => Array.from(document.querySelectorAll(selector)).filter(isVisible);
  const failures = visible('.alert-danger, .alert-error, .invalid-feedback, .text-danger, .swal2-popup.swal2-show').filter(el => {
    const text = compact(el.textContent || '');
    return text && (el.matches('.alert-danger,.alert-error,.invalid-feedback') || /gagal|failed|error|tidak berhasil|tidak valid|wajib diisi|terlalu besar|too large/i.test(text));
  });
  if (failures.length) return { error: compact(failures[0].textContent).slice(0, 400) };
  const success = visible('.alert-success, .swal2-popup.swal2-show, .toast, .notify, .notification').find(el => /berhasil|success|sukses|tersimpan/i.test(el.textContent || '') && saveMessagesBeforeClick.get(el) !== el.textContent);
  return { success: !!success };
}
async function waitAfterSave(button, timeoutMs = 30000, autoConfirm = true) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const feedback = saveFeedback();
    if (feedback.error) throw new Error('SiAdu menolak penyimpanan: ' + feedback.error);
    if (feedback.success) {
      const state = getState(); state.saveConfirmed = true; setState(state);
      if (autoConfirm) { const confirm = findSwalConfirmButton(); if (confirm) confirm.click(); }
      return true;
    }
    if (!getState().running) throw new Error('Proses dijeda. Periksa status simpan nomor ini sebelum melanjutkan.');
    if (autoConfirm) {
      const btn = findSwalConfirmButton();
      if (btn) btn.click();
      else await tryClickValidationModalSimpan();
    }
    await sleep(250);
  }
  throw new Error('Status simpan belum terkonfirmasi. Periksa nomor ini di SiAdu, lalu tentukan urutan mulai; antrean tidak dilewati otomatis.');
}
async function parseFromPanel() {
  if (parsingQueue || processingQuestion || getState().running) throw new Error('Jeda dan tunggu proses selesai sebelum membaca file baru.');
  parsingQueue = true; lockQueueControls(true);
  try {
    const panel = document.querySelector('#siadu-auto-input-panel');
    const file = panel.querySelector('#siadu-file').files[0], pasted = panel.querySelector('#siadu-paste').value.trim();
    let parsed;
    if (file && /\.docx$/i.test(file.name)) parsed = await readSiaduDocx(await readFileAsArrayBuffer(file), { ommlToLatex, mapLevel, parseScores, progress: percent => {
      const status = panel.querySelector('#siadu-status'); if (status) status.textContent = `Membaca Word, gambar, dan rumus: ${percent}%`;
    } });
    else if (file && /\.(xlsx|xls)$/i.test(file.name)) parsed = parseQuestionsFromExcel(await readFileAsArrayBuffer(file));
    else { const text = file ? await readUploadedFile(file) : pasted; if (!text) throw new Error('Pilih berkas atau tempel teks soal terlebih dahulu.'); parsed = parseQuestions(text); }
    if (parsed.errors.length || !parsed.items.length) throw new Error(parsed.errors.slice(0, 8).join('\n') || 'Tidak ada soal terbaca.');
    for (const item of parsed.items) { item.answerMode = detectedAnswerMode(item); item.errors = [...new Set([...(item.errors || []), ...validateItemMode(item)])]; }
    await setQueue(parsed.items);
    const createUrl = panel.querySelector('#siadu-create-url').value.trim() || detectCreateUrl();
    if (createUrl) localStorage.setItem(APP.createUrlKey, createUrl);
    const state = getState(); Object.assign(state, { lastMessage: `Terbaca ${parsed.items.length} soal. Periksa mode, format, dan poin melalui Isi 1 Soal Tanpa Simpan.`, phase: 'idle', index: 0, running: false, answerMode: selectedAnswerMode(panel.querySelector('#siadu-answer-mode').value) });
    setState(state); panel.querySelector('#siadu-start-index').value = '1';
  } catch (error) {
    const state = getState(); Object.assign(state, { running: false, phase: 'error', lastMessage: 'File baru belum dimuat. ' + error.message }); setState(state); throw error;
  } finally { parsingQueue = false; lockQueueControls(false); updatePanel(); }
}
function renderPreview(queue) {
  if (!queue?.length) return '<div class="siadu-muted">Belum ada data soal.</div>';
  const legacy = queue.filter(q => detectedAnswerMode(q) === 'option').length, invalid = queue.filter(q => q.errors?.length).length;
  return `<div class="siadu-muted">${queue.length} soal · TWK/TIU: ${queue.length - legacy} · TKP: ${legacy} · Bermasalah: ${invalid}. Preview 15 soal pertama; mode mengikuti setiap nomor.</div><table class="siadu-table"><thead><tr><th>No</th><th>Mode</th><th>Kunci / poin</th><th>Isi</th><th>Status</th></tr></thead><tbody>` + queue.slice(0, 15).map(q => {
    const html = (q.questionFullHtml || '') + (q.explanationHtml || '');
    return `<tr><td>${escapeHtml(q.no)}</td><td>${detectedAnswerMode(q) === 'option' ? 'TKP / Legacy' : 'TWK–TIU / New'}</td><td>${escapeHtml(q.correctAnswer)}<br>${escapeHtml(Object.entries(q.scores || {}).map(([l, p]) => l + ':' + p).join(' '))}</td><td>${(html.match(/<img\b/g) || []).length} gambar/rumus<br>${(html.match(/<table\b/g) || []).length} tabel</td><td>${q.errors?.length ? '<span class="siadu-error">' + q.errors.map(escapeHtml).join('<br>') + '</span>' : '<span class="siadu-ok">Siap</span>'}</td></tr>`;
  }).join('') + '</tbody></table>';
}
async function init() {
  try {
    await loadQueue();
    const state = getState();
    if (state.importerVersion !== '2.7.1') {
      Object.assign(state, { importerVersion: '2.7.1', running: false, phase: 'idle', answerMode: 'auto', lastMessage: 'Importir 2.7.1 siap. Pilih DOCX gabungan, lalu Parse File.' });
      saveJSON(APP.stateKey, state);
    }
    createPanel();
    if (state.running) setTimeout(processCurrentAuto, 900);
  } catch (error) { alert('SiAdu Auto Input: ' + error.message); console.error(error); }
}
