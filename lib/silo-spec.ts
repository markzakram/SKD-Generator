// Kerangka formal silogisme menurut Blueprint Silogisme Tanpa Logika Kuantor (akademik, 28 Okt 2026): tanpa bahasa, hanya logika.
//  - Bagian 3: 32 variasi dasar dua premis (MP, MT, SK, SD, TK, TA) bertanda; Bagian 13: 96 variasi dasar tiga premis (T3-01 sampai T3-11).
//  - Bagian 4 dan 14: transformasi premis dan kunci (I = A → B, D = ¬A ∨ B, K = ¬B → ¬A; disjungsi dan dua implikasinya) dan enam urutan penyajian.
//  - Perluasan (tidak masuk hitungan blueprint): bentuk De Morgan sebagai bentuk premis (indeks 3) dan negasi implikasi (keluarga NI, contoh E-08).
// Sebuah soal ditentukan oleh `Config` (kode pola, bentuk tiap premis, bentuk kunci, urutan); `codeOf` menuliskannya sebagai kode blueprint
// (mis. MP-03-E10-K0-U1, T3-04-01-E000-K0-U132). Semua hubungan logika dihitung lewat lib/solver.ts (tabel kebenaran).
import { implies, not, variable, type Logic } from './solver';

export type Lit = readonly [v: number, neg: boolean];
export const VARS = ['p', 'q', 'r', 's', 't']; // t = proposisi tambahan pada opsi (informasi yang tidak diberikan premis)
export const EXTRA = 4;
export const L = (v: number, neg = false): Lit => [v, neg];
export const flip = (l: Lit): Lit => [l[0], !l[1]];
export type Op = 'lit' | 'imp' | 'or' | 'and' | 'nand' | 'notimp';
export type Stmt = { op: Op; a: Lit; b?: Lit };
export const lit = (a: Lit): Stmt => ({ op: 'lit', a });
export const imp = (a: Lit, b: Lit): Stmt => ({ op: 'imp', a, b });
export const or = (a: Lit, b: Lit): Stmt => ({ op: 'or', a, b });
export const and = (a: Lit, b: Lit): Stmt => ({ op: 'and', a, b });
export const nand = (a: Lit, b: Lit): Stmt => ({ op: 'nand', a, b }); // ¬(A ∧ B)
export const notimp = (a: Lit, b: Lit): Stmt => ({ op: 'notimp', a, b }); // ¬(A → B)

const litLogic = ([v, neg]: Lit): Logic => neg ? not(variable(VARS[v])) : variable(VARS[v]);
export function logicOf(s: Stmt): Logic {
  const a = litLogic(s.a), b = s.b ? litLogic(s.b) : a;
  return s.op === 'lit' ? a : s.op === 'imp' ? implies(a, b) : s.op === 'or' ? { op: 'or', left: a, right: b } : s.op === 'and' ? { op: 'and', left: a, right: b } :
    s.op === 'nand' ? not({ op: 'and', left: a, right: b }) : not(implies(a, b));
}
const sym = (l: Lit) => (l[1] ? '\\neg ' : '') + VARS[l[0]];
export function texOf(s: Stmt): string {
  const a = sym(s.a), b = s.b ? sym(s.b) : '';
  return s.op === 'lit' ? a : s.op === 'imp' ? a + ' \\to ' + b : s.op === 'or' ? a + ' \\lor ' + b : s.op === 'and' ? a + ' \\land ' + b :
    s.op === 'nand' ? '\\neg (' + a + ' \\land ' + b + ')' : '\\neg (' + a + ' \\to ' + b + ')';
}
export const sameStmt = (x: Stmt, y: Stmt) => x.op === y.op && x.a[0] === y.a[0] && x.a[1] === y.a[1] && (x.b?.[0] ?? -1) === (y.b?.[0] ?? -1) && (x.b?.[1] ?? false) === (y.b?.[1] ?? false);
export const varsOf = (list: Stmt[]) => [...new Set(list.flatMap((s) => s.b ? [s.a[0], s.b[0]] : [s.a[0]]))].sort();

// ---- Bentuk ekuivalen (Bagian 4.4) -----------------------------------------------------------------------------------
// Indeks bentuk (Bagian 9): implikasi 0 = asli, 1 = disjungsi, 2 = kontraposisi; disjungsi 0 = asli, 1 = implikasi pertama, 2 = implikasi kedua; fakta hanya 0.
// Indeks 3 = bentuk De Morgan (perluasan).
export type Form = 0 | 1 | 2 | 3;
export const formsOf = (s: Stmt, extended: boolean): Form[] => s.op === 'imp' || s.op === 'or' ? (extended ? [0, 1, 2, 3] : [0, 1, 2]) : [0];
export function transform(s: Stmt, form: Form): Stmt {
  if (form === 0 || !s.b) return s;
  const { a, b } = s;
  if (s.op === 'imp') return form === 1 ? or(flip(a), b) : form === 2 ? imp(flip(b), flip(a)) : nand(a, flip(b));
  if (s.op === 'or') return form === 1 ? imp(flip(a), b) : form === 2 ? imp(flip(b), a) : nand(flip(a), flip(b));
  return s;
}
// Hukum yang dipakai untuk kembali dari bentuk `form` ke bentuk dasar, dan persamaannya ("bentuk tampil ≡ bentuk dasar").
export function normalization(base: Stmt, form: Form): { law: string; eq: string } {
  const shown = transform(base, form), a = base.a, b = base.b!;
  if (base.op === 'imp') {
    if (form === 1) return { law: 'hukum implikasi', eq: texOf(shown) + ' \\equiv ' + texOf(base) };
    if (form === 2) return { law: 'hukum kontraposisi', eq: texOf(shown) + ' \\equiv ' + texOf(base) };
    return { law: 'hukum De Morgan dan hukum implikasi', eq: texOf(shown) + ' \\equiv ' + texOf(or(flip(a), b)) + ' \\equiv ' + texOf(base) };
  }
  if (form === 1) return { law: 'hukum implikasi', eq: texOf(shown) + ' \\equiv ' + texOf(base) };
  if (form === 2) return { law: 'hukum implikasi dan hukum komutatif', eq: texOf(shown) + ' \\equiv ' + texOf(or(b, a)) + ' \\equiv ' + texOf(base) };
  return { law: 'hukum De Morgan', eq: texOf(shown) + ' \\equiv ' + texOf(base) };
}
// Hukum untuk mengubah kesimpulan dasar (implikasi A → C) ke bentuk kunci; persamaannya "dasar ≡ bentuk kunci".
export function keyLaw(base: Stmt, form: Form): { law: string; eq: string } {
  const shown = transform(base, form);
  return { law: form === 1 ? 'hukum implikasi' : 'hukum kontraposisi', eq: texOf(base) + ' \\equiv ' + texOf(shown) };
}

// ---- Katalog dasar --------------------------------------------------------------------------------------------------------
export type LawId = 'mp' | 'mt' | 'sk' | 'sd';
export const LAW_NAME: Record<LawId, string> = { mp: 'Modus Ponens', mt: 'Modus Tollens', sk: 'hukum Silogisme', sd: 'Silogisme Disjungtif' };
// `use`: indeks premis menurut urutan katalog (0 dan seterusnya) atau n (= jumlah premis) bagi hasil antara (Premis 4).
export type Step = { use: number[]; law: LawId | 'tds'; out: Stmt | null };
export type Base = { code: string; fam: string; premises: Stmt[]; steps: Step[]; key: Stmt | null; target?: Lit };
const bit = (i: number, k: number) => ((i >> k) & 1) === 1;
const pad = (n: number) => String(n).padStart(2, '0');

export const FAM2 = ['MP', 'MT', 'SK', 'SD', 'TK', 'TA', 'NI'] as const;
export type Fam2 = (typeof FAM2)[number];
export const COUNT2: Record<Fam2, number> = { MP: 4, MT: 4, SK: 8, SD: 8, TK: 4, TA: 4, NI: 8 };
export function base2(fam: Fam2, i: number): Base {
  const code = fam + '-' + pad(i + 1);
  if (fam === 'SK') {
    const A = L(0, bit(i, 2)), B = L(1, bit(i, 1)), C = L(2, bit(i, 0));
    return { code, fam, premises: [imp(A, B), imp(B, C)], steps: [{ use: [0, 1], law: 'sk', out: imp(A, C) }], key: imp(A, C) };
  }
  if (fam === 'SD') {
    const j = i >> 1, right = bit(i, 0), A = L(0, bit(j, 1)), B = L(1, bit(j, 0)), key = right ? A : B;
    return { code, fam, premises: [or(A, B), lit(flip(right ? B : A))], steps: [{ use: [0, 1], law: 'sd', out: lit(key) }], key: lit(key) };
  }
  if (fam === 'NI') { // E-08: ¬(A → B) dan ¬B → C menghasilkan C (perluasan premis majemuk)
    const A = L(0, bit(i, 2)), B = L(1, bit(i, 1)), C = L(2, bit(i, 0));
    return { code, fam, premises: [notimp(A, B), imp(flip(B), C)], steps: [{ use: [0, 1], law: 'mp', out: lit(C) }], key: lit(C) };
  }
  const A = L(0, bit(i, 1)), B = L(1, bit(i, 0));
  if (fam === 'MP') return { code, fam, premises: [imp(A, B), lit(A)], steps: [{ use: [0, 1], law: 'mp', out: lit(B) }], key: lit(B) };
  if (fam === 'MT') return { code, fam, premises: [imp(A, B), lit(flip(B))], steps: [{ use: [0, 1], law: 'mt', out: lit(flip(A)) }], key: lit(flip(A)) };
  if (fam === 'TK') return { code, fam, premises: [imp(A, B), lit(B)], steps: [{ use: [0, 1], law: 'tds', out: null }], key: null, target: A };
  return { code, fam, premises: [imp(A, B), lit(flip(A))], steps: [{ use: [0, 1], law: 'tds', out: null }], key: null, target: B };
}

export const COUNT3 = [8, 8, 16, 8, 8, 8, 8, 8, 8, 8, 8]; // T3-01 sampai T3-11 (T3-03 memuat s sehingga 16 variasi)
export function base3(family: number, i: number): Base {
  const n = COUNT3[family - 1], bits = n === 16 ? 4 : 3, at = (k: number) => bit(i, bits - 1 - k);
  const A = L(0, at(0)), B = L(1, at(1)), C = L(2, at(2)), D = L(3, bit(i, 0));
  const code = 'T3-' + pad(family) + '-' + pad(i + 1);
  const mk = (premises: Stmt[], steps: Step[], target?: Lit): Base => ({ code, fam: 'T3-' + pad(family), premises, steps, key: steps[1].out, ...(target ? { target } : {}) });
  const S = (use: number[], law: Step['law'], out: Stmt | null): Step => ({ use, law, out });
  switch (family) {
    case 1: return mk([imp(A, B), imp(B, C), lit(A)], [S([0, 1], 'sk', imp(A, C)), S([3, 2], 'mp', lit(C))]);
    case 2: return mk([imp(A, B), imp(B, C), lit(flip(C))], [S([0, 1], 'sk', imp(A, C)), S([3, 2], 'mt', lit(flip(A)))]);
    case 3: return mk([imp(A, B), imp(B, C), imp(C, D)], [S([0, 1], 'sk', imp(A, C)), S([3, 2], 'sk', imp(A, D))]);
    case 4: return mk([imp(A, B), imp(C, flip(B)), lit(A)], [S([0, 2], 'mp', lit(B)), S([1, 3], 'mt', lit(flip(C)))]);
    case 5: return mk([imp(A, B), imp(flip(A), C), lit(flip(B))], [S([0, 2], 'mt', lit(flip(A))), S([1, 3], 'mp', lit(C))]);
    case 6: return mk([or(A, B), imp(B, C), lit(flip(A))], [S([0, 2], 'sd', lit(B)), S([1, 3], 'mp', lit(C))]);
    case 7: return mk([imp(A, B), or(flip(B), C), lit(A)], [S([0, 2], 'mp', lit(B)), S([1, 3], 'sd', lit(C))]);
    case 8: return mk([or(A, B), imp(C, flip(B)), lit(flip(A))], [S([0, 2], 'sd', lit(B)), S([1, 3], 'mt', lit(flip(C)))]);
    case 9: return mk([or(A, B), or(flip(B), C), lit(flip(A))], [S([0, 2], 'sd', lit(B)), S([1, 3], 'sd', lit(C))]);
    case 10: return mk([imp(A, B), imp(B, C), lit(C)], [S([0, 1], 'sk', imp(A, C)), S([3, 2], 'tds', null)], A);
    default: return mk([imp(A, B), imp(B, C), lit(flip(A))], [S([0, 1], 'sk', imp(A, C)), S([3, 2], 'tds', null)], C);
  }
}
export const ORDERS: number[][] = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]; // U123, U132, U213, U231, U312, U321
export const ORDER_NAMES = ['U123', 'U132', 'U213', 'U231', 'U312', 'U321'];

// ---- Konfigurasi soal -----------------------------------------------------------------------------------------------------
export type Config = { base: Base; forms: Form[]; keyForm: Form; order: number };
const SK_LIKE = (base: Base) => base.key?.op === 'imp'; // kunci berupa hubungan: boleh berbentuk I, D, atau K
export const keyForms = (base: Base): Form[] => SK_LIKE(base) ? [0, 1, 2] : [0];
// Premis yang ditampilkan menurut urutan penyajian (indeks katalog dalam `order`, atau [0, 1] / [1, 0] pada dua premis).
export const shownOrder = (config: Config) => config.base.premises.length === 2 ? (config.order === 0 ? [0, 1] : [1, 0]) : ORDERS[config.order];
export function codeOf(config: Config): string {
  const n = config.base.premises.length;
  return config.base.code + '-E' + config.forms.join('') + '-K' + config.keyForm + '-U' + (n === 2 ? config.order : ORDER_NAMES[config.order].slice(1));
}
// Seluruh konfigurasi katalog (tanpa perluasan De Morgan dan NI): 576 untuk dua premis, 12.096 untuk tiga premis (Bagian 4.4 dan 14).
export function allConfigs(premises: 2 | 3): Config[] {
  const out: Config[] = [];
  const bases: Base[] = premises === 2 ? FAM2.filter((f) => f !== 'NI').flatMap((f) => Array.from({ length: COUNT2[f] }, (_, i) => base2(f, i))) :
    COUNT3.flatMap((count, f) => Array.from({ length: count }, (_, i) => base3(f + 1, i)));
  for (const base of bases) {
    const choices = base.premises.map((p) => formsOf(p, false));
    const combos = choices.reduce<Form[][]>((acc, list) => acc.flatMap((prefix) => list.map((form) => [...prefix, form])), [[]]);
    for (const forms of combos) for (const keyForm of keyForms(base)) for (let order = 0; order < (premises === 2 ? 2 : 6); order++) out.push({ base, forms, keyForm, order });
  }
  return out;
}

// ---- Keluarga modus (keberagaman satu paket) ----------------------------------------------------------------------------------
// Sebuah soal digolongkan ke tepat satu keluarga menurut hukum yang dipakainya. Urutan penentu (yang lebih khas menang): TDS bila ada langkah "tidak dapat disimpulkan"; NEG bila ada premis berbentuk
// negasi majemuk (De Morgan atau negasi implikasi, perluasan pada Silogisme Biasa); SD bila ada Silogisme Disjungtif; MT bila ada Modus Tollens; MP bila ada Modus Ponens; selain itu SK (rantai silogisme murni).
// Contoh: T3-01 (rantai lalu Modus Ponens) = MP, T3-04 (MP lalu MT) = MT, T3-07 (MP lalu SD) = SD, N3-03 (tiga aturan) = SK. Blueprint Bagian B melarang De Morgan dan negasi implikasi sebagai langkah
// penyelesaian narasi, jadi NEG hanya muncul pada Silogisme Biasa. Satu paket tryout memuat lima butir silogisme dengan keluarga berbeda (lib/silo-rencana.ts).
export type Keluarga = 'MP' | 'MT' | 'SK' | 'SD' | 'NEG' | 'TDS';
export const KELUARGA: Keluarga[] = ['MP', 'MT', 'SK', 'SD', 'NEG', 'TDS'];
export const KELUARGA_NAME: Record<Keluarga, string> = { MP: 'Modus Ponens', MT: 'Modus Tollens', SK: 'Silogisme (rantai)', SD: 'Silogisme Disjungtif', NEG: 'Negasi majemuk (De Morgan atau negasi implikasi)', TDS: 'Tidak dapat disimpulkan' };
export function keluargaOfLaws(laws: readonly (LawId | 'tds')[], negasiMajemuk: boolean): Keluarga {
  if (laws.includes('tds')) return 'TDS';
  if (negasiMajemuk) return 'NEG';
  return laws.includes('sd') ? 'SD' : laws.includes('mt') ? 'MT' : laws.includes('mp') ? 'MP' : 'SK';
}
export const keluargaOfConfig = (config: Config): Keluarga => keluargaOfLaws(config.base.steps.map((step) => step.law), config.base.fam === 'NI' || config.forms.includes(3));
// Dari kode butir pembangkit ("MP-03-E10-K0-U1", "T3-04-01-E000-K0-U132", "NI-02-…"); angka E memuat 3 bila ada premis berbentuk De Morgan. Kode contoh blueprint (N2-01 dan seterusnya): lib/silo-contoh.ts.
export function keluargaOfCatalogCode(code: string): Keluarga | undefined {
  const m = /^(MP|MT|SK|SD|TK|TA|NI|T3)-(\d+)(?:-(\d+))?-E(\d+)-K\d-U\w+$/.exec(code);
  if (!m) return undefined;
  const negasi = m[4].includes('3') || m[1] === 'NI'; // NI (negasi implikasi) selalu NEG, sama dengan keluargaOfConfig
  if (m[1] === 'T3') return keluargaOfLaws(base3(Number(m[2]), Number(m[3]) - 1).steps.map((step) => step.law), negasi);
  return keluargaOfLaws(base2(m[1] as Fam2, Number(m[2]) - 1).steps.map((step) => step.law), negasi);
}
