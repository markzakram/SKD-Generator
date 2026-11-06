import JSZip from 'jszip';
import { renderSiaduFormula } from './math-render';

const children = node => Array.from(node?.children || []);
const child = (node, name) => children(node).find(n => n.localName === name);
const descendants = (node, name) => Array.from(node?.getElementsByTagNameNS('*', name) || []);
const attr = (node, name) => Array.from(node?.attributes || []).find(a => a.localName === name)?.value || '';
const on = node => !!node && !/^(0|false|off)$/i.test(attr(node, 'val'));
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const xml = text => { const doc = new DOMParser().parseFromString(text, 'application/xml'); if (doc.querySelector('parsererror')) throw new Error('Struktur XML Word tidak valid.'); return doc; };
const plain = node => children(node).map(n => n.localName === 't' ? n.textContent : n.localName === 'tab' ? '\t' : ['br', 'cr'].includes(n.localName) ? '\n' : plain(n)).join('');

function runStyle(props, inherited = {}) {
  const result = { ...inherited };
  for (const [tag, key] of [['b', 'bold'], ['i', 'italic'], ['strike', 'strike'], ['dstrike', 'strike']]) {
    const node = child(props, tag); if (node) result[key] = on(node);
  }
  const color = attr(child(props, 'color'), 'val');
  if (/^[0-9a-f]{6}$/i.test(color)) result.color = '#' + color;
  if (color === 'auto') result.color = '#000000';
  return result;
}

export async function readSiaduDocx(buffer, { ommlToLatex, mapLevel, parseScores, progress = () => {} }) {
  if (buffer.byteLength > 50 * 1024 * 1024) throw new Error('DOCX melebihi 50 MB.');
  const zip = await JSZip.loadAsync(buffer);
  let inflated = 0;
  for (const entry of Object.values(zip.files)) {
    inflated += entry._data?.uncompressedSize || 0;
    if (inflated > 200 * 1024 * 1024) throw new Error('Isi DOCX melebihi 200 MB.');
  }
  const readXml = async (path, required = false) => {
    const file = zip.file(path); if (!file) { if (required) throw new Error('Bagian Word tidak ditemukan: ' + path); return null; }
    return xml(await file.async('string'));
  };
  const documentXml = await readXml('word/document.xml', true);
  const stylesXml = await readXml('word/styles.xml');
  const styles = new Map(descendants(stylesXml, 'style').map(n => [attr(n, 'styleId'), n]));
  const defaults = runStyle(descendants(stylesXml, 'rPrDefault')[0]?.firstElementChild);
  const styleFor = (id, seen = new Set()) => {
    if (!id || seen.has(id)) return defaults;
    seen.add(id); const node = styles.get(id);
    return runStyle(child(node, 'rPr'), styleFor(attr(child(node, 'basedOn'), 'val'), seen));
  };
  const relXml = await readXml('word/_rels/document.xml.rels');
  const rels = new Map(descendants(relXml, 'Relationship').map(n => [attr(n, 'Id'), n]));
  const mediaCache = new Map();
  async function imageHtml(node) {
    const blip = descendants(node, 'blip')[0] || descendants(node, 'imagedata')[0];
    if (!blip) throw new Error('Gambar Word tidak memiliki media tersemat yang dapat dibaca.');
    const id = attr(blip, 'embed') || attr(blip, 'id');
    const rel = rels.get(id);
    if (!rel || attr(rel, 'TargetMode') === 'External') throw new Error('Gambar Word harus disematkan, bukan tautan eksternal.');
    const target = attr(rel, 'Target').replaceAll('\\', '/');
    const segments = (target.startsWith('/') ? target.slice(1) : 'word/' + target).split('/'); const resolved = [];
    for (const part of segments) { if (part === '..') resolved.pop(); else if (part && part !== '.') resolved.push(part); }
    const path = resolved.join('/');
    if (!path.startsWith('word/media/')) throw new Error('Lokasi gambar Word tidak didukung: ' + path);
    let data = mediaCache.get(path);
    if (!data) {
      const file = zip.file(path); if (!file) throw new Error('Gambar hilang: ' + path);
      const bytes = await file.async('uint8array');
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('Satu gambar melebihi 10 MB: ' + path);
      const signature = Array.from(bytes.slice(0, 12));
      const mime = signature.slice(0, 8).join() === '137,80,78,71,13,10,26,10' ? 'image/png' : signature[0] === 255 && signature[1] === 216 && signature[2] === 255 ? 'image/jpeg' : /^GIF8[79]a/.test(String.fromCharCode(...signature)) ? 'image/gif' : String.fromCharCode(...signature).startsWith('RIFF') && String.fromCharCode(...signature.slice(8)) === 'WEBP' ? 'image/webp' : '';
      if (!mime) throw new Error('Format gambar tidak didukung (gunakan PNG/JPEG/GIF/WebP): ' + path);
      data = 'data:' + mime + ';base64,' + await file.async('base64'); mediaCache.set(path, data);
    }
    const extent = descendants(node, 'extent')[0], props = descendants(node, 'docPr')[0];
    const rawWidth = Number(attr(extent, 'cx')) / 9525 || 500, rawHeight = Number(attr(extent, 'cy')) / 9525 || 300;
    const scale = Math.min(1, 720 / rawWidth), width = Math.max(1, Math.round(rawWidth * scale)), height = Math.max(1, Math.round(rawHeight * scale));
    return `<img src="${data}" alt="${escape(attr(props, 'descr') || attr(props, 'name') || 'Gambar soal')}" width="${width}" height="${height}" style="max-width:100%;height:auto" />`;
  }
  const styledText = async (text, style) => {
    let html = '', at = 0;
    for (const match of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
      html += escape(text.slice(at, match.index)); html += await renderSiaduFormula(match[1], style); at = match.index + match[0].length;
    }
    html += escape(text.slice(at));
    if (style.strike) html = `<s>${html}</s>`;
    if (style.italic) html = `<em>${html}</em>`;
    if (style.bold) html = `<strong>${html}</strong>`;
    if (style.color) html = `<span style="color:${style.color}">${html}</span>`;
    return html;
  };
  async function inline(node, inherited) {
    const name = node.localName;
    if (name === 'r') {
      const props = child(node, 'rPr'), id = attr(child(props, 'rStyle'), 'val');
      const style = runStyle(props, id ? { ...inherited, ...styleFor(id) } : inherited);
      let html = '', text = '';
      for (const n of children(node)) {
        if (n.localName === 't') { text += n.textContent; continue; }
        if (text) { html += await styledText(text, style); text = ''; }
        if (n.localName === 'tab') html += ' ';
        else if (['br', 'cr'].includes(n.localName)) html += '<br />';
        else if (['drawing', 'pict'].includes(n.localName)) html += await imageHtml(n);
        else if (!['rPr', 'lastRenderedPageBreak'].includes(n.localName)) html += await inline(n, style);
      }
      return html + (text ? await styledText(text, style) : '');
    }
    if (name === 'oMath') return renderSiaduFormula(ommlToLatex(node), inherited);
    if (['drawing', 'pict'].includes(name)) return imageHtml(node);
    if (name === 'del') return ''; // Match Word's accepted/revised view, not deleted revisions.
    return (await Promise.all(children(node).filter(n => n.localName !== 'pPr').map(n => inline(n, inherited)))).join('');
  }
  async function paragraph(node) {
    const props = child(node, 'pPr'), style = styleFor(attr(child(props, 'pStyle'), 'val'));
    const align = attr(child(props, 'jc'), 'val');
    const alignment = ['center', 'right', 'left', 'both'].includes(align) ? `text-align:${align === 'both' ? 'justify' : align};` : '';
    const html = await inline(node, style);
    return { plain: plain(node).trim(), html: `<p style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;margin:0 0 6pt;${alignment}">${html}</p>` };
  }
  async function table(node) {
    const rows = [], activeMerges = new Map();
    for (const tr of children(node).filter(n => n.localName === 'tr')) {
      const row = [], header = on(child(child(tr, 'trPr'), 'tblHeader')); let col = 0;
      for (const tc of children(tr).filter(n => n.localName === 'tc')) {
        const props = child(tc, 'tcPr'), span = Math.max(1, Math.min(100, Number(attr(child(props, 'gridSpan'), 'val')) || 1));
        const merge = child(props, 'vMerge');
        if (merge && attr(merge, 'val') !== 'restart') {
          const previous = activeMerges.get(col);
          if (!previous || previous.span !== span) throw new Error('Gabungan sel tabel Word tidak valid.');
          previous.rowspan++; col += span; continue;
        }
        const blocks = await bodyBlocks(tc);
        const cell = { html: blocks.map(b => b.html).join(''), plain: blocks.map(b => b.plain).join(' '), span, rowspan: 1, header };
        for (let j = col; j < col + span; j++) activeMerges.delete(j);
        if (merge) activeMerges.set(col, cell);
        row.push(cell); col += span;
      }
      rows.push(row);
    }
    return { plain: rows.map(r => r.map(c => c.plain).join('\t')).join('\n'), html: '<table style="border-collapse:collapse;width:100%" border="1" cellpadding="6"><tbody>' + rows.map(r => '<tr>' + r.map(c => {
      const tag = c.header ? 'th' : 'td';
      return `<${tag} colspan="${c.span}" rowspan="${c.rowspan}" style="border:1px solid #b8c2cc;padding:6px;vertical-align:top">${c.html}</${tag}>`;
    }).join('') + '</tr>').join('') + '</tbody></table>' };
  }
  async function bodyBlocks(node) {
    const result = [];
    for (const n of children(node)) {
      if (n.localName === 'p') result.push(await paragraph(n));
      else if (n.localName === 'tbl') result.push(await table(n));
      else if (['sdt', 'sdtContent', 'ins'].includes(n.localName)) result.push(...await bodyBlocks(n));
      else if (n.localName === 'altChunk') throw new Error('Word berisi konten tertaut yang belum didukung. Simpan ulang sebagai DOCX biasa.');
    }
    return result;
  }
  const blocks = [], body = descendants(documentXml, 'body')[0];
  if (!body) throw new Error('Isi dokumen Word kosong.');
  const nodes = children(body);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.localName === 'p') blocks.push(await paragraph(node));
    else if (node.localName === 'tbl') blocks.push(await table(node));
    else if (node.localName !== 'sectPr') blocks.push(...await bodyBlocks({ children: [node] }));
    if (i % 100 === 0) { progress(Math.round(i / nodes.length * 100)); await new Promise(resolve => setTimeout(resolve, 0)); }
  }
  const starts = blocks.flatMap((b, i) => /^SOAL\s+\d+$/i.test(b.plain) ? [i] : []);
  if (!starts.length) throw new Error('Tidak ditemukan paragraf "Soal 1", "Soal 2", dan seterusnya.');
  // Only explicitly marked exports may omit the discussion. Keep detecting
  // missing/truncated explanations in ordinary full-format documents.
  const answerOnly = blocks.slice(0, starts[0]).some(b => /^Isi dokumen:\s*Soal \+ jawaban tanpa pembahasan$/i.test(b.plain));
  const items = starts.map((start, i) => {
    const chunk = blocks.slice(start, starts[i + 1] ?? blocks.length);
    const no = chunk[0].plain.match(/\d+/)[0];
    const answerIndex = chunk.findIndex(b => /^Jawaban\s*:\s*[A-F]\b/i.test(b.plain));
    const levelIndex = chunk.findIndex(b => /^Tingkat\s+Kesulitan\s*:/i.test(b.plain));
    if (answerIndex < 0 || levelIndex < 0 || levelIndex >= answerIndex) throw new Error(`Soal ${no}: penanda Jawaban/Tingkat Kesulitan tidak lengkap atau urutannya salah.`);
    const metadata = Object.fromEntries(chunk.slice(1, levelIndex + 1).map(b => { const m = /^([^:]+):\s*(.*)$/.exec(b.plain); return m ? [m[1].trim().toLowerCase(), m[2]] : ['', '']; }));
    const content = chunk.slice(levelIndex + 1, answerIndex), explanation = chunk.slice(answerIndex).filter(b => !/^Sumber\s*:/i.test(b.plain));
    const stem = [], options = {}, full = []; let letter = '';
    for (const block of content) {
      const match = /^([A-F])\.\s*/.exec(block.plain);
      full.push(block);
      if (match) {
        letter = match[1];
        if (options[letter]) throw new Error(`Soal ${no}: label opsi ${letter} ganda.`);
        options[letter] = [{ ...block, plain: block.plain.slice(match[0].length), html: removeTextPrefix(block.html, match[0].length) }];
      } else if (letter) options[letter].push(block); else stem.push(block);
    }
    const explanationText = explanation.map(b => b.plain).join('\n'), scores = parseScores(explanationText);
    const answerMode = /option\s*new/i.test(metadata['bentuk soal'] || '') ? 'option_new' : /option.*legacy/i.test(metadata['bentuk soal'] || '') ? 'option' : '';
    const correctAnswer = chunk[answerIndex].plain.match(/^Jawaban\s*:\s*([A-F])/i)[1].toUpperCase();
    const optionLettersFound = Object.keys(options), errors = [];
    const level = mapLevel(metadata['tingkat kesulitan']);
    if (!level) errors.push('Tingkat kesulitan tidak dikenal');
    if (!answerMode) errors.push('Bentuk Soal tidak dikenal; ekspor ulang memakai Word SiAdu terbaru');
    if (optionLettersFound.join('') !== 'ABCDE' && optionLettersFound.join('') !== 'ABCDEF') errors.push('Pilihan harus berurutan A–E (atau A–F)');
    if (!options[correctAnswer]) errors.push('Kunci tidak memiliki pilihan jawaban');
    if (answerOnly) {
      if (explanation.some(b => b.plain.trim() && !/^(?:Jawaban\s*:\s*[A-F]|Nilai per opsi:|Opsi [A-F] \(\d+ poin\))$/i.test(b.plain))) errors.push('Dokumen tanpa pembahasan berisi teks tambahan setelah kunci');
    } else if (!/^Pembahasan\s*:/im.test(explanationText)) errors.push('Penanda Pembahasan tidak ditemukan');
    const combine = list => list.map(b => b.html).join('');
    const questionHtml = combine(stem), optionHtmls = Object.fromEntries(Object.entries(options).map(([key, value]) => [key, combine(value)]));
    if (!hasContent(questionHtml)) errors.push('Batang soal kosong');
    for (const key of optionLettersFound) if (!hasContent(optionHtmls[key])) errors.push('Pilihan ' + key + ' kosong');
    return { no, level, correctAnswer, answerMode, metadata, richDocx: true,
      questionStemText: stem.map(b => b.plain).join('\n').trim(), questionText: full.map(b => b.plain).join('\n').trim(),
      explanationText, questionHtml, questionFullHtml: combine(full), explanationHtml: combine(explanation),
      optionTexts: Object.fromEntries(Object.entries(options).map(([key, value]) => [key, value.map(b => b.plain).join('\n').trim()])),
      optionHtmls, optionLettersFound, optionCount: optionLettersFound.length, scores, errors };
  });
  progress(100);
  return { items, errors: items.flatMap(q => q.errors.map(e => `Soal ${q.no}: ${e}`)) };
}

function removeTextPrefix(html, length) {
  const div = document.createElement('div'); div.innerHTML = html;
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  while (length > 0) { const node = walker.nextNode(); if (!node) throw new Error('Label pilihan Word tidak dapat dibaca.'); const count = Math.min(length, node.textContent.length); node.textContent = node.textContent.slice(count); length -= count; }
  return div.innerHTML;
}
function hasContent(html) { const div = document.createElement('div'); div.innerHTML = html; return !!(div.textContent.trim() || div.querySelector('img,table')); }
