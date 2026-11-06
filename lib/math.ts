import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/cancel/CancelConfiguration.js';
import 'mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';

// Local, deterministic SVG glyphs: no CDN, fonts, network, or user-defined HTML macros.
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const document = mathjax.document('', { InputJax: new TeX({ packages: ['base', 'ams', 'cancel', 'boldsymbol'], maxBuffer: 12000, maxMacros: 500 }), OutputJax: new SVG({ fontCache: 'none' }) });
export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export type MathPart = { kind: 'text'; value: string } | { kind: 'math'; value: string; display: boolean };

export function legacyLatex(value: string) {
  let s = value.normalize('NFKC').replace(/[−–]/g, '-').replace(/(\d)\u0336/g,'\\cancel{$1}').trim();
  // Parenthesized fractions exported by Word, followed by ordinary numeric fractions.
  s = s.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
  s = s.replace(/\^\(([^()]+)\)/g, '^{$1}');
  // Dua angka dengan spasi di kedua sisi garis miring ("5 / 3") adalah pemisah daftar atau baris, bukan pecahan: hanya "5/3" tanpa spasi yang menjadi pecahan.
  s = s.replace(/(?<![\w}])(-?\d+(?:[.,]\d+)?|[a-z])(\s*)\/(\s*)(-?\d+(?:[.,]\d+)?|[a-z])(?![\w{])/gi, (whole, top: string, before: string, after: string, bottom: string) =>
    (before || after) && /^-?\d/.test(top) && /^-?\d/.test(bottom) ? whole : '\\frac{' + top + '}{' + bottom + '}');
  return s.replace(/×|\*/g, '\\times ').replace(/÷/g, '\\div ').replace(/±/g,'\\pm ').replace(/≤/g, '\\le ').replace(/≥/g, '\\ge ').replace(/≠/g, '\\ne ').replace(/¬/g, '\\neg ').replace(/∧/g, '\\land ').replace(/∨/g, '\\lor ').replace(/√\s*\(?([\d.]+)\)?/g, '\\sqrt{$1}').replace(/%/g, '\\%').replace(/…|\.\.\./g, '\\ldots ').replace(/\^(-?\d+)/g, '^{$1}').replace(/\b(Dtotal|[A-Z]{2,3}|[A-Z]\d)\b/g,'\\mathrm{$1}').replace(/(\d),(?=\d)/g,'$1{,}');
}

// Explicit LaTeX wins. Legacy detection is deliberately confined to mathematical
// tokens; ordinary prose, dates, URLs, labels and source citations remain text.
function legacyFormulaParts(text: string): MathPart[] {
  const out: MathPart[] = [];
  const digits=String.raw`(?:\p{Nd}\u0336?)+`;
  const atom=String.raw`(?:${digits}(?:[.,]${digits})?(?:[a-zA-Z]\b)?|(?:Dtotal|[A-Z]{1,3}\d?|[a-z])\b|√\(?\d+\)?)(?:[²³]|\^-?\d+)?`;
  const term=String.raw`\(*[ \t]*[-−±]?${atom}\)*`;
  const token = new RegExp(String.raw`(?:(?<![\p{L}\d/:])|(?=[=⇔→]))(?:[=⇔→][ \t]*)?${term}(?:[ \t]*(?:[+−×÷=<>≤≥≠^*/]|-(?=[ \t]|\d))[ \t]*${term})+|[=⇔→][ \t]*${term}|(?<!\w)(?:\d+(?:[.,]\d+)?|[a-zA-Z]+)[²³]|(?:¬\s*)?\b[pqrst]\b(?:\s*[∧∨]\s*(?:¬\s*)?[pqrst]\b)+|¬\s*[pqrst]\b|\b[pqrstxy]\b`,'gu');
  let at = 0;
  const tags=[...text.matchAll(/<\/?[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[^<>\r\n]*)?\/?>/g)].map(m=>[m.index!,m.index!+m[0].length]);
  for (const match of text.matchAll(token)) {
    let value = match[0]; const index = match.index!;
    // A prose parenthesis may surround a label: "(Premis 2 + 3)". Its closing
    // parenthesis belongs to prose, not to the equation extracted inside it.
    while (value.endsWith(')') && (value.match(/\)/g)?.length ?? 0) > (value.match(/\(/g)?.length ?? 0)) value = value.slice(0, -1);
    // Avoid converting date-like identifiers or parts of web paths.
    const before=text.slice(0,index);
    if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(value) || /https?:\/\/\S*$/.test(before) || tags.some(([a,b])=>index<b&&index+value.length>a)) continue;
    const leading=/^[ \t]+/.exec(value)?.[0].length??0;
    if(index+leading>at)out.push({kind:'text',value:text.slice(at,index+leading)});
    const latex=legacyLatex(value.replace(/²/g,'^2').replace(/³/g,'^3')).replace(/⇔/g,'\\Leftrightarrow ').replace(/→/g,'\\to ');
    out.push({kind:'math',value:latex,display:false});at=index+value.length;
  }
  if(at<text.length)out.push({kind:'text',value:text.slice(at)});
  // A numeric answer or matrix cell is also typeset, without treating prose numbers as formulas.
  if(!out.some(p=>p.kind==='math')&&/^\s*[-−]?\d+(?:[.,]\d+)?\s*%?\s*$/.test(text))return [{kind:'math',value:legacyLatex(text),display:false}];
  return out;
}
// Panah dalam prosa juga memakai glif matematika. Font bawaan PDF tidak memiliki
// glif ini; jangan menurunkannya menjadi "->". URL tetap merupakan teks biasa.
const ARROWS: Record<string, string> = {
  '->': '\\to', '-->': '\\to', '→': '\\to', '⇒': '\\Rightarrow',
  '<->': '\\leftrightarrow', '<-->': '\\leftrightarrow', '↔': '\\leftrightarrow', '⇔': '\\Leftrightarrow',
  '←': '\\leftarrow', '⇐': '\\Leftarrow', '↑': '\\uparrow', '↓': '\\downarrow',
  '−': '-', '✓': '\\checkmark',
};
function legacyParts(text: string): MathPart[] {
  const parts: MathPart[] = []; let at = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s]+|<--?>|--?>|[→⇒↔⇔←⇐↑↓✓]/g)) {
    parts.push(...legacyFormulaParts(text.slice(at, match.index)));
    parts.push(ARROWS[match[0]] ? { kind: 'math', value: ARROWS[match[0]], display: false } : { kind: 'text', value: match[0] });
    at = match.index! + match[0].length;
  }
  parts.push(...legacyFormulaParts(text.slice(at)));
  // A remaining minus in prose (e.g. "−5" after a styled digit) needs a math glyph.
  return parts.flatMap(part => part.kind !== 'text' || !part.value.includes('−') ? [part] : part.value.split('−').flatMap((value,i): MathPart[] => [...(i ? [{kind:'math' as const,value:'-',display:false}] : []), ...(value ? [{kind:'text' as const,value}] : [])]));
}
const formulaArrows = (latex: string) => latex.replace(/<--?>|--?>/g, (arrow) => ARROWS[arrow] + ' ');
export function mathParts(text: string): MathPart[] {
  const out: MathPart[]=[];let at=0;
  const explicit=/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
  for(const m of text.matchAll(explicit)){out.push(...legacyParts(text.slice(at,m.index)));out.push({kind:'math',value:formulaArrows(m[1]??m[2]??m[3]??m[4]),display:m[1]!==undefined||m[3]!==undefined});at=m.index!+m[0].length;}
  out.push(...legacyParts(text.slice(at)));return out;
}
export const latexText=(text:string)=>mathParts(text).map(p=>p.kind==='math'?(p.display?'\\[':'\\(')+p.value+(p.display?'\\]':'\\)'):p.value).join('');
const cache=new Map<string,{svg:string;width:number;height:number;depth:number}>();
export type MathStyle = { bold?: boolean; strike?: boolean };
export function mathSvg(latex:string, style:MathStyle = {}) {
  const key = (style.bold ? 'bold:' : '') + (style.strike ? 'strike:' : '') + latex;
  const cached=cache.get(key);if(cached)return cached;
  if(latex.length>12000)throw new Error('Rumus terlalu panjang.');
  const node=document.convert(style.bold ? '\\boldsymbol{' + latex + '}' : latex,{display:false});
  const raw=adaptor.outerHTML(node), svg=raw.slice(raw.indexOf('<svg'),raw.lastIndexOf('</svg>')+6);
  const box=/viewBox="([^"]+)"/.exec(svg)?.[1].split(/\s+/).map(Number);
  if(!box||box.length!==4||svg.includes('data-mjx-error'))throw new Error('Format LaTeX tidak valid: '+latex.slice(0,80));
  const strike = style.strike ? `<line x1="${box[0]}" x2="${box[0]+box[2]}" y1="${box[1]+box[3]*.55}" y2="${box[1]+box[3]*.55}" stroke="#142b49" stroke-width="55"/>` : '';
  const result={svg:svg.replace(/currentColor/g,'#142b49').replace(/style="vertical-align:[^"]*"/,'').replace('</svg>',strike+'</svg>'),width:box[2]/1000,height:box[3]/1000,depth:Math.max(0,(box[1]+box[3])/1000)};
  if(cache.size>1200)cache.clear();cache.set(key,result);return result;
}
export function sizedMathSvg(latex:string,size=16,style:MathStyle={}){const m=mathSvg(latex,style);return m.svg.replace(/width="[^"]*"/,`width="${m.width*size}"`).replace(/height="[^"]*"/,`height="${m.height*size}"`);}
export function mathHtml(text:string,style:MathStyle={}){return mathParts(text).map(p=>{
  if(p.kind==='text')return escapeHtml(p.value);
  try{const m=mathSvg(p.value,style);return `<span class="math-formula${p.display?' math-display':''}" role="math" aria-label="${escapeHtml(p.value)}" style="display:inline-block;max-width:100%;vertical-align:${-m.depth}em">${m.svg.replace(/width="[^"]*"/,`width="${m.width}em"`).replace(/height="[^"]*"/,`height="${m.height}em"`)}</span>`;}
  catch{return `<span class="math-error" title="Periksa penulisan LaTeX">${escapeHtml('\\('+p.value+'\\)')}</span>`;}
}).join('');}

// Teks terbaca dari LaTeX (salinan teks polos dan CSV): tanpa pembatas, \frac, atau \begin{aligned}. Pecahan menjadi "a/b" dengan kurung
// bila pembilang atau penyebutnya majemuk; persamaan bertingkat (aligned) menjadi satu baris per larik.
export function latexPlain(latex: string): string {
  let s = latex.replace(/\\checkmark\b/g, '✓').replace(/\\(?:Leftrightarrow|leftrightarrow|Rightarrow|rightarrow|Leftarrow|leftarrow|uparrow|downarrow)(?![a-zA-Z])\s*/g,
    (value) => ({ Leftrightarrow: ' ⇔ ', leftrightarrow: ' ↔ ', Rightarrow: ' ⇒ ', rightarrow: ' → ', Leftarrow: ' ⇐ ', leftarrow: ' ← ', uparrow: ' ↑ ', downarrow: ' ↓ ' })[value.slice(1).trim() as 'rightarrow'])
    .replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '').replace(/\\\\/g, '\n').replace(/&/g, '').replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002')
    .replace(/\\sum(?:_\{[^{}]*\})?(?:\^\{[^{}]*\})?\s*/g, 'Σ ').replace(/\\cdot\s*/g, ' · ').replace(/\\l?dots\s*/g, '… ').replace(/_\{?(\d+)\}?/g, (_, digits: string) => [...digits].map((d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]).join(''))
    .replace(/\\times\s*/g, ' × ').replace(/\\div\s*/g, ' ÷ ').replace(/\\pm\s*/g, '± ').replace(/\\le\s*/g, ' ≤ ').replace(/\\ge\s*/g, ' ≥ ').replace(/\\ne(?![a-zA-Z])\s*/g, ' ≠ ')
    .replace(/\\Leftrightarrow\s*/g, ' ⇔ ').replace(/\\to\s*/g, ' → ').replace(/\\neg\s*/g, '¬').replace(/\\lor\s*/g, ' ∨ ').replace(/\\land\s*/g, ' ∧ ').replace(/\\equiv\s*/g, ' ≡ ').replace(/\\ldots\s*/g, '… ').replace(/\\%/g, '%').replace(/\{,\}/g, ',').replace(/\\[;,!: ]/g, ' ')
    .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, (_, words: string) => words.replace(/-/g, '\u0003')).replace(/\^\{2\}|\^2/g, '²').replace(/\^\{3\}|\^3/g, '³').replace(/\\sqrt\{([^{}]*)\}/g, '√$1');
  const wrap = (part: string) => /^[\w,.²³%−-]+$/.test(part.trim()) ? part.trim() : '(' + part.trim() + ')';
  for (let guard = 0; guard < 8 && /\\frac\{/.test(s); guard++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, top: string, bottom: string) => wrap(top) + '/' + wrap(bottom));
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1').replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/\u0003/g, '-');
  s = s.replace(/([\w)²³%])[ \t]*-[ \t]*/g, '$1 − ').replace(/-/g, '−').replace(/[ \t]*([=+<>])[ \t]*/g, ' $1 ');
  return s.split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/^([=+]) /gm, '$1 ');
}
export const plainMath = (text: string) => mathParts(text).map((p) => p.kind === 'math' ? latexPlain(p.value) : p.value).join('');
