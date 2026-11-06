import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorkspace } from '../lib/quality';
import { DEFAULT_SETTINGS } from '../lib/config';
import { VARY_ROWS } from '../lib/tryout-profile';
import { questionBlocks } from '../lib/export';
import assets from '../data/tryout-images.json';
import sourceFormat from '../data/tryout-format.json';
import rawBank from '../data/tryout-reference.json';
import { academicText } from '../lib/academic-format';
import { BANK } from '../lib/bank';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { makeMappedTiu } from '../lib/tryout-patterns';
import { MAPPING_ROWS } from '../lib/mapping';
import { rng } from '../lib/rng';
import { documentExplanation, explanationTexts, parseExplanation } from '../lib/explanation';
import { mark, richRuns, stripMarks } from '../lib/richtext';
import { mathParts, mathSvg } from '../lib/math';
import { diagramResult, isDiagramBlock } from '../lib/diagram';
import type { Difficulty, Question } from '../lib/types';

const samples: { group: string; question: Question }[] = [];
const add = (group: string, q: Omit<Question, 'no' | 'id'>, id: string) => samples.push({ group, question: { ...q, id, no: samples.length + 1 } });
for (const item of BANK.filter(q => q.subtest === 'TIU')) add('bank:' + item.provenance?.file, { ...item, family: item.id, origin: 'referensi', proof: { kind: 'manual', note: 'Bank sumber' } }, item.id);
for (const family of TIU_FAMILIES) for (const level of family.levels) for (let seed = 0; seed < 32; seed++) add('generator:' + family.id, makeTiu(family, level, rng(`tiu-academic|${family.id}|${level}|${seed}`)), `${family.id}-${level}-${seed}`);
// Other mapping rows use the ordinary families (covered above) or accepted bank.
const mappedRows = VARY_ROWS;
for (const row of MAPPING_ROWS.filter(row => row.subtest === 'TIU' && mappedRows.includes(row.row))) for (const level of ['mudah', 'sedang', 'sulit'] as Difficulty[]) for (let seed = 0; seed < 16; seed++) {
  add('mapping:' + row.row, makeMappedTiu(row, level, rng(`tiu-academic|${row.row}|${level}|${seed}`)), `mapping-${row.row}-${level}-${seed}`);
}
const groups: Record<string, { total: number; plain: number; bold: number; table: number; image: number; color: number; strike: number }> = {};
const issues: { id: string; kind: string; detail: string }[] = [], checkedMath = new Set<string>();
const representatives = new Map<string, Question>(), unsupported = new Set<string>();
for (const { group, question: q } of samples) {
  const text = documentExplanation(q), blocks = parseExplanation(text) ?? [], runs = richRuns(text);
  const stats = groups[group] ??= { total: 0, plain: 0, bold: 0, table: 0, image: 0, color: 0, strike: 0 };
  stats.total++; if (!blocks.length) stats.plain++;
  if (runs.some(run => run.bold) || blocks.some(b => b.k === 'heading')) stats.bold++;
  if (runs.some(run => run.color)) stats.color++;
  if (runs.some(run => run.strike)) stats.strike++;
  if (blocks.some(b => b.k === 'table')) stats.table++;
  if (blocks.some(isDiagramBlock)) stats.image++;
  if (!text.trim()) issues.push({ id: q.id, kind: 'empty', detail: group });
  for (const block of blocks.filter(isDiagramBlock)) { const result = diagramResult(block); if ('error' in result) issues.push({ id: q.id, kind: 'image', detail: result.error }); }
  for (const piece of explanationTexts(text)) for (const run of richRuns(piece)) for (const part of mathParts(run.text)) {
    if (part.kind === 'text') for (const c of part.value) if (c.codePointAt(0)! > 255 && !'‘’“”–—…•'.includes(c)) unsupported.add(c);
    if (part.kind === 'math' && !checkedMath.has(part.value)) { checkedMath.add(part.value); try { mathSvg(part.value, run); } catch (error) { issues.push({ id: q.id, kind: 'math', detail: String(error) }); } }
  }
  for (const b of questionBlocks(q, 'pembahasan', null).tail) if (b.kind === 'text' || b.kind === 'table') assert.equal(b.size, 12, q.id + ': font pembahasan 12 pt');
  if (['setara','pernyataan-tabel','cerita'].includes(q.family) || ['mapping:25','mapping:26'].includes(group)) assert.ok(blocks.some(b => b.k === 'table'), q.id + ': langkah perhitungan tiap opsi/pernyataan');
  if (q.family === 'matriks-angka') assert.ok(text.includes('Menentukan pengali') && text.includes('aligned'), q.id + ': pengali dan hitungan bertahap');
  // One representative of every structural subtype, not just one per family.
  const structure = group + '|' + q.difficulty + '|' + [...new Set(blocks.map(b => b.k === 'guide' ? 'guide:' + b.id : b.k))].sort().join(',') + '|' + runs.some(run => run.color) + '|' + runs.some(run => run.strike) + '|' + runs.some(run => run.bold);
  if (group.startsWith('bank:') || !representatives.has(structure)) representatives.set(group.startsWith('bank:') ? q.id : structure, q);
}
for (const image of Object.values(assets)) assert.equal(createHash('sha256').update(fs.readFileSync('public' + image.url)).digest('hex'), image.sha256, 'Original media bytes');
let imagePlacements = 0;
for (const q of rawBank.filter(q => q.subtest === 'TIU')) {
  const format = sourceFormat[(q.provenance.file + '|' + q.provenance.question) as keyof typeof sourceFormat];
  const restored = academicText(q, q.explanation);
  assert.equal(academicText(q, restored), restored, q.id + ': idempotent saved workspace');
  for (const image of format.images) { assert.ok(restored.includes('@acuan ' + image.id), q.id + ': source image restored'); imagePlacements++; }
}
assert.deepEqual(richRuns('𝟐𝟒'), [{ text: '24', bold: true }]);
assert.deepEqual(richRuns('0̶0̶'), [{ text: '00', strike: true }]);
assert.equal(stripMarks(mark.bold('**Header** {merah:angka}')), 'Header angka', 'No nested bold markers');
assert.ok(mathParts('x^(2)=121').some(p=>p.kind==='math'&&p.value.includes('x^{2}')), 'Word exponent notation must become a real superscript');
assert.ok(mathParts('(Premis 2 + 3):').some(p=>p.kind==='text'&&p.value==='):'), 'Prose closing parenthesis stays outside math');
for (const variable of ['p','q','r']) assert.ok(mathParts(variable+': proposisi').some(p=>p.kind==='math'&&p.value===variable), 'Source logic variables use LaTeX');
const questions = [...representatives.values()].map((q,i) => ({ ...q, no:i+1 }));
const settings = { ...DEFAULT_SETTINGS, title: 'QC seluruh pembahasan TIU', mode: 'TIU' as const, count: questions.length, packages:1 };
const result = { settings, packages: [{id:'QC-TIU',seed:'tiu-academic-audit',mode:'TIU' as const,duration:100,questions}], audit:{ok:true,checked:questions.length,errors:[],duplicateCount:0,keyDistribution:[0,0,0,0,0]},elapsed:0 };
fs.writeFileSync('test-results/tiu-academic-fixture.json', JSON.stringify(createWorkspace(result)));
fs.writeFileSync('test-results/tiu-academic-audit.json', JSON.stringify({ samples: samples.length, formulas: checkedMath.size, groups, issues, unsupported:[...unsupported], imagePlacements, representatives: questions }, null, 2));
console.log(JSON.stringify({ samples: samples.length, formulas: checkedMath.size, groups, issues, unsupported:[...unsupported], imagePlacements, representatives: representatives.size }, null, 2));
assert.deepEqual(issues, [], 'Every audited formula and diagram must render');
assert.deepEqual([...unsupported], [], 'No unsupported Unicode prose in PDF');
