// Diagram rantai suku deret untuk pembahasan (panduan TIU, bagian deret angka, PDF 64–71): angka berderet dengan panah melengkung berlabel
// (selisih, rasio, atau operasi) di atas atau di bawah, panah arah (↑ ↓) dengan lingkaran merah pada tiga panah pertama, panah turun untuk
// Fibonacci ("1+1"), dan suku jawaban berwarna. Pembahasan menyimpannya sebagai satu baris `@deret {JSON}`; SVG dibuat dari data itu sehingga layar,
// PDF, PNG, Word, dan salinan memakai gambar yang sama, dan pemeriksaan dapat menghitung ulang setiap panah dari data.
export type ChainColor = 'ink' | 'blue' | 'green' | 'red';
export type ChainArc = {
  from: number; to: number; label: string; color: ChainColor;
  side: 'top' | 'bottom';
  style?: 'arc' | 'drop' | 'tick'; // arc: panah melengkung from -> to; drop: panah turun dari suku `to`; tick: panah arah ↑/↓ di atas jarak from -> to (label "=" untuk dua suku yang sama: tanda sama dengan, tanpa arah)
  depth?: number; // lapisan lebih dalam untuk larik ketiga atau panah turun berselang
};
export type Chain = { terms: string[]; arcs: ChainArc[]; marks?: { index: number; color: ChainColor }[]; loop?: [number, number] };

const COLORS: Record<ChainColor, string> = { ink: '#000000', blue: '#0070c0', green: '#00b050', red: '#ff3131' };
const STEP = 64, PAD = 40, FONT = 24;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => String(Math.round(n * 10) / 10);

export const chainLine = (chain: Chain) => '@deret ' + JSON.stringify(chain);
export function parseChainLine(line: string): Chain | undefined {
  const found = /^@deret (\{.*\})$/.exec(line.trim());
  if (!found) return undefined;
  try {
    const chain = JSON.parse(found[1]) as Chain, n = chain.terms?.length;
    const index = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < n;
    if (!Array.isArray(chain.terms) || !chain.terms.every((t) => typeof t === 'string') || !Array.isArray(chain.arcs) ||
      !chain.arcs.every((a) => index(a.from) && index(a.to) && typeof a.label === 'string' && a.color in COLORS && (a.side === 'top' || a.side === 'bottom'))) return undefined;
    if (chain.marks && !chain.marks.every((m) => index(m.index) && m.color in COLORS)) return undefined;
    if (chain.loop && !(chain.loop.length === 2 && chain.loop.every(index))) return undefined;
    return chain;
  } catch { return undefined; }
}

function head(x: number, y: number, angle: number, color: string): string {
  const back = (d: number, side: number) => (x - d * Math.cos(angle) - side * Math.sin(angle)).toFixed(1) + ',' + (y - d * Math.sin(angle) + side * Math.cos(angle)).toFixed(1);
  return '<polygon points="' + x.toFixed(1) + ',' + y.toFixed(1) + ' ' + back(10, 5) + ' ' + back(10, -5) + '" fill="' + color + '"/>';
}

export function chainSvg(chain: Chain): string {
  const n = chain.terms.length, x = (i: number) => PAD + i * STEP;
  const arcs = chain.arcs.filter((a) => (a.style ?? 'arc') === 'arc'), drops = chain.arcs.filter((a) => a.style === 'drop'), ticks = chain.arcs.filter((a) => a.style === 'tick');
  const height = (a: ChainArc) => 18 + 12 * Math.abs(a.to - a.from) + (a.depth ?? 0) * 26;
  const topNeed = Math.max(ticks.length ? 56 : 0, ...arcs.filter((a) => a.side === 'top').map((a) => FONT + height(a) / 2 + 26), 22);
  const bottomNeed = Math.max(...arcs.filter((a) => a.side === 'bottom').map((a) => height(a) / 2 + 34), ...drops.map((a) => 30 + (a.depth ?? 0) * 22 + 22), 14);
  const y0 = topNeed + FONT * 0.35, width = PAD * 2 + (n - 1) * STEP + 20, total = y0 + 8 + bottomNeed;
  const parts: string[] = [];
  const top = y0 - FONT, bottom = y0 + 8;
  for (const a of arcs) {
    const color = COLORS[a.color], h = height(a), up = a.side === 'top', ey = up ? top : bottom, sign = up ? -1 : 1;
    const x1 = x(a.from) + (a.to > a.from ? 8 : -8), x2 = x(a.to) + (a.to > a.from ? -10 : 10), cx = (x1 + x2) / 2, cy = ey + sign * h;
    parts.push('<path d="M' + fmt(x1) + ',' + fmt(ey) + ' Q' + fmt(cx) + ',' + fmt(cy) + ' ' + fmt(x2) + ',' + fmt(ey) + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linecap="round"/>');
    parts.push(head(x2, ey, Math.atan2(ey - cy, x2 - cx), color));
    parts.push('<text x="' + fmt(cx) + '" y="' + fmt(ey + sign * (h / 2 + (up ? 7 : 17))) + '" font-size="15" font-weight="700" fill="' + color + '" text-anchor="middle">' + esc(a.label) + '</text>');
  }
  for (const a of drops) {
    const color = COLORS[a.color], length = 30 + (a.depth ?? 0) * 22, px = x(a.to);
    parts.push('<line x1="' + fmt(px) + '" y1="' + fmt(bottom) + '" x2="' + fmt(px) + '" y2="' + fmt(bottom + length - 8) + '" stroke="' + color + '" stroke-width="2.4"/>', head(px, bottom + length, Math.PI / 2, color));
    parts.push('<text x="' + fmt(px) + '" y="' + fmt(bottom + length + 17) + '" font-size="15" font-weight="700" fill="' + color + '" text-anchor="middle">' + esc(a.label) + '</text>');
  }
  // Panah arah digambar sebagai bentuk (bukan huruf ↑ ↓) agar sama di semua peramban dan tidak berubah menjadi emoji berwarna.
  for (const a of ticks) {
    const cx = (x(a.from) + x(a.to)) / 2, mid = y0 - FONT - 18, up = a.label !== '↓', tipY = up ? mid - 14 : mid + 14, tailY = up ? mid + 14 : mid - 14;
    // Dua suku berurutan yang sama ("="): tanpa arah naik atau turun, digambar sebagai tanda sama dengan.
    if (a.label === '=') { for (const dy of [-4.5, 4.5]) parts.push('<line x1="' + fmt(cx - 9) + '" y1="' + fmt(mid + dy) + '" x2="' + fmt(cx + 9) + '" y2="' + fmt(mid + dy) + '" stroke="#6b7280" stroke-width="3.2" stroke-linecap="round"/>'); continue; }
    parts.push('<line x1="' + fmt(cx) + '" y1="' + fmt(tailY) + '" x2="' + fmt(cx) + '" y2="' + fmt(tipY + (up ? 6 : -6)) + '" stroke="#6b7280" stroke-width="3.2" stroke-linecap="round"/>', head(cx, tipY, up ? -Math.PI / 2 : Math.PI / 2, '#6b7280'));
  }
  if (chain.loop) {
    const left = (x(chain.loop[0]) + x(chain.loop[0] + 1)) / 2 - 22, right = (x(chain.loop[1] - 1) + x(chain.loop[1])) / 2 + 22;
    parts.push('<rect x="' + fmt(left) + '" y="' + fmt(y0 - FONT - 40) + '" width="' + fmt(right - left) + '" height="38" rx="19" fill="none" stroke="' + COLORS.red + '" stroke-width="2.2"/>');
  }
  const marks = new Map((chain.marks ?? []).map((m) => [m.index, m.color]));
  chain.terms.forEach((term, i) => parts.push('<text x="' + fmt(x(i)) + '" y="' + fmt(y0) + '" font-size="' + FONT + '" font-weight="800" fill="' + COLORS[marks.get(i) ?? 'ink'] + '" text-anchor="middle">' + esc(term) + '</text>'));
  const label = chain.terms.join(', ');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(width) + '" height="' + Math.ceil(total) + '" viewBox="0 0 ' + Math.ceil(width) + ' ' + Math.ceil(total) +
    '" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="' + esc('Pola deret: ' + label) + '">' + parts.join('') + '</svg>';
}

// Teks polos diagram (salinan teks, CSV): satu baris per warna larik, mis. "22 →(+4) 26 →(+4) 30"; panah turun "2 = 1+1"; panah arah "↑ ↑ ↑".
export function chainPlain(chain: Chain): string {
  const arcs = chain.arcs.filter((a) => (a.style ?? 'arc') === 'arc'), drops = chain.arcs.filter((a) => a.style === 'drop'), ticks = chain.arcs.filter((a) => a.style === 'tick');
  const lines: string[] = [];
  if (ticks.length) lines.push('Arah: ' + [...ticks].sort((a, b) => a.from - b.from).map((a) => a.label).join(' ') + ' | ' + chain.terms.join(', '));
  else if (!arcs.length && !drops.length) lines.push(chain.terms.join(', '));
  for (const color of [...new Set(arcs.map((a) => a.color))]) {
    const lane = arcs.filter((a) => a.color === color).sort((a, b) => a.from - b.from);
    let text = '';
    lane.forEach((a, i) => { text += (i && lane[i - 1].to === a.from ? '' : (i ? '; ' : '') + chain.terms[a.from]) + ' →(' + a.label + ') ' + chain.terms[a.to]; });
    lines.push(text);
  }
  if (drops.length) lines.push(drops.map((a) => chain.terms[a.to] + ' = ' + a.label).join('; '));
  return lines.join('\n');
}
