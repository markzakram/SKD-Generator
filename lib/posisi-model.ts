// Model susunan dan posisi (Panduan Produksi Soal TIU JadiASN, Verbal Analitis, Susunan dan Posisi): tiga subbentuk (susunan linear, duduk melingkar, baris-kolom),
// petunjuk dan pernyataan opsi sebagai fakta berstruktur, dan pemecah brute force. Fakta disimpan sebagai data (JSON) pada `proof.model`, sehingga kunci soal dapat
// dibuktikan ulang tanpa membaca teks stem: kunci = satu-satunya opsi yang benar pada SEMUA susunan yang memenuhi petunjuk.
// Nomor kursi: linear dari kiri/depan/atas (0 = posisi pertama); melingkar searah jarum jam dengan satu orang sebagai acuan di kursi 0 (kiri seseorang = kursi tepat
// setelahnya searah jarum jam, definisi yang sama dengan contoh akademik); baris-kolom: kursi = baris * kolom + kolom (baris 0 = depan).

// Gaya linear: tiga yang pertama untuk Susunan dan Posisi; lima berikutnya untuk Urutan dan Peringkat (lomba, nilai, datang, tinggi) dan Jadwal (jadwal: kursi = hari bernama pada
// `labels`). `who` = sebutan benda yang disusun pada pertanyaan jadwal ("mata kuliah", "pelatihan"); bila kosong "orang".
export type Linear = 'berdiri' | 'duduk' | 'antre' | 'lomba' | 'nilai' | 'datang' | 'tinggi' | 'jadwal';
export const isTheme = (style: Linear) => style !== 'berdiri' && style !== 'duduk' && style !== 'antre';
export type Geo =
  | { form: 'linear'; n: number; style: Linear; labels?: string[]; who?: string }
  | { form: 'circular'; n: number }
  | { form: 'grid'; rows: number; cols: number; people: number };

export type Fact =
  | { k: 'at'; a: string; seats: number[] } // orang a menempati salah satu kursi
  | { k: 'row'; who: string[]; rows: number[] } // semua orang berada pada salah satu baris (baris-kolom)
  | { k: 'col'; who: string[]; cols: number[] } // semua orang berada pada salah satu kolom (baris-kolom)
  | { k: 'next'; a: string; b: string; w?: 0 | 1 } // a tepat setelah b (linear: satu posisi ke kanan/belakang/bawah; melingkar: kursi berikutnya; baris-kolom: tepat di belakang b)
  | { k: 'beside'; a: string; b: string } // berdampingan (baris-kolom: satu baris, kolom bersebelahan)
  | { k: 'between'; a: string; b: string; c: string } // a diapit b dan c (bersebelahan dengan keduanya)
  | { k: 'opposite'; a: string; b: string } // melingkar: berhadapan
  | { k: 'before'; a: string; b: string; w?: 0 | 1 } // linear: a di depan/kiri b (tidak harus bersebelahan); baris-kolom: baris a lebih depan daripada baris b
  | { k: 'sameRow'; a: string; b: string }
  | { k: 'sameCol'; a: string; b: string }
  | { k: 'gap'; a: string; b: string; n: number } // linear: tepat n orang di antara a dan b
  | { k: 'not'; f: Fact }
  | { k: 'order'; seq: string[] }; // seluruh susunan: seq[i] menempati kursi i

export const seatCount = (geo: Geo) => geo.form === 'grid' ? geo.rows * geo.cols : geo.n;
export const rowOf = (geo: Geo, seat: number) => geo.form === 'grid' ? Math.floor(seat / geo.cols) : 0;
export const colOf = (geo: Geo, seat: number) => geo.form === 'grid' ? seat % geo.cols : seat;

export function persons(f: Fact): string[] {
  switch (f.k) {
    case 'at': return [f.a];
    case 'row': case 'col': return f.who;
    case 'between': return [f.a, f.b, f.c];
    case 'not': return persons(f.f);
    case 'order': return f.seq;
    default: return [f.a, f.b];
  }
}

// Nilai kebenaran satu fakta pada penempatan `seat` (nama -> nomor kursi).
export function holds(f: Fact, seat: (name: string) => number, geo: Geo): boolean {
  const n = seatCount(geo), circular = geo.form === 'circular', grid = geo.form === 'grid';
  const dist = (a: string, b: string) => seat(a) - seat(b);
  const adjacent = (a: string, b: string) => {
    if (grid) return rowOf(geo, seat(a)) === rowOf(geo, seat(b)) && Math.abs(colOf(geo, seat(a)) - colOf(geo, seat(b))) === 1;
    const d = Math.abs(dist(a, b));
    return circular ? d === 1 || d === n - 1 : d === 1;
  };
  switch (f.k) {
    case 'at': return f.seats.includes(seat(f.a));
    case 'row': return f.who.every((name) => f.rows.includes(rowOf(geo, seat(name))));
    case 'col': return f.who.every((name) => f.cols.includes(colOf(geo, seat(name))));
    case 'next':
      if (grid) return colOf(geo, seat(f.a)) === colOf(geo, seat(f.b)) && rowOf(geo, seat(f.a)) === rowOf(geo, seat(f.b)) + 1;
      return circular ? (seat(f.b) + 1) % n === seat(f.a) : dist(f.a, f.b) === 1;
    case 'beside': return adjacent(f.a, f.b);
    case 'between': return f.b !== f.c && adjacent(f.a, f.b) && adjacent(f.a, f.c);
    case 'opposite': return circular && Math.abs(dist(f.a, f.b)) === n / 2;
    case 'before': return grid ? rowOf(geo, seat(f.a)) < rowOf(geo, seat(f.b)) : dist(f.a, f.b) < 0;
    case 'sameRow': return rowOf(geo, seat(f.a)) === rowOf(geo, seat(f.b));
    case 'sameCol': return colOf(geo, seat(f.a)) === colOf(geo, seat(f.b));
    case 'gap': return Math.abs(dist(f.a, f.b)) === f.n + 1;
    case 'not': return !holds(f.f, seat, geo);
    case 'order': return f.seq.every((name, i) => seat(name) === i);
  }
}

// Semua susunan yang memenuhi petunjuk (brute force dengan runut-balik, penyaringan maju, dan orang dengan pilihan paling sedikit lebih dahulu). Hasil: larik nomor
// kursi menurut urutan `names`. Susunan melingkar menetapkan `anchor` di kursi 0 (putaran meja tidak dibedakan). Berhenti setelah `limit` susunan terkumpul
// (limit + 1 tersimpan), cukup untuk menguji ketunggalan.
export function solve(geo: Geo, names: string[], clues: Fact[], anchor: string | undefined, limit = Infinity): number[][] {
  const seats = seatCount(geo), index = new Map(names.map((name, i) => [name, i] as const)), count = names.length;
  const need = clues.map((f) => ({ f, who: [...new Set(persons(f))].map((name) => { const i = index.get(name); if (i === undefined) throw new Error('Petunjuk menyebut orang di luar daftar.'); return i; }) }));
  const all = Array.from({ length: seats }, (_, i) => i), first = anchor !== undefined && geo.form === 'circular' ? index.get(anchor)! : undefined;
  const at = new Array<number>(count).fill(-1), used = new Array<boolean>(seats).fill(false), found: number[][] = [];
  const get = (name: string) => at[index.get(name)!];
  const dom: number[][] = names.map((_, i) => i === first ? [0] : all);
  const byPerson: number[][] = names.map(() => []);
  need.forEach((c, k) => c.who.forEach((i) => byPerson[i].push(k)));
  // Petunjuk satu orang menyaring pilihan sejak awal.
  for (const c of need) if (c.who.length === 1) { const i = c.who[0]; dom[i] = dom[i].filter((t) => { at[i] = t; const ok = holds(c.f, get, geo); at[i] = -1; return ok; }); if (!dom[i].length) return []; }
  const rec = (): void => {
    if (found.length > limit) return;
    let p = -1, best = Infinity;
    for (let i = 0; i < count; i++) if (at[i] < 0) { const size = dom[i].filter((t) => !used[t]).length; if (size < best) { best = size; p = i; } }
    if (p < 0) { found.push([...at]); return; }
    for (const s of dom[p]) {
      if (used[s]) continue;
      at[p] = s; used[s] = true;
      const saved: [number, number[]][] = [];
      let ok = true;
      for (const k of byPerson[p]) {
        const c = need[k], open = c.who.filter((j) => at[j] < 0);
        if (!open.length) { if (!holds(c.f, get, geo)) { ok = false; break; } continue; }
        if (open.length === 1) {
          const q = open[0], keep = dom[q].filter((t) => { if (used[t]) return false; at[q] = t; const fits = holds(c.f, get, geo); at[q] = -1; return fits; });
          if (keep.length !== dom[q].length) { saved.push([q, dom[q]]); dom[q] = keep; if (!keep.length) { ok = false; break; } }
        }
      }
      if (ok) rec();
      for (let k = saved.length - 1; k >= 0; k--) dom[saved[k][0]] = saved[k][1];
      used[s] = false; at[p] = -1;
      if (found.length > limit) return;
    }
  };
  rec();
  return found;
}

// Fakta yang benar pada setiap susunan dalam `solutions`.
export const holdsAll = (f: Fact, names: string[], solutions: number[][], geo: Geo) => solutions.length > 0 && solutions.every((sol) => holds(f, (name) => sol[names.indexOf(name)], geo));
export const holdsNone = (f: Fact, names: string[], solutions: number[][], geo: Geo) => solutions.every((sol) => !holds(f, (name) => sol[names.indexOf(name)], geo));

export const sameFact = (a: Fact, b: Fact) => JSON.stringify({ ...a, w: undefined }) === JSON.stringify({ ...b, w: undefined });
