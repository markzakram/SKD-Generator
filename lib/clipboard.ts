// Menulis ke clipboard dari tombol Salin: salinan kaya (HTML dengan gambar + teks), gambar PNG, dan cadangan teks saja.
// Dipanggil langsung dari penangan klik; jangan menaruh `await` sebelum `copyRich` atau `copyPng` (Safari menuntut izin klik).

export const canCopyRich = () => typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.write);
export type CopyKind = 'kaya' | 'teks';
export const CLIPBOARD_DENIED = 'Browser menolak akses clipboard. Izinkan akses clipboard untuk situs ini, lalu coba lagi.';

function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area); area.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  area.remove();
  return ok;
}
// Teks biasa: Clipboard API bila ada, kalau tidak (atau ditolak) jalur lama lewat textarea tersembunyi.
export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* coba jalur lama */ }
  }
  if (!legacyCopy(text)) throw new Error(CLIPBOARD_DENIED);
}
// Salinan kaya untuk Word dan Google Docs: `text/html` (gambar sebagai PNG data URI) dan `text/plain` sebagai cadangan.
// HTML dibuat lewat `makeHtml` dan diberikan sebagai Promise, sehingga rasterisasi gambar berjalan tanpa melewatkan izin klik.
// Bila clipboard kaya tidak didukung atau ditolak, yang tersalin hanya teks dan hasilnya 'teks'.
export async function copyRich(text: string, makeHtml: () => Promise<string>): Promise<CopyKind> {
  if (canCopyRich()) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': makeHtml().then((html) => new Blob([html], { type: 'text/html' })),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      return 'kaya';
    } catch { /* jatuh ke teks saja */ }
  }
  await copyText(text);
  return 'teks';
}
// Satu gambar sebagai `image/png`. Tidak ada cadangan teks: gambar yang tidak bisa disalin harus diunduh.
export async function copyPng(png: Promise<Blob>): Promise<void> {
  png.catch(() => undefined); // galat gambar dilaporkan di bawah; ini mencegah "unhandled rejection" saat clipboard tidak didukung
  if (!canCopyRich()) throw new Error('Browser ini belum mendukung salin gambar. Gunakan Unduh PNG.');
  let failure: unknown;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png.catch((error) => { failure = error; throw error; }) })]);
  } catch (error) {
    if (failure) throw failure instanceof Error ? failure : new Error('Gambar gagal disiapkan.');
    throw new Error(error instanceof DOMException && error.name === 'NotAllowedError' ? CLIPBOARD_DENIED : 'Gambar tidak bisa disalin di browser ini. Gunakan Unduh PNG.');
  }
}
