// Perangkat hipotesis: dari nilai yang tampak pada deret atau kisi, cari semua aturan sederhana yang cocok
// dan nilai yang diminta masing-masing untuk kotak tersembunyi. Pembuktian keunikan kunci bergantung pada
// kenyataan bahwa SEMUA aturan yang cocok dengan stimulus meramalkan nilai yang sama.
export type Kind = 'cat' | 'num' | 'angle' | 'count' | 'bool';
export type Spec = { kind: Kind; mod?: number };
export type Fit<V> = { nama: string; pred: V };
export type Cells<V> = (V | undefined)[];

const EPS = 1e-6;
export function equal<V>(a: V, b: V, spec: Spec): boolean {
  if (spec.kind === 'cat' || spec.kind === 'bool') return a === b;
  const x = a as unknown as number, y = b as unknown as number;
  if (spec.mod) { const d = Math.abs(((x - y) % spec.mod + spec.mod) % spec.mod); return Math.min(d, spec.mod - d) < 0.06; }
  return Math.abs(x - y) < (spec.kind === 'count' ? 0.5 : 0.01) + EPS;
}
const wrap = (value: number, spec: Spec) => spec.mod ? ((value % spec.mod) + spec.mod) % spec.mod : value;
const known = <V,>(cells: Cells<V>, skip: number) => cells.flatMap((v, i) => v !== undefined && i !== skip ? [[i, v] as [number, V]] : []);

// Semua prediksi berbeda? Mengembalikan nilai unik pertama dan daftar kelompok yang berbeda.
export function distinct<V>(fits: Fit<V>[], spec: Spec): Fit<V>[] {
  const groups: Fit<V>[] = [];
  for (const fit of fits) if (!groups.some((g) => equal(g.pred, fit.pred, spec))) groups.push(fit);
  return groups;
}

// ---------------------------------------------------------------- deret (1 dimensi)
export function fitSequence<V>(cells: Cells<V>, hidden: number, spec: Spec): Fit<V>[] {
  const data = known(cells, hidden), fits: Fit<V>[] = [];
  if (data.length < 2) return fits;
  for (const p of [1, 2, 3]) {
    let ok = true;
    for (const [i, a] of data) for (const [j, b] of data) if (j > i && (j - i) % p === 0 && !equal(a, b, spec)) ok = false;
    const same = data.filter(([i]) => (hidden - i) % p === 0);
    if (ok && same.length && data.length >= p + 1) fits.push({ nama: p === 1 ? 'tetap' : 'berulang tiap ' + p + ' kotak', pred: same.reduce((best, d) => Math.abs(d[0] - hidden) < Math.abs(best[0] - hidden) ? d : best)[1] });
  }
  if ((spec.kind === 'num' || spec.kind === 'angle' || spec.kind === 'count') && data.length >= 3) {
    const [[i0, v0], [i1, v1]] = [data[0], data[1]] as [number, number][], span = i1 - i0, delta = v1 - v0;
    const steps: number[] = [];
    if (spec.mod) for (let t = 0; t < span; t++) steps.push((delta + t * spec.mod) / span); else steps.push(delta / span);
    for (const d of steps) {
      if (spec.kind === 'count' && Math.abs(d - Math.round(d)) > EPS) continue;
      if (spec.kind === 'count' && v0 + d * (hidden - i0) < 0) continue;
      if (data.every(([i, v]) => equal(v as unknown as number, wrap(v0 + d * (i - i0), spec), spec))) fits.push({ nama: 'bertambah ' + Math.round(d * 100) / 100 + ' tiap kotak', pred: wrap(v0 + d * (hidden - i0), spec) as unknown as V });
    }
  }
  return fits;
}

// ------------------------------------------------------------------ kisi 3 × 3
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
const NAMED: [string, number[]][] = [['bilangan prima', PRIMES], ['kuadrat', Array.from({ length: 12 }, (_, i) => (i + 1) ** 2)], ['kubik', Array.from({ length: 8 }, (_, i) => (i + 1) ** 3)],
  ['segitiga', Array.from({ length: 12 }, (_, i) => (i + 1) * (i + 2) / 2)], ['pangkat dua', Array.from({ length: 10 }, (_, i) => 2 ** i)]];
export function fitGrid<V>(cells: Cells<V>, hidden: number, spec: Spec): Fit<V>[] {
  const fits: Fit<V>[] = [], at = (r: number, c: number) => cells[r * 3 + c], hr = Math.floor(hidden / 3), hc = hidden % 3;
  const data = known(cells, hidden);
  if (!data.length) return fits;
  const numeric = spec.kind === 'num' || spec.kind === 'angle' || spec.kind === 'count';
  const eq = (a: V | undefined, b: V | undefined) => a !== undefined && b !== undefined && equal(a, b, spec);
  const rowCells = (r: number) => [0, 1, 2].filter((c) => !(r === hr && c === hc)).map((c) => at(r, c));
  const colCells = (c: number) => [0, 1, 2].filter((r) => !(r === hr && c === hc)).map((r) => at(r, c));
  const defined = (list: (V | undefined)[]) => list.filter((v): v is V => v !== undefined);
  // semua sama
  if (data.every(([, v]) => equal(v, data[0][1], spec))) fits.push({ nama: 'tetap', pred: data[0][1] });
  // tetap per baris / per kolom
  // Hipotesis "tetap per baris/kolom" hanya sah bila diuji: sedikitnya satu baris/kolom memuat dua pengamatan.
  const rowOk = [0, 1, 2].every((r) => defined(rowCells(r)).every((v) => eq(v, defined(rowCells(r))[0]))) && [0, 1, 2].some((r) => defined(rowCells(r)).length >= 2);
  if (rowOk && defined(rowCells(hr)).length) fits.push({ nama: 'tetap di setiap baris', pred: defined(rowCells(hr))[0] });
  const colOk = [0, 1, 2].every((c) => defined(colCells(c)).every((v) => eq(v, defined(colCells(c))[0]))) && [0, 1, 2].some((c) => defined(colCells(c)).length >= 2);
  if (colOk && defined(colCells(hc)).length) fits.push({ nama: 'tetap di setiap kolom', pred: defined(colCells(hc))[0] });
  if (data.length < 5) return fits; // aturan antarbaris dan antarkolom butuh data yang cukup
  // persegi Latin: tiap baris dan kolom memuat tiga nilai yang sama tepat satu kali
  const values: V[] = [];
  for (const [, v] of data) if (!values.some((x) => equal(x, v, spec))) values.push(v);
  if (values.length === 3 && hr === 2 && hc === 2) {
    const lacks = (list: (V | undefined)[]) => values.filter((v) => !list.some((x) => x !== undefined && equal(x, v, spec)));
    const perm = (list: (V | undefined)[]) => defined(list).length === 3 && lacks(list).length === 0;
    if (perm([at(0, 0), at(0, 1), at(0, 2)]) && perm([at(1, 0), at(1, 1), at(1, 2)]) && perm([at(0, 0), at(1, 0), at(2, 0)]) && perm([at(0, 1), at(1, 1), at(2, 1)])) {
      const byRow = lacks([at(2, 0), at(2, 1)]), byCol = lacks([at(0, 2), at(1, 2)]);
      if (byRow.length === 1 && byCol.length === 1 && equal(byRow[0], byCol[0], spec)) fits.push({ nama: 'persegi Latin', pred: byRow[0] });
    }
  }
  if (numeric && hr === 2 && hc === 2) {
    const v = (r: number, c: number) => at(r, c) as unknown as number;
    // a + d1 * kolom + d2 * baris (butuh tiga sudut kisi yang diketahui)
    const d1 = wrap(v(0, 1) - v(0, 0), spec), d2 = wrap(v(1, 0) - v(0, 0), spec);
    if ([at(0, 0), at(0, 1), at(1, 0)].every((x) => x !== undefined) && data.every(([i, x]) => equal(x as unknown as number, wrap(v(0, 0) + d1 * (i % 3) + d2 * Math.floor(i / 3), spec), spec)))
      fits.push({ nama: 'berubah ' + d1 + ' per kolom dan ' + d2 + ' per baris', pred: wrap(v(0, 0) + 2 * d1 + 2 * d2, spec) as unknown as V });
    if (spec.kind === 'count' || spec.kind === 'num') {
      // kolom ketiga = hasil operasi kolom pertama dan kedua pada setiap baris
      const sumOk = [0, 1].every((r) => Math.abs(v(r, 2) - (v(r, 0) + v(r, 1))) < 0.5), difOk = [0, 1].every((r) => Math.abs(v(r, 2) - (v(r, 0) - v(r, 1))) < 0.5);
      if (sumOk && v(2, 0) + v(2, 1) > 0) fits.push({ nama: 'kolom ketiga = jumlah dua kolom pertama', pred: (v(2, 0) + v(2, 1)) as unknown as V });
      if (difOk && v(2, 0) - v(2, 1) >= 0) fits.push({ nama: 'kolom ketiga = selisih dua kolom pertama', pred: (v(2, 0) - v(2, 1)) as unknown as V });
      const colSumOk = [0, 1].every((c) => Math.abs(v(2, c) - (v(0, c) + v(1, c))) < 0.5);
      if (colSumOk && v(0, 2) + v(1, 2) > 0) fits.push({ nama: 'baris ketiga = jumlah dua baris pertama', pred: (v(0, 2) + v(1, 2)) as unknown as V });
      // kali tetap sepanjang baris
      if (v(0, 0) > 0 && v(0, 1) % v(0, 0) === 0) {
        const q = v(0, 1) / v(0, 0);
        if (q > 1 && [0, 1, 2].every((r) => Math.abs(v(r, 1) - q * v(r, 0)) < 0.5) && [0, 1].every((r) => Math.abs(v(r, 2) - q * v(r, 1)) < 0.5)) fits.push({ nama: 'dikali ' + q + ' tiap kolom', pred: (q * v(2, 1)) as unknown as V });
      }
      // deret menurut urutan baca (kiri ke kanan, atas ke bawah)
      const s = cells.map((x) => x as unknown as number), first = s.slice(0, 8);
      if (first.every((x) => x !== undefined)) {
        if (first.every((x, i) => Math.abs(x - (first[0] + i * (first[1] - first[0]))) < 0.5)) fits.push({ nama: 'deret aritmetika', pred: (first[0] + 8 * (first[1] - first[0])) as unknown as V });
        const d2s = first[2] - 2 * first[1] + first[0];
        if (d2s !== 0 && first.every((x, i) => Math.abs(x - (first[0] + i * (first[1] - first[0]) + i * (i - 1) / 2 * d2s)) < 0.5)) fits.push({ nama: 'deret bertingkat', pred: (first[0] + 8 * (first[1] - first[0]) + 28 * d2s) as unknown as V });
        if (first.slice(2).every((x, i) => Math.abs(x - (first[i + 1] + first[i])) < 0.5)) fits.push({ nama: 'jumlah dua suku sebelumnya', pred: (first[7] + first[6]) as unknown as V });
        for (const [nama, list] of NAMED) for (let t = 0; t + 9 <= list.length; t++) if (first.every((x, i) => x === list[t + i])) fits.push({ nama: 'deret ' + nama, pred: list[t + 8] as unknown as V });
      }
    }
  }
  // tumpukan (hanya untuk nilai ada/tidak): hasil = operasi kolom pertama dan kedua, atau baris pertama dan kedua
  if (spec.kind === 'bool' && hr === 2 && hc === 2) {
    const v = (r: number, c: number) => at(r, c) as unknown as boolean;
    const ops: [string, (a: boolean, b: boolean) => boolean][] = [['gabungan (salah satu ada)', (a, b) => a || b], ['hanya salah satunya (yang sama saling menghilangkan)', (a, b) => a !== b], ['kolom pertama tanpa kolom kedua', (a, b) => a && !b]];
    for (const [nama, op] of ops) {
      if ([0, 1].every((r) => v(r, 2) === op(v(r, 0), v(r, 1)))) fits.push({ nama: 'kolom ketiga: ' + nama, pred: op(v(2, 0), v(2, 1)) as unknown as V });
      if ([0, 1].every((c) => v(2, c) === op(v(0, c), v(1, c)))) fits.push({ nama: 'baris ketiga: ' + nama, pred: op(v(0, 2), v(1, 2)) as unknown as V });
    }
  }
  return fits;
}
