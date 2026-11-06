import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { siaduDeliveryDocuments, siaduWordBlob, siaduStem, siaduText, siaduMapping } from '../lib/siadu';
import { documentExplanation } from '../lib/explanation';
import { richRuns } from '../lib/richtext';
import { diagramResult, isDiagramBlock } from '../lib/diagram';
import { parseExplanation } from '../lib/explanation';
import type { Raster } from '../lib/export';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import type { Question, Workspace } from '../lib/types';
import { boldAnswerLabels } from '../lib/pembahasan';
import { BANK } from '../lib/bank';
import { LOCAL_RECIPES, renderLocal } from '../lib/local';

// Pembahasan TWK/TKP di Word SiAdu (QC akademik #2), dari paragraf sesudah "Pembahasan:" sampai soal berikutnya:
//   TWK  paragraf yang ditutup "Opsi yang paling tepat adalah X", lalu "Alasan opsi salah:" dengan tepat empat opsi nonkunci ("A. …", huruf kunci tidak diulang), lalu
//        "Cara cepat: …" bila ada tip; tanpa teks tebal di dalam pembahasan (Nynda dan Dhea sama-sama hanya menebalkan judul dan label jawaban).
//   TKP  label "Konsep yang digunakan:", "Kata kunci:" (bila ada), "Opsi X (5 poin) paling tepat", "Pembahasan opsi lain:", empat opsi nonkunci "A (3 poin) …"
//        dengan tepat satu label poin yang sama dengan skornya, lalu "Cara cepat:" — berurutan; label tebal, isi biasa; ejaan "poin" huruf kecil.
function caseFormat(q: Question, nodes: Element[]) {
  const L = String.fromCharCode(65 + q.answer), others = q.options.map((_, i) => i).filter((i) => i !== q.answer);
  const texts = nodes.map((n) => n.textContent ?? ''), runs = (n: Element) => Array.from(n.getElementsByTagName('w:r'));
  const boldText = (n: Element) => runs(n).filter((r) => r.getElementsByTagName('w:b').length).map((r) => r.textContent ?? '').join('');
  if (q.subtest === 'TWK') {
    const at = texts.indexOf('Alasan opsi salah:');
    assert.ok(at > 0 && texts[at - 1].includes('Opsi yang paling tepat adalah ' + L), q.id + ': paragraf TWK ditutup "Opsi yang paling tepat adalah ' + L + '" sebelum "Alasan opsi salah:"');
    const items = texts.slice(at + 1).filter((t) => /^[A-E]\. /.test(t));
    assert.deepEqual(items.map((t) => t[0]), others.map((i) => String.fromCharCode(65 + i)), q.id + ': alasan TWK tepat empat opsi nonkunci');
    if (q.tip?.trim()) assert.ok(texts[texts.length - 1].startsWith('Cara cepat: '), q.id + ': "Cara cepat:" sesudah alasan opsi');
    assert.ok(!texts.some((t) => /Konsep yang digunakan:|Fakta penentu:|Pilihan terbaik:/.test(t)), q.id + ': tanpa pecahan "Konsep yang digunakan / Fakta penentu / Pilihan terbaik"');
    assert.equal(nodes.map(boldText).join(''), '', q.id + ': isi pembahasan TWK tanpa teks tebal');
    return;
  }
  const end = texts.indexOf('Nilai per opsi:'), body = texts.slice(0, end < 0 ? undefined : end);
  const find = (pattern: RegExp) => body.findIndex((t) => pattern.test(t));
  const order = [find(/^Konsep yang digunakan: /), find(new RegExp('^Opsi ' + L + ' \\(5 poin\\) paling tepat')), find(/^Pembahasan opsi lain:$/)];
  assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), q.id + ': urutan label TKP Konsep → Opsi kunci (5 poin) → Pembahasan opsi lain');
  const items = body.slice(order[2] + 1).filter((t) => /^[A-E] \(\d poin\) /.test(t));
  assert.deepEqual(items.map((t) => t.slice(0, t.indexOf(')') + 1)), others.map((i) => String.fromCharCode(65 + i) + ' (' + q.options[i].score + ' poin)'), q.id + ': empat opsi nonkunci TKP dengan poinnya');
  assert.ok(body.every((t) => (t.match(/\(\d poin\)/g) ?? []).length <= 1 && !/Poin\b/.test(t)), q.id + ': satu label poin per baris dan ejaan "poin" seragam');
  if (q.tip?.trim()) assert.ok(body[body.length - 1].startsWith('Cara cepat: ') && find(/^Cara cepat: /) > order[2] + 4, q.id + ': "Cara cepat:" sesudah keempat opsi');
  for (const label of ['Konsep yang digunakan:', 'Pembahasan opsi lain:', ...(q.tip?.trim() ? ['Cara cepat:'] : [])]) {
    const node = nodes[texts.findIndex((t) => t.startsWith(label))];
    assert.equal(boldText(node).trim(), label, q.id + ': label "' + label + '" tebal, isinya biasa');
  }
  assert.equal(boldText(nodes[order[1]]), '', q.id + ': kalimat "Opsi ' + L + ' (5 poin) …" tidak tebal');
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync('test-results/academic-fixture.json', 'utf8')) as Workspace;
  const before = JSON.stringify(fixture);
  // Real line-break edge case: whitespace in prose stems only. Do not flatten options or explanation.
  const questions = fixture.result.packages[0].questions.map(q => q.subtest === 'TIU' ? q : { ...q, binding: undefined, stem: '  ' + q.stem.replace(' ', '\r\n\r\n\t') + '\u2028  ' });
  const packs = [{ ...fixture.result.packages[0], questions }, { ...fixture.result.packages[0], id: 'PAKET-KEDUA', questions: questions.slice(-2) }];
  const [doc] = siaduDeliveryDocuments(packs, 'all', 'single');
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
  const raster = async (svg: string): Promise<Raster> => { assert.ok(svg.includes('<svg')); return { data: png, url: '', width: 100, height: 100 }; };
  const entries = unzipSync(new Uint8Array(await (await siaduWordBlob(doc, fixture.result.settings, raster)).arrayBuffer()));
  const xml = strFromU8(entries['word/document.xml']), styles = strFromU8(entries['word/styles.xml']);
  const dom = new DOMParser().parseFromString(xml, 'text/xml');
  const nodes = Array.from(dom.getElementsByTagName('w:body')[0].childNodes).filter(n => n.nodeType === 1) as Element[];
  const starts = nodes.flatMap((n, i) => /^Soal \d+$/.test(n.textContent ?? '') ? [i] : []);
  assert.equal(starts.length, 14);
  assert.match(styles, /w:ascii="Times New Roman"/); assert.match(styles, /w:sz w:val="24"/); assert.match(styles, /w:line="360"/);
  assert.match(styles, /w:styleId="SiaduAnswer"[^]*?<w:b\/>/);
  let checked = 0;
  for (const [i, q] of doc.questions.entries()) {
    const chunk = nodes.slice(starts[i], starts[i + 1] ?? nodes.length), text = chunk.map(n => n.textContent ?? '');
    assert.equal(text[0], 'Soal ' + (i + 1));
    assert.equal(chunk[0].getElementsByTagName('w:b').length, 0, 'Parser lama harus melihat marker nomor tanpa **');
    assert.equal(chunk[0].getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val'), 'SiaduQuestion');
    assert.ok(text[4].startsWith('Bentuk Soal:')); assert.ok(text[5].startsWith('Tingkat Kesulitan:'));
    const firstOption = text.findIndex(t => /^A\. /.test(t));
    if (q.subtest !== 'TIU') {
      assert.equal(firstOption, 7, 'Tepat satu paragraf batang soal, tanpa paragraf kosong');
      assert.equal(chunk[6].getElementsByTagName('w:br').length, 0);
      assert.equal(text[6], siaduText(siaduStem(q)));
    } else assert.equal(siaduStem(q), q.stem, 'Premis dan baris TIU tidak digabung');
    const answer = text.indexOf('Jawaban: ' + String.fromCharCode(65 + q.answer));
    assert.ok(answer > firstOption); assert.equal(text[answer + 1], 'Pembahasan:');
    // TWK gaya Nynda (Nasionalisme, Integritas, Bela Negara, Pilar Negara): "Jawaban:" dan "Pembahasan:" biasa; subtes lain dan TWK Bahasa Negara (gaya Dhea) tebal.
    assert.equal(chunk[answer].getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val'), boldAnswerLabels(q) ? 'SiaduAnswer' : undefined);
    assert.equal(chunk[answer + 1].getElementsByTagName('w:b').length, boldAnswerLabels(q) ? 1 : 0);
    if (q.subtest === 'TWK' || q.subtest === 'TKP') caseFormat(q, chunk.slice(answer + 2));
    const joined = text.join('\n');
    assert.ok(!/@(?:acuan|gambar|deret|graf) |\{kunci\}|->|\*\*|~~|\{merah:|^Sumber:/m.test(joined));
    // Every text segment retains its format in Word, including bold/colored LaTeX source.
    const runs = chunk.slice(answer + 2).flatMap(n => Array.from(n.getElementsByTagName('w:r')));
    for (const run of richRuns(documentExplanation(q))) {
      if (!run.bold && !run.strike && !run.color) continue;
      const key = siaduText(run.text).split(/\r?\n/).find(t => t.trim());
      if (!key || key.startsWith('@')) continue;
      const matches = runs.filter(r => (r.textContent ?? '').includes(key));
      // Heading/list/table boundaries may split a rich-text run; dedicated academic cases below test those.
      if (matches.length) {
        if (run.bold) assert.ok(matches.some(r => r.getElementsByTagName('w:b').length));
        if (run.strike) assert.ok(matches.some(r => r.getElementsByTagName('w:strike').length));
      }
    }
    if (q.proof.kind === 'model' && q.proof.model.kind === 'syllogism') {
      assert.deepEqual(siaduMapping(q), { category: 'Penalaran Verbal', lesson: 'Silogisme', chapter: q.proof.model.chapter });
      assert.ok(joined.includes('Premis 1:') && joined.includes('Kesimpulan:'));
      // Analisis opsi (opsi salah dicoret, huruf terisi) hanya pada Silogisme Narasi; Silogisme Biasa berakhir pada "Jawaban: kalimat" tanpa coretan (blueprint Bagian 8).
      const struck = chunk.flatMap(n => Array.from(n.getElementsByTagName('w:strike'))).length;
      if (q.proof.model.chapter?.endsWith('Narasi')) { assert.ok(struck >= 4); assert.ok(joined.includes('Analisis setiap opsi') && /^A\. /m.test(joined) && !joined.includes('{opsi:')); }
      else assert.ok(struck === 0 && !joined.includes('Analisis setiap opsi'));
    }
    for (const block of parseExplanation(documentExplanation(q)) ?? []) if (isDiagramBlock(block)) {
      assert.ok('svg' in diagramResult(block));
      assert.ok(chunk.some(n => n.getElementsByTagName('w:drawing').length));
    }
    for (const table of chunk.filter(n => n.nodeName === 'w:tbl')) {
      assert.ok(table.getElementsByTagName('w:tblHeader').length <= 1, 'Importir tidak boleh menganggap seluruh baris sebagai header');
      assert.ok(table.getElementsByTagName('w:tblGrid').length);
    }
    if (q.subtest === 'TKP') assert.deepEqual(text.filter(t => /^Opsi [A-E] \(\d+ poin\)$/.test(t)), q.options.map((o, i) => `Opsi ${String.fromCharCode(65 + i)} (${o.score} poin)`));
    checked++;
  }
  assert.match(xml, /<w:color w:val="FF0000"/); assert.match(xml, /<w:strike\/>/);
  assert.equal(JSON.stringify(fixture), before, 'Data tersimpan tidak diubah saat ekspor');
  const excluded = { ...packs[0], questions: packs[0].questions.map((q, i) => i === 0 ? { ...q, review: { ...q.review!, excluded: true } } : q) };
  assert.equal(siaduDeliveryDocuments([excluded], 'all', 'single')[0].questions.length, 11);
  // Butir tanpa mappingId (profil selain tryout): bab bertanda "/" atau "&" dan bentuk implikasi tetap terpetakan ke Penalaran Verbal, bukan "SKD / TIU / <nama keluarga>".
  // Perbaikan MINOR QA akhir 2 Nov.
  const draft = (family: string, wanted: (q: Question) => boolean = () => true, level?: 'sedang' | 'sulit') => {
    const fam = TIU_FAMILIES.find(f => f.id === family)!;
    for (let seed = 0; seed < 300; seed++) { const q = { ...makeTiu(fam, level ?? fam.levels[fam.levels.length - 1], rng('map-' + family + seed)), id: 'm', no: 1 } as Question; if (wanted(q)) return q; }
    throw new Error('tidak ada butir contoh: ' + family);
  };
  for (const [family, chapter] of [['argumen', 'Memperkuat/Memperlemah Argumen'], ['posisi', 'Susunan & Posisi'], ['peringkat', 'Urutan & Peringkat'], ['jadwal', 'Jadwal'], ['kategori', 'Distribusi & Kategori'], ['rute', 'Rute & Jalur']])
    assert.deepEqual(siaduMapping(draft(family)), { category: 'Penalaran Verbal', lesson: 'Analitis', chapter }, 'Mapping SiAdu tanpa mappingId: ' + family);
  assert.deepEqual(siaduMapping(draft('silogisme', q => q.proof.kind === 'model' && q.proof.model.kind === 'implication', 'sedang')), { category: 'Penalaran Verbal', lesson: 'Silogisme', chapter: 'Bentuk Implikasi' }, 'Mapping SiAdu bentuk implikasi');
  // Header angka urut polos pada tabel pembahasan tetap teks ("1"), bukan "$$1$$"; angka data tetap rumus.
  const numbered = { ...questions.find(q => q.subtest === 'TIU')!, explanation: ['| 1 | 2 | 3 |', '|---|---|---|', '| A | B | 12 |', 'Jadi, jawaban yang benar adalah A.'].join('\n') };
  const [single] = siaduDeliveryDocuments([{ ...packs[0], questions: [numbered] }], 'all', 'single');
  const numberedXml = new DOMParser().parseFromString(strFromU8(unzipSync(new Uint8Array(await (await siaduWordBlob(single, fixture.result.settings, raster)).arrayBuffer()))['word/document.xml']), 'text/xml');
  const tableRows = Array.from(numberedXml.getElementsByTagName('w:tr')).map(tr => Array.from(tr.getElementsByTagName('w:tc')).map(tc => tc.textContent ?? '').join('|'));
  assert.ok(tableRows.includes('1|2|3'), 'Header 1..n tabel tetap teks biasa: ' + tableRows.join(' ; '));
  assert.ok(tableRows.includes('A|B|$$12$$'), 'Angka data tabel tetap rumus: ' + tableRows.join(' ; '));
  // TWK gaya Nynda (naskah QC butir 6) dan gaya Dhea (naskah QC butir 25, Bahasa Negara), contoh riset TWK berlabel "Konsep:", dan kasus TKP orisinal profil tryout.
  const local = (id: string) => { const recipe = LOCAL_RECIPES.find((x) => x.key === id)!; return { ...renderLocal({ kind: 'local', version: 2, model: recipe.model, context: recipe.context, state: recipe.state, order: [4, 2, 0, 1, 3] }), no: 1 }; };
  const banked = (id: string): Question => { const item = BANK.find((x) => x.id === id)!; return { ...structuredClone(item), no: 1, family: id, origin: 'kasus', proof: { kind: 'bank', id, answerText: item.options[item.answer].text } }; };
  const samples = [local('nas-ingatan:0:1'), local('bahasa-ide:3:0'), banked('twk-ref-4-1'), banked('tkp-kasus-pp-01'), banked(BANK.find((x) => x.kasus && x.topic === 'Anti Radikalisme')!.id)];
  const [caseDoc] = siaduDeliveryDocuments([{ ...packs[0], id: 'QC2-FORMAT', questions: samples.map((q, i) => ({ ...q, no: i + 1 })) }], 'all', 'single');
  const caseDom = new DOMParser().parseFromString(strFromU8(unzipSync(new Uint8Array(await (await siaduWordBlob(caseDoc, fixture.result.settings, raster)).arrayBuffer()))['word/document.xml']), 'text/xml');
  const caseNodes = Array.from(caseDom.getElementsByTagName('w:body')[0].childNodes).filter(n => n.nodeType === 1) as Element[];
  const caseStarts = caseNodes.flatMap((n, i) => /^Soal \d+$/.test(n.textContent ?? '') ? [i] : []);
  assert.equal(caseStarts.length, samples.length);
  for (const [i, q] of caseDoc.questions.entries()) {
    const chunk = caseNodes.slice(caseStarts[i], caseStarts[i + 1] ?? caseNodes.length), text = chunk.map(n => n.textContent ?? '');
    const answer = text.indexOf('Jawaban: ' + String.fromCharCode(65 + q.answer));
    assert.equal(chunk[answer].getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val'), boldAnswerLabels(q) ? 'SiaduAnswer' : undefined, q.id + ': gaya label Jawaban');
    assert.equal(chunk[answer + 1].getElementsByTagName('w:b').length, boldAnswerLabels(q) ? 1 : 0, q.id + ': gaya label Pembahasan');
    caseFormat(q, chunk.slice(answer + 2));
    checked++;
  }
  assert.ok(boldAnswerLabels(samples[1]) && !boldAnswerLabels(samples[0]), 'Bahasa Negara bergaya Dhea (label tebal), KD lain bergaya Nynda');
  fixture.result.packages = [packs[0]];
  fs.writeFileSync('test-results/siadu-academic-fixture.json', JSON.stringify(fixture));
  console.log('PASS: ' + checked + ' soal gabungan; satu paragraf TWK/TKP, urutan TIU, bold/warna/coret/LaTeX, gambar, tabel, mapping silogisme dan butir tanpa mappingId, header angka urut tabel, poin dan penomoran berlanjut.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
