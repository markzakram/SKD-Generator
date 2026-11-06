// Pembahasan Distribusi dan Kategori (Panduan Produksi Soal TIU JadiASN, Verbal Analitis): bentuk orang-kegiatan dan bentuk objek/tempat-kategori. Pembahasan mengalir dari
// fakta ke akibat, ditutup "Jadi, jawaban yang benar adalah {kunci}."; tabel hasil mengikuti contoh panduan (orang-kegiatan: tabel sesudah penutup; objek-tempat: matriks
// ✓ / x / ? sebelum penjelasan, dan tempat yang punya tanda x gugur). Susunan, urutan, peringkat, dan jadwal sudah tidak lewat berkas ini: semuanya memakai mesin
// lib/tiu-posisi.ts (lib/tiu-urutan.ts).
import { KEY_MARK, tableLines } from './explanation';

const join = (...lines: string[]) => lines.join('\n');
const CLOSE = 'Jadi, jawaban yang benar adalah ' + KEY_MARK + '.';

// ---- Distribusi dan kategori ---------------------------------------------------------------------------------------------------------------------
// Bentuk orang-kegiatan (contoh panduan Distribusi Orang-Kegiatan): fakta langsung, akibatnya, pernyataan yang pasti benar, penutup, lalu tabel orang x kegiatan.
export function kategoriOrangExplanation(names: string[], first: string, second: string, keyText: string): string {
  const [a, b, c] = names;
  return join(
    a + ' mengikuti ' + first + ', sedangkan ' + c + ' tidak mengikuti ' + first + '. Karena tepat dua orang mengikuti ' + first + ', orang kedua yang mengikuti ' + first + ' adalah ' + b + '.', '',
    'Hanya ' + c + ' yang mengikuti ' + second + ', sehingga ' + a + ' dan ' + b + ' tidak mengikuti ' + second + '.', '',
    'Dengan demikian, ' + keyText, CLOSE, '',
    ...tableLines({ headers: ['', ...names], rows: [[first, '✓', '✓', 'x'], [second, 'x', 'x', '✓']] }));
}
// Bentuk objek-tempat (contoh panduan Distribusi Objek/Tempat-Kategori): matriks ✓ / x / ?, tempat yang punya x gugur.
export type Availability = { stores: string[]; items: string[]; matrix: ('✓' | 'x' | '?')[][]; key: number; buyer: string; infoCount: number };
export function kategoriTokoExplanation(a: Availability): string {
  const cross = '\\(\\text{x}\\)'; // tanda x tegak
  const gugur = a.stores.filter((_, i) => i !== a.key), list = (values: string[]) => values.length > 2 ? values.slice(0, -1).join(', ') + ', dan ' + values[values.length - 1] : values.join(' dan ');
  return join(
    a.buyer + ' membutuhkan ' + list(a.items) + '.', '',
    'Berdasarkan informasi 1 sampai ' + a.infoCount + ', tabel ketersediaan terisi sebagai berikut:',
    ...tableLines({ headers: ['Toko', ...a.stores.map((store) => store.replace(/^Toko /, ''))], rows: a.items.map((item, row) => [item[0].toUpperCase() + item.slice(1), ...a.matrix[row]]) }), '',
    gugur.join(', ').replace(/, ([^,]*)$/, ', dan $1') + ' gugur karena masing-masing memiliki setidaknya satu tanda ' + cross + ' pada jenis barang yang dibutuhkan. Tanda ' + cross + ' menunjukkan bahwa barang tersebut tidak tersedia di toko tersebut.', '',
    'Sementara itu, ' + a.stores[a.key] + ' tidak memiliki tanda ' + cross + ' pada semua jenis barang yang dibutuhkan. Artinya, ' + a.stores[a.key] + ' masih mungkin menyediakan ' + list(a.items) + '.', '',
    'Jadi, toko yang akan dikunjungi ' + a.buyer + ' adalah ' + a.stores[a.key] + '.', CLOSE);
}
