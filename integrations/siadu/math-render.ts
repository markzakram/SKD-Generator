import { mathSvg, sizedMathSvg } from '../../lib/math';

// Render on this device. No formula or document content is sent to a rendering API.
const cache = new Map<string, Promise<string>>();
export function renderSiaduFormula(latex: string, style: { bold?: boolean; strike?: boolean; color?: string } = {}) {
  const key = JSON.stringify([latex, style]);
  let pending = cache.get(key);
  if (pending) return pending;
  pending = (async () => {
    const dimensions = mathSvg(latex, style);
    const width = Math.max(1, Math.ceil(dimensions.width * 16)), height = Math.max(1, Math.ceil(dimensions.height * 16));
    if (width > 10000 || height > 5000) throw new Error('Ukuran rumus melebihi batas gambar.');
    const svg = sizedMathSvg(latex, 16, style).replaceAll('#142b49', style.color || '#000000');
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Gagal menggambar rumus: ' + latex.slice(0, 80))); image.src = url; });
      const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas tidak tersedia untuk rumus.');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      return `<img class="siadu-latex-formula" src="${canvas.toDataURL('image/png')}" alt="${escape(latex)}" width="${width}" height="${height}" style="vertical-align:middle;max-width:100%" />`;
    } finally { URL.revokeObjectURL(url); }
  })();
  if (cache.size > 1200) cache.clear(); cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}
