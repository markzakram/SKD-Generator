// Perwujudan kalimat silogisme (Indonesia) dari pernyataan formal (lib/silo-spec.ts). Premis tidak memakai kuantor, titik dua, penghubung bersyarat (jika, apabila, bila, maka),
// maupun penanda sebab-akibat; hubungan implikasi disampaikan lewat klausa pewatas ("Rina yang terdaftar sebagai peserta memperoleh hak memilih sesi"), pewatas
// "dengan/tanpa", predikat kategori ("tercakup dalam daftar penerima …"), dan predikat hak di depan (narasi). Pewatas "dengan/tanpa" tidak pernah digabung dengan kategori "termasuk …". Pada narasi kata kunci tiap proposisi bertanda tebal di pembahasan
// (`Seg.b`) dan kalimat tidak memakai koma (blueprint Bagian B: "Hindari koma"; contoh blueprint pun menulis "Dalam ketentuan … hak …" tanpa koma).
// Kerangka kalimat narasi (Bagian 19 blueprint) ditulis utuh per bentuk logika: klausa pewatas, pewatas "dengan/tanpa", cakupan daftar, predikat hak di depan, fakta langsung, fakta
// melalui catatan, dan pilihan. Tidak ada keterangan rujukan pengisi yang diulang di setiap kalimat: pembuka berkonteks ("Catatan … menunjukkan …", "… menurut ketentuan …" di belakang kalimat, "Dalam ketentuan …" hanya sebelum predikat hak di depan) dipakai paling banyak satu kali pada satu soal (`Voice.ctx`), dan opsi narasi tidak memakai pembuka.
import type { Rng } from './rng';
import type { Frame, Prop } from './silo-frames';
import type { Lit, Stmt } from './silo-spec';

export type Seg = { t: string; b?: boolean };
// `ctx.used`: pembuka berkonteks sudah dipakai pada salah satu premis soal ini (maksimal satu).
export type Voice = { frame: Frame; narasi: boolean; subject: { c: string; m: string }; ctx: { used: boolean }; propOf: (v: number) => Prop };
export const segText = (segs: Seg[]) => segs.map((s) => s.t).join('');

// Frasa berulang: urutan tiga kata atau lebih (`min`) yang muncul dua kali pada satu kalimat. Subjek (`mask`) ditutup karena opsi boleh mengulang subjek.
export function repeatedPhrase(text: string, mask: string[] = [], min = 3): string | null {
  let rest = text.toLowerCase();
  mask.filter(Boolean).forEach((m, i) => { rest = rest.split(m.toLowerCase()).join(' §' + i + ' '); });
  const words = rest.replace(/[.,…?;]/g, ' ').split(/\s+/).filter(Boolean).map((w, i) => w.startsWith('§') ? w + '#' + i : w);
  for (let n = min; n <= 8; n++) for (let i = 0; i + n <= words.length; i++) {
    const phrase = words.slice(i, i + n).join(' ');
    for (let j = i + n; j + n <= words.length; j++) if (words.slice(j, j + n).join(' ') === phrase) return phrase;
  }
  return null;
}
// Teks bertanda tebal untuk pembahasan: segmen tebal yang berurutan digabung menjadi satu pasang penanda.
export function segMarked(segs: Seg[]): string {
  let out = '', open = false;
  for (const seg of segs) {
    if (seg.b && !open) { out += '**'; open = true; } else if (!seg.b && open) { out += '**'; open = false; }
    out += seg.t;
  }
  return out + (open ? '**' : '');
}
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function makeVoice(frame: Frame, narasi: boolean, r: Rng, propOrder: number[]): Voice {
  const [noun, id] = r.pick(frame.subjects);
  const subject = noun ? { c: noun + ' ' + id, m: lowerFirst(noun) + ' ' + id } : { c: id, m: id };
  // Variabel p, q, r, s memakai proposisi kerangka menurut urutan acak; t selalu proposisi kelima (informasi tambahan).
  return { frame, narasi, subject, ctx: { used: false }, propOf: (v) => frame.props[v === 4 ? 4 : propOrder[v]] };
}
const phrase = (voice: Voice, l: Lit, kind: 'pred' | 'mod' | 'cat' | 'right', key = true): Seg | undefined => {
  const prop = voice.propOf(l[0]);
  const text = kind === 'pred' ? (l[1] ? prop.neg : prop.pos) : prop[kind]?.[l[1] ? 1 : 0];
  return text === undefined ? undefined : { t: text, b: key && voice.narasi ? true : undefined };
};
const plain = (t: string): Seg => ({ t });
const seq = (...parts: (string | Seg | undefined)[]): Seg[] => parts.flatMap((part) => part === undefined ? [] : typeof part === 'string' ? [plain(part)] : [part]);
const space = (...parts: (string | Seg | undefined)[]): Seg[] => parts.flatMap((part, i) => part === undefined ? [] : [...(i > 0 ? [plain(' ')] : []), ...seq(part)]);
const sentence = (segs: Seg[]): Seg[] => { const out = segs.map((s) => ({ ...s })); out[0] = { ...out[0], t: upperFirst(out[0].t) }; out.push(plain('.')); return out; };

type Template = { id: string; startsWithS: boolean; make: (S: string) => Seg[]; reversed?: boolean; ctx?: boolean };
// Kalimat implikasi A → B dengan subjek S (awal kalimat bila startsWithS, selain itu di tengah). Mengembalikan templat yang berlaku untuk pasangan literal ini.
function implicationTemplates(voice: Voice, A: Lit, B: Lit, forOption: boolean): Template[] {
  const pA = phrase(voice, A, 'pred')!, pB = phrase(voice, B, 'pred')!, mA = phrase(voice, A, 'mod'), cB = phrase(voice, B, 'cat'), rB = phrase(voice, B, 'right');
  const plainRel = !pA.t.includes(' yang '); // dua "yang" berturutan dihindari: pewatas pengganti dipakai
  const lead = (): Seg[] | undefined => mA ? [mA] : plainRel ? [plain('yang '), pA] : undefined;
  const list: Template[] = [];
  if (plainRel) list.push({ id: 'rel', startsWithS: true, make: (S) => [plain(S + ' yang '), pA, plain(' '), pB] });
  if (mA) list.push({ id: 'mod', startsWithS: true, make: (S) => [plain(S + ' '), mA, plain(' '), pB] });
  if (cB && lead()) list.push({ id: 'cat', startsWithS: true, make: (S) => [plain(S + ' '), ...lead()!, plain(' '), cB] });
  if (forOption && !voice.narasi) {
    list.push({ id: 'ketentuan', startsWithS: false, make: (S) => [plain('Dalam ketentuan tersebut, ' + S + ' yang '), pA, plain(' '), pB] });
    list.push({ id: 'untuk', startsWithS: false, make: (S) => [plain('Untuk ' + S + ' yang '), pA, plain(', ' + S + ' '), pB] });
  }
  // Narasi, opsi: predikat hak di depan tanpa pembuka ("Hak memilih sesi melekat pada Rina dengan berkas lengkap").
  if (voice.narasi && forOption && rB && lead()) list.push({ id: 'hak', startsWithS: false, make: (S) => [rB, plain(' ' + S + ' '), ...lead()!] });
  // Narasi, premis: pembuka berkonteks hanya bila belum dipakai pada premis lain (konsekuensi lebih dahulu = minoritas, Bagian 25).
  if (voice.narasi && !forOption && !voice.ctx.used) {
    if (rB && lead()) list.push({ id: 'front', startsWithS: false, reversed: true, ctx: true, make: (S) => [plain('Dalam ketentuan ' + voice.frame.ctx + ' '), rB, plain(' ' + S + ' '), ...lead()!] });
    // Pembuka berkonteks diletakkan di belakang ("… menurut ketentuan layanan perpustakaan"): pembuka di depan hanya pada predikat hak di depan, tanpa koma seperti contoh blueprint ("Dalam ketentuan pemesanan ruang pamer hak memilih … melekat pada Nadira …"), sehingga pembuka tidak melekat pada subjek.
    if (plainRel) list.push({ id: 'menurut', startsWithS: true, ctx: true, make: (S) => [plain(S + ' yang '), pA, plain(' '), pB, plain(' menurut ketentuan ' + voice.frame.ctx)] });
  }
  return list.length ? list : [{ id: 'rel', startsWithS: true, make: (S) => [plain(S + ' yang '), pA, plain(' '), pB] }];
}

// `ctx`: kalimat memakai pembuka berkonteks.
export type Made = { segs: Seg[]; reversed: boolean; ctx: boolean };
// Kalimat premis (satu premis = satu kalimat). Susunan konsekuensi lebih dahulu (predikat hak di depan) hanya dipilih pada sekitar sepersepuluh implikasi narasi (Bagian 25).
export function premiseSentence(voice: Voice, st: Stmt, r: Rng, allowReverse = true): Made {
  const { c, m } = voice.subject, ctx = voice.frame.ctx, A = st.a, B = st.b!;
  const pred = (l: Lit) => phrase(voice, l, 'pred')!;
  const take = (forms: { segs: Seg[]; ctx?: boolean }[]): Made => { const pick = r.pick(forms); if (pick.ctx) voice.ctx.used = true; return { segs: sentence(pick.segs), reversed: false, ctx: !!pick.ctx }; };
  if (st.op === 'lit') {
    if (!voice.narasi) return { segs: sentence([plain(c + ' '), pred(A)]), reversed: false, ctx: false };
    return take([{ segs: [plain(c + ' '), pred(A)] }, ...(voice.ctx.used ? [] : [{ segs: [plain('Catatan ' + ctx + ' menunjukkan ' + m + ' '), pred(A)], ctx: true }, { segs: [plain(c + ' '), pred(A), plain(' menurut ketentuan ' + ctx)], ctx: true }])]);
  }
  if (st.op === 'or') {
    if (!voice.narasi) return { segs: sentence([plain(c + ' '), pred(A), plain(' atau ' + m + ' '), pred(B)]), reversed: false, ctx: false };
    return take([{ segs: [plain(c + ' '), pred(A), plain(' atau '), pred(B)] }, ...(voice.ctx.used ? [] : [{ segs: [plain(c + ' '), pred(A), plain(' atau '), pred(B), plain(' menurut ketentuan ' + ctx)], ctx: true }])]);
  }
  if (st.op === 'nand') return { segs: sentence([plain('Tidak benar bahwa ' + m + ' '), pred(A), plain(' dan ' + m + ' '), pred(B)]), reversed: false, ctx: false };
  const templates = implicationTemplates(voice, A, B, false), front = templates.filter((t) => t.reversed);
  if (st.op === 'notimp') { const pick = r.pick(templates.filter((t) => t.startsWithS && !t.ctx)); return { segs: sentence([plain('Tidak benar bahwa '), ...pick.make(m)]), reversed: false, ctx: false }; }
  const normal = templates.filter((t) => !t.reversed);
  const pick = allowReverse && front.length && r.next() < 0.12 ? r.pick(front) : r.pick(normal);
  if (pick.ctx) voice.ctx.used = true;
  return { segs: sentence(pick.make(pick.startsWithS ? c : m)), reversed: !!pick.reversed, ctx: !!pick.ctx };
}

// Kalimat opsi. Beberapa bentuk tersedia untuk tiap pernyataan; pemanggil menolak teks kembar dan memilih ulang bila perlu.
export function optionSentence(voice: Voice, st: Stmt, r: Rng): Seg[] {
  const { c, m } = voice.subject, A = st.a, B = st.b!;
  const pred = (l: Lit) => ({ ...phrase(voice, l, 'pred', false)! });
  // Panjang opsi bervariasi pada kunci maupun pengecoh (awalan "Dalam ketentuan tersebut"; subjek diulang atau tidak pada "dan"/"atau") supaya panjang tidak membocorkan kunci.
  if (voice.narasi) { // opsi narasi tanpa pembuka: variasi lewat predikat, kategori daftar, atau predikat hak di depan ("Hak memilih sesi melekat pada Rina")
    const kinds = (l: Lit): Seg[][] => [...[phrase(voice, l, 'cat', false)].flatMap((seg) => seg ? [[plain(c + ' '), seg]] : []), ...[phrase(voice, l, 'right', false)].flatMap((seg) => seg ? [[seg, plain(' ' + m)]] : [])];
    if (st.op === 'lit') return sentence(r.pick<Seg[]>([[plain(c + ' '), pred(A)], ...kinds(A)]));
    if (st.op === 'and' || st.op === 'or') { const cat = phrase(voice, B, 'cat', false); return sentence([plain(c + ' '), pred(A), plain(st.op === 'and' ? ' dan ' : ' atau '), cat && r.next() < 0.4 ? cat : pred(B)]); }
  }
  if (st.op === 'lit') return sentence(r.next() < 0.7 ? [plain(c + ' '), pred(A)] : [plain('Dalam ketentuan tersebut, ' + m + ' '), pred(A)]);
  if (st.op === 'and' || st.op === 'or') {
    const join = st.op === 'and' ? ' dan ' : ' atau ';
    return sentence(r.next() < 0.65 ? [plain(c + ' '), pred(A), plain(join), pred(B)] : [plain(c + ' '), pred(A), plain(join + m + ' '), pred(B)]);
  }
  if (st.op === 'nand') {
    // Tidak benar bahwa A dan B (dua "tidak" paling banyak: nand dengan dua ruas negatif tidak dibentuk oleh penyusun opsi). "… tidak terjadi bersamaan" hanya dipakai bila kedua ruas positif,
    // supaya "tidak" tidak bertumpuk dengan "tidak" di dalam frasa.
    const a = [plain(m + ' '), pred(A)], b = [plain(m + ' '), pred(B)], inner = Number(A[1]) + Number(B[1]);
    const forms: Seg[][] = [sentence([plain('Tidak benar bahwa '), ...a, plain(' dan '), ...b])];
    if (inner === 0) forms.push(sentence([plain('Keadaan '), ...a, plain(' dan '), ...b, plain(' tidak terjadi bersamaan')]), sentence([plain('Pernyataan bahwa '), ...a, plain(' dan '), ...b, plain(' tidak benar')]));
    return r.pick<Seg[]>(forms);
  }
  const picked = r.pick(implicationTemplates(voice, A, B, true));
  return sentence(picked.make(picked.startsWithS ? c : m).map((s) => ({ t: s.t })));
}
// Kalimat penyusun pertanyaan TDS: "kebenaran pernyataan bahwa …".
export const targetClause = (voice: Voice, l: Lit) => voice.subject.m + ' ' + phrase(voice, l, 'pred', false)!.t;
// Pernyataan positif sebuah variabel (definisi p, q, r pada pembahasan), tanpa titik.
export const definition = (voice: Voice, v: number) => voice.subject.c + ' ' + voice.propOf(v).pos;

// Frasa pengisi berulang antarkalimat (narasi): urutan tiga kata yang sama pada dua kalimat berbeda setelah semua frasa proposisi kerangka dan nama subjek dibuang.
// Proposisi penghubung memang tampil pada dua premis, tetapi keterangan rujukan atau pembuka konteks tidak boleh diulang di setiap premis.
export function fillerRepeated(sentences: string[], voice: Voice): string | null {
  const masks = [...voice.frame.props.flatMap((p) => [p.pos, p.neg, ...(p.mod ?? []), ...(p.cat ?? []), ...(p.right ?? [])]), voice.subject.c, voice.subject.m].map((text) => text.toLowerCase()).sort((x, y) => y.length - x.length);
  const grams = sentences.map((sentence) => {
    let rest = sentence.toLowerCase();
    for (const mask of masks) rest = rest.split(mask).join(' § ');
    const found = new Set<string>();
    for (const chunk of rest.split('§')) {
      const words = chunk.replace(/[.,…?;]/g, ' ').split(/\s+/).filter(Boolean);
      for (let i = 0; i + 3 <= words.length; i++) found.add(words.slice(i, i + 3).join(' '));
    }
    return found;
  });
  for (let i = 0; i < grams.length; i++) for (const gram of grams[i]) if (grams.some((other, j) => j > i && other.has(gram))) return gram;
  return null;
}
