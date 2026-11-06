import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VIDEO, videoQuestions, videoSections, videoTiming, slideAtFrame, videoTime, type VideoSlide } from '../lib/video-plan';
import { diagramResult } from '../lib/diagram';
import type { Workspace } from '../lib/types';
import { generate } from '../lib/generate';
import { DEFAULT_SETTINGS } from '../lib/config';
import { createWorkspace } from '../lib/quality';

const workspace = JSON.parse(fs.readFileSync('test-results/academic-fixture.json', 'utf8')) as Workspace;
const questions = workspace.result.packages[0].questions;
let checks = 0;
const check = (value: unknown, label: string) => { assert.ok(value, label); checks++; };
for (const q of questions) {
  const original = JSON.stringify(q), plan = videoSections({ ...q, source: 'SECRET-SOURCE', explanation: q.explanation + '\nSumber: SECRET-SOURCE' });
  check(JSON.stringify(q) === original, 'Question data is not changed');
  check(!JSON.stringify(plan).includes('SECRET-SOURCE'), 'No source metadata in video');
  check(plan.map(p => p.stage).slice(0, 4).join() === 'soal,pilihan,jawaban,pembahasan', 'Answer revealed only after question and choices');
  const answer = plan.find(p => p.stage === 'jawaban')!;
  check(JSON.stringify(answer).includes('Jawaban: ' + String.fromCharCode(65 + q.answer)), 'Saved answer letter, not recalculated');
  if (q.subtest === 'TKP') {
    const table = answer.blocks.find(b => b.kind === 'table');
    check(table?.kind === 'table' && table.rows[0].join() === q.options.map(o => o.score + ' poin').join(), 'All TKP scores follow current option order');
  }
  for (const block of plan.flatMap(p => p.blocks)) {
    if (block.kind === 'diagram') check('svg' in diagramResult(block.block), 'Existing academic diagram stays renderable');
    if (block.kind === 'svg') check(block.svg.includes('<svg'), 'Figural question/answer is not omitted');
  }
}
// Opsi salah tercoret hanya pada analisis opsi Silogisme Narasi (Silogisme Biasa berakhir pada jawaban kalimat).
const silogism = videoSections(questions.find((q) => q.explanation.includes('**Analisis setiap opsi**')) ?? questions[0]);
check(JSON.stringify(silogism).includes('~~') && JSON.stringify(silogism).includes('**'), 'Keep academic strike and bold markup until rasterization');
check(JSON.stringify(videoSections(questions[4])).includes('merah'), 'Keep academic color markup');
const excluded = { ...questions[0], review: { status: 'draft' as const, excluded: true, note: '', revision: 1, updatedAt: '' } };
const all = [excluded, ...questions.slice(1)], picked = new Set([questions[3].id, questions[1].id, questions[0].id]);
check(videoQuestions(all, excluded.id, picked, 'current').length === 0, 'Excluded current question cannot be exported');
assert.deepEqual(videoQuestions(all, excluded.id, picked, 'selected').map(q => q.id), [questions[1].id, questions[3].id]); checks++;
check(videoQuestions(all, excluded.id, picked, 'package').length === all.length - 1, 'Full package filters exclusions');
check(videoQuestions(all, excluded.id, new Set(), 'selected').length === 0, 'Empty selection does not fall back to package');
const slides = ['soal', 'pilihan', 'jawaban', 'pembahasan'].map((stage, i) => ({ src: 'blob:test', questionId: 'test', questionNo: 1,
  subtest: 'TIU', stage, page: 1, pages: 1, words: i === 3 ? 150 : 10, hasDiagram: false, think: stage === 'pilihan', from: 0, durationInFrames: 0 })) as VideoSlide[];
const normal = videoTiming(slides, 'normal', 5), slow = videoTiming(slides, 'slow', 5), fast = videoTiming(slides, 'fast', 0);
check(slow.durationInFrames > normal.durationInFrames && normal.durationInFrames > fast.durationInFrames, 'Reading speed changes duration');
check(normal.slides[1].durationInFrames - videoTiming(slides, 'normal', 0).slides[1].durationInFrames === 5 * VIDEO.fps, 'Thinking time holds the last choices screen');
check(normal.durationInFrames === normal.slides.reduce((n, s) => n + s.durationInFrames, 0), 'Timeline has no dropped frames');
for (const s of normal.slides) {
  check(Number.isInteger(s.durationInFrames) && s.durationInFrames >= 5 * VIDEO.fps, 'Readable positive scene duration');
  check(slideAtFrame(normal.slides, s.from) === s && slideAtFrame(normal.slides, s.from + s.durationInFrames - 1) === s, 'Scene boundaries never reveal the answer early');
}
check(videoTime(3661) === '1:01:01' && videoTime(59.9) === '1:00', 'Duration supports long packages');
check(slides.every(s => s.durationInFrames === 0), 'Retiming does not mutate prepared assets');
fs.writeFileSync('test-results/video-checks.json', JSON.stringify({ status: 'PASS', checks, questions: questions.length }, null, 2));
const settings = { ...DEFAULT_SETTINGS, seed: 'VIDEO-FULL-QC', mode: 'SKD' as const, count: 110, packages: 1, tiuSource: 'variation' as const };
const packages = generate(settings);
fs.writeFileSync('test-results/video-full-fixture.json', JSON.stringify(createWorkspace({ settings, packages, elapsed: 0,
  audit: { ok: true, checked: 110, errors: [], duplicateCount: 0, keyDistribution: [0, 0, 0, 0, 0] } })));
console.log(JSON.stringify({ status: 'PASS', checks, questions: questions.length }));
