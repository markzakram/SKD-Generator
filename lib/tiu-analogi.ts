// Verbal analogi dua kata (Panduan Produksi Soal TIU JadiASN, bagian 1.1, PDF 9–17): bentuk "Kata 1 : Kata 2 = … : …" dengan pasangan kata sebagai opsi. Setiap pasangan
// berasal dari katalog jenis hubungan (antonim, sinonim, alat dan fungsi, profesi dan alat kerja, benda dan tempat, bagian dan keseluruhan, sifat, kategori, sebab
// dan akibat); kunci adalah pasangan lain dengan jenis dan arah hubungan yang sama, pengecoh adalah pasangan dengan hubungan lain (kedekatan tema saja) atau
// pasangan yang arahnya terbalik. Ulasan tiap opsi (keputusan akademik F.1, QC 170–172) menyebut jenis dan arah hubungan, "sepadan" atau "tidak sepadan", dan
// alasannya; semuanya disusun dari katalog, bukan ditulis tangan per soal.
import { KEY_MARK } from './explanation';
import type { Rng } from './rng';

export type Relation = { id: string; name: string; direction: string; directional: boolean; text: (a: string, b: string) => string; pairs: [string, string][] };
export const RELATIONS: Relation[] = [
  { id: 'antonim', name: 'antonim (berlawanan makna)', direction: 'saling berlawanan', directional: false, text: (a, b) => a + ' berlawanan makna dengan ' + b,
    pairs: [['cepat', 'lambat'], ['tinggi', 'rendah'], ['panas', 'dingin'], ['awal', 'akhir'], ['besar', 'kecil'], ['kuat', 'lemah'], ['terang', 'gelap'], ['jujur', 'curang'], ['rajin', 'malas'], ['hemat', 'boros'], ['maju', 'mundur'], ['naik', 'turun']] },
  { id: 'sinonim', name: 'sinonim (sama makna)', direction: 'saling bersamaan makna', directional: false, text: (a, b) => a + ' bersamaan makna dengan ' + b,
    pairs: [['pandai', 'cerdas'], ['marah', 'murka'], ['makmur', 'sejahtera'], ['sabar', 'tabah'], ['sungai', 'kali'], ['pergi', 'berangkat'], ['indah', 'elok'], ['takut', 'gentar']] },
  { id: 'fungsi', name: 'alat dan fungsinya', direction: 'alat → kegunaan', directional: true, text: (a, b) => a + ' digunakan untuk ' + b,
    pairs: [['pena', 'menulis surat'], ['gergaji', 'memotong kayu'], ['kompas', 'menunjukkan arah'], ['palu', 'memukul paku'], ['sapu', 'membersihkan lantai'], ['termometer', 'mengukur suhu'], ['kunci', 'membuka pintu'], ['payung', 'melindungi dari hujan']] },
  { id: 'profesi', name: 'profesi dan alat kerjanya', direction: 'profesi → alat kerja', directional: true, text: (a, b) => a + ' bekerja dengan ' + b,
    pairs: [['petani', 'cangkul'], ['nelayan', 'jala'], ['penjahit', 'jarum'], ['pelukis', 'kuas'], ['guru', 'papan tulis'], ['dokter', 'stetoskop'], ['tukang batu', 'cetok'], ['pemadam kebakaran', 'selang air']] },
  { id: 'tempat', name: 'benda dan tempat penyimpanannya', direction: 'benda → tempat', directional: true, text: (a, b) => a + ' disimpan atau berada di ' + b,
    pairs: [['buku', 'perpustakaan'], ['pakaian', 'lemari'], ['kereta', 'stasiun'], ['obat', 'apotek'], ['kapal', 'dermaga'], ['uang', 'bank'], ['beras', 'lumbung'], ['bus', 'terminal']] },
  { id: 'bagian', name: 'bagian dan keseluruhan', direction: 'bagian → keseluruhan', directional: true, text: (a, b) => a + ' adalah bagian dari ' + b,
    pairs: [['kelopak', 'teratai'], ['jendela', 'rumah'], ['roda', 'mobil'], ['bab', 'novel'], ['sayap', 'pesawat'], ['dahan', 'beringin'], ['lensa', 'kamera'], ['layar', 'televisi']] },
  { id: 'sifat', name: 'benda dan sifatnya', direction: 'benda → sifat', directional: true, text: (a, b) => a + ' memiliki sifat ' + b,
    pairs: [['kapas', 'ringan'], ['es', 'beku'], ['api', 'membakar'], ['gula', 'manis'], ['batu', 'keras'], ['duri', 'tajam'], ['garam', 'asin'], ['besi', 'kokoh']] },
  { id: 'kategori', name: 'anggota dan kategorinya', direction: 'anggota → kategori', directional: true, text: (a, b) => a + ' termasuk jenis ' + b,
    pairs: [['elang', 'burung'], ['hiu', 'ikan'], ['mawar', 'bunga'], ['apel', 'buah'], ['jati', 'pohon'], ['sedan', 'kendaraan'], ['kobra', 'ular'], ['kerbau', 'hewan ternak']] },
  { id: 'sebab', name: 'sebab dan akibat', direction: 'sebab → akibat', directional: true, text: (a, b) => a + ' menyebabkan ' + b,
    pairs: [['kelalaian', 'kecelakaan'], ['virus', 'penyakit'], ['begadang', 'mengantuk'], ['hujan deras', 'banjir'], ['latihan', 'mahir'], ['kebakaran', 'asap'], ['kemalasan', 'kegagalan'], ['polusi', 'gangguan pernapasan']] },
];
export const relationById = (id: string) => RELATIONS.find((relation) => relation.id === id)!;
export const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const pairText = (a: string, b: string) => cap(a) + ' : ' + cap(b);
// Hubungan pasangan teks "A : B" menurut katalog: jenisnya dan apakah urutannya terbalik (b : a). undefined bila bukan pasangan katalog.
export function lookupPair(text: string): { relation: string; reversed: boolean } | undefined {
  const [a, b] = text.split(' : ').map((word) => word.toLowerCase());
  if (a === undefined || b === undefined) return undefined;
  for (const relation of RELATIONS) for (const [x, y] of relation.pairs) { if (a === x && b === y) return { relation: relation.id, reversed: false }; if (a === y && b === x) return { relation: relation.id, reversed: true }; }
  return undefined;
}

export type AnalogiOption = { text: string; rel: string; reversed: boolean; reason: string };
export type AnalogiBuild = { stem: string; options: AnalogiOption[]; answer: number; explanation: string; target: string };
// Alasan per opsi: "{pasangan}: hubungan {jenis}, {arah}; sepadan/tidak sepadan, karena {alasan}".
function reasonOf(target: Relation, premise: [string, string], pair: [string, string], rel: Relation, reversed: boolean): string {
  const head = pairText(pair[0], pair[1]) + ': ';
  const base = target.text(premise[0], premise[1]);
  if (rel.id === target.id && !reversed) return head + 'hubungan ' + rel.name + ', ' + rel.direction + '; sepadan, karena ' + rel.text(pair[0], pair[1]) + ', sama seperti pada soal (' + base + ').';
  if (rel.id === target.id) return head + 'hubungan ' + rel.name + ' dengan arah terbalik (' + pair[0] + ' lebih dahulu, padahal arah pada soal ' + target.direction + '); tidak sepadan, karena ' + rel.text(pair[1], pair[0]) + ', sedangkan pada soal ' + base + '.';
  // Pengecoh jenis lain: alasannya cukup hubungan pasangan itu sendiri; kalimat soal tidak diulang di setiap opsi (QC akademik #2, soal 36).
  return head + 'hubungan ' + rel.name + ', ' + rel.direction + '; tidak sepadan, karena ' + rel.text(pair[0], pair[1]) + ', jadi hubungannya bukan ' + target.name + '.';
}

export function buildAnalogi(r: Rng): AnalogiBuild {
  const target = r.pick(RELATIONS), [premise, answerPair] = r.shuffle(target.pairs).slice(0, 2);
  const others = r.shuffle(RELATIONS.filter((relation) => relation.id !== target.id));
  // Satu pengecoh berarah terbalik bila hubungan berarah (pasangan lain dari jenis yang sama, urutannya dibalik); sisanya dari jenis hubungan lain.
  const wrong: { pair: [string, string]; rel: Relation; reversed: boolean }[] = [];
  if (target.directional && r.next() < 0.7) { const [x, y] = r.pick(target.pairs.filter((pair) => pair !== premise && pair !== answerPair)); wrong.push({ pair: [y, x], rel: target, reversed: true }); }
  for (const relation of others) {
    if (wrong.length === 4) break;
    // Hindari kata yang sama dengan soal atau kunci agar pasangan pengecoh tidak terbaca sebagai pasangan yang sama.
    const choices = relation.pairs.filter(([x, y]) => ![premise[0], premise[1], answerPair[0], answerPair[1]].some((word) => word === x || word === y));
    if (choices.length) wrong.push({ pair: r.pick(choices), rel: relation, reversed: false });
  }
  const entries = [{ pair: answerPair, rel: target, reversed: false }, ...wrong.slice(0, 4)];
  const options = r.shuffle(entries).map((entry): AnalogiOption => ({ text: pairText(entry.pair[0], entry.pair[1]), rel: entry.rel.id, reversed: entry.reversed, reason: reasonOf(target, premise, entry.pair, entry.rel, entry.reversed) }));
  const answer = options.findIndex((option) => option.rel === target.id && !option.reversed);
  return {
    stem: pairText(premise[0], premise[1]) + ' = … : …', options, answer, target: target.id,
    explanation: 'Kata "' + premise[0] + '" dan "' + premise[1] + '" memiliki hubungan ' + target.name + ': ' + target.text(premise[0], premise[1]) + '.\n' +
      'Pola yang sama terdapat pada opsi ' + KEY_MARK + ', yaitu "' + answerPair[0] + '" dan "' + answerPair[1] + '": ' + target.text(answerPair[0], answerPair[1]) + ', dengan arah hubungan yang sama (' + target.direction + ').',
  };
}
