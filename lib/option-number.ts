// Nilai angka pada teks opsi numerik: satuan di depan atau belakang diabaikan ("Rp60.000", "14.400 liter", "1,5 jam"); titik = pemisah ribuan, koma = desimal.
export function optionNumber(text: string): number {
  const found = /\d[\d.]*(?:,\d+)?/.exec(text);
  if (!found) return NaN;
  const value = Number(found[0].replace(/\./g, '').replace(',', '.'));
  return /^\s*[-−]/.test(text) ? -value : value;
}
