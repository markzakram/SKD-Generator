// Pemeriksaan fitur "ambil soal satuan atau terpilih": dipanggil dari scripts/verify.ts.
// Isinya: serialisasi soal ke teks dan HTML (termasuk pengamanan karakter khusus), gambar yang ikut tersalin, nama berkas,
// himpunan soal terpilih, model tata letak bersama PDF dan PNG, PDF satu soal dan soal terpilih, PNG (canvas tiruan),
// alur clipboard (kaya, teks saja, ditolak), dan unduhan ZIP PNG. Peramban ditiru di Node; uji klik sebenarnya ada di
// pengujian UI terpisah dengan Edge/Chrome headless.
import assert from 'node:assert/strict';
import { Buffer, resolveObjectURL } from 'node:buffer';
import { unzipSync, unzlibSync } from 'fflate';
import { CLIPBOARD_DENIED, canCopyRich, copyPng, copyRich, copyText } from '../lib/clipboard';
import { DEFAULT_SETTINGS } from '../lib/config';
import { DRAFT_NOTE, docImageSize, letter, pdfBlob, questionBlocks, questionHeader, questionPngBlob, rasterizeSvg, reasonLine, scoreLine, wrapLines, type Block } from '../lib/export';
import { hasStimulus, optionSvg, questionSvg } from '../lib/figures';
import { generate, normalizeSettings } from '../lib/generate';
import { rng } from '../lib/rng';
import { copyQuestionImage, copyQuestions, downloadPdf, downloadPng } from '../lib/take-actions';
import { ALL_PARTS, NASKAH_PARTS, TAKE_MENU, esc, joinHtml, joinTexts, partsOf, pickAll, pickedQuestions, pngEntryNames, sectionSlots, sectionsHtml, sectionsText, selectable, slotSvg, takeFileName, takeSections, togglePick } from '../lib/take';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import type { Difficulty, Figure, Package, Question } from '../lib/types';
import { solidPng } from './figural-checks';

type Check = (condition: unknown, message: string) => void;
const clone = <T,>(value: T): T => structuredClone(value);
const fnv = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
const L = letter;
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

// ------------------------------------------------------------------ peramban tiruan
type Drawn = { text: string; x: number; y: number; font: string };
class StubCanvas {
  width = 0; height = 0; tag = ''; texts: Drawn[] = []; images: { width: number; height: number }[] = [];
  context = {
    font: '', fillStyle: '', textBaseline: '', imageSmoothingQuality: '', fillRect: () => {},
    measureText: (text: string) => ({ width: text.length * (parseFloat(this.context.font.replace(/^bold /, '')) || 10) * 0.5 }),
    fillText: (text: string, x: number, y: number) => { this.texts.push({ text, x, y, font: this.context.font }); },
    drawImage: (image: { tag: string }, _x: number, _y: number, width?: number, height?: number) => { this.tag = image.tag; if (width !== undefined) this.images.push({ width, height: height! }); },
  };
  getContext() { return this.context; }
  toDataURL() { return 'data:image/png;base64,' + Buffer.from(solidPng(this.width, this.height, this.tag)).toString('base64'); }
  toBlob(done: (blob: Blob | null) => void) { done(new Blob([solidPng(this.width, this.height, this.tag) as Uint8Array<ArrayBuffer>], { type: 'image/png' })); }
}
class StubImage {
  onload: (() => void) | null = null; onerror: ((error: unknown) => void) | null = null; width = 0; height = 0; tag = '';
  set src(url: string) {
    void (async () => {
      try {
        if (url.startsWith('data:image/png;base64,')) { const png = Buffer.from(url.slice(22), 'base64'); this.width = png.readUInt32BE(16); this.height = png.readUInt32BE(20); this.tag = 'png'; }
        else { const text = await resolveObjectURL(url)!.text(), size = text.match(/width="([\d.]+)" height="([\d.]+)"/)!; this.width = Number(size[1]); this.height = Number(size[2]); this.tag = fnv(text); }
        this.onload?.();
      } catch (error) { this.onerror?.(error); }
    })();
  }
}
type Written = Record<string, string | Uint8Array>;
function installBrowser() {
  const g = globalThis as Record<string, unknown>;
  const saved = { Image: g.Image, document: g.document, ClipboardItem: g.ClipboardItem, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const env = { canvases: [] as StubCanvas[], anchors: [] as { href: string; download: string }[], written: [] as Written[], texts: [] as string[], legacy: [] as string[],
    rejectWrite: false, rejectText: false, legacyOk: false, hasItem: true, rasterFails: false };
  g.Image = StubImage;
  g.document = {
    createElement(name: string) {
      if (name === 'canvas') {
        const canvas = new StubCanvas();
        if (env.rasterFails) canvas.getContext = () => { throw new Error('Canvas tidak tersedia.'); };
        env.canvases.push(canvas); return canvas;
      }
      if (name === 'a') { const a = { href: '', download: '', click() { env.anchors.push({ href: a.href, download: a.download }); }, remove() {} }; return a; }
      if (name === 'textarea') { const area = { value: '', style: { cssText: '' }, setAttribute() {}, select() { env.legacy.push(area.value); }, remove() {} }; return area; }
      throw new Error('elemen tidak ditiru: ' + name);
    },
    body: { appendChild() {} },
    execCommand: () => env.legacyOk,
  };
  class FakeItem { constructor(public data: Record<string, unknown>) {} }
  const clipboard = {
    async write(items: FakeItem[]) {
      if (env.rejectWrite) throw new DOMException('ditolak', 'NotAllowedError');
      for (const item of items) {
        const entry: Written = {};
        for (const [type, value] of Object.entries(item.data)) { const blob = await (value as Promise<Blob>); entry[type] = type.startsWith('image/') ? await bytesOf(blob) : await blob.text(); }
        env.written.push(entry);
      }
    },
    async writeText(text: string) { if (env.rejectText) throw new DOMException('ditolak', 'NotAllowedError'); env.texts.push(text); },
  };
  const setClipboard = () => {
    if (env.hasItem) g.ClipboardItem = FakeItem; else delete g.ClipboardItem;
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true, writable: true });
  };
  setClipboard();
  return { env, refresh: setClipboard, restore() {
    g.Image = saved.Image; g.document = saved.document; g.ClipboardItem = saved.ClipboardItem;
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator); else delete g.navigator;
  } };
}
// Teks yang tertulis di dalam PDF (aliran Flate berisi "(teks) Tj").
function pdfStrings(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString('latin1'), out: string[] = [], re = /(?<!end)stream\r?\n/g; // "endstream" tidak boleh dianggap awal aliran
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) {
    const start = re.lastIndex, end = raw.indexOf('endstream', start);
    if (end < 0) break;
    try {
      const inflated = Buffer.from(unzlibSync(Uint8Array.from(Buffer.from(raw.slice(start, end), 'latin1')))).toString('latin1');
      for (const part of inflated.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(part[1].replace(/\\([()\\])/g, '$1'));
    } catch { /* aliran biasa, bukan teks halaman */ }
    re.lastIndex = end;
  }
  return out;
}
const blockTexts = (blocks: Block[]) => blocks.flatMap((b) => b.kind === 'text' ? [b.text] : []);
const frames = (svg: string) => (svg.match(/<rect x="1" y="1" width="(98|100)" height="(98|100)"/g) ?? []).length;
const sane = (svg: string) => svg.startsWith('<svg') && svg.endsWith('</svg>') && !/NaN|undefined|Infinity/.test(svg);

export async function runTakeChecks(check: Check): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, seed: 'TAKE-UJI' });
  const pack = generate(settings)[0];
  const twk = clone(pack.questions.find((q) => q.subtest === 'TWK')!), tkp = clone(pack.questions.find((q) => q.subtest === 'TKP')!);
  const figural = (id: string, level: Difficulty, seed: string, no: number): Question => ({ ...makeTiu(TIU_FAMILIES.find((f) => f.id === id)!, level, rng(seed)), id: 'take-' + id, no });
  const analogi = figural('fig-analogi', 'sedang', 'take-a', 41), odd = figural('fig-odd', 'sedang', 'take-o', 42), serial = figural('fig-serial', 'mudah', 'take-s', 43), matrix = figural('fig-matrix', 'sulit', 'take-m', 44);
  const f = (shape: Figure['shape'], angle: number, count: number, fill: number): Figure => ({ shape, angle, count, fill });
  const legacy: Question = { id: 'lama', no: 45, subtest: 'TIU', topic: 'Figural', subtopic: 'Analogi', difficulty: 'sedang', family: 'fig-analogi', stem: 'Hubungan gambar 1 terhadap gambar 2 diterapkan pada gambar 3.',
    options: [f('square', 135, 2, 0), f('square', 135, 3, 0), f('circle', 135, 2, 0), f('square', 90, 2, 0), f('square', 135, 2, 1)].map((figure, i) => ({ text: 'Gambar ' + L(i), score: i === 0 ? 5 : 0, reason: 'Alasan ' + i, figure })),
    answer: 0, explanation: 'Pembahasan lama.', source: 'uji', origin: 'pola', visual: { kind: 'analogi', columns: 4, figures: [f('square', 0, 1, 0), f('circle', 90, 2, 1), f('triangle', 45, 1, 2), null] }, proof: { kind: 'figure', answer: f('square', 135, 2, 0) } };
  const figurals = [analogi, odd, serial, matrix, legacy];
  check(figurals.every((q) => q.visual) && hasStimulus(analogi) && hasStimulus(serial) && hasStimulus(matrix) && hasStimulus(legacy), 'Contoh figural harus lengkap');
  report.stimulusless = figurals.filter((q) => !hasStimulus(q)).map((q) => q.family);

  // 1. Bagian soal pada soal teks (TWK) -------------------------------------------------------------------------------
  const stemLines = twk.stem.split('\n').filter((line) => line.trim()).join('\n');
  check(sectionsText(takeSections(twk, ['soal'])) === stemLines, 'Salin soal TWK hanya berisi pertanyaan');
  check(sectionsText(takeSections(twk, ['pilihan'])) === twk.options.map((o, i) => L(i) + '. ' + o.text).join('\n'), 'Salin pilihan memuat A sampai E berurutan');
  check(sectionsText(takeSections(twk, ['jawaban'])) === 'Jawaban: ' + L(twk.answer), 'Salin jawaban TWK hanya huruf kunci');
  const explanation = sectionsText(takeSections(twk, ['pembahasan']));
  check(explanation.startsWith('Pembahasan\n') && twk.options.every((_, i) => explanation.includes(reasonLine(twk, i))) && explanation.includes(twk.explanation.split('\n')[0]), 'Salin pembahasan memuat pembahasan dan alasan tiap pilihan');
  const everything = sectionsText(takeSections(twk, ALL_PARTS, true));
  const order = [questionHeader(twk), stemLines, 'A. ' + twk.options[0].text, 'Jawaban: ' + L(twk.answer), 'Pembahasan\n'].map((part) => everything.indexOf(part));
  check(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), 'Salin semua berurutan: judul, soal, pilihan, jawaban, pembahasan');
  check(takeSections(twk, ALL_PARTS, true).length === 5 && takeSections(twk, ALL_PARTS).length === 4 && takeSections(twk, []).length === 0, 'Jumlah kelompok mengikuti bagian yang diminta');
  check(partsOf('semua') === ALL_PARTS && partsOf('soal').join() === 'soal' && TAKE_MENU.map((item) => item.id).join() === 'soal,pilihan,jawaban,pembahasan,semua' && NASKAH_PARTS.join() === 'soal,pilihan', 'Menu salin memuat lima pilihan');
  const naskah = sectionsText(takeSections(twk, NASKAH_PARTS, true));
  check(!naskah.includes('Jawaban') && !naskah.includes(twk.explanation.slice(0, 30)), 'Naskah tanpa kunci tidak boleh membocorkan jawaban atau pembahasan');

  // 2. TKP: skor tiap pilihan ----------------------------------------------------------------------------------------
  const tkpAnswer = sectionsText(takeSections(tkp, ['jawaban']));
  check(tkpAnswer === 'Jawaban: ' + L(tkp.answer) + ' (5 poin)\nSkor tiap pilihan: ' + scoreLine(tkp) && tkp.options.every((o, i) => tkpAnswer.includes(L(i) + ': ' + o.score)), 'Jawaban TKP memuat skor lima pilihan');
  check(tkp.options.every((_, i) => sectionsText(takeSections(tkp, ['pembahasan'])).includes(reasonLine(tkp, i))) && sectionsText(takeSections(tkp, ['pembahasan'])).includes('poin)'), 'Pembahasan TKP memuat poin tiap pilihan');

  // 3. Tabel dan karakter khusus ----------------------------------------------------------------------------------------
  const withTable: Question = { ...clone(twk), table: { headers: ['Tahun', 'Jumlah'], rows: [['2024', '10 <20>'], ['2025', 'a & b']] } };
  check(sectionsText(takeSections(withTable, ['soal'])).endsWith('Tahun | Jumlah\n2024 | 10 <20>\n2025 | a & b'), 'Tabel soal tersalin sebagai teks bertanda |');
  const tableHtml = sectionsHtml(takeSections(withTable, ['soal']), {});
  check((tableHtml.match(/<th /g) ?? []).length === 2 && (tableHtml.match(/<td /g) ?? []).length === 4 && tableHtml.includes('10 &lt;20&gt;') && tableHtml.includes('a &amp; b'), 'Tabel soal menjadi tabel HTML dengan karakter yang diamankan');
  const hostile: Question = { ...clone(twk), stem: 'x < y & "z"\n\nBaris <script>alert(1)</script>', options: twk.options.map((o) => ({ ...o, text: '<b>' + o.text + '</b>' })) };
  const hostileHtml = sectionsHtml(takeSections(hostile, ALL_PARTS, true), {});
  check(!/<script/i.test(hostileHtml) && hostileHtml.includes('&lt;script&gt;') && hostileHtml.includes('x &lt; y &amp; &quot;z&quot;') && hostileHtml.includes('&lt;b&gt;' + esc(twk.options[0].text) + '&lt;/b&gt;') && !hostileHtml.includes('<b>' + twk.options[0].text), 'HTML salinan tidak boleh memuat markup dari isi soal');
  check(!/undefined|NaN/.test(hostileHtml) && (hostileHtml.match(/<p /g) ?? []).length >= 8, 'HTML salinan tidak memuat nilai kosong');
  check(sectionsText(takeSections(hostile, ['soal'])) === 'x < y & "z"\nBaris <script>alert(1)</script>', 'Teks biasa mempertahankan karakter asli dan membuang baris kosong');
  const joined = joinHtml(['<p>a</p>', '<p>b</p>', '<p>c</p>']);
  check(joined.startsWith('<div style="font-family:Calibri') && (joined.match(/<hr /g) ?? []).length === 2 && joinTexts(['a', 'b']) === 'a\n\n\nb', 'Beberapa soal dipisah garis dan baris kosong');

  // 4. Soal bergambar: gambar yang ikut tersalin ---------------------------------------------------------------------------
  for (const q of figurals) {
    const stimulus = hasStimulus(q), tag = q.family + '/' + (q.options[0].scene ? 'scene' : 'lama');
    const soal = takeSections(q, ['soal']), pilihan = takeSections(q, ['pilihan']), semua = takeSections(q, ALL_PARTS, true);
    check(sectionSlots(soal).join() === (stimulus ? 'stimulus' : ''), tag + ': salin soal membawa gambar stimulus hanya bila ada');
    check(sectionSlots(pilihan).join() === 'pilihan' && sectionsText(pilihan) === '[Gambar pilihan A sampai E]', tag + ': salin pilihan membawa satu gambar deret A sampai E');
    check(sectionSlots(semua).join() === (stimulus ? 'gabungan' : 'pilihan') && !sectionsText(semua).includes('A. Gambar A'), tag + ': salin semua memakai gambar yang sama dengan PDF dan Word');
    check(sectionSlots(takeSections(q, ['jawaban', 'pembahasan'])).length === 0, tag + ': jawaban dan pembahasan tidak membawa gambar');
    const stimulusSvg = slotSvg(q, 'stimulus'), optionsSvg = slotSvg(q, 'pilihan'), allSvg = slotSvg(q, 'gabungan');
    check(stimulusSvg === questionSvg(q, false) && allSvg === questionSvg(q) && [stimulusSvg, optionsSvg, allSvg].every(sane), tag + ': SVG tiap kelompok sah');
    check(frames(optionsSvg) === 5 && frames(allSvg) === frames(stimulusSvg) + 5 && (stimulus ? frames(stimulusSvg) > 0 : frames(stimulusSvg) === 0), tag + ': deret pilihan memuat lima kotak, gabungan = stimulus + pilihan (' + frames(stimulusSvg) + ' + 5)');
    check(optionsSvg.length < allSvg.length || !stimulus, tag + ': deret pilihan lebih ringkas daripada gabungan');
    check(q.options.length === 5 && q.options.every((o) => optionSvg(o) !== ''), tag + ': tiap pilihan punya gambar sendiri untuk "Salin gambar"');
  }
  const images = { gabungan: { url: 'data:image/png;base64,AAAA', width: 542, height: 300 } };
  const figHtml = sectionsHtml(takeSections(matrix, ALL_PARTS, true), images), shown = docImageSize(images.gabungan);
  check(figHtml.includes('<img src="data:image/png;base64,AAAA" width="' + Math.round(shown.width) + '" height="' + Math.round(shown.height) + '" alt="Gambar soal 44 beserta pilihan A sampai E">') && (figHtml.match(/<img /g) ?? []).length === 1, 'HTML soal figural memuat satu gambar dengan ukuran seperti di Word');
  check(sectionsHtml(takeSections(matrix, ['soal']), {}).includes('<i>[Gambar soal]</i>'), 'Gambar yang gagal dibuat diberi penanda, bukan hilang diam-diam');
  check(docImageSize({ width: 2000, height: 500 }).width === 630 && Math.abs(docImageSize({ width: 100, height: 50 }).height - 55) < 1e-9, 'Ukuran gambar dokumen dibatasi 630 piksel');

  // 5. Nama berkas -------------------------------------------------------------------------------------------------------
  const context = { title: 'Latihan SKD CPNS 2027', packId: 'SKD-01' }, q12 = { ...twk, no: 12 };
  check(takeFileName(context, [q12], true, 'png') === 'Latihan-SKD-CPNS-2027-SKD-01-soal-012-TWK-dengan-kunci.png', 'Nama PNG satu soal');
  check(takeFileName(context, [q12], false, 'pdf') === 'Latihan-SKD-CPNS-2027-SKD-01-soal-012-TWK-tanpa-kunci.pdf', 'Nama PDF satu soal tanpa kunci');
  check(takeFileName(context, [q12, tkp, odd], false, 'pdf') === 'Latihan-SKD-CPNS-2027-SKD-01-3-soal-terpilih-tanpa-kunci.pdf' && takeFileName(context, [q12, tkp], true, 'zip') === 'Latihan-SKD-CPNS-2027-SKD-01-2-soal-terpilih-dengan-kunci-png.zip', 'Nama berkas soal terpilih');
  check(takeFileName({ title: ' Judul/..:*? "aneh" ', packId: 'P 1' }, [q12], true, 'png') === 'Judul-aneh-P-1-soal-012-TWK-dengan-kunci.png' && takeFileName({ title: '???', packId: '' }, [q12], true, 'png').startsWith('skd-skd-'), 'Karakter tidak aman dibuang dari nama berkas');
  check(pngEntryNames([q12, tkp, { ...q12 }, { ...q12 }]).join() === 'soal-012-TWK.png,soal-' + String(tkp.no).padStart(3, '0') + '-TKP.png,soal-012-TWK-2.png,soal-012-TWK-3.png', 'Nama PNG dalam ZIP tidak saling menimpa');

  // 6. Soal terpilih --------------------------------------------------------------------------------------------------------
  const empty = new Set<string>(), one = togglePick(empty, 'a'), two = togglePick(one, 'b');
  check(empty.size === 0 && one.size === 1 && two.size === 2 && togglePick(two, 'a').has('a') === false && togglePick(two, 'a').size === 1, 'Memilih dan membatalkan tidak mengubah himpunan lama');
  const list = pack.questions.map((q, i) => i === 1 ? { ...q, review: { status: 'draft' as const, excluded: true, note: '', revision: 1, updatedAt: 'x' } } : q);
  const picked = pickAll(empty, list);
  check(selectable(list).length === list.length - 1 && picked.size === list.length - 1 && !picked.has(list[1].id), 'Pilih semua melewati soal yang dikeluarkan');
  check(pickAll(new Set([list[1].id]), list).size === list.length && pickAll(new Set(['x']), list.slice(0, 3)).size === 3, 'Pilih semua menambah ke pilihan yang ada');
  check(pickedQuestions(list, new Set([list[5].id, list[2].id, 'tidak-ada'])).map((q) => q.no).join() === [list[2].no, list[5].no].join(), 'Soal terpilih diurutkan menurut paket, id asing diabaikan');

  // 7. Model tata letak bersama PDF dan PNG ------------------------------------------------------------------------------
  const plainBlocks = questionBlocks(twk, 'soal', null);
  check(blockTexts(plainBlocks.head).join('|') === [questionHeader(twk), twk.stem, ...twk.options.map((o, i) => L(i) + '. ' + o.text)].join('|') && plainBlocks.tail.length === 0, 'Blok soal: judul, pertanyaan, lima pilihan, tanpa pembahasan');
  const fullBlocks = questionBlocks(tkp, 'pembahasan', null);
  check(blockTexts(fullBlocks.tail).join('|') === ['Jawaban: ' + L(tkp.answer), tkp.explanation, ...tkp.options.map((_, i) => reasonLine(tkp, i))].join('|'), 'Blok pembahasan: jawaban, pembahasan, alasan tiap pilihan');
  const bold = (b: Block) => b.kind === 'text' && b.bold;
  check(fullBlocks.head.filter(bold).length === 1 && fullBlocks.tail.filter(bold).length === 1, 'Hanya judul soal dan baris jawaban yang tebal');
  const drafted = questionBlocks(twk, 'soal', null, true), approved = questionBlocks({ ...twk, review: { status: 'approved', excluded: false, note: '', revision: 1, updatedAt: 'x' } }, 'soal', null, true);
  check(blockTexts(drafted.head)[0] === DRAFT_NOTE && blockTexts(approved.head)[0] === questionHeader(twk) && blockTexts(plainBlocks.head)[0] === questionHeader(twk), 'Label draf hanya untuk soal yang belum disetujui dan hanya bila diminta');
  const tableBlocks = questionBlocks(withTable, 'soal', null).head;
  check(blockTexts(tableBlocks).slice(2, 5).join('|') === 'Tahun | Jumlah|2024 | 10 <20>|2025 | a & b' && tableBlocks.some((b) => b.kind === 'gap' && b.mm === 3), 'Blok tabel meniru ekspor PDF');

  const lineStub = { measureText: (text: string) => ({ width: text.length }) };
  check(wrapLines(lineStub, 'satu dua tiga empat', 9).join('|') === 'satu dua|tiga|empat', 'Teks dipecah menurut lebar');
  check(wrapLines(lineStub, 'a\n\nb', 20).join('|') === 'a||b', 'Baris kosong dan baris baru dipertahankan');
  check(wrapLines(lineStub, 'abcdefghij kl', 4).join('|') === 'abcd|efgh|ij|kl', 'Kata yang lebih lebar dari baris dipotong');
  check(wrapLines(lineStub, 'x', 0).length >= 1 && wrapLines(lineStub, '', 5).join('|') === '', 'Teks kosong tidak membuat galat');

  // 8. Peramban tiruan: rasterisasi, PDF, PNG --------------------------------------------------------------------------------
  const browser = installBrowser(), env = browser.env;
  try {
    const raster = await rasterizeSvg(slotSvg(analogi, 'stimulus'));
    check(raster.url.startsWith('data:image/png;base64,') && raster.data[0] === 137 && raster.width > 0 && raster.height > 0, 'rasterizeSvg menghasilkan PNG dan ukuran asli');
    const raster2 = await rasterizeSvg(optionSvg(analogi.options[0]), 4);
    check(raster2.width === 120 && env.canvases[env.canvases.length - 1].width === 480, 'Skala rasterisasi dapat diatur');

    const pdfBytes = async (packs: Package[], content: 'soal' | 'pembahasan', heading?: 'paket' | 'ringkas' | 'tanpa') => bytesOf(await pdfBlob(packs, { title: 'Judul Uji TAKE' }, content, heading));
    const asPdf = (value: string) => value.replace(/[–—−]/g, '-'); // pdfBlob mengganti tanda pisah panjang menjadi "-"
    const flatPdf = (bytes: Uint8Array) => pdfStrings(bytes).join(' ').replace(/\s+/g, ' '); // judul panjang bisa terpecah dua baris
    const single = await pdfBytes([{ ...pack, questions: [twk] }], 'pembahasan', 'tanpa');
    const singleText = flatPdf(single);
    check(Buffer.from(single.subarray(0, 5)).toString() === '%PDF-' && !singleText.includes('Judul Uji TAKE') && singleText.includes(questionHeader(twk)) && singleText.includes('Jawaban: ' + L(twk.answer)) && singleText.includes(asPdf(DRAFT_NOTE)), 'PDF satu soal: tanpa judul paket, dengan label draf, kunci, dan pembahasan');
    const noKey = flatPdf(await pdfBytes([{ ...pack, questions: [twk] }], 'soal', 'tanpa'));
    check(!noKey.includes('Jawaban:') && noKey.includes('A. ') && noKey.includes(twk.stem.slice(0, 25)), 'PDF satu soal tanpa kunci tidak memuat jawaban');
    const several = flatPdf(await pdfBytes([{ ...pack, questions: [twk, tkp] }], 'pembahasan', 'ringkas'));
    check(several.includes('Judul Uji TAKE') && several.includes(pack.id + ' · 2 soal terpilih') && !several.includes('menit') && several.includes(questionHeader(tkp)) && several.indexOf(questionHeader(twk)) < several.indexOf(questionHeader(tkp)), 'PDF soal terpilih: judul ringkas, urutan paket, tanpa durasi paket');
    const whole = flatPdf(await pdfBytes([{ ...pack, questions: [twk] }], 'soal'));
    check(whole.includes('Judul Uji TAKE') && whole.includes(pack.id + ' · 1 soal · ' + pack.duration + ' menit'), 'PDF paket tetap memakai judul dan durasi paket');
    const figurePdf = flatPdf(await pdfBytes([{ ...pack, questions: [matrix] }], 'pembahasan', 'tanpa'));
    check(!figurePdf.includes('A. Gambar') && figurePdf.includes(questionHeader(matrix)), 'PDF soal figural memakai gambar, bukan daftar pilihan');

    const pngOf = async (q: Question, content: 'soal' | 'pembahasan') => {
      const before = env.canvases.length, blob = await questionPngBlob(q, content), canvas = env.canvases[env.canvases.length - 1];
      return { blob, canvas, made: env.canvases.length - before };
    };
    const text = await pngOf(tkp, 'pembahasan'), lines = text.canvas.texts.map((t) => t.text);
    const flat = (value: string) => value.replace(/\s+/g, ' ').trim();
    check(text.made === 1 && text.canvas.width === 1260 && text.canvas.height > 600 && Number.isInteger(text.canvas.height) && (await bytesOf(text.blob))[0] === 137, 'PNG soal teks: lebar halaman A4 (1.260 piksel) dan berkas PNG sah');
    const expected = [DRAFT_NOTE, ...blockTexts(questionBlocks(tkp, 'pembahasan', null).head), ...blockTexts(questionBlocks(tkp, 'pembahasan', null).tail)];
    check(flat(lines.join(' ')) === flat(expected.join(' ')), 'PNG memuat label draf, judul, pertanyaan, pilihan, jawaban, pembahasan, dan alasan menurut urutan PDF');
    check(text.canvas.texts.every((t) => t.text.length * parseFloat(t.font.replace(/^bold /, '')) * 0.5 <= 178 * 6 + 1e-6), 'Tiap baris PNG muat dalam kolom 178 mm');
    check(text.canvas.texts.every((t) => t.x === 96 && t.y > 96 && t.y < text.canvas.height) && text.canvas.texts.every((t, i, all) => i === 0 || t.y >= all[i - 1].y), 'Baris PNG berada di dalam halaman, urut ke bawah, dengan margin 16 mm');
    check(text.canvas.texts[1].font.startsWith('bold ') && text.canvas.texts[0].font.startsWith('bold ') && !text.canvas.texts[3].font.startsWith('bold ') && text.canvas.texts[1].font.endsWith('Arial, Helvetica, sans-serif'), 'Judul tebal, isi biasa, huruf Arial/Helvetica seperti PDF');
    const shortPng = await pngOf(tkp, 'soal');
    check(shortPng.canvas.height < text.canvas.height && !shortPng.canvas.texts.some((t) => t.text.startsWith('Jawaban')), 'PNG tanpa kunci lebih pendek dan tidak memuat jawaban');
    const approvedPng = await pngOf({ ...twk, review: { status: 'approved', excluded: false, note: '', revision: 1, updatedAt: 'x' } }, 'soal');
    check(!approvedPng.canvas.texts.some((t) => t.text === DRAFT_NOTE) && approvedPng.canvas.texts[0].text === questionHeader(twk), 'PNG soal yang disetujui tidak diberi label draf');
    for (const q of [analogi, odd, serial, matrix, legacy]) {
      const result = await pngOf(q, 'pembahasan'), drawn = result.canvas.images;
      check(result.made === 2 && drawn.length === 1 && drawn[0].width <= 172 * 6 + 1e-6 && drawn[0].width > 60 * 6 && !result.canvas.texts.some((t) => /^[A-E]\. Gambar/.test(t.text)), q.family + ': PNG figural menggambar satu gambar (stimulus + pilihan) dan tidak mendaftar pilihan sebagai teks');
      const whole = await rasterizeSvg(questionSvg(q));
      check(Math.abs(drawn[0].height / drawn[0].width - whole.height / whole.width) < 1e-9, q.family + ': perbandingan lebar-tinggi gambar terjaga');
    }
    check((await pngOf(matrix, 'soal')).canvas.images[0].width <= 145 * 6 + 1e-6, 'Matriks 3 × 3 dibatasi 145 mm seperti di PDF');

    // 9. Clipboard -----------------------------------------------------------------------------------------------------------
    const plainText = 'Soal\nA. satu';
    env.written.length = 0;
    check(canCopyRich(), 'Clipboard tiruan mendukung ClipboardItem');
    check(await copyRich(plainText, async () => '<p>html</p>') === 'kaya' && env.written.length === 1 && env.written[0]['text/html'] === '<p>html</p>' && env.written[0]['text/plain'] === plainText, 'copyRich menulis text/html dan text/plain sekaligus');
    env.rejectWrite = true; env.texts.length = 0;
    check(await copyRich(plainText, async () => '<p>html</p>') === 'teks' && env.texts[0] === plainText, 'Clipboard kaya ditolak: yang tersalin teks saja');
    env.rejectWrite = false;
    check(await copyRich(plainText, async () => { throw new Error('rasterisasi gagal'); }) === 'teks' && env.texts[1] === plainText, 'Gambar gagal dibuat: yang tersalin teks saja');
    env.hasItem = false; browser.refresh(); env.texts.length = 0;
    check(!canCopyRich() && await copyRich(plainText, async () => { throw new Error('tidak boleh dipanggil'); }) === 'teks' && env.texts[0] === plainText, 'Tanpa ClipboardItem (mis. Firefox lama): teks saja dan HTML tidak dibuat');
    await assert.rejects(copyPng(Promise.resolve(new Blob(['x']))), /belum mendukung salin gambar/); check(true, 'Salin gambar tanpa ClipboardItem memberi pesan yang jelas');
    env.hasItem = true; browser.refresh(); env.rejectWrite = true; env.rejectText = true; env.legacyOk = false;
    await assert.rejects(copyRich(plainText, async () => '<p>x</p>'), new RegExp(CLIPBOARD_DENIED.slice(0, 30))); check(true, 'Semua jalur clipboard ditolak: galat yang jelas');
    env.legacyOk = true; env.legacy.length = 0;
    check(await copyRich(plainText, async () => '<p>x</p>') === 'teks' && env.legacy[0] === plainText, 'Jalur lama (execCommand) dipakai bila Clipboard API menolak');
    await copyText('abc'); check(env.legacy[1] === 'abc', 'copyText memakai jalur lama bila writeText ditolak');
    env.rejectWrite = false; env.rejectText = false; env.legacyOk = false;
    await assert.rejects(copyPng(Promise.reject(new Error('Gambar figural gagal disiapkan.'))), /Gambar figural gagal disiapkan/); check(true, 'Galat rasterisasi dilaporkan apa adanya');
    env.rejectWrite = true;
    await assert.rejects(copyPng(Promise.resolve(new Blob(['x']))), new RegExp(CLIPBOARD_DENIED.slice(0, 30))); check(true, 'Salin gambar ditolak browser: pesan izin clipboard');
    env.rejectWrite = false; env.written.length = 0;

    // 10. Alur lengkap salin soal dan salin gambar -----------------------------------------------------------------------------
    check(await copyQuestions([matrix], ALL_PARTS, true) === 'kaya', 'Salin semua soal figural berhasil sebagai salinan kaya');
    const rich = env.written[0], html = rich['text/html'] as string;
    check(html.startsWith('<div style="font-family:Calibri') && (html.match(/<img src="data:image\/png;base64,[A-Za-z0-9+/=]+"/g) ?? []).length === 1 && html.includes(questionHeader(matrix)) && html.includes('Jawaban: ' + L(matrix.answer)) && html.includes('Pembahasan'), 'HTML hasil salin memuat gambar PNG, judul, jawaban, dan pembahasan');
    check((rich['text/plain'] as string).includes('[Gambar soal dan pilihan A sampai E]') && (rich['text/plain'] as string).includes(questionHeader(matrix)), 'Teks cadangan menandai gambar yang tidak ikut');
    env.written.length = 0;
    check(await copyQuestions([twk, matrix, tkp], NASKAH_PARTS, true) === 'kaya', 'Salin terpilih berhasil');
    const many = env.written[0], manyHtml = many['text/html'] as string, manyText = many['text/plain'] as string;
    check((manyHtml.match(/<hr /g) ?? []).length === 2 && (manyHtml.match(/<img /g) ?? []).length === 1 && !manyHtml.includes('Jawaban:') && [twk, matrix, tkp].map((q) => manyHtml.indexOf(questionHeader(q))).every((at, i, all) => at >= 0 && (i === 0 || at > all[i - 1])), 'Salin terpilih: urutan soal dipertahankan, dipisah garis, tanpa kunci bila tidak diminta');
    check([twk, matrix, tkp].map((q) => manyText.indexOf(questionHeader(q))).every((at, i, all) => at >= 0 && (i === 0 || at > all[i - 1])) && !manyText.includes('Jawaban:'), 'Teks cadangan salin terpilih berurutan');
    env.written.length = 0;
    await copyQuestionImage(odd, 2);
    const copiedOption = env.written[0]['image/png'] as Uint8Array;
    check(copiedOption[0] === 137 && copiedOption[1] === 80 && Object.keys(env.written[0]).join() === 'image/png', 'Salin gambar opsi menulis image/png saja');
    env.written.length = 0;
    await copyQuestionImage(matrix, 'stimulus');
    check((env.written[0]['image/png'] as Uint8Array)[0] === 137, 'Salin gambar stimulus menulis image/png');
    await assert.rejects(copyQuestionImage(twk, 'stimulus'), /tidak tersedia/); await assert.rejects(copyQuestionImage(twk, 0), /tidak tersedia/); check(true, 'Soal teks tidak punya gambar untuk disalin');
    env.rasterFails = true;
    await assert.rejects(copyQuestionImage(matrix, 'stimulus'), /Canvas tidak tersedia/); check(true, 'Galat canvas sampai ke pengguna');
    check(await copyQuestions([matrix], ALL_PARTS, true) === 'teks', 'Rasterisasi gagal: tetap tersalin sebagai teks');
    env.rasterFails = false;

    // 11. Unduhan -------------------------------------------------------------------------------------------------------------
    const downloaded = async () => { const a = env.anchors[env.anchors.length - 1]; return { name: a.download, blob: resolveObjectURL(a.href)! }; };
    check(await downloadPdf(pack, [twk], context, true) === takeFileName(context, [twk], true, 'pdf'), 'downloadPdf mengembalikan nama berkas');
    const pdfFile = await downloaded();
    check(pdfFile.name === takeFileName(context, [twk], true, 'pdf') && Buffer.from(new Uint8Array(await pdfFile.blob.arrayBuffer()).subarray(0, 5)).toString() === '%PDF-', 'Unduh PDF satu soal');
    await downloadPdf(pack, [twk, tkp], context, false);
    const pdfMany = await downloaded();
    check(pdfMany.name.endsWith('-2-soal-terpilih-tanpa-kunci.pdf') && pdfStrings(new Uint8Array(await pdfMany.blob.arrayBuffer())).join('\n').includes('2 soal terpilih'), 'Unduh PDF soal terpilih');
    await downloadPng([matrix], context, true);
    const pngFile = await downloaded();
    check(pngFile.name.endsWith('-soal-044-TIU-dengan-kunci.png') && (await pngFile.blob.arrayBuffer()).byteLength > 100, 'Unduh PNG satu soal langsung berupa PNG');
    const progress: string[] = [];
    await downloadPng([twk, matrix, tkp], context, false, (done, total) => progress.push(done + '/' + total));
    const zipFile = await downloaded(), zip = unzipSync(new Uint8Array(await zipFile.blob.arrayBuffer()));
    check(zipFile.name.endsWith('-3-soal-terpilih-tanpa-kunci-png.zip') && Object.keys(zip).join() === pngEntryNames([twk, matrix, tkp]).join() && Object.values(zip).every((png) => png[0] === 137 && png[1] === 80), 'Unduh PNG banyak soal: satu PNG per soal dalam ZIP');
    check(progress.join() === '0/3,1/3,2/3', 'Kemajuan PNG dilaporkan per soal');
    report.zipEntries = Object.keys(zip);
    report.canvasesMade = env.canvases.length;
  } finally { browser.restore(); }
  return report;
}
