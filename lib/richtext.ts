// Penanda format sebaris pada teks pembahasan (dan teks lain yang dirender lewat lib/explanation.ts). Satu aturan untuk semua keluaran
// (layar, PDF dan PNG, Word, salinan HTML, teks polos, CSV), jadi penanda baru cukup ditambahkan di sini:
//   **teks**          tebal
//   ~~teks~~          coret (opsi yang salah pada analisis opsi silogisme)
//   {merah:teks}      warna panduan, dibawa ke HTML, Word, PDF/PNG, dan salinan.
// Penanda boleh bersarang (`**~~teks~~**`). Rumus eksplisit (`\( \)`, `\[ \]`, `$$ $$`) tidak dibaca sebagai penanda, dan penanda tanpa pasangan
// tetap menjadi teks biasa. Teks tanpa penanda menghasilkan satu Run tanpa gaya, sama dengan perilaku sebelum penanda ada.
export type Run = { text: string; bold?: boolean; strike?: boolean; color?: string };
export const COLORS = ['merah', 'biru', 'hijau', 'oranye', 'ungu', 'abu'] as const;
export const COLORS_RENDERED = true;
export const COLOR_HEX: Record<string, string> = { merah: 'FF0000', biru: '0070C0', hijau: '00B050', oranye: 'ED7D31', ungu: '7030A0', abu: '808080' };
const MATH_PAIRS: [string, string][] = [['\\(', '\\)'], ['\\[', '\\]'], ['$$', '$$']];

// Indeks akhir (setelah penutup) rumus eksplisit yang dimulai di `at`, atau -1 bila `at` bukan awal rumus yang tertutup.
function mathEnd(text: string, at: number): number {
  for (const [open, close] of MATH_PAIRS) {
    if (!text.startsWith(open, at)) continue;
    const end = text.indexOf(close, at + open.length);
    if (end >= 0) return end + close.length;
  }
  return -1;
}
// Indeks penutup `marker` berikutnya mulai dari `from` (rumus dilewati), atau -1.
function findMarker(text: string, marker: string, from: number): number {
  for (let i = from; i < text.length;) {
    const end = mathEnd(text, i);
    if (end >= 0) { i = end; continue; }
    if (text.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}
// Indeks "}" yang menutup kurung buka pada `open` (kurung bersarang dan rumus dilewati), atau -1.
function findBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length;) {
    const end = mathEnd(text, i);
    if (end >= 0) { i = end; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
    i++;
  }
  return -1;
}
const COLOR_OPEN = new RegExp('^\\{(' + COLORS.join('|') + '):');

const same = (a: Run, b: Run) => !!a.bold === !!b.bold && !!a.strike === !!b.strike && a.color === b.color;
function parse(text: string, style: Omit<Run, 'text'>, out: Run[]): void {
  let buffer = '';
  const flush = () => { if (buffer) { const run: Run = { text: buffer, ...style }; const last = out[out.length - 1]; if (last && same(last, run)) last.text += buffer; else out.push(run); buffer = ''; } };
  for (let i = 0; i < text.length;) {
    const end = mathEnd(text, i);
    if (end >= 0) { buffer += text.slice(i, end); i = end; continue; }
    // Source Word files sometimes encode emphasis as mathematical bold digits
    // or a combining strike. Convert these to real runs, supported by all fonts.
    const code = text.codePointAt(i)!, char = String.fromCodePoint(code), next = i + char.length;
    const unicodeBold = code >= 0x1D400 && code <= 0x1D433 || code >= 0x1D7CE && code <= 0x1D7D7;
    const unicodeStrike = text[next] === '\u0336';
    if (unicodeBold || unicodeStrike) {
      flush(); parse(unicodeBold ? char.normalize('NFKD') : char, { ...style, ...(unicodeBold ? { bold: true } : {}), ...(unicodeStrike ? { strike: true } : {}) }, out);
      i = next + (unicodeStrike ? 1 : 0); continue;
    }
    const marker = text.startsWith('**', i) ? '**' : text.startsWith('~~', i) ? '~~' : '';
    if (marker) {
      const close = findMarker(text, marker, i + 2);
      if (close > i + 2) { flush(); parse(text.slice(i + 2, close), marker === '**' ? { ...style, bold: true } : { ...style, strike: true }, out); i = close + 2; continue; }
    }
    if (text[i] === '{') {
      const color = COLOR_OPEN.exec(text.slice(i, i + 12));
      const close = color ? findBrace(text, i) : -1;
      if (color && close > i + color[0].length) { flush(); parse(text.slice(i + color[0].length, close), { ...style, color: color[1] }, out); i = close + 1; continue; }
    }
    buffer += text[i++];
  }
  flush();
}
const MAYBE_MARKED = /\*\*|~~|\{(?:merah|biru|hijau|oranye|ungu|abu):|[\u{1D400}-\u{1D433}\u{1D7CE}-\u{1D7D7}\u0336]/u;
export function richRuns(text: string): Run[] {
  if (!MAYBE_MARKED.test(text)) return [{ text }];
  const out: Run[] = [];
  parse(text, {}, out);
  return out.length ? out : [{ text }];
}
// Ada penanda yang berlaku (tebal, coret, atau warna) pada teks ini?
export const hasMarks = (text: string) => MAYBE_MARKED.test(text) && richRuns(text).some((run) => run.bold || run.strike || run.color);
// Teks tanpa penanda (salinan teks polos, CSV, PDF teks biasa): isi tetap terbaca, hanya gayanya yang hilang.
export const stripMarks = (text: string) => MAYBE_MARKED.test(text) ? richRuns(text).map((run) => run.text).join('') : text;
// Gaya inline ikut terbawa saat disalin ke Word/Google Docs.
export function richHtml(text: string, render: (text: string, style?: Run) => string): string {
  return richRuns(text).map((run) => {
    let html = render(run.text, run);
    if (run.color && COLOR_HEX[run.color]) html = '<span data-warna="' + run.color + '" style="color:#' + COLOR_HEX[run.color] + '">' + html.replaceAll('#142b49', '#' + COLOR_HEX[run.color]) + '</span>';
    if (run.strike) html = '<s style="text-decoration:line-through">' + html + '</s>';
    if (run.bold) html = '<b>' + html + '</b>';
    return html;
  }).join('');
}
// Sebaliknya: Run menjadi teks bertanda (untuk penyusun pembahasan).
export const mark = {
  bold: (text: string) => text ? '**' + richRuns(text).map(run => {
    let value = run.strike ? '~~' + run.text + '~~' : run.text;
    if (run.color) value = '{' + run.color + ':' + value + '}';
    return value;
  }).join('') + '**' : '',
  strike: (text: string) => text ? '~~' + text + '~~' : '',
  color: (name: (typeof COLORS)[number], text: string) => text ? '{' + name + ':' + text + '}' : '',
};
