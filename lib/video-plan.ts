import { explanationBlocks, letter, reasonLines, type Block } from './export';
import { documentExplanation } from './explanation';
import { separateTip } from './pembahasan';
import { hasStimulus, optionSvg, questionSvg } from './figures';
import { questionTable } from './table';
import { plainMath } from './math';
import { stripMarks } from './richtext';
import type { Question, Subtest } from './types';

export const VIDEO = { width: 1280, height: 720, fps: 24, x: 72, y: 174, contentWidth: 1136, contentHeight: 454 } as const;
export type VideoScope = 'current' | 'selected' | 'package';
export type VideoPace = 'normal' | 'slow' | 'fast';
export type VideoStage = 'soal' | 'pilihan' | 'jawaban' | 'pembahasan' | 'tip';
export const STAGE_LABEL: Record<VideoStage, string> = { soal: 'Pahami soal', pilihan: 'Tentukan pilihan', jawaban: 'Jawaban', pembahasan: 'Pembahasan', tip: 'Cara cepat' };
export type VideoBlock = Block | { kind: 'svg'; svg: string; gap: number };
export type VideoSection = { stage: VideoStage; blocks: VideoBlock[] };
export type VideoSlide = {
  src: string; questionId: string; questionNo: number; subtest: Subtest; stage: VideoStage;
  page: number; pages: number; words: number; hasDiagram: boolean; think: boolean;
  from: number; durationInFrames: number;
};
export type VideoProject = { slides: VideoSlide[]; durationInFrames: number; questionCount: number };
export type VideoProps = { project: VideoProject };

// Selection follows package order, never selection-click order. Excluded questions never reappear in a video.
export function videoQuestions(all: Question[], currentId: string, selected: ReadonlySet<string>, scope: VideoScope) {
  return all.filter(q => !q.review?.excluded && (scope === 'package' || (scope === 'current' ? q.id === currentId : selected.has(q.id))));
}
const text = (value: string, bold = false): Block => ({ kind: 'text', text: value, bold, size: 12, gap: 3 });

// Use the saved answer/options/academic explanation as-is. No AI, new inference, or hidden source/provenance labels.
export function videoSections(q: Question): VideoSection[] {
  const stem: VideoBlock[] = [text(q.stem)], table = questionTable(q);
  if (table) stem.push({ kind: 'table', ...table, size: 12, gap: 3 });
  if (hasStimulus(q)) stem.push({ kind: 'svg', svg: questionSvg(q, false), gap: 3 });
  const hasImages = q.options.some(o => optionSvg(o));
  const options: VideoBlock[] = hasImages ? [{ kind: 'svg', svg: questionSvg(q, true, false), gap: 3 }] : q.options.map((o, i) => text(`**${letter(i)}.** ${o.text}`));
  const answer: VideoBlock[] = [text(`Jawaban: ${letter(q.answer)}${q.subtest === 'TKP' ? ` (${q.options[q.answer].score} poin)` : ''}`, true)];
  const svg = optionSvg(q.options[q.answer]);
  if (svg) answer.push({ kind: 'svg', svg, gap: 3 });
  else answer.push(text(q.options[q.answer].text));
  if (q.subtest === 'TKP') {
    answer.push(text('Poin setiap pilihan', true));
    answer.push({ kind: 'table', headers: q.options.map((_, i) => letter(i)), rows: [q.options.map(o => String(o.score) + ' poin')], size: 12, gap: 3 });
  }
  return [
    { stage: 'soal', blocks: stem }, { stage: 'pilihan', blocks: options }, { stage: 'jawaban', blocks: answer },
    { stage: 'pembahasan', blocks: [...explanationBlocks(documentExplanation(q)), ...reasonLines(q).map(line => text(line))] },
    ...(separateTip(q) ? [{ stage: 'tip' as const, blocks: [text(separateTip(q)!)] }] : []), // TWK/TKP: cara cepat sudah ada di pembahasan rakitan
  ];
}
export const videoWords = (value: string) => plainMath(stripMarks(value)).trim().split(/\s+/).filter(Boolean).length;
export function videoTiming(slides: VideoSlide[], pace: VideoPace, thinkSeconds: number): VideoProject {
  const wordsPerSecond = { normal: 2.6, slow: 1.9, fast: 3.5 }[pace];
  let from = 0;
  const timed = slides.map(slide => {
    const seconds = Math.max(5, slide.words / wordsPerSecond + 2, slide.hasDiagram ? 10 : 0) + (slide.think ? thinkSeconds : 0);
    const durationInFrames = Math.ceil(seconds * VIDEO.fps);
    const next = { ...slide, from, durationInFrames }; from += durationInFrames; return next;
  });
  return { slides: timed, durationInFrames: from, questionCount: new Set(slides.map(s => s.questionId)).size };
}
export function slideAtFrame(slides: VideoSlide[], frame: number) {
  let low = 0, high = slides.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (slides[mid].from <= frame) low = mid; else high = mid - 1; }
  return slides[low];
}
export function videoTime(seconds: number) {
  const n = Math.ceil(seconds), h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, s = n % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
}
