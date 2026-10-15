import type { Rng } from '../rng';
import type { Difficulty, Fill, Part, Scene } from '../types';
import { PLAIN_GLYPHS } from './glyphs';
import { chooseWrong, layoutOk, pack, packPositions, polar, tierOf, type Built } from './compose';
import { groupOf, isGroup, mk, orientation, partRadius, scene } from './scene';
import { STEMS } from './stems';
import { capital, describeScene, fillWord, glyphName, listText, makeNamer, turnWord } from './text';

// Satu resep matriks: cara menyusun kotak (baris, kolom) dan kalimat aturan untuk setiap aspek yang berubah.
type Recipe = { cell: (r: number, c: number) => Scene; rules: Record<string, string>; roles: Record<string, string>; explain: string; difficultyReason: string; mekanisme: string; repack?: (name: string, n: number) => Part[] };
const GRID = [0, 1, 2];
const latinOf = (a: Rng) => { const [p, q] = a.pick([[1, 1], [1, 2], [2, 1], [2, 2]]), e = a.int(0, 2); return (r: number, c: number) => (p * r + q * c + e) % 3; };
const fills3 = (a: Rng) => a.shuffle([0, 1, 2]) as Fill[];
const glyphTrio = (a: Rng) => a.shuffle(['segitiga', 'lingkaran', 'persegi', 'bintang', 'belah', 'segienam']).slice(0, 3);
const fillList = (list: number[]) => listText(list.map(fillWord));

// Matriks 1: bangun tetap di setiap baris, warna tetap di setiap kolom (dasar).
function rowColumn(a: Rng): Recipe {
  const glyphs = glyphTrio(a), fills = fills3(a), turnR = a.pick([0, 0, 90]);
  const cell = (r: number, c: number) => scene([mk('inti', glyphs[r], 0, 0, { radius: 19, f: fills[c], r: turnR })]);
  return {
    cell, roles: { inti: 'bangun di tengah' }, mekanisme: 'matriks-baris-kolom',
    rules: { 'inti:g': 'bentuk bangun di tengah sama pada setiap baris', 'inti:f': 'warna bangun di tengah sama pada setiap kolom' },
    explain: 'Bangun pada setiap baris selalu sama: ' + listText(glyphs.map(glyphName)) + ' berturut-turut dari baris pertama sampai ketiga. Warnanya selalu sama pada setiap kolom: ' + fillList(fills) + ' berturut-turut dari kolom pertama sampai ketiga. Jadi kotak kanan bawah berbentuk ' + glyphName(glyphs[2]) + ' berwarna ' + fillWord(fills[2]) + '.',
    difficultyReason: 'Dua aturan sederhana: bentuk tetap per baris dan warna tetap per kolom.',
  };
}
// Matriks 2: bagian yang berputar mengikuti kolom dan baris.
function rotation(a: Rng, tier: number): Recipe {
  const glyph = a.pick(['panah', 'bulan', 'rumah', 'siku', 'bendera', 'segitigasiku', 'layang', 'trapesium', 'tetes', 'setengah']), r0 = a.int(0, 7) * 45;
  const d1 = a.pick([45, 90, -90, -45, 135]), d2 = tier === 0 ? 0 : a.pick([45, 90, -45, -90]), fills = fills3(a);
  const byRow = a.next() < 0.5, mark = a.pick(PLAIN_GLYPHS);
  const cell = (r: number, c: number) => scene([mk('inti', glyph, 0, 0, { radius: 18, r: r0 + d1 * c + d2 * r, f: byRow ? fills[r] : fills[c] }), ...(tier >= 1 ? [mk('penanda', mark, -29, -29, { radius: 6, f: byRow ? fills[c] : fills[r] })] : [])]);
  const total = (((d1 * 2 + d2 * 2) % 360) + 360) % 360;
  const rules: Record<string, string> = { 'inti:r': 'bangun di tengah berputar ' + turnWord(d1) + ' pada setiap kolom' + (d2 ? ' dan ' + turnWord(d2) + ' pada setiap baris' : ''), 'inti:f': 'warna bangun di tengah sama pada setiap ' + (byRow ? 'baris' : 'kolom') };
  if (tier >= 1) rules['penanda:f'] = 'warna bangun kecil di sudut sama pada setiap ' + (byRow ? 'kolom' : 'baris');
  return {
    cell, roles: { inti: 'bangun di tengah', penanda: 'bangun kecil di sudut' }, mekanisme: 'matriks-putaran', rules,
    explain: capital(rules['inti:r']) + '. ' + capital(rules['inti:f']) + (tier >= 1 ? ', sedangkan ' + rules['penanda:f'] : '') + '. ' +
      (total === 0 ? 'Pada kotak kanan bawah putaran dua langkah kolom dan dua langkah baris saling menggenapi sehingga arah bangun sama dengan kotak kiri atas' : 'Pada kotak kanan bawah bangun sudah berputar ' + turnWord(total > 180 ? total - 360 : total) + ' dari arahnya di kotak kiri atas') + ', dengan warna mengikuti aturan di atas.',
    difficultyReason: tier === 0 ? 'Satu bangun berputar dengan langkah tetap pada setiap kolom.' : 'Putaran mengikuti kolom dan baris, ditambah dua warna yang mengikuti arah berbeda.',
  };
}
// Matriks 3: persegi Latin pada bentuk dan warna beberapa bagian.
function latin(a: Rng, tier: number): Recipe {
  const gTengah = glyphTrio(a), gPojok = glyphTrio(a), fTengah = fills3(a), fPojok = fills3(a), pg = latinOf(a), pf = latinOf(a), pj = latinOf(a), pk = latinOf(a);
  const byCol = a.next() < 0.5, deco = fills3(a), turn = a.pick([0, 45, 90]);
  const cell = (r: number, c: number) => scene([
    mk('inti', gTengah[pg(r, c)], 0, 0, { radius: 17, r: turn, f: tier === 1 ? fTengah[byCol ? c : r] : fTengah[pf(r, c)] }),
    mk('pojok', tier === 1 ? gPojok[0] : gPojok[pj(r, c)], -28, -28, { radius: 7, f: tier === 1 ? fPojok[pk(r, c)] : fPojok[tier === 2 ? (byCol ? r : c) : pk(r, c)] }),
    ...(tier >= 2 ? [mk('batang', 'batang', 31, 0, { radius: 15, r: tier === 3 ? 45 * c : 0, f: deco[byCol ? c : r] })] : []),
  ]);
  const rules: Record<string, string> = { 'inti:g': 'setiap baris dan setiap kolom memuat ketiga bentuk bangun di tengah (' + listText(gTengah.map(glyphName)) + ') tepat satu kali' };
  rules['inti:f'] = tier === 1 ? 'warna bangun di tengah sama pada setiap ' + (byCol ? 'kolom' : 'baris') : 'setiap baris dan setiap kolom memuat ketiga warna bangun di tengah (' + fillList(fTengah) + ') tepat satu kali';
  if (tier === 1) rules['pojok:f'] = 'setiap baris dan setiap kolom memuat ketiga warna bangun kecil di sudut (' + fillList(fPojok) + ') tepat satu kali';
  else { rules['pojok:g'] = 'setiap baris dan setiap kolom memuat ketiga bentuk bangun kecil di sudut (' + listText(gPojok.map(glyphName)) + ') tepat satu kali'; rules['pojok:f'] = 'warna bangun kecil di sudut sama pada setiap ' + (byCol ? 'baris' : 'kolom'); rules['batang:f'] = 'warna batang di kanan sama pada setiap ' + (byCol ? 'kolom' : 'baris'); if (tier === 3) rules['batang:r'] = 'batang di kanan berputar 45° searah jarum jam pada setiap kolom'; }
  return {
    cell, roles: { inti: 'bangun di tengah', pojok: 'bangun kecil di sudut', batang: 'batang di kanan' }, mekanisme: 'matriks-latin', rules,
    explain: [...new Set(Object.values(rules))].map(capital).join('. ') + '. Pada baris ketiga dan kolom ketiga hanya satu kemungkinan yang tersisa untuk setiap bagian, sehingga kotak kanan bawah memuat ' + describeScene(cell(2, 2), makeNamer({ inti: 'bangun di tengah', pojok: 'bangun kecil di sudut', batang: 'batang di kanan' })) + '.',
    difficultyReason: tier === 1 ? 'Dua bagian dengan aturan persegi Latin pada bentuk atau warna.' : 'Beberapa bagian mengikuti persegi Latin pada bentuk dan warna sekaligus, ditambah bagian yang warnanya mengikuti baris atau kolom; opsi harus disaring satu per satu.',
  };
}
// Matriks 4: banyaknya bangun mengikuti deret atau hubungan antarkolom.
function counts(a: Rng, tier: number): Recipe {
  const glyph = a.pick(['bintang', 'lingkaran', 'segitiga', 'persegi', 'belah']), kind = tier === 0 ? 'aritmetika' : tier === 1 ? a.pick(['jumlah', 'kali']) : a.pick(['prima', 'jumlah', 'kali', 'aritmetika-besar']);
  let value: (r: number, c: number) => number, rule: string;
  if (kind === 'aritmetika' || kind === 'aritmetika-besar') {
    const d1 = kind === 'aritmetika' ? a.int(1, 2) : a.int(2, 3), d2 = kind === 'aritmetika' ? a.int(1, 3) : a.int(3, 4), a0 = a.int(1, 3);
    value = (r, c) => a0 + d1 * c + d2 * r;
    rule = 'banyaknya bangun bertambah ' + d1 + ' pada setiap kolom dan ' + d2 + ' pada setiap baris';
  } else if (kind === 'jumlah') {
    const first = [a.int(1, 6), a.int(1, 6), a.int(1, 6)], second = [a.int(1, 6), a.int(1, 6), a.int(1, 6)];
    value = (r, c) => c === 0 ? first[r] : c === 1 ? second[r] : first[r] + second[r];
    rule = 'banyaknya bangun pada kolom ketiga adalah jumlah banyaknya bangun pada kolom pertama dan kedua di baris yang sama';
  } else if (kind === 'kali') {
    const start = [a.int(1, 3), a.int(1, 3), a.int(1, 3)], q = a.pick([2, 3]);
    value = (r, c) => start[r] * q ** c;
    rule = 'banyaknya bangun dikalikan ' + q + ' pada setiap kolom';
  } else {
    const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
    value = (r, c) => primes[r * 3 + c];
    rule = 'banyaknya bangun pada kotak-kotak, dibaca dari kiri ke kanan lalu atas ke bawah, adalah bilangan prima berurutan';
  }
  const biggest = Math.max(...GRID.flatMap((r) => GRID.map((c) => value(r, c))));
  if (biggest > 25) throw new Error('banyak bangun melebihi petak');
  const cols = biggest <= 8 ? 3 : biggest <= 15 ? 4 : 5, pitch = cols === 3 ? 22 : cols === 4 ? 19 : 15, radius = cols === 3 ? 8 : cols === 4 ? 7 : 6;
  const cell = (r: number, c: number) => scene(pack('bangun', glyph, value(r, c), { cols, pitch, radius, f: 2 }));
  return {
    cell, roles: { bangun: 'bangun ' + glyphName(glyph) }, mekanisme: 'matriks-jumlah', rules: { 'bangun@:n': rule }, repack: (name, n) => pack(name, glyph, n, { cols, pitch, radius, f: 2 }),
    explain: 'Hitung banyaknya bangun pada setiap kotak: ' + GRID.map((r) => GRID.map((c) => r === 2 && c === 2 ? '?' : value(r, c)).join(', ')).join(' / ') + '. ' + capital(rule) + '. Jadi kotak kanan bawah berisi ' + value(2, 2) + ' bangun.',
    difficultyReason: kind === 'aritmetika' ? 'Banyaknya bangun bertambah dengan langkah tetap pada kolom dan baris.' : kind === 'prima' ? 'Banyaknya bangun mengikuti deret bilangan prima yang harus dikenali sendiri.' : 'Banyaknya bangun mengikuti hubungan antarkolom yang harus ditemukan sendiri.',
  };
}
// Matriks 5: gambar kolom ketiga adalah tumpukan gambar kolom pertama dan kedua pada baris yang sama.
const LAYERS: { g: string; radius: number; r: number; nama: string }[] = [
  { g: 'persegi', radius: 36, r: 0, nama: 'persegi besar' }, { g: 'belah', radius: 34, r: 0, nama: 'belah ketupat' }, { g: 'lingkaran', radius: 22, r: 0, nama: 'lingkaran' }, { g: 'tambah', radius: 30, r: 0, nama: 'tanda tambah' },
  { g: 'batang', radius: 36, r: 90, nama: 'batang mendatar' }, { g: 'batang', radius: 36, r: 0, nama: 'batang tegak' }, { g: 'bintang', radius: 28, r: 0, nama: 'bintang' }, { g: 'segitiga', radius: 30, r: 0, nama: 'segitiga' },
  { g: 'segienam', radius: 40, r: 0, nama: 'segienam' }, { g: 'kilau', radius: 34, r: 0, nama: 'bintang bersudut empat' },
];
function overlay(a: Rng, tier: number): Recipe {
  const xor = tier >= 2, pool = a.shuffle(LAYERS.map((_, i) => i)).slice(0, tier === 1 ? 6 : tier === 2 ? 7 : 9), per = tier === 1 ? 1 : 2;
  const rows: { left: number[]; right: number[] }[] = [];
  for (let r = 0; r < 3; r++) {
    const mix = a.shuffle(pool), left = mix.slice(0, per);
    // Pada tumpukan "saling menghilangkan", baris pertama dan terakhir memuat garis yang sama di kedua kotak: baris pertama menjadi bukti aturan,
    // baris terakhir membuat jawaban bergantung pada aturan itu (menggabungkan saja akan keliru).
    const right = xor ? [...mix.slice(per, per + (tier === 3 ? 2 : 1)), ...(r !== 1 ? [left[0]] : [])] : mix.slice(per, per + per);
    rows.push({ left, right: [...new Set(right)] });
  }
  const has = (r: number, c: number, layer: number) => c === 0 ? rows[r].left.includes(layer) : c === 1 ? rows[r].right.includes(layer) : xor ? rows[r].left.includes(layer) !== rows[r].right.includes(layer) : rows[r].left.includes(layer) || rows[r].right.includes(layer);
  const cell = (r: number, c: number) => scene(pool.filter((layer) => has(r, c, layer)).map((layer) => mk('lapis' + (layer + 1), LAYERS[layer].g, 0, 0, { radius: LAYERS[layer].radius, r: LAYERS[layer].r, f: 3 })));
  const rule = xor ? 'gambar pada kolom ketiga adalah hasil menumpuk gambar kolom pertama dan kedua pada baris yang sama; garis yang sama pada kedua gambar saling menghilangkan' : 'gambar pada kolom ketiga adalah hasil menumpuk gambar kolom pertama dan kedua pada baris yang sama';
  const names = (layers: number[]) => listText(layers.map((layer) => LAYERS[layer].nama)), shared = rows[2].left.filter((layer) => rows[2].right.includes(layer));
  return {
    cell, roles: Object.fromEntries(LAYERS.map((layer, i) => ['lapis' + (i + 1), 'garis ' + layer.nama])), mekanisme: xor ? 'matriks-tumpuk-xor' : 'matriks-tumpuk',
    rules: { 'lapis:pres': rule },
    explain: capital(rule) + '. Pada baris ketiga, kotak pertama memuat garis ' + names(rows[2].left) + ' dan kotak kedua memuat garis ' + names(rows[2].right) + '. ' +
      (xor && shared.length ? 'Garis ' + names(shared) + ' ada pada kedua kotak sehingga saling menghilangkan. ' : '') + 'Hasil tumpukannya, yaitu isi kotak kanan bawah, memuat garis ' + names(pool.filter((layer) => has(2, 2, layer))) + '.',
    difficultyReason: xor ? 'Dua gambar ditumpuk dan garis yang sama saling menghilangkan; harus dikenali dari dua baris yang lengkap, dan menggabungkan saja menghasilkan jawaban yang keliru.' : 'Dua gambar garis ditumpuk menjadi gambar ketiga pada setiap baris.',
  };
}
// Matriks 6: bangun bergeser mengelilingi cincin dan warnanya berputar mengikuti kolom dan baris.
function ring(a: Rng, tier: number): Recipe {
  const n = a.pick([4, 5]), glyphs = a.shuffle(['segitiga', 'lingkaran', 'persegi', 'bintang', 'belah', 'segienam', 'tambah']).slice(0, n);
  const s1 = a.pick([1, n - 1]), s2 = a.pick([0, 1, n - 1]), phi0 = a.pick([0, 18, 22.5, 45]), startFills = glyphs.map(() => a.int(0, 2));
  const u = a.pick([1, 2]), v = tier === 2 ? 0 : a.pick([1, 2]), centers = glyphTrio(a), pc = latinOf(a);
  const cell = (r: number, c: number) => scene([...glyphs.map((g, i) => {
    const slot = (i + s1 * c + s2 * r) % n, [x, y] = polar(27, phi0 + slot * 360 / n);
    return mk('bangun' + (i + 1), g, x, y, { radius: 7.5, f: ((startFills[i] + u * c + v * r) % 3) as Fill });
  }), tier === 3 ? mk('pusat', centers[pc(r, c)], 0, 0, { radius: 7, f: 2 }) : mk('pusat', 'lingkaran', 0, 0, { radius: 5, f: 2 })]);
  const rules: Record<string, string> = {};
  glyphs.forEach((g, i) => { rules['bangun' + (i + 1) + ':pos'] = 'setiap bangun bergeser ' + (s1 === 1 ? '1' : String(n - 1)) + ' tempat pada cincin ke arah ' + (s1 === 1 ? 'searah' : 'berlawanan arah') + ' jarum jam pada setiap kolom' + (s2 ? ' dan ' + (s2 === 1 ? '1 tempat searah' : '1 tempat berlawanan arah') + ' jarum jam pada setiap baris' : ''); rules['bangun' + (i + 1) + ':f'] = 'warna setiap bangun bergeser ' + u + ' langkah pada siklus putih, abu-abu, hitam pada setiap kolom' + (v ? ' dan ' + v + ' langkah pada setiap baris' : ''); });
  if (tier === 3) rules['pusat:g'] = 'setiap baris dan setiap kolom memuat ketiga bentuk bangun di pusat (' + listText(centers.map(glyphName)) + ') tepat satu kali';
  return {
    cell, roles: { ...Object.fromEntries(glyphs.map((g, i) => ['bangun' + (i + 1), 'bangun ' + glyphName(g)])), pusat: 'bangun di pusat cincin' }, mekanisme: 'matriks-cincin', rules,
    explain: [...new Set(Object.values(rules))].map(capital).join('. ') + '. Perubahan berlaku bersamaan untuk semua bangun. Pada kotak kanan bawah: ' + describeScene(cell(2, 2), makeNamer(Object.fromEntries(glyphs.map((g, i) => ['bangun' + (i + 1), 'bangun ' + glyphName(g)])))) + '.',
    difficultyReason: 'Letak dan warna setiap bangun berubah bersamaan dengan langkah berbeda pada kolom dan baris.',
  };
}

// Matriks 7: dua kelompok bangun dengan aturan jumlah yang berbeda di sisi kiri dan kanan.
function countsDuo(a: Rng): Recipe {
  const [gl, gr] = a.shuffle(['bintang', 'lingkaran', 'segitiga', 'persegi', 'belah']).slice(0, 2), d1 = a.pick([1, 2]), d2 = a.pick([1, 2]), a0 = 1;
  const left = (r: number, c: number) => a0 + d1 * c + d2 * r;
  const first = [a.int(1, 3), a.int(1, 3), a.int(1, 3)], second = [a.int(1, 3), a.int(1, 3), a.int(1, 3)];
  const right = (r: number, c: number) => c === 0 ? first[r] : c === 1 ? second[r] : first[r] + second[r];
  const half = (name: string, g: string, n: number, side: number) => n ? pack(name, g, n, { cols: 2, pitch: 17, radius: 6.5, slots: packPositions(n, 2, 17).map(([x, y]) => [x + side * 22, y] as [number, number]) }) : [];
  const cell = (r: number, c: number) => scene([...half('kiri', gl, left(r, c), -1), ...half('kanan', gr, right(r, c), 1)]);
  const ruleL = 'banyaknya bangun ' + glyphName(gl) + ' di sisi kiri bertambah ' + d1 + ' pada setiap kolom dan ' + d2 + ' pada setiap baris';
  const ruleR = 'banyaknya bangun ' + glyphName(gr) + ' di sisi kanan pada kolom ketiga adalah jumlah kolom pertama dan kedua di baris yang sama';
  return {
    cell, roles: { kiri: 'bangun ' + glyphName(gl) + ' di sisi kiri', kanan: 'bangun ' + glyphName(gr) + ' di sisi kanan' }, mekanisme: 'matriks-jumlah-ganda', rules: { 'kiri@:n': ruleL, 'kanan@:n': ruleR },
    repack: (name, n) => half(name, name === 'kiri' ? gl : gr, n, name === 'kiri' ? -1 : 1),
    explain: 'Dua kelompok bangun mengikuti aturan yang berbeda. 1. ' + capital(ruleL) + '. 2. ' + capital(ruleR) + '. Pada kotak kanan bawah terdapat ' + left(2, 2) + ' ' + glyphName(gl) + ' di sisi kiri dan ' + right(2, 2) + ' ' + glyphName(gr) + ' di sisi kanan.',
    difficultyReason: 'Dua kelompok bangun mengikuti aturan jumlah yang berbeda dan harus ditelusuri bersamaan.',
  };
}

export function buildMatrix(a: Rng, level: Difficulty): Built | null {
  const tier = tierOf(level);
  let recipe: Recipe;
  try {
    if (tier === 0) recipe = a.pick([() => rowColumn(a), () => counts(a, 0), () => rotation(a, 0)])();
    else if (tier === 1) recipe = a.pick([() => latin(a, 1), () => counts(a, 1), () => overlay(a, 1), () => rotation(a, 1)])();
    else if (tier === 2) recipe = a.pick([() => latin(a, 2), () => counts(a, 2), () => overlay(a, 2), () => ring(a, 2)])();
    else recipe = a.pick([() => latin(a, 3), () => countsDuo(a), () => overlay(a, 3), () => ring(a, 3)])();
  } catch { return null; }
  const cells = GRID.flatMap((r) => GRID.map((c) => recipe.cell(r, c))), key = cells[8], known = cells.slice(0, 8);
  if (cells.some((s) => !s.parts.length) || known.some((s) => !layoutOk(s)) || !layoutOk(key)) return null;
  if (known.some((s) => s.parts.length === key.parts.length && JSON.stringify(s) === JSON.stringify(key))) return null;
  const name = makeNamer(recipe.roles), candidates = mutants(key, [cells[7], cells[5], cells[6], cells[2], cells[4], cells[3]], recipe, tier);
  const wrong = chooseWrong(key, candidates, 4, a);
  if (wrong.length < 4) return null;
  return {
    kind: 'matriks', columns: 3, scenes: [...known, null], key, wrong, namer: name,
    rule: { mekanisme: recipe.mekanisme, aturan: [...new Set(Object.values(recipe.rules))].map(capital) },
    explanation: recipe.explain, keyReason: 'Memenuhi seluruh aturan: ' + describeScene(key, name) + '.',
    difficultyReason: recipe.difficultyReason, stem: STEMS.matriks[0],
  };
}

// Calon pengecoh: kunci dengan satu aspek diganti nilai yang muncul pada kotak tetangga (kesalahan yang wajar).
function mutants(key: Scene, neighbors: Scene[], recipe: Recipe, tier: number): { scene: Scene; rule: string; group: string }[] {
  const out: { scene: Scene; rule: string; group: string; hint: number }[] = [];
  const ruleOf = (id: string, aspect: string) => recipe.rules[(isGroup(id) ? groupOf(id) + '@' : id) + ':' + aspect] ?? recipe.rules[(isGroup(id) ? groupOf(id) + '@' : id.replace(/\d+$/, '')) + ':' + aspect] ?? Object.values(recipe.rules)[0];
  const groups = new Set<string>();
  const add = (s: Scene, id: string, aspect: string, hint: number) => out.push({ scene: s, rule: ruleOf(id, aspect), group: id + ':' + aspect, hint });
  const swapPart = (s: Scene, p: Part) => scene(s.parts.map((q) => q.id === p.id ? p : q));
  for (const part of key.parts) {
    if (isGroup(part.id)) {
      const name = groupOf(part.id);
      if (groups.has(name)) continue; groups.add(name);
      const n = key.parts.filter((p) => isGroup(p.id) && groupOf(p.id) === name).length;
      const seen = [...new Set([...neighbors.map((s) => s.parts.filter((p) => isGroup(p.id) && groupOf(p.id) === name).length), n - 1, n + 1, n + 2, n - 2])].filter((v) => v !== n && v >= 1 && v <= 25);
      if (!recipe.repack) continue;
      seen.forEach((v, i) => add(scene([...key.parts.filter((p) => !(isGroup(p.id) && groupOf(p.id) === name)), ...recipe.repack!(name, v)]), name + '@', 'n', i));
      continue;
    }
    const tracked = neighbors.map((s) => s.parts.find((p) => p.id === part.id)).filter((p): p is Part => !!p);
    for (const other of tracked) {
      if (other.g !== part.g) add(swapPart(key, mk(part.id, other.g, part.x, part.y, { radius: partRadius(part), r: part.r, f: part.f })), part.id, 'g', 0);
      if (other.f !== part.f) add(swapPart(key, { ...part, f: other.f }), part.id, 'f', 0);
      if (orientation(other) !== orientation(part)) add(swapPart(key, { ...part, r: other.r }), part.id, 'r', 0);
      if (Math.hypot(other.x - part.x, other.y - part.y) > 0.5) add(swapPart(key, { ...part, x: other.x, y: other.y }), part.id, 'pos', 0);
    }
    if (part.id.startsWith('lapis')) add(scene(key.parts.filter((p) => p.id !== part.id)), part.id, 'pres', 0);
    // Warna yang tidak pernah muncul pada tetangga hanya dipakai pada tingkat yang lebih mudah.
    if (tier <= 1) for (const f of [0, 1, 2] as Fill[]) if (f !== part.f && part.f !== 3) add(swapPart(key, { ...part, f }), part.id, 'f', 2);
  }
  if (recipe.mekanisme.startsWith('matriks-tumpuk')) {
    for (const s of neighbors) for (const p of s.parts) if (!key.parts.some((q) => q.id === p.id)) add(scene([...key.parts, p]), p.id, 'pres', 0);
  }
  return out.sort((x, y) => x.hint - y.hint).map(({ scene: s, rule, group }) => ({ scene: s, rule, group }));
}
