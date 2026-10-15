// Pemeriksaan mesin figural TIU (lib/figural): dipanggil dari scripts/verify.ts.
// Isinya: katalog bentuk, aljabar gambar, perangkat hipotesis, soal dari semua keluarga x tingkat x banyak seed
// (dibuktikan ulang oleh validator), kontrol negatif (soal yang dirusak harus ditolak), tidak ada kebocoran aturan,
// determinisme, keunikan, tingkat kesulitan, tampilan kartu soal, ekspor Word/PDF, dan kompatibilitas paket lama.
import assert from 'node:assert/strict';
import { resolveObjectURL } from 'node:buffer';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { unzipSync, zlibSync } from 'fflate';
import QuestionCard from '../components/QuestionCard';
import { DEFAULT_SETTINGS } from '../lib/config';
import { pdfBlob, wordBlob } from '../lib/export';
import { fingerprint, generate, normalizeSettings } from '../lib/generate';
import { hasStimulus, optionSvg, questionSvg, solveFigure } from '../lib/figures';
import { contentHash } from '../lib/pilot';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import type { Difficulty, Fill, Figure, Package, Question, Scene } from '../lib/types';
import { auditPackages, auditQuestion } from '../lib/validate';
import { GLYPH_LIST, type Pt } from '../lib/figural/glyphs';
import { distinct, fitGrid, fitSequence } from '../lib/figural/hyp';
import { inferHidden, matchPrediction, readScene } from '../lib/figural/infer';
import { explain } from '../lib/figural/ops';
import { LEAK, STEMS } from '../lib/figural/stems';
import { diffScenes, flipScene, mk, rotateScene, rotationBetween, sameScene, scene } from '../lib/figural/scene';

type Check = (condition: unknown, message: string) => void;
const FAMILIES = ['fig-analogi', 'fig-odd', 'fig-serial', 'fig-matrix'] as const;
const LEVELS: Difficulty[] = ['mudah', 'sedang', 'sulit', 'hots'];
const clone = <T,>(value: T): T => structuredClone(value);
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const figural = (draft: ReturnType<typeof makeTiu>, family: string, level: Difficulty, seed: number): Question => ({ ...draft, no: 1, id: 'fig-' + family + '-' + level + '-' + seed });

// ------------------------------------------------------------------ alat bantu
function wellFormed(svg: string): string | null {
  const stack: string[] = [], tag = /<(\/?)([a-zA-Z][\w:-]*)([^<>]*?)(\/?)>/g;
  let last = 0, match: RegExpExecArray | null;
  while ((match = tag.exec(svg))) {
    if (/[<>]/.test(svg.slice(last, match.index)) || /&(?!amp;|lt;|gt;|quot;)/.test(svg.slice(last, match.index))) return 'teks liar di luar tag';
    last = tag.lastIndex;
    if (match[4] === '/') continue;
    if (match[1]) { if (stack.pop() !== match[2]) return 'tag penutup ' + match[2] + ' tidak cocok'; } else stack.push(match[2]);
  }
  if (/[<>]/.test(svg.slice(last))) return 'sisa teks liar';
  return stack.length ? 'tag belum ditutup: ' + stack.join(',') : /NaN|undefined|Infinity|null/.test(svg) ? 'nilai tidak sah di SVG' : null;
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (bytes: Uint8Array) => { let c = 0xffffffff; for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngBody = new Map<string, Uint8Array>();
const fnv = (text: string) => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(16); };
// PNG putih polos berukuran w x h, diberi penanda unik agar tiap gambar berbeda; cukup untuk memeriksa jalur penyisipan
// gambar di Word dan PDF tanpa peramban (pustaka docx membuang gambar yang isinya persis sama).
function solidPng(width: number, height: number, tag: string): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
    view.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8); view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
  };
  const key = width + 'x' + height;
  if (!pngBody.has(key)) {
    const header = new Uint8Array(13), hv = new DataView(header.buffer); hv.setUint32(0, width); hv.setUint32(4, height); header[8] = 8;
    const raw = new Uint8Array((width + 1) * height).fill(255); for (let y = 0; y < height; y++) raw[y * (width + 1)] = 0;
    const body = [chunk('IHDR', header), chunk('IDAT', zlibSync(raw))], all = new Uint8Array(body.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of body) { all.set(p, at); at += p.length; }
    pngBody.set(key, all);
  }
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngBody.get(key)!, chunk('tEXt', new TextEncoder().encode('tag\0' + tag)), chunk('IEND', new Uint8Array())];
  const png = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { png.set(p, at); at += p.length; }
  return png;
}
// Lingkungan peramban minimal agar `rasterize` pada lib/export.ts bisa dijalankan di Node.
function installBrowserStub() {
  const g = globalThis as Record<string, unknown>;
  g.Image = class { onload: (() => void) | null = null; onerror: ((e: unknown) => void) | null = null; width = 0; height = 0; tag = '';
    set src(url: string) { void (async () => { try { const text = await resolveObjectURL(url)!.text(), size = text.match(/width="([\d.]+)" height="([\d.]+)"/)!; this.width = Number(size[1]); this.height = Number(size[2]); this.tag = fnv(text); this.onload?.(); } catch (error) { this.onerror?.(error); } })(); } };
  g.document = { createElement: (name: string) => {
    assert.equal(name, 'canvas');
    let drawn = '';
    const canvas = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage(image: { tag: string }) { drawn = image.tag; } }), toDataURL() { return 'data:image/png;base64,' + Buffer.from(solidPng(canvas.width, canvas.height, drawn)).toString('base64'); } };
    return canvas;
  } };
}

// Kunci tunggal dirusak dengan berbagai cara; validator wajib menolak setiap kerusakan.
function rescore(q: Question, answer: number) { q.answer = answer; q.options.forEach((option, i) => { option.score = i === answer ? 5 : 0; }); }
function nudge(s: Scene): Scene {
  const out = clone(s), part = out.parts.find((p) => p.id !== 'rangka' && p.f < 3) ?? out.parts[out.parts.length - 1];
  part.f = ((part.f + 1) % 3) as Fill; return out;
}
function tamper(q: Question): { name: string; q: Question }[] {
  const out: { name: string; q: Question }[] = [];
  const wrongKey = clone(q); rescore(wrongKey, (q.answer + 1) % 5); out.push({ name: 'kunci digeser', q: wrongKey });
  const twin = clone(q); twin.options[(q.answer + 1) % 5].scene = clone(q.options[q.answer].scene); out.push({ name: 'opsi kembar', q: twin });
  const kind = q.visual!.kind;
  if (kind === 'ketidaksamaan') {
    const mechanism = clone(q); mechanism.visual!.rule!.mekanisme = 'ketidaksamaan-tidak-dikenal'; out.push({ name: 'aturan tidak dikenal', q: mechanism });
    // Satu gambar sekelompok diganti salinan kunci yang diputar: kini ada dua gambar yang berbeda dan tidak ada yang tunggal.
    const doubled = clone(q); doubled.options[(q.answer + 1) % 5].scene = rotateScene(q.options[q.answer].scene!, 37); out.push({ name: 'dua gambar berbeda', q: doubled });
  } else {
    const key = clone(q); key.options[q.answer].scene = nudge(q.options[q.answer].scene!); out.push({ name: 'kunci diubah', q: key });
    // Stimulus dirusak pada bagian yang ikut menentukan jawaban: satu bagian pada kunci diberi warna lain di kotak terdekat dengan
    // kotak tersembunyi. Aturan yang cocok dengan stimulus asli tidak boleh lagi cocok, atau ramalannya harus berubah.
    const cells = q.visual!.scenes!, hidden = cells.findIndex((c) => c === null), name = (id: string) => id.includes('@') ? id.slice(0, id.indexOf('@')) : id;
    const order = kind === 'matriks' ? [7, 5, 6, 2, 4, 3, 1, 0] : kind === 'serial' ? [hidden - 1, hidden + 1, hidden - 2, hidden + 2, 0].filter((i) => i >= 0 && i < cells.length && i !== hidden) : [1, 0, 2];
    const keyParts = q.options[q.answer].scene!.parts;
    const pick = keyParts.find((p) => p.f < 3 && p.id !== 'rangka') ?? keyParts[0];
    const at = order.find((i) => cells[i]?.parts.some((p) => name(p.id) === name(pick.id)));
    if (at !== undefined) {
      const stimulus = clone(q), changed = clone(cells[at]!);
      changed.parts.filter((p) => name(p.id) === name(pick.id)).forEach((p) => { p.f = ((p.f + 1) % 3) as Fill; });
      stimulus.visual!.scenes![at] = changed; out.push({ name: 'stimulus dirusak', q: stimulus });
    }
  }
  return out;
}

// ---------------------------------------------------------------- uji utama
export async function runFiguralChecks(check: Check): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {};

  // 1. Katalog bentuk: orde simetri dan kiralitas yang tercatat harus sama dengan hasil pengukuran numerik.
  const dense = (pts: Pt[]): Pt[] => pts.flatMap((p, i) => { const q = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.4)); return Array.from({ length: n }, (_, j) => [p[0] + (q[0] - p[0]) * j / n, p[1] + (q[1] - p[1]) * j / n] as Pt); });
  const hausdorff = (a: Pt[], b: Pt[]) => { const one = (x: Pt[], y: Pt[]) => Math.max(...x.map((p) => Math.min(...y.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))))); return Math.max(one(a, b), one(b, a)); };
  const turned = (pts: Pt[], deg: number): Pt[] => pts.map(([x, y]) => [x * Math.cos(deg * Math.PI / 180) - y * Math.sin(deg * Math.PI / 180), x * Math.sin(deg * Math.PI / 180) + y * Math.cos(deg * Math.PI / 180)] as Pt);
  const reflected = (pts: Pt[], axis: number): Pt[] => pts.map(([x, y]) => { const a = 2 * axis * Math.PI / 180; return [x * Math.cos(a) + y * Math.sin(a), x * Math.sin(a) - y * Math.cos(a)] as Pt; });
  for (const g of GLYPH_LIST) {
    const pts = dense(g.pts), orders = Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => hausdorff(pts, turned(pts, 360 / n)) < 0.25);
    check(g.k === 0 || Math.max(...orders) === g.k, 'Orde simetri bentuk ' + g.id + ' tercatat ' + g.k + ' tetapi terukur ' + Math.max(...orders));
    const axes = Array.from({ length: 36 }, (_, i) => i * 5).filter((axis) => hausdorff(pts, reflected(pts, axis)) < 0.25);
    check(g.chiral ? axes.length === 0 : axes.includes(90), 'Kiralitas bentuk ' + g.id + ' tidak sesuai ukuran');
  }

  // 2. Aljabar gambar: putaran, cermin, dan pembanding putaran.
  const base = scene([mk('a', 'panah', 10, -20, { radius: 8, r: 30, f: 2 }), mk('b', 'siku', -18, 12, { radius: 9, r: 90 }), mk('c', 'bulan', 5, 25, { radius: 6, r: 200, f: 1 })]);
  for (const deg of [15, 45, 90, 135, 180, 225, 330]) {
    check(rotationBetween(base, rotateScene(base, deg)) === deg, 'Pembanding putaran harus menemukan sudut ' + deg);
    check(sameScene(rotateScene(rotateScene(base, deg), 360 - deg), base), 'Putaran dan kebalikannya harus kembali ke gambar semula');
  }
  check(sameScene(flipScene(flipScene(base)), base), 'Dua kali cermin harus kembali ke gambar semula');
  check(rotationBetween(base, flipScene(base)) === null, 'Bayangan cermin gambar kiral bukan putaran');
  check(sameScene(scene([mk('s', 'persegi', 0, 0, { radius: 10, r: 90 })]), scene([mk('t', 'persegi', 0, 0, { radius: 10 })])), 'Persegi diputar 90° tampak sama');
  check(!sameScene(scene([mk('s', 'panah', 0, 0, { radius: 10, r: 90 })]), scene([mk('t', 'panah', 0, 0, { radius: 10 })])), 'Panah diputar 90° tampak berbeda');
  check(diffScenes(base, nudge(base)).length === 1, 'Selisih satu warna harus tercatat satu kali');

  // 3. Perangkat hipotesis.
  const num = { kind: 'num' as const }, cat = { kind: 'cat' as const };
  check(distinct(fitSequence([1, 3, 5, 7, undefined], 4, num), num).length === 1 && distinct(fitSequence([1, 3, 5, 7, undefined], 4, num), num)[0].pred === 9, 'Deret aritmetika harus meramalkan 9');
  check(distinct(fitSequence(['a', 'b', 'a', 'b', undefined] as (string | undefined)[], 4, cat), cat)[0].pred === 'a', 'Deret berselang-seling harus meramalkan nilai awal');
  check(distinct(fitSequence([0, 90, undefined, 270, 0], 2, { kind: 'angle', mod: 360 }), { kind: 'angle', mod: 360 })[0].pred === 180, 'Kotak hilang di tengah harus bisa diramalkan');
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, undefined], count = { kind: 'count' as const };
  check(distinct(fitGrid(primes, 8, count), count).length === 1 && distinct(fitGrid(primes, 8, count), count)[0].pred === 23, 'Deret prima 3 × 3 harus meramalkan 23');
  check(distinct(fitGrid(['x', 'y', 'z', 'y', 'z', 'x', 'z', 'x', undefined] as (string | undefined)[], 8, cat), cat)[0].pred === 'y', 'Persegi Latin harus meramalkan nilai yang belum muncul');
  check(distinct(fitGrid([1, 2, 3, 2, 3, 4, 3, 4, undefined], 8, count), count).length === 1, 'Hipotesis yang sama-sama cocok boleh dipakai bila ramalannya sama');
  check(distinct(fitGrid([true, false, true, false, true, true, true, true, undefined], 8, { kind: 'bool' }), { kind: 'bool' }).length >= 1, 'Tumpukan harus menghasilkan ramalan');

  // 4. Tiap keluarga x tingkat x banyak seed: dibuktikan ulang oleh validator, tanpa kebocoran, dengan kontrol negatif.
  type Stat = { n: number; rules: number[]; parts: number[]; varying: number[]; singleEntity: number[]; ms: number[] };
  const SEEDS = 90, NEGATIVE = 18, stats: Record<string, Stat> = {};
  let audited = 0, controls = 0, mechanisms = new Set<string>(), generationMs = 0, auditMs = 0;
  const lettersInText = /\b(opsi|pilihan|gambar)\s+[A-E]\b/i;
  for (const family of FAMILIES) {
    const info = TIU_FAMILIES.find((f) => f.id === family)!;
    check(['mudah', 'sedang', 'sulit'].every((level) => info.levels.includes(level as Difficulty)), family + ' harus tersedia pada tingkat mudah, sedang, dan sulit');
    for (const level of LEVELS) {
      const bucket: Stat = { n: 0, rules: [], parts: [], varying: [], singleEntity: [], ms: [] };
      stats[family + '/' + level] = bucket;
      for (let seed = 0; seed < SEEDS; seed++) {
        const t0 = performance.now();
        const draft = makeTiu(info, level, rng('uji-figural|' + family + '|' + level + '|' + seed)), t1 = performance.now();
        const q = figural(draft, family, level, seed), errors = auditQuestion(q), t2 = performance.now();
        generationMs += t1 - t0; auditMs += t2 - t1; bucket.ms.push(t1 - t0); audited++; bucket.n++;
        check(!errors.length, family + '/' + level + '/' + seed + ': ' + errors.join('; '));
        const visual = q.visual!, kind = visual.kind;
        check(q.proof.kind === 'scene' && q.options.length === 5 && q.options.every((o) => o.scene && /^Gambar \d$/.test(o.text)), 'Opsi figural harus berupa lima gambar');
        check(STEMS[kind].includes(q.stem) && !LEAK.test(q.stem), family + ': kalimat soal harus baku dan tidak membocorkan aturan: ' + q.stem);
        check(!lettersInText.test(q.explanation + ' ' + q.options.map((o) => o.reason).join(' ')), family + ': pembahasan tidak boleh menyebut huruf opsi');
        check(new Set(q.options.map((o) => o.reason)).size === 5 && q.options.every((o) => o.reason.length > 40), family + ': alasan setiap opsi harus ada dan berbeda');
        check(q.explanation.length > 120 && visual.rule!.aturan.length > 0, family + ': pembahasan harus menguraikan aturan');
        const svg = questionSvg(q, true), problem = wellFormed(svg);
        check(!problem, family + ': SVG tidak sah: ' + problem);
        check(!/rotasi|putar|aturan|cermin|derajat|searah|ganjil|genap/i.test(svg + q.options.map(optionSvg).join('')), family + ': gambar tidak boleh memuat kata aturan');
        check(q.options.every((o) => !wellFormed(optionSvg(o))), family + ': SVG opsi harus sah');
        mechanisms.add(visual.rule!.mekanisme);
        bucket.rules.push(visual.rule!.aturan.length);
        const shown = [...(visual.scenes ?? []).filter(Boolean), ...q.options.map((o) => o.scene)] as Scene[];
        bucket.parts.push(mean(shown.map((s) => s.parts.length)));
        const key = q.options[q.answer].scene!;
        if (kind !== 'ketidaksamaan') {
          q.options.forEach((option, i) => {
            if (i === q.answer) return;
            check(!sameScene(option.scene!, key), family + ': pengecoh tidak boleh sama dengan kunci');
            check(/^Gambar ini berbeda dari gambar yang benar: .+/.test(option.reason), family + ': alasan pengecoh harus menyebut selisih konkret: ' + option.reason);
          });
        }
        if (kind === 'serial' || kind === 'matriks') {
          const cells = visual.scenes!, hidden = cells.findIndex((s) => s === null), inferred = inferHidden(cells, hidden, kind === 'serial' ? 'seq' : 'grid');
          bucket.varying.push(inferred.varying);
          const entities = q.options.flatMap((option, i) => i === q.answer ? [] : [new Set(matchPrediction(readScene(option.scene!), inferred.pred).map((m) => m.split(' ')[0]))]);
          entities.forEach((set) => bucket.singleEntity.push(set.size));
        } else if (kind === 'analogi') {
          const [a, b] = visual.scenes!; bucket.varying.push(explain(a!, b!)[0].n);
        } else {
          bucket.varying.push(visual.rule!.mekanisme === 'ketidaksamaan-urutan' ? q.options[0].scene!.parts.filter((p) => p.id.startsWith('obj')).length : 0);
        }
        if (seed < NEGATIVE) for (const control of tamper(q)) {
          controls++;
          check(auditQuestion(control.q).length > 0, family + '/' + level + ': validator harus menolak "' + control.name + '"');
        }
      }
    }
  }
  report.figuralQuestions = audited; report.negativeControls = controls; report.mechanisms = [...mechanisms].sort();
  report.msPerQuestion = { generation: Math.round(generationMs / audited * 100) / 100, audit: Math.round(auditMs / audited * 100) / 100 };
  check(generationMs / audited < 25, 'Penyusunan satu soal figural harus cukup cepat (rata-rata ' + Math.round(generationMs / audited) + ' ms)');

  // 5. Tingkat kesulitan benar-benar berbeda kerumitannya.
  const level = (family: string, name: Difficulty) => stats[family + '/' + name];
  const summary: Record<string, unknown> = {};
  for (const family of ['fig-analogi', 'fig-serial', 'fig-matrix'] as const) {
    const [easy, middle, hard, hots] = LEVELS.map((name) => mean(level(family, name).varying));
    summary[family] = { varying: [easy, middle, hard, hots].map((v) => Math.round(v * 100) / 100), parts: LEVELS.map((name) => Math.round(mean(level(family, name).parts) * 10) / 10) };
    check(easy + 0.2 < middle && middle + 0.2 < hard && hots >= hard - 0.05, family + ': kerumitan terukur harus naik pada setiap tingkat (' + [easy, middle, hard, hots].map((v) => v.toFixed(2)).join(' < ') + ')');
  }
  for (const family of ['fig-serial', 'fig-matrix'] as const) for (const name of ['sulit', 'hots'] as Difficulty[]) {
    check(Math.max(...level(family, name).singleEntity) <= 1, family + '/' + name + ': setiap pengecoh sulit hanya berbeda pada satu bagian dari jawaban');
  }
  const oddParts = LEVELS.slice(0, 3).map((name) => mean(level('fig-odd', name).parts));
  check(oddParts[0] < oddParts[2] + 3, 'Gambar ketidaksamaan harus tersusun dari bagian yang wajar banyaknya');
  report.difficulty = summary;

  // 6. Determinisme per seed, termasuk lewat generate().
  for (const family of FAMILIES) for (const name of LEVELS) {
    const info = TIU_FAMILIES.find((f) => f.id === family)!;
    for (let seed = 0; seed < 4; seed++) assert.deepEqual(makeTiu(info, name, rng('det|' + family + '|' + seed)), makeTiu(info, name, rng('det|' + family + '|' + seed))); check(true, 'deterministik');
  }
  const settings = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], count: 24, packages: 3, seed: 'FIG-DET', difficulty: 'campuran' });
  assert.deepEqual(generate(settings), generate(settings)); check(true, 'paket figural deterministik');

  // 7. Tidak ada soal kembar dalam satu paket maupun antarpaket; sebaran huruf kunci merata.
  const unique = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], count: 24, packages: 10, seed: 'FIG-UNIK', uniqueAcross: true });
  const packs: Package[] = generate(unique), audit = auditPackages(packs, unique);
  check(audit.ok && audit.duplicateCount === 0, 'Paket figural harus lulus audit tanpa soal kembar: ' + audit.errors.slice(0, 2).join('; '));
  const prints = packs.flatMap((p) => p.questions.map(fingerprint));
  check(packs.every((p) => p.questions.every((q) => q.options.every((o, i) => o.text === 'Gambar ' + String.fromCharCode(65 + i)))), 'Opsi bergambar harus bernama menurut hurufnya setelah diacak');
  check(new Set(prints).size === prints.length && prints.length === 240, 'Seluruh 240 soal figural pada sepuluh paket harus berbeda');
  const chi = (() => { const n = audit.keyDistribution.reduce((a, b) => a + b, 0), e = n / 5; return audit.keyDistribution.reduce((sum, o) => sum + (o - e) ** 2 / e, 0); })();
  check(chi < 13.28, 'Sebaran huruf kunci harus merata (χ² = ' + chi.toFixed(2) + ')');
  report.packages = { questions: prints.length, chiSquareKey: Math.round(chi * 100) / 100 };
  for (const name of ['mudah', 'sedang', 'sulit'] as const) {
    const pack = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], count: 16, packages: 3, seed: 'FIG-' + name, difficulty: name, uniqueAcross: true });
    const result = generate(pack); check(auditPackages(result, pack).ok && result.every((p) => p.questions.every((q) => q.difficulty === name && q.topic === 'Figural')), 'Paket figural tingkat ' + name + ' harus lulus audit');
  }
  for (const [key, subtopic] of [['fig-analogi', 'Analogi'], ['fig-odd', 'Ketidaksamaan'], ['fig-serial', 'Serial'], ['fig-matrix', 'Matriks 3 × 3']]) {
    const pack = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], subtopics: ['Figural::' + subtopic], count: 6, seed: 'SUB-' + key });
    const result = generate(pack); check(auditPackages(result, pack).ok && result[0].questions.every((q) => q.family === key), 'Submateri ' + subtopic + ' harus menghasilkan keluarga ' + key);
  }

  // 8. Kartu soal dan lembar pilot: tampilan memuat gambar stimulus dan kelima opsi.
  const sample = packs[0].questions.filter((q) => q.visual);
  for (const q of sample.slice(0, 12)) {
    const html = renderToStaticMarkup(createElement(QuestionCard, { question: q, showAnswers: true }));
    const svgCount = (html.match(/<svg xmlns=/g) ?? []).length, expected = 5 + (hasStimulus(q) ? 1 : 0);
    check(svgCount === expected && !/NaN|undefined/.test(html), 'Kartu soal figural harus menggambar ' + expected + ' SVG, bukan ' + svgCount);
    check(html.includes('Jawaban ' + String.fromCharCode(65 + q.answer)), 'Kartu soal harus menampilkan kunci jawaban');
    const hidden = renderToStaticMarkup(createElement(QuestionCard, { question: q, showAnswers: false, hideExplanation: true }));
    check(!hidden.includes(q.explanation.slice(0, 60)) && !hidden.includes(q.options[0].reason.slice(0, 60)), 'Kartu untuk peserta tidak boleh memuat pembahasan');
  }

  // 9. Ekspor Word dan PDF memakai gambar figural yang dirasterkan.
  installBrowserStub();
  const settingsExport = normalizeSettings({ ...DEFAULT_SETTINGS, mode: 'TIU', topics: ['Figural'], count: 12, packages: 2, seed: 'FIG-EKSPOR' });
  const exportPacks = generate(settingsExport), figuralCount = exportPacks.flatMap((p) => p.questions).filter((q) => q.visual).length;
  const word = new Uint8Array(await (await wordBlob(exportPacks, settingsExport, 'pembahasan')).arrayBuffer()), parts = unzipSync(word);
  const media = Object.keys(parts).filter((name) => name.startsWith('word/media/') && name.endsWith('.png'));
  check(media.length === figuralCount && media.every((name) => parts[name][0] === 137 && parts[name][1] === 80), 'Word: setiap soal figural harus memuat satu gambar PNG (' + media.length + ' dari ' + figuralCount + ')');
  const documentXml = new TextDecoder().decode(parts['word/document.xml']);
  check(documentXml.includes('Soal figural') && documentXml.includes('Jawaban:') && !documentXml.includes('undefined'), 'Word: dokumen harus memuat teks soal dan pembahasan');
  const pdf = Buffer.from(await (await pdfBlob(exportPacks, settingsExport, 'soal')).arrayBuffer()).toString('latin1');
  check(pdf.startsWith('%PDF-') && (pdf.match(/\/Type\s*\/Page[^s]/g) ?? []).length >= 2, 'PDF: berkas harus sah dan berhalaman');
  check(new Uint8Array(await (await wordBlob(exportPacks, settingsExport, 'kunci')).arrayBuffer()).length > 1000 && !Object.keys(unzipSync(new Uint8Array(await (await wordBlob(exportPacks, settingsExport, 'kunci')).arrayBuffer()))).some((name) => name.startsWith('word/media/') && name.endsWith('.png')), 'Word kunci jawaban tidak memuat gambar');
  report.export = { figuralInWord: media.length, pdfBytes: pdf.length };
  try {
    // sharp hanya dipakai bila ada (dependensi opsional bawaan Next.js); nama modul dibuat dinamis agar tipe-nya tidak diwajibkan saat typecheck.
    const sharpName = 'sharp', sharp = (await import(sharpName)).default as (input: Buffer, options: { density: number }) => { flatten(o: { background: string }): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Uint8Array; info: { width: number } }> } } };
    for (const q of sample.slice(0, 8)) {
      const { data, info } = await sharp(Buffer.from(questionSvg(q, true)), { density: 96 }).flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
      const ink = data.reduce((n, v) => n + (v < 90 ? 1 : 0), 0);
      check(info.width > 300 && ink > 400 && ink < data.length * 0.5, 'SVG soal figural harus terender dan berisi gambar (tinta ' + ink + ')');
    }
    report.rasterized = 'sharp';
  } catch { report.rasterized = 'dilewati (sharp tidak tersedia)'; }

  // 10. Perubahan gambar harus mengubah identitas isi soal pada lembar pilot.
  const pilotBase = sample[0], pilotChanged = clone(pilotBase); pilotChanged.options[1].scene = nudge(pilotChanged.options[1].scene!);
  check(contentHash(pilotBase) !== contentHash(pilotChanged), 'Jawaban peserta pilot pada gambar lama tidak boleh dicampur dengan gambar yang sudah berubah');

  // 11. Kompatibilitas: soal figural versi lama (Figure) tetap terbaca dan terverifikasi.
  const f = (shape: Figure['shape'], angle: number, countDots: number, fill: number): Figure => ({ shape, angle, count: countDots, fill });
  const legacy: Question = { id: 'lama', no: 1, subtest: 'TIU', topic: 'Figural', subtopic: 'Analogi', difficulty: 'sedang', family: 'fig-analogi', stem: 'Hubungan gambar 1 terhadap gambar 2 diterapkan pada gambar 3.',
    options: [f('square', 135, 2, 0), f('square', 135, 3, 0), f('circle', 135, 2, 0), f('square', 90, 2, 0), f('square', 135, 2, 1)].map((figure, i) => ({ text: 'Gambar ' + (i + 1), score: i === 0 ? 5 : 0, reason: 'Alasan ' + i, figure })),
    answer: 0, explanation: 'Pembahasan lama.', source: 'uji', origin: 'pola', visual: { kind: 'analogi', columns: 4, figures: [f('square', 0, 1, 0), f('circle', 90, 2, 1), f('triangle', 45, 1, 2), null] }, proof: { kind: 'figure', answer: f('square', 135, 2, 0) } };
  check(solveFigure(legacy) === 0 && auditQuestion(legacy).length === 0, 'Soal figural lama harus tetap lolos audit');
  check(hasStimulus(legacy) && !wellFormed(questionSvg(legacy)) && questionSvg(legacy).includes('rotate('), 'Soal figural lama harus tetap digambar');
  const brokenLegacy = clone(legacy); brokenLegacy.options[0].figure!.count += 1;
  check(auditQuestion(brokenLegacy).length > 0, 'Soal figural lama yang dirusak tetap ditolak');
  return report;
}
