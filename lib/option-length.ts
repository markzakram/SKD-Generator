// Panjang opsi dinilai dalam kata DAN karakter. Posisi kunci tidak digunakan
// untuk merapikan opsi: kelima pilihan harus sama-sama layak dibaca.
export function optionLengthProfile(texts: readonly string[]) {
  const normalized = texts.map((text) => text.trim().replace(/\s+/g, ' '));
  const words = normalized.map((text) => text ? text.split(' ').length : 0);
  const characters = normalized.map((text) => text.length);
  return { words, characters, wordSpread: Math.max(...words) - Math.min(...words),
    characterRatio: Math.max(...characters) / Math.max(1, Math.min(...characters)) };
}

export function parallelTwkOptions(texts: readonly string[]): boolean {
  const length = optionLengthProfile(texts);
  return texts.length === 5 && length.wordSpread <= 4 && length.characterRatio <= 1.5;
}
