// Perencana keluarga modus silogisme untuk satu paket tryout (QC akademik 2 Nov 2026): lima butir silogisme sepaket (baris 13 = 3 Premis, baris 14 = 2 Premis - Narasi dua butir,
// baris 15 = 3 Premis - Narasi dua butir) tidak boleh semuanya rantai kondisional. Setiap paket mendapat lima keluarga BERBEDA dari enam keluarga (MP, MT, SK, SD, NEG, TDS; lib/silo-spec.ts):
//   - satu keluarga dilewatkan tiap paket; NEG (De Morgan atau negasi implikasi) hanya bisa pada baris 13 karena blueprint Bagian B melarangnya sebagai langkah narasi;
//   - paket dikelompokkan per blok lima paket. Dalam satu blok kelima keluarga non-NEG (urutan acak menurut seed) digeser melingkar: paket ke-j memakai F[j] pada baris 13 (atau melewatkannya pada
//     satu paket acak yang baris 13-nya NEG), F[j+1] dan F[j+2] pada baris 14, F[j+3] dan F[j+4] pada baris 15. Jadi baris 13 pada lima paket berurutan berbeda, paket tidak saling kembar, dan
//     tiap keluarga non-NEG tepat dua kali pada baris 14 dan dua kali pada baris 15 per blok (Blueprint Bagian 8: distribusi pola dipantau);
//   - contoh blueprint (lib/silo-contoh.ts) tetap dipakai lebih dahulu: butir dengan keluarga X memakai contoh X yang belum terpakai pada pembuatan yang sama, pembangkit baru hanya mengisi kekurangannya
//     dengan keluarga yang sama (tiu-logika.ts: randomConfig dengan `family`). Sebaran seimbang memakai 8 dari 8 contoh dua premis dan 8 dari 11 contoh tiga premis pada lima paket pertama.
// Rencana berupa fungsi murni dari (seed, nomor paket, urutan butir baris itu). Pemanggil mengetahui urutan butir dari jumlah butir baris yang sudah ada (ContohSlot.used), sehingga tidak ada keadaan
// bersama dan butir lain pada seed yang sama tidak bergeser.
import { rng } from './rng';
import { contohOf, keluargaOfContoh, type Contoh, type NarasiChapter } from './silo-contoh';
import { KELUARGA, type Keluarga } from './silo-spec';

export type BarisSilogisme = 13 | 14 | 15;
// Letak butir pada satu paket: `perPaket` = jumlah butir baris itu per paket (1, 2, 2 pada profil tryout 2027), `paket` = indeks paket.
// `merata`: jumlah per chapter (Settings.chapterCounts). Kuota melebihi lebar profil tryout tidak memakai barisan blok lima paket, melainkan putaran keluarga yang merata (urutanMerata).
export type PaketSlot = { baris: BarisSilogisme; paket: number; perPaket: number; merata?: boolean };
export type Rencana = { keluarga: Keluarga; contoh?: Contoh };
const CHAPTER: Record<BarisSilogisme, NarasiChapter | undefined> = { 13: undefined, 14: '2 Premis - Narasi', 15: '3 Premis - Narasi' };

// Enam keluarga berbeda untuk satu paket: indeks 0 = baris 13, 1–2 = baris 14, 3–4 = baris 15, 5 = keluarga yang dilewatkan. NEG hanya pada indeks 0 atau 5.
export const BLOK = 5;
export function barisan(seed: string, paket: number): Keluarga[] {
  const blok = Math.floor(paket / BLOK), j = paket % BLOK, F = rng(seed + '|silo-blok|' + blok).shuffle(KELUARGA.filter((f) => f !== 'NEG'));
  const negDi = rng(seed + '|silo-blok-neg|' + blok).int(0, BLOK - 1), r = rng(seed + '|silo-paket|' + paket), at = (k: number) => F[(j + k) % BLOK];
  const narasi = [...r.shuffle([at(1), at(2)]), ...r.shuffle([at(3), at(4)])]; // urutan dua butir sebaris diacak
  return j === negDi ? ['NEG', ...narasi, at(0)] : [at(0), ...narasi, 'NEG'];
}
// Keluarga butir ke-`i` baris itu pada paket `paket`. Butir lebih banyak daripada profil tryout (1, 2, 2) berputar pada keluarga yang boleh untuk baris itu.
export function keluargaButir(seed: string, baris: BarisSilogisme, paket: number, i: number): Keluarga {
  const lineup = barisan(seed, paket), offset = baris === 13 ? 0 : baris === 14 ? 1 : 3, width = baris === 13 ? 1 : 2;
  if (i < width) return lineup[offset + i];
  const allowed = baris === 13 ? [lineup[5], ...lineup.slice(1, 5)] : lineup.filter((f) => f !== 'NEG');
  return allowed[(i - width) % allowed.length];
}
// Kuota besar pada satu baris (jumlah per chapter): butir ke-k sejak paket pertama memakai keluarga ke-(k mod jumlah keluarga), sehingga selisih antarkeluarga paling banyak satu, dalam satu paket maupun
// seluruh paket. Keluarga yang contohnya lebih banyak didahulukan supaya contoh blueprint terpakai lebih dahulu; seri mengikuti urutan acak seed. NEG hanya pada baris 13 (blueprint Bagian B melarangnya pada narasi).
export function urutanMerata(seed: string, baris: BarisSilogisme): Keluarga[] {
  const chapter = CHAPTER[baris], stok = (family: Keluarga) => chapter ? contohOf(chapter).filter((item) => keluargaOfContoh(item) === family).length : 0;
  return rng(seed + '|silo-merata|' + baris).shuffle(KELUARGA.filter((f) => baris === 13 || f !== 'NEG')).sort((a, b) => stok(b) - stok(a));
}
// Contoh blueprint berkeluarga `family` yang belum terpakai, menurut urutan acak seed yang sama dengan contohAt (lib/silo-contoh.ts).
const contohUntuk = (chapter: NarasiChapter, seed: string, family: Keluarga, used: Set<string>) =>
  rng(seed + '|contoh-narasi|' + chapter).shuffle(contohOf(chapter)).find((item) => keluargaOfContoh(item) === family && !used.has(item.code));
// Rencana butir ke-`ordinal` baris itu (urutan sejak paket pertama; paket ke-n memegang urutan n x perPaket sampai n x perPaket + perPaket - 1). Mengulang butir sebelumnya untuk mengetahui contoh yang sudah terpakai.
export function rencanaButir(seed: string, slot: PaketSlot, ordinal: number): Rencana | undefined {
  if (slot.perPaket < 1 || ordinal < slot.paket * slot.perPaket || ordinal >= (slot.paket + 1) * slot.perPaket) return undefined; // di luar paket ini (mis. penggantian butir): urutan contoh biasa
  const chapter = CHAPTER[slot.baris], used = new Set<string>(), merata = slot.merata && slot.perPaket > (slot.baris === 13 ? 1 : 2) ? urutanMerata(seed, slot.baris) : undefined;
  for (let k = 0; k <= ordinal; k++) {
    const family = merata ? merata[k % merata.length] : keluargaButir(seed, slot.baris, Math.floor(k / slot.perPaket), k % slot.perPaket), item = chapter ? contohUntuk(chapter, seed, family, used) : undefined;
    if (item) used.add(item.code);
    if (k === ordinal) return { keluarga: family, ...(item ? { contoh: item } : {}) };
  }
  return undefined;
}
