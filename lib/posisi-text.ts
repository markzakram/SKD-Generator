// Bahasa soal susunan dan posisi, urutan dan peringkat, serta jadwal: kalimat petunjuk (stem), sebutan tempat, pertanyaan bertema, dan kalimat penalaran pembahasan.
// Petunjuk ditulis sebagai paragraf (jadwal: daftar bernomor, seperti contoh panduan); pembahasan mengalir dari petunjuk pasti ("sehingga ..."), memuat hanya langkah yang
// diperlukan, mencoret kemungkinan yang gugur beserta alasannya, lalu menyajikan susunan akhir (Panduan Produksi Soal TIU JadiASN, contoh Susunan dan Posisi, Urutan dan Peringkat,
// Jadwal). Kata sambung dan bentuk kalimat bergilir menurut urutan kalimat dan sidik soal, sehingga satu pembahasan tidak diawali "Karena" terus-menerus.
import { colOf, isTheme, rowOf, seatCount, type Fact, type Geo, type Linear } from './posisi-model';
import type { Step } from './posisi-deduce';

export const NUM = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'];
export const ORD = ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam', 'ketujuh', 'kedelapan', 'kesembilan', 'kesepuluh'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const mid = (text: string) => /^(Tepat|Ada|Terdapat)\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
// Urutan nama dipisah " - " seperti contoh panduan; nama berupa satu huruf (A - B - C) memakai " – " karena huruf yang dipisah tanda hubung dibaca penata rumus sebagai pengurangan dan digambar sebagai rumus.
export const chain = (seq: string[], glue = ' - ') => seq.join(seq.every((name) => name.length === 1) ? ' – ' : glue);
const list = (items: string[], last = 'dan') => items.length > 2 ? items.slice(0, -1).join(', ') + ', ' + last + ' ' + items[items.length - 1] : items.join(' ' + last + ' ');

type LinearGeo = Extract<Geo, { form: 'linear' }>;
const LINEAR: Record<Linear, { v: string; lo: string; hi: string; loEnd: string; hiEnd: string; noun: string }> = {
  berdiri: { v: 'berdiri', lo: 'kiri', hi: 'kanan', loEnd: 'paling kiri', hiEnd: 'paling kanan', noun: 'posisi' },
  duduk: { v: 'duduk', lo: 'kiri', hi: 'kanan', loEnd: 'paling kiri', hiEnd: 'paling kanan', noun: 'posisi' },
  antre: { v: 'mengantre', lo: 'depan', hi: 'belakang', loEnd: 'paling depan', hiEnd: 'paling belakang', noun: 'urutan' },
  // Gaya bertema (Urutan dan Peringkat, Jadwal): ujung disebut "pertama" dan "terakhir".
  lomba: { v: 'finis', lo: 'awal', hi: 'akhir', loEnd: 'pertama', hiEnd: 'terakhir', noun: 'posisi' },
  nilai: { v: 'berada', lo: 'atas', hi: 'bawah', loEnd: 'pertama', hiEnd: 'terakhir', noun: 'urutan' },
  datang: { v: 'tiba', lo: 'awal', hi: 'akhir', loEnd: 'pertama', hiEnd: 'terakhir', noun: 'urutan' },
  tinggi: { v: 'berada', lo: 'atas', hi: 'bawah', loEnd: 'pertama', hiEnd: 'terakhir', noun: 'urutan' },
  jadwal: { v: 'dijadwalkan', lo: 'awal', hi: 'akhir', loEnd: 'pertama', hiEnd: 'terakhir', noun: 'hari' },
};
export const linearWords = (geo: LinearGeo) => LINEAR[geo.style];
const COLS: Record<number, string[]> = { 2: ['kursi kiri', 'kursi kanan'], 3: ['kursi kiri', 'kursi tengah', 'kursi kanan'] };
const isJadwal = (geo: Geo) => geo.form === 'linear' && geo.style === 'jadwal';
// "berada di" untuk susunan dan peringkat, "dijadwalkan pada" untuk jadwal; `spot` = sebutan tempat pada kalimat ("tempat yang tersisa").
const is = (geo: Geo) => isJadwal(geo) ? 'dijadwalkan pada' : 'berada di';
const spot = (geo: Geo) => geo.form === 'linear' ? LINEAR[geo.style].noun : 'kursi';
const fill = (geo: Geo) => isJadwal(geo) ? 'diisi oleh' : 'ditempati';

// ---- Sebutan tempat dan himpunan tempat ----------------------------------------------------------------------------------------------------
export function seatText(geo: Geo, seat: number): string {
  if (geo.form === 'linear') return geo.labels ? 'hari ' + geo.labels[seat] : LINEAR[geo.style].noun + ' ke-' + (seat + 1);
  if (geo.form === 'circular') return 'kursi ' + (seat + 1);
  return 'baris ' + (rowOf(geo, seat) + 1) + ' ' + COLS[geo.cols][colOf(geo, seat)];
}
const ranges = (values: number[]) => {
  const out: number[][] = [];
  for (const v of values) { const last = out[out.length - 1]; if (last && v === last[last.length - 1] + 1) last.push(v); else out.push([v]); }
  return out;
};
// `or` = kata penghubung daftar ("atau" untuk kemungkinan, "dan" untuk tempat yang sudah terpakai, "maupun" untuk larangan).
export function domainText(geo: Geo, domain: number[], or = 'atau'): string {
  if (geo.form === 'grid') {
    // Dua penyajian dipilih yang lebih pendek: per baris ("baris 1 atau baris 2 kursi kiri") atau per kolom ("kursi kanan pada baris 1 sampai 3").
    const rows = [...new Set(domain.map((s) => rowOf(geo, s)))], cols = [...new Set(domain.map((s) => colOf(geo, s)))], byRow: string[] = [], byCol: string[] = [];
    for (const row of rows) {
      const here = domain.filter((s) => rowOf(geo, s) === row);
      byRow.push(here.length === geo.cols ? 'baris ' + (row + 1) : 'baris ' + (row + 1) + ' ' + list(here.map((s) => COLS[geo.cols][colOf(geo, s)]), or));
    }
    for (const col of cols) {
      const here = domain.filter((s) => colOf(geo, s) === col).map((s) => rowOf(geo, s)), runs = ranges(here);
      byCol.push(here.length === geo.rows ? COLS[geo.cols][col] : COLS[geo.cols][col] + ' pada baris ' + (here.length > 2 && runs.length === 1 ? here[0] + 1 + ' sampai ' + (here[here.length - 1] + 1) : list(here.map((v) => String(v + 1)), or)));
    }
    const a = list(byRow, or), b = list(byCol, or);
    return b.length < a.length ? b : a;
  }
  const noun = geo.form === 'linear' ? LINEAR[geo.style].noun : 'kursi', mark = (s: number) => geo.form === 'linear' ? (geo.labels ? geo.labels[s] : 'ke-' + (s + 1)) : String(s + 1);
  const runs = ranges(domain);
  if (domain.length > 2 && runs.length === 1) return noun + ' ' + mark(domain[0]) + ' sampai ' + mark(domain[domain.length - 1]);
  return noun + ' ' + list(domain.map(mark), or);
}
const rowWord = (row: number) => 'baris ' + ORD[row];

// ---- Kalimat petunjuk (satu fakta = satu kalimat tanpa titik) ------------------------------------------------------------------------
// Frasa tempat untuk gaya bertema: "di posisi pertama", "di urutan ke-3", "pada hari Rabu atau Jumat".
function atPhrase(geo: LinearGeo, seats: number[]): string {
  const n = geo.n, one = (s: number) => geo.labels ? geo.labels[s] : s === 0 ? 'pertama' : s === n - 1 ? 'terakhir' : 'ke-' + (s + 1);
  return (geo.labels ? 'pada hari ' : 'di ' + LINEAR[geo.style].noun + ' ') + list(seats.map(one), 'atau');
}
// Hubungan bertema: [kalimat bila w benar, kalimat bila w salah]. `next` = a tepat setelah b; `before` = a lebih awal daripada b (a di depan b).
const NEXT: Record<string, (a: string, b: string, w: boolean) => string> = {
  lomba: (a, b, w) => w ? b + ' memasuki garis finis tepat sebelum ' + a : a + ' memasuki garis finis tepat setelah ' + b,
  nilai: (a, b, w) => w ? b + ' berada tepat satu urutan di atas ' + a : a + ' berada tepat satu urutan di bawah ' + b,
  datang: (a, b, w) => w ? b + ' tiba tepat sebelum ' + a : a + ' tiba tepat setelah ' + b,
  tinggi: (a, b, w) => w ? b + ' berada tepat satu urutan lebih tinggi daripada ' + a : a + ' berada tepat satu urutan lebih pendek daripada ' + b,
  jadwal: (a, b, w) => w ? b + ' dijadwalkan tepat sehari sebelum ' + a : a + ' dijadwalkan tepat sehari setelah ' + b,
};
const BEFORE: Record<string, (a: string, b: string, w: boolean) => string> = {
  lomba: (a, b, w) => w ? b + ' lebih lambat daripada ' + a : a + ' lebih cepat daripada ' + b,
  nilai: (a, b, w) => w ? b + ' memperoleh nilai lebih rendah daripada ' + a : a + ' memperoleh nilai lebih tinggi daripada ' + b,
  datang: (a, b, w) => w ? b + ' tiba lebih lambat daripada ' + a : a + ' tiba lebih awal daripada ' + b,
  tinggi: (a, b, w) => w ? b + ' lebih pendek daripada ' + a : a + ' lebih tinggi daripada ' + b,
  jadwal: (a, b, w) => w ? b + ' dijadwalkan setelah ' + a : a + ' dijadwalkan sebelum ' + b,
};
const BESIDE: Record<string, [string, string]> = {
  lomba: ['finis berurutan', 'tidak finis berurutan'], nilai: ['berada pada urutan yang berdekatan', 'tidak berada pada urutan yang berdekatan'],
  datang: ['tiba berurutan', 'tidak tiba berurutan'], tinggi: ['berada pada urutan yang berdekatan', 'tidak berada pada urutan yang berdekatan'],
  jadwal: ['dijadwalkan pada hari yang berurutan', 'tidak dijadwalkan pada hari yang berurutan'],
};
function themeClause(f: Fact, geo: LinearGeo): string {
  const w = LINEAR[geo.style], s = geo.style;
  switch (f.k) {
    case 'at': return f.a + ' ' + w.v + ' ' + atPhrase(geo, f.seats);
    case 'next': return NEXT[s](f.a, f.b, !!f.w);
    case 'before': return BEFORE[s](f.a, f.b, !!f.w);
    case 'beside': return f.a + ' dan ' + f.b + ' ' + BESIDE[s][0];
    case 'between': return f.a + ' ' + w.v + ' tepat di antara ' + f.b + ' dan ' + f.c;
    case 'gap': return s === 'jadwal' ? 'Terdapat tepat ' + NUM[f.n] + ' hari di antara jadwal ' + f.a + ' dan ' + f.b : 'Tepat ' + NUM[f.n] + ' orang ' + w.v + ' di antara ' + f.a + ' dan ' + f.b;
    case 'order': return chain(f.seq);
    default: return '';
  }
}
function themeNegative(f: Fact, geo: LinearGeo): string {
  const w = LINEAR[geo.style], n = geo.n, s = geo.style, lab = (i: number) => geo.labels ? geo.labels[i] : i === 0 ? 'pertama' : i === n - 1 ? 'terakhir' : 'ke-' + (i + 1);
  const head = geo.labels ? 'pada hari ' : 'di ' + w.noun + ' ';
  if (f.k === 'at') {
    const seats = f.seats;
    if (seats.length === 2 && seats[0] === 0 && seats[1] === n - 1) return f.a + ' tidak ' + w.v + ' ' + head + lab(0) + ' maupun ' + lab(n - 1);
    if (seats.length >= 2 && seats[0] === 0 && seats.every((v, i) => v === i)) return f.a + ' tidak ' + w.v + (geo.labels ? ' pada ' : ' di antara ') + NUM[seats.length] + ' ' + w.noun + ' pertama';
    if (seats.length >= 2 && seats[seats.length - 1] === n - 1 && seats.every((v, i) => v === n - seats.length + i)) return f.a + ' tidak ' + w.v + (geo.labels ? ' pada ' : ' di antara ') + NUM[seats.length] + ' ' + w.noun + ' terakhir';
    return f.a + ' tidak ' + w.v + ' ' + head + list(seats.map(lab), 'maupun');
  }
  if (f.k === 'beside') return f.a + ' dan ' + f.b + ' ' + BESIDE[s][1];
  if (f.k === 'gap') return f.a + ' dan ' + f.b + ' tidak dipisahkan oleh tepat ' + NUM[f.n] + (s === 'jadwal' ? ' hari' : ' orang');
  if (f.k === 'next') return f.a + ' tidak ' + (s === 'lomba' ? 'memasuki garis finis tepat setelah ' : s === 'jadwal' ? 'dijadwalkan tepat sehari setelah ' : w.v + ' tepat setelah ') + f.b;
  throw new Error('Kalimat negatif belum tersedia untuk ' + f.k);
}

export function clause(f: Fact, geo: Geo): string {
  if (f.k === 'not') return negative(f.f, geo);
  if (geo.form === 'linear' && isTheme(geo.style)) return themeClause(f, geo);
  if (geo.form === 'linear') {
    const w = LINEAR[geo.style], n = geo.n, antre = geo.style === 'antre';
    const adjacent = (side: string) => antre ? 'tepat di ' + side : 'tepat di sebelah ' + side, far = (side: string) => antre ? 'di ' + side : 'di sebelah ' + side;
    switch (f.k) {
      case 'at': {
        if (f.seats.length === 1) {
          const s = f.seats[0];
          return f.a + ' ' + w.v + ' ' + (s === 0 ? 'di ' + w.noun + ' ' + w.loEnd : s === n - 1 ? 'di ' + w.noun + ' ' + w.hiEnd : n % 2 && s === (n - 1) / 2 ? 'tepat di tengah' : 'di ' + w.noun + ' ke-' + (s + 1));
        }
        return f.seats.length === 2 && f.seats[0] === 0 && f.seats[1] === n - 1 ? f.a + ' ' + w.v + ' di salah satu ujung' : f.a + ' ' + w.v + ' di ' + w.noun + ' ' + list(f.seats.map((s) => 'ke-' + (s + 1)), 'atau');
      }
      case 'next': return f.w ? f.a + ' ' + w.v + ' ' + adjacent(w.hi) + ' ' + f.b : f.b + ' ' + w.v + ' ' + adjacent(w.lo) + ' ' + f.a;
      case 'before': return f.w ? f.b + ' ' + w.v + ' ' + far(w.hi) + ' ' + f.a : f.a + ' ' + w.v + ' ' + far(w.lo) + ' ' + f.b;
      case 'beside': return f.a + ' ' + w.v + ' di samping ' + f.b;
      case 'between': return f.a + ' ' + w.v + ' tepat di antara ' + f.b + ' dan ' + f.c;
      case 'gap': return 'Tepat ' + NUM[f.n] + ' orang ' + w.v + ' di antara ' + f.a + ' dan ' + f.b;
      case 'order': return chain(f.seq);
      default: return '';
    }
  }
  if (geo.form === 'circular') {
    switch (f.k) {
      case 'next': return f.w ? f.b + ' duduk tepat di sebelah kanan ' + f.a : f.a + ' duduk tepat di sebelah kiri ' + f.b;
      case 'beside': return f.a + ' duduk di samping ' + f.b;
      case 'between': return f.a + ' duduk tepat di antara ' + f.b + ' dan ' + f.c;
      case 'opposite': return f.a + ' duduk berhadapan dengan ' + f.b;
      case 'order': return chain(f.seq);
      default: return '';
    }
  }
  switch (f.k) {
    case 'row': return list(f.who) + ' duduk di ' + list(f.rows.map(rowWord), 'atau');
    case 'col': return list(f.who) + ' duduk di ' + list(f.cols.map((c) => COLS[geo.cols][c]), 'atau');
    case 'sameRow': return f.a + ' dan ' + f.b + ' duduk bersama pada satu baris';
    case 'sameCol': return f.a + ' dan ' + f.b + ' duduk pada kolom yang sama';
    case 'next': return f.w ? f.b + ' duduk tepat di depan ' + f.a : f.a + ' duduk tepat di belakang ' + f.b;
    case 'beside': return f.a + ' duduk di samping ' + f.b;
    case 'before': return f.a + ' duduk di baris yang lebih depan daripada ' + f.b;
    default: return '';
  }
}
function negative(f: Fact, geo: Geo): string {
  if (geo.form === 'linear' && isTheme(geo.style)) return themeNegative(f, geo);
  if (geo.form === 'linear') {
    const w = LINEAR[geo.style], n = geo.n;
    if (f.k === 'at') {
      const s = f.seats;
      if (s.length === 2 && s[0] === 0 && s[1] === n - 1) return f.a + ' tidak ' + w.v + ' di ' + w.noun + ' ' + w.loEnd + ' maupun ' + w.hiEnd;
      if (s.length >= 2 && s[0] === 0 && s.every((v, i) => v === i)) return f.a + ' tidak ' + w.v + ' di antara ' + NUM[s.length] + ' ' + w.noun + ' pertama';
      if (s.length >= 2 && s[s.length - 1] === n - 1 && s.every((v, i) => v === n - s.length + i)) return f.a + ' tidak ' + w.v + ' di antara ' + NUM[s.length] + ' ' + w.noun + ' terakhir';
      return f.a + ' tidak ' + w.v + ' di ' + w.noun + ' ' + list(s.map((v) => 'ke-' + (v + 1)), 'maupun');
    }
    if (f.k === 'beside') return f.a + ' tidak ' + w.v + ' di samping ' + f.b;
    if (f.k === 'gap') return f.a + ' dan ' + f.b + ' tidak dipisahkan oleh tepat ' + NUM[f.n] + ' orang';
    if (f.k === 'next') return f.a + ' tidak ' + w.v + ' tepat setelah ' + f.b;
  }
  if (geo.form === 'circular') {
    if (f.k === 'beside') return f.a + ' tidak duduk di samping ' + f.b;
    if (f.k === 'opposite') return f.a + ' tidak duduk berhadapan dengan ' + f.b;
  }
  if (geo.form === 'grid') {
    if (f.k === 'row') return list(f.who) + ' tidak duduk di ' + list(f.rows.map(rowWord), 'maupun');
    if (f.k === 'col') return list(f.who) + ' tidak duduk di ' + list(f.cols.map((c) => COLS[geo.cols][c]), 'maupun');
    if (f.k === 'sameRow') return f.a + ' dan ' + f.b + ' tidak duduk pada baris yang sama';
    if (f.k === 'sameCol') return f.a + ' dan ' + f.b + ' tidak duduk pada kolom yang sama';
    if (f.k === 'beside') return f.a + ' tidak duduk di samping ' + f.b;
  }
  throw new Error('Kalimat negatif belum tersedia untuk ' + f.k);
}
// Kalimat yang satu subjek digabung: "E tidak berdiri di samping C dan tidak berada di antara tiga posisi pertama." Hanya fakta berpredikat sederhana.
export function clueSentences(clues: Fact[], geo: Geo): string[] {
  const texts = clues.map((f) => clause(f, geo)), out: string[] = [];
  const subject = (f: Fact) => f.k === 'at' || (f.k === 'not' && f.f.k === 'at') ? (f.k === 'at' ? f.a : (f.f as Extract<Fact, { k: 'at' }>).a) : undefined;
  for (let i = 0; i < clues.length; i++) {
    const s = subject(clues[i]);
    if (s !== undefined && i + 1 < clues.length && subject(clues[i + 1]) === s && texts[i].startsWith(s + ' ') && texts[i + 1].startsWith(s + ' ') && clues[i].k === 'not' && clues[i + 1].k === 'not') {
      out.push(texts[i] + ' dan ' + texts[i + 1].slice(s.length + 1)); i++;
    } else out.push(texts[i]);
  }
  return out.map((text) => cap(text) + '.');
}

// ---- Pertanyaan bertema (Urutan dan Peringkat, Jadwal) --------------------------------------------------------------------------------------
export type ThemeAsk = { ask: string; conclusion: string };
const orderPhrase = (geo: LinearGeo) => ({
  lomba: 'urutan peserta dari posisi pertama hingga terakhir', nilai: 'urutan peserta dari nilai tertinggi hingga terendah', datang: 'urutan kedatangan dari yang pertama hingga terakhir',
  tinggi: 'urutan dari yang tertinggi hingga terendah', jadwal: 'jadwal dari hari ' + (geo.labels?.[0] ?? '') + ' sampai hari ' + (geo.labels?.[geo.n - 1] ?? ''),
} as Record<string, string>)[geo.style] ?? 'urutan';
const whoAsk = (geo: LinearGeo) => !geo.who || geo.who === 'orang' ? 'Siapakah yang' : cap(geo.who) + ' apakah yang';
// kind: siapa-posisi (seat), posisi-orang (person, seat), siapa-samping (person, side: 'hi' = tepat setelah), urutan (seq, dengan "formed" sebagai teks susunan).
export function themeAsk(geo: LinearGeo, kind: string, a: { seat?: number; person?: string; side?: 'lo' | 'hi'; answer?: string; seq?: string[] }): ThemeAsk {
  const w = LINEAR[geo.style], n = geo.n, who = !geo.who || geo.who === 'orang' ? 'orang' : geo.who;
  const where = (s: number) => geo.labels ? 'pada hari ' + geo.labels[s] : 'di ' + w.noun + ' ' + (s === 0 ? 'pertama' : s === n - 1 ? 'terakhir' : 'ke-' + (s + 1));
  if (kind === 'siapa-posisi') return { ask: whoAsk(geo) + ' ' + w.v + ' ' + where(a.seat!) + '?', conclusion: 'Dengan demikian, ' + who + ' yang ' + w.v + ' ' + where(a.seat!) + ' adalah ' + a.answer + '.' };
  if (kind === 'posisi-orang') {
    return geo.labels ? { ask: 'Pada hari apakah ' + a.person + ' dijadwalkan?', conclusion: 'Dengan demikian, ' + a.person + ' dijadwalkan ' + where(a.seat!) + '.' }
      : { ask: 'Di ' + w.noun + ' keberapakah ' + a.person + ' ' + w.v + '?', conclusion: 'Dengan demikian, ' + a.person + ' ' + w.v + ' di ' + w.noun + ' ke-' + (a.seat! + 1) + '.' };
  }
  if (kind === 'siapa-samping') {
    const hi = a.side === 'hi', rel = geo.style === 'jadwal' ? (hi ? 'tepat sehari setelah ' : 'tepat sehari sebelum ') + a.person
      : geo.style === 'nilai' || geo.style === 'tinggi' ? 'tepat satu urutan di ' + (hi ? 'bawah ' : 'atas ') + a.person : 'tepat ' + (hi ? 'setelah ' : 'sebelum ') + a.person;
    return { ask: whoAsk(geo) + ' ' + w.v + ' ' + rel + '?', conclusion: 'Dengan demikian, ' + who + ' yang ' + w.v + ' ' + rel + ' adalah ' + a.answer + '.' };
  }
  return { ask: cap(orderPhrase(geo)) + ' yang sesuai dengan seluruh informasi adalah ...', conclusion: 'Dengan demikian, ' + orderPhrase(geo) + ' adalah ' + chain(a.seq!) + '.' };
}
// Kalimat susunan akhir sebelum kesimpulan (hanya bila pertanyaannya bukan susunan lengkap).
export function formedText(geo: LinearGeo, seq: string[]): string {
  if (!isTheme(geo.style)) return 'Susunan dari ' + (LINEAR[geo.style].lo === 'kiri' ? 'kiri ke kanan' : 'depan ke belakang') + ' yang terbentuk adalah ' + list(seq) + '.';
  return (geo.style === 'jadwal' ? 'Jadwal dari hari ' + geo.labels![0] + ' sampai hari ' + geo.labels![geo.n - 1] + ' yang terbentuk adalah ' : 'Urutan yang terbentuk adalah ') + chain(seq) + '.';
}

// ---- Kalimat penalaran ----------------------------------------------------------------------------------------------------------------------
export type TextCtx = { geo: Geo; clues: Fact[]; names: string[] };
const total = (c: TextCtx) => seatCount(c.geo);
const only = (geo: Geo, alt: boolean) => 'hanya ' + (alt ? 'dapat' : 'mungkin') + ' ' + is(geo);
const result = (c: TextCtx, person: string, domain: number[], alt = false) => person + (domain.length === 1 ? ' ' + is(c.geo) + ' ' + seatText(c.geo, domain[0]) : ' ' + only(c.geo, alt) + ' ' + domainText(c.geo, domain));
// Hasil beberapa orang digabung: orang dengan hasil yang sama disatukan ("A dan B hanya mungkin berada di ...").
function results(c: TextCtx, items: [string, number[]][], alt = false): string {
  const groups = new Map<string, string[]>();
  for (const [person, domain] of items) {
    const key = domain.length === 1 ? 'tunggal:' + domain[0] : 'banyak:' + domain.join(',');
    groups.set(key, [...(groups.get(key) ?? []), person]);
  }
  return list([...groups].map(([key, who]) => {
    const domain = key.split(':')[1].split(',').map(Number);
    return list(who) + (key.startsWith('tunggal') ? ' ' + is(c.geo) + ' ' + seatText(c.geo, domain[0]) : ' ' + only(c.geo, alt) + ' ' + domainText(c.geo, domain));
  }));
}
// Dasar yang sudah diketahui (domain orang lain dalam petunjuk yang sama). Domain yang hampir seluruh tempat disebut lewat tempat yang dikecualikan ("tidak berada di ...").
function premise(c: TextCtx, person: string, domain: number[], alt: boolean): string {
  const all = Array.from({ length: total(c) }, (_, i) => i), out = all.filter((s) => !domain.includes(s));
  if (domain.length > 1 && total(c) >= 5 && out.length <= 2) return person + ' tidak ' + is(c.geo) + ' ' + domainText(c.geo, out, 'maupun');
  return result(c, person, domain, alt);
}
const premisesOf = (c: TextCtx, ctx: Record<string, number[]>, alt: boolean) => Object.entries(ctx).filter(([, domain]) => domain.length < total(c)).map(([q, domain]) => premise(c, q, domain, alt));
// Kalimat "Karena ... dan ... dan ..., maka ..." (tiga klausa bertumpuk) tidak dipakai: bentuk lain dipilih.
const stacked = (text: string) => text.startsWith('Karena ') && (text.split(/, (?:maka|sehingga) /)[0].match(/ dan /g) ?? []).length >= 2;
const hash = (text: string) => { let h = 7; for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

type Clue = Extract<Step, { kind: 'clue' }>;
type Elim = Extract<Step, { kind: 'elim' }>;
// Penyusun kalimat langkah. Setiap jenis kalimat memutar beberapa bentuk (urutan dimulai dari sidik soal), sehingga kalimat berurutan tidak memakai kerangka yang sama.
export function stepSentences(c: TextCtx, steps: Step[]): string[] {
  const out: string[] = [], seed = hash(c.names.join('|') + JSON.stringify(c.clues));
  const turn: Record<string, number> = {};
  const next = (kind: string, cycle: number[]) => cycle[((turn[kind] = (turn[kind] ?? seed % 7) + 1) - 1) % cycle.length];
  let tick = seed % 2;
  const alt = () => tick++ % 2 === 1;
  const link = () => ['Akibatnya', 'Artinya', 'Oleh karena itu', 'Dengan begitu'][next('sambung', [0, 1, 2, 3])];
  const geo = c.geo;
  // Petunjuk: satu kalimat untuk sekelompok langkah petunjuk yang sama.
  const clueSentence = (group: Clue[]): string => {
    const f = c.clues[group[0].clue], cl = clause(f, geo), items = group.map((s): [string, number[]] => [s.person, s.after]);
    if (f.k === 'at' && f.seats.length === 1 && geo.form === 'linear') {
      const s = f.seats[0], n = geo.n;
      if (!isTheme(geo.style) && n % 2 && s === (n - 1) / 2 && !/di posisi ke-|di urutan ke-/.test(cl)) return 'Posisi tengah dari ' + NUM[n] + ' tempat adalah ' + seatText(geo, s) + ', sehingga ' + f.a + ' ' + is(geo) + ' ' + seatText(geo, s) + '.';
      if (!/ ke-\d/.test(cl) && !geo.labels) return cl + ', yaitu ' + seatText(geo, s) + '.';
      return cl + '.';
    }
    const premises = premisesOf(c, group[0].ctx, alt()), R = results(c, items, alt());
    if (!premises.length) {
      switch (next('tanpa', [0, 1, 2, 0, 3, 2])) {
        case 0: return cap(cl) + ', sehingga ' + R + '.';
        case 1: return cap(cl) + '. ' + link() + ', ' + R + '.';
        case 2: return 'Berdasarkan petunjuk bahwa ' + mid(cl) + ', maka ' + R + '.';
        default: { const text = 'Karena ' + mid(cl) + ', maka ' + R + '.'; return stacked(text) ? cap(cl) + ', sehingga ' + R + '.' : text; }
      }
    }
    if (premises.length === 1) {
      const p = premises[0];
      switch (next('satu', [1, 0, 2, 3, 1, 2, 3])) {
        case 0: { const text = 'Karena ' + p + ' dan ' + mid(cl) + ', maka ' + R + '.'; return stacked(text) ? 'Mengingat ' + p + ', ' + mid(cl) + ', sehingga ' + R + '.' : text; }
        case 1: return cap(cl) + '. ' + cap(p) + ', sehingga ' + R + '.';
        case 2: return 'Mengingat ' + p + ', ' + mid(cl) + ', sehingga ' + R + '.';
        // Subjek petunjuk yang berpasangan ("Intan dan Nando duduk bersama ...") tidak disambung dengan ", dan": dua "dan" berturutan. Petunjuk menjadi kalimat sendiri.
        default: return /^\S+ dan /.test(mid(cl)) ? cap(p) + '. ' + cap(cl) + '. ' + link() + ', ' + R + '.' : cap(p) + ', dan ' + mid(cl) + '. ' + link() + ', ' + R + '.';
      }
    }
    // Dua dasar atau lebih: petunjuk disebut sendiri lebih dahulu, supaya satu kalimat tidak menampung tiga klausa.
    const p1 = premises[0], p2 = list(premises.slice(1));
    switch (next('dua', [1, 2, 0, 2, 1])) {
      case 0: { const text = cap(cl) + '. Karena ' + p1 + ' dan ' + p2 + ', maka ' + R + '.'; return text; }
      case 1: return cap(cl) + '. Mengingat ' + p1 + ' dan ' + p2 + ', ' + R + '.';
      default: return cap(cl) + '. ' + cap(p1) + ' dan ' + p2 + ', sehingga ' + R + '.';
    }
  };
  // Pernyataan singkat satu langkah di dalam pengandaian: hasilnya beserta dasarnya.
  const chainItem = (step: Step): string => {
    if (step.kind !== 'refute' && !step.after.length) return ''; // langkah yang menimbulkan kontradiksi dinyatakan oleh kalimat akibat
    if (step.kind === 'clue') return result(c, step.person, step.after, alt()) + ' karena ' + mid(clause(c.clues[step.clue], geo));
    if (step.kind === 'elim') return result(c, step.person, step.after, alt()) + ', sebab ' + step.holder + ' sudah ' + is(geo) + ' ' + seatText(geo, step.seat);
    if (step.kind === 'single') return step.person + ' ' + is(geo) + ' ' + seatText(geo, step.seat) + ', satu-satunya yang masih dapat menempatinya';
    return '';
  };
  // Pencoretan: tempat yang sudah dipakai tidak tersedia lagi. Langkah yang tidak menempatkan siapa pun dan tidak dipakai sesudahnya dilewati.
  const elimSentence = (run: Elim[], later: Step[]): string | undefined => {
    const holders = [...new Map(run.map((s) => [s.holder + ':' + s.seat, s] as const)).values()], people = [...new Set(run.map((s) => s.person))];
    const last = new Map(run.map((s) => [s.person, s] as const)), fixed = [...last.values()].filter((s) => s.after.length === 1);
    const taken = holders.map((h) => h.holder + ' sudah ' + is(geo) + ' ' + seatText(geo, h.seat)), byseat = holders.slice().sort((a, b) => a.seat - b.seat);
    const seatsTaken = cap(domainText(geo, byseat.map((h) => h.seat), 'dan')) + ' sudah ' + fill(geo) + ' ' + list(byseat.map((h) => h.holder));
    if (!fixed.length) {
      const used = later.some((s) => s.kind === 'clue' && people.some((p) => p in s.ctx && s.ctx[p].length < total(c)));
      if (!used) return undefined;
      return seatsTaken + ', sehingga tidak tersedia bagi ' + (people.length > 3 ? 'orang lain' : list(people)) + '.';
    }
    if (people.length === 1) {
      const step = fixed[0], first = run[0], gone = holders.filter((h) => first.before.includes(h.seat)), P = step.person, rest = seatText(geo, step.after[0]);
      const left = first.before.length === total(c) ? 'semua ' + spot(geo) : domainText(geo, first.before), goneText = domainText(geo, gone.map((h) => h.seat).sort((a, b) => a - b), 'dan');
      switch (next('elim', [0, 2, 1, 0, 2])) {
        case 0: return cap(left) + ' masih terbuka bagi ' + P + ', tetapi ' + goneText + ' sudah ' + fill(geo) + ' ' + list(gone.map((h) => h.holder)) + ', sehingga ' + P + ' ' + is(geo) + ' ' + rest + '.';
        case 1: if (gone.length > 1) return list(taken) + ', sehingga ' + P + ' ' + is(geo) + ' ' + rest + '.';
          return 'Karena ' + list(taken) + ', ' + P + ' tidak dapat lagi ' + (isJadwal(geo) ? 'dijadwalkan pada ' : 'berada di ') + goneText + '. Jadi, ' + P + ' ' + is(geo) + ' ' + rest + '.';
        default: return list(taken) + ', sehingga ' + P + ' ' + is(geo) + ' ' + rest + '.';
      }
    }
    return seatsTaken + ', sehingga ' + results(c, fixed.map((s): [string, number[]] => [s.person, s.after]), alt()) + '.';
  };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.kind === 'clue') {
      const group = [step];
      while (i + 1 < steps.length && steps[i + 1].kind === 'clue' && (steps[i + 1] as Clue).clue === step.clue) group.push(steps[++i] as Clue);
      // Petunjuk baris atau kolom yang menyebut tempat langsung hanya mengulang soal; hasilnya sudah tampak pada dasar kalimat berikutnya.
      const fact = c.clues[step.clue];
      if (fact.k === 'row' || fact.k === 'col') continue;
      out.push(clueSentence(group));
    } else if (step.kind === 'elim') {
      const run: Elim[] = [step];
      while (i + 1 < steps.length && steps[i + 1].kind === 'elim' && !run.some((r) => r.person === (steps[i + 1] as Elim).holder) && !run.some((r) => r.holder === (steps[i + 1] as Elim).person)) run.push(steps[++i] as Elim);
      const sentence = elimSentence(run, steps.slice(i + 1));
      if (sentence) out.push(sentence);
    } else if (step.kind === 'single') {
      const P = step.person, S = seatText(geo, step.seat);
      out.push(next('single', [0, 1]) === 0 ? 'Hanya ' + P + ' yang masih dapat ' + is(geo) + ' ' + S + ', sehingga ' + P + ' ' + is(geo) + ' ' + S + '.' : cap(S) + ' hanya dapat ' + fill(geo) + ' ' + P + ', sehingga ' + P + ' ' + is(geo) + ' ' + S + '.');
    } else {
      // Pencoretan berurutan oleh tempat yang sama digabung: "A berada di ... dan B berada di ..., sebab C sudah berada di ...".
      const items: string[] = [];
      for (let k = 0; k < step.chain.length; k++) {
        const link = step.chain[k];
        if (link.kind === 'elim' && link.after.length) {
          const same = [link];
          while (k + 1 < step.chain.length) { const nxt = step.chain[k + 1]; if (nxt.kind === 'elim' && nxt.after.length && nxt.holder === link.holder && nxt.seat === link.seat) { same.push(nxt); k++; } else break; }
          items.push(results(c, same.map((e): [string, number[]] => [e.person, e.after]), alt()) + ', sebab ' + link.holder + ' sudah ' + is(geo) + ' ' + seatText(geo, link.seat));
        } else { const text = chainItem(link); if (text) items.push(text); }
      }
      const why = step.conflict, S = seatText(geo, step.seat), P = step.person;
      const broke = why.clue >= 0
        ? (why.person === P && !items.length ? 'petunjuk bahwa ' + mid(clause(c.clues[why.clue], geo)) + ' tidak dapat dipenuhi'
          : why.person + ' tidak lagi mempunyai ' + spot(geo) + ' yang memenuhi petunjuk bahwa ' + mid(clause(c.clues[why.clue], geo)))
        : why.person ? why.person + ' tidak lagi mempunyai ' + spot(geo) + ' yang tersisa' : seatText(geo, why.seat ?? 0) + ' tidak dapat ' + fill(geo) + ' siapa pun';
      out.push('Jika ' + P + ' ' + is(geo) + ' ' + S + (items.length ? ', maka ' + items.join(', lalu ') + '. Akibatnya, ' : ', ') + broke + '. Jadi, ' + P + ' tidak ' + is(geo) + ' ' + S + '.');
    }
  }
  return out;
}
