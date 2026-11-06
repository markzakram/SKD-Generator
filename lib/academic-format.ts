import sourceFormat from '@/data/tryout-format.json';
import { mark, richRuns } from './richtext';

type SourceQuestion = { provenance?: { file: string; question: number; sourceHash?: string } };
type SourceFormat = { sourceHash: string; paragraphs: Record<string, string>; tables: { text: string; rich: string }[]; images?: { after: string; id: string }[] };
const formats: Record<string, SourceFormat> = sourceFormat;
const marked = (run: ReturnType<typeof richRuns>[number]) => {
  let text = run.text;
  if (run.strike) text = mark.strike(text);
  if (run.bold) text = mark.bold(text);
  if (run.color) text = '{' + run.color + ':' + text + '}';
  return text;
};

// Restore formatting from the supplied Word files at display/export time, so
// existing workspaces benefit too. Exact matches only: edited wording survives.
export function academicText(q: SourceQuestion, text: string): string {
  const provenance = q.provenance;
  const format = provenance && formats[provenance.file + '|' + provenance.question];
  if (!format || provenance?.sourceHash && provenance.sourceHash !== format.sourceHash) return text;
  let result = text.replace(/\r\n?/g, '\n');
  // Only explanations contain these anchors. Prepend images only to the actual
  // original opening, never to short option reasons or edited paragraphs.
  for (const image of format.images ?? []) {
    const marker = '@acuan ' + image.id;
    if (result.includes(marker)) continue;
    if (image.after) {
      for (const anchor of [image.after, format.paragraphs[image.after]].filter(Boolean)) {
        const wrapped = '\n' + result + '\n', needle = '\n' + anchor + '\n';
        if (wrapped.includes(needle)) { result = wrapped.replace(needle, needle + marker + '\n').slice(1, -1); break; }
      }
    } else if (/^[↑↓].*artinya \d+ towew/.test(result)) result = marker + '\n' + result;
  }
  for (const table of format.tables) {
    // Block boundaries prevent replacing a few cells inside an already styled table.
    result = ('\n' + result + '\n').replaceAll('\n' + table.text + '\n', '\n' + table.rich + '\n').slice(1, -1);
  }
  return result.split('\n').map(line => {
    const exact = format.paragraphs[line.trim()];
    if (exact) return exact;
    // The old importer removed A./Opsi A from option explanations.
    for (const [original, rich] of Object.entries(format.paragraphs)) {
      if (!line.trim() || !original.endsWith(line.trim())) continue;
      const count = original.length - line.trim().length;
      if (!/^(?:Opsi\s+)?[A-E](?:\s*\(\d\s*poin\))?[.:]?\s+$/i.test(original.slice(0, count))) continue;
      let remaining = count;
      return richRuns(rich).map(run => {
        const remove = Math.min(remaining, run.text.length); remaining -= remove;
        return marked({ ...run, text: run.text.slice(remove) });
      }).join('');
    }
    return line;
  }).join('\n');
}
