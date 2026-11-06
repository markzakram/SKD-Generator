import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DOMParser, type Element } from '@xmldom/xmldom';
import { unzipSync, strFromU8 } from 'fflate';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate, normalizeSettings } from '../lib/generate';
import { siaduDocuments, siaduDeliveryDocuments, siaduWordBlob, siaduText, siaduScoreLines, siaduStem } from '../lib/siadu';
import { createWorkspace, exportPackages } from '../lib/quality';
import { auditPackages } from '../lib/validate';
import { questionTable } from '../lib/table';
import { mathParts } from '../lib/math';
import type { Raster } from '../lib/export';

async function main() {
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, profile: 'tryout-2027', twkSource: 'new', tkpSource: 'accepted', tiuSource: 'variation', packages: 2, uniqueAcross: false, seed: 'SIADU-EXPORT-QA', title: 'Uji ekspor SKD' });
  const packages = generate(settings), audit = auditPackages(packages, settings);
  assert.equal(audit.ok, true, audit.errors.join('\n'));
  const result = { settings, packages, audit, elapsed: 0 };
  const workspace = createWorkspace(result);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/siadu-fixture.json', JSON.stringify(workspace));
  assert.equal(siaduDocuments(packages).length, 6);
  assert.equal(siaduDocuments([packages[1]], 'TKP').length, 1);
  assert.equal(siaduDocuments([{ ...packages[0], questions: [] }]).length, 0);
  const combined = siaduDeliveryDocuments(packages, 'all', 'single');
  assert.equal(combined.length, 1); assert.equal(combined[0].questions.length, 220);
  assert.deepEqual(combined[0].questions.map(q => q.id), packages.flatMap(p => p.questions.map(q => q.id)));
  assert.equal(siaduDeliveryDocuments(packages, 'all', 'zip').length, 6);
  assert.equal(siaduDeliveryDocuments(packages, 'TKP', 'single')[0].questions.length, 90);
  assert.deepEqual(siaduDeliveryDocuments([], 'all', 'single'), []);
  const tkp = packages[0].questions.find((q) => q.subtest === 'TKP')!;
  assert.throws(() => siaduScoreLines({ ...tkp, options: tkp.options.map((o) => ({ ...o, score: 5 })) }), /poin 1–5/);
  assert.throws(() => siaduScoreLines({ ...tkp, answer: (tkp.answer + 1) % 5 }), /poin 1–5/);
  assert.throws(() => siaduScoreLines({ ...tkp, options: tkp.options.slice(0, 4) }), /poin 1–5/);
  const reordered = Array.from({ length: 5 }, (_, offset) => {
    const q = structuredClone(tkp);
    q.options = [...q.options.slice(offset), ...q.options.slice(0, offset)];
    q.answer = q.options.findIndex((o) => o.score === 5);
    // Old/editable prose must never override the current option scores.
    q.explanation += '\nOpsi A (1 poin)\nOpsi B (1 poin)';
    q.tip = 'Catatan lama: Opsi C (1 poin)';
    q.source = 'Catatan lama: Opsi D (1 poin), Opsi E (1 poin)';
    return q;
  });
  const edited = structuredClone(reordered[0]);
  [edited.options[0].score, edited.options[1].score] = [edited.options[1].score, edited.options[0].score];
  edited.answer = edited.options.findIndex((o) => o.score === 5);
  const edgeCases = [...reordered, edited];
  const edgeDoc = siaduDocuments([{ ...packages[0], questions: edgeCases }], 'TKP')[0];
  fs.writeFileSync('test-results/siadu-tkp-edge.docx', new Uint8Array(await (await siaduWordBlob(edgeDoc, settings)).arrayBuffer()));
  fs.writeFileSync('test-results/siadu-tkp-edge.json', JSON.stringify(edgeCases));
  assert.equal(siaduText('Nilai \\(\\frac{1}{2}\\) dan \\[x+1\\].'), 'Nilai $$\\frac{1}{2}$$ dan $$x+1$$.');
  const filtered = structuredClone(workspace.result);
  filtered.packages[0].questions[0].review!.excluded = true;
  assert.equal(exportPackages(filtered, 'draft', 0)[0].questions.length, 109);
  // Browser integration checks the actual pixels; this readback checks Word's structure independently.
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
  let rasterCount = 0;
  const raster = async (svg: string): Promise<Raster> => {
    assert.match(svg, /<svg/); assert.match(svg, /viewBox=/); rasterCount++;
    return { data: png, url: '', width: 100, height: 100 };
  };
  for (const doc of siaduDocuments([packages[0]])) {
    const blob = await siaduWordBlob(doc, settings, raster);
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    if (doc.subtest === 'TKP') fs.writeFileSync('test-results/siadu-tkp-unit.docx', new Uint8Array(await blob.arrayBuffer()));
    const xml = strFromU8(entries['word/document.xml']);
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    const body = dom.getElementsByTagName('w:body')[0];
    const nodes = Array.from(body.childNodes).filter((node) => node.nodeType === 1);
    const starts = nodes.flatMap((node, i) => /^Soal \d+$/.test(node.textContent ?? '') ? [i] : []);
    assert.equal(starts.length, doc.questions.length);
    for (const [i, q] of doc.questions.entries()) {
      const chunk = nodes.slice(starts[i], starts[i + 1] ?? nodes.length);
      const lines = chunk.map((node) => node.textContent ?? '');
      assert.equal(lines[0], 'Soal ' + (i + 1));
      for (const [offset, key] of ['Category', 'Lesson', 'Chapter'].entries()) {
        assert.match(lines[offset + 1], new RegExp('^' + key + ': .+'));
        assert.equal((chunk[offset + 1] as Element).getElementsByTagName('w:b').length, 1);
      }
      assert.match(lines[5], /^Tingkat Kesulitan: (Mudah|Sedang|Sulit|Hots)$/);
      assert.equal(lines[4], 'Bentuk Soal: ' + (q.subtest === 'TKP' ? 'Option (Legacy)' : 'Option New'));
      assert.ok(lines[6].trim(), 'Tidak ada paragraf kosong sebelum batang soal');
      if (q.subtest !== 'TIU') {
        assert.equal(lines[6], siaduText(siaduStem(q)));
        assert.equal((chunk[6] as Element).getElementsByTagName('w:br').length, 0);
      }
      const keyAt = lines.indexOf('Jawaban: ' + String.fromCharCode(65 + q.answer));
      assert.ok(keyAt > 6);
      assert.equal(lines[keyAt + 1], 'Pembahasan:');
      const options = chunk.slice(6, keyAt).filter((node) => /^[A-E]\. /.test(node.textContent ?? ''));
      assert.equal(options.length, 5);
      for (const [j, option] of q.options.entries()) {
        assert.ok(options[j].textContent?.startsWith(String.fromCharCode(65 + j) + '. '));
        if (option.figure || option.scene) assert.equal((options[j] as Element).getElementsByTagName('w:drawing').length, 1);
      }
      if (q.subtest === 'TKP') for (const [j, o] of q.options.entries()) assert.ok(lines.includes('Opsi ' + String.fromCharCode(65 + j) + ' (' + o.score + ' poin)'));
      if (q.table) {
        const table = questionTable(q)!;
        const tables = chunk.filter((node) => node.nodeName === 'w:tbl');
        assert.ok(tables.length > 0);
        const headers = Array.from((tables[0] as Element).getElementsByTagName('w:tblHeader')).filter((node) => !['0', 'false', 'off'].includes(node.getAttribute('w:val') ?? ''));
        assert.equal(headers.length, table.headers.length ? 1 : 0);
      }
      for (const part of mathParts(q.stem)) if (part.kind === 'math') assert.ok(lines.join('\n').includes('$$' + part.value + '$$'));
      assert.ok(!lines.join('\n').includes('@gambar '));
      assert.ok(!lines.join('\n').includes('@deret '));
      assert.ok(!lines.join('\n').includes('@graf '));
      assert.ok(!lines.join('\n').includes('{kunci}'));
    }
    assert.ok(entries['word/_rels/document.xml.rels']);
  }
  assert.ok(rasterCount > 20, 'Stimulus, opsi figural, dan diagram pembahasan disertakan');
  console.log('LULUS: 110 soal dibaca balik dari Word; mapping, opsi, kunci, poin TKP, LaTeX, tabel tanpa header, dan gambar. Fixture browser: 2 paket / 220 soal.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
