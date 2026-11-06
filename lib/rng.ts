export function rng(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];
  const shuffle = <T,>(items: readonly T[]) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return { next, int, pick, shuffle };
}
export type Rng = ReturnType<typeof rng>;
// Isolasi keacakan sebuah pembangkit (keputusan PM): pembangkit berjalan pada pengacak turunan (kunci + satu undian dari aliran bersama), dan aliran bersama hanya
// dimajukan sebanyak `draws` undian, yaitu jumlah yang dipakai pembangkit itu sebelum direvisi. Dengan begitu perubahan isi pembangkit tidak menggeser
// pemilihan dan pengacakan butir lain pada seed yang sama (profil tryout, paket biasa).
export function isolated(shared: Rng, key: string, draws: number): Rng {
  const seed = shared.int(0, 0x3fffffff);
  for (let i = 1; i < draws; i++) shared.next();
  return rng(key + '|' + seed);
}
