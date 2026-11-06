// Pemeriksaan revisi QC akademik #2 (3 Nov 2026) untuk TIU selain silogisme; dipanggil dari scripts/tiu-format-checks.ts.
// Contoh diterima direvisi saat bank dimuat (lib/bank/tiu-revisi.ts), jadi yang diperiksa adalah ACCEPTED_BANK, bukan data mentah.
import { ACCEPTED_BANK } from '../lib/bank';
import { DIGIT_FILTER, SALAH_SATU, polaLevel } from '../lib/bank/tiu-revisi';
import { explanationOf, parseExplanation } from '../lib/explanation';
import { stripMarks } from '../lib/richtext';
import { rng } from '../lib/rng';
import { towewMeaning } from '../lib/tiu-deret';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import { RELATIONS, buildAnalogi } from '../lib/tiu-analogi';
import type { Question } from '../lib/types';

type Check = (condition: unknown, message: string) => void;
const tiu = ACCEPTED_BANK.filter((q) => q.subtest === 'TIU');
const byId = (id: string) => tiu.find((q) => q.id === id)!;

export function runTiuQc2Checks(check: Check): Record<string, number> {
  let n = 0;
  // Soal 43–44: pasangan yang belum terbukti sama ditulis "dibandingkan dengan"; "Uji apakah" sebelum perkalian silang; ≠ pada pasangan yang gugur; digit terakhir hanya menyaring.
  for (const q of tiu.filter((x) => x.subtopic === 'Perkalian Setara' || x.subtopic === 'Pembagian Setara')) {
    const plain = stripMarks(q.explanation), dropped = (plain.match(/digit terakhirnya berbeda/g) ?? []).length + (plain.match(/^Hasil berbeda/gm) ?? []).length;
    check(q.options.every((o) => o.text.includes(' dibandingkan dengan ') && !o.text.includes('sama dengan')) && !/ sama dengan /.test(plain), q.id + ': pasangan ditulis "dibandingkan dengan", bukan "sama dengan"');
    check(plain.includes(DIGIT_FILTER) && (plain.match(/≠/g) ?? []).length === dropped && /Hasilnya sama: (\d+) = \1\./.test(plain), q.id + ': digit terakhir hanya menyaring, pasangan yang gugur ditulis dengan ≠');
    if (q.subtopic === 'Pembagian Setara') check((plain.match(/^Uji apakah \(\d+\)\/\(\d+\)=\(\d+\)\/\(\d+\):$/gm) ?? []).length === 5, q.id + ': "Uji apakah" sebelum perkalian silang pada kelima pasangan');
    n++;
  }
  // Soal 51: arti "n towew" sebagai larik berselang.
  for (const q of tiu.filter((x) => x.subtopic.startsWith('Deret Angka'))) {
    const count = Number(/artinya (\d+) towew/.exec(q.explanation)?.[1]);
    check(count > 0 && q.explanation.includes(towewMeaning(count)) && towewMeaning(count).includes('larik'), q.id + ': istilah towew dijelaskan sebagai larik berselang'); n++;
  }
  check(towewMeaning(3).includes('suku ke-1, 4, 7') && towewMeaning(2).includes('larik genap'), 'Arti 2 dan 3 towew menyebut suku per larik');
  // Soal 53: aturan matriks diuji pada dua baris/kolom contoh sebelum diterapkan.
  for (const q of tiu.filter((x) => x.subtopic === 'Matriks Deret')) {
    const lines = q.explanation.split('\n').map(stripMarks), first = lines.findIndex((l) => l.startsWith('Periksa aturan itu pada dua ')), apply = lines.findIndex((l) => l.startsWith('Aturan itu berlaku pada kedua '));
    check(first >= 0 && apply === first + 3 && lines.slice(first + 1, apply).every((l) => l.endsWith('(sesuai dengan tabel).')) && /\bx\b/.test(lines[apply + 1]), q.id + ': dua baris/kolom contoh ditunjukkan sebelum baris yang memuat x'); n++;
  }
  // Soal 54–55: Uₙ bersubskrip; label menurut aturan pola (geometri dengan dua urutan berurutan = sedang).
  for (const q of tiu.filter((x) => x.subtopic === 'Pola Bilangan Tabel')) {
    const outside = q.explanation.replace(/\\\(.*?\\\)/g, '');
    check(!/\bU(n|\d+)\b/.test(outside) && /\\\(U_\{n\}/.test(q.explanation), q.id + ': notasi U bersubskrip di dalam rumus, tanpa "Un"/"U15" polos');
    check(q.difficulty === polaLevel(q)?.level && q.difficultyReason?.startsWith('Aturan label Pola Bilangan Tabel'), q.id + ': label kesulitan mengikuti aturan pola'); n++;
  }
  check(byId('tryout-ref-00-42').difficulty === 'sedang' && byId('tryout-ref-00-41').difficulty === 'sulit' && byId('tryout-ref-00-37').difficulty === 'mudah', 'Geometri langsung (soal 54) sedang; geometri dengan urutan tidak berurutan tetap sulit; linear mudah');
  // Soal 56–57: tabel hitungan/klaim/status dan eliminasi setiap opsi; tabel komparasi dan kelayakan; harga per kursi bukan dasar jawaban.
  for (const q of tiu.filter((x) => x.subtopic.startsWith('Tabel Pernyataan'))) {
    const blocks = parseExplanation(q.explanation) ?? [], table = blocks.find((b) => b.k === 'table'), plain = stripMarks(q.explanation);
    const pernyataan = q.subtopic.endsWith('Kombinasi Pernyataan');
    check(table?.k === 'table' && (pernyataan ? ['Klaim', 'Status'].every((h) => table.headers.includes(h)) : table.headers.includes('Kelayakan') && table.rows.length === 5), q.id + ': tabel ' + (pernyataan ? 'hitungan, klaim, dan status' : 'komparasi dan kelayakan'));
    if (pernyataan) check(plain.includes('Eliminasi opsi:') && 'ABCDE'.split('').every((l) => new RegExp('^' + l + ' (memuat|belum)', 'm').test(plain)), q.id + ': eliminasi kelima opsi');
    check(plain.endsWith('Jadi, jawaban yang benar adalah ' + 'ABCDE'[q.answer] + '.') && !!q.tip, q.id + ': penutup sesuai kunci dan cara cepat terisi'); n++;
  }
  check(stripMarks(byId('tryout-ref-00-47').explanation).includes('tidak cukup menjadi dasar jawaban karena bus disewa utuh') && !byId('tryout-ref-00-47').explanation.includes('minimum global'), 'Soal 57: harga per kursi bukan dasar jawaban; pemeriksaan minimum global tidak dimasukkan');
  // Soal 40–41: konteks berkas konsisten; tabel baris-kolom yang posisinya tidak semua pasti diberi judul.
  const berkas = byId('tryout-ref-11-01');
  check(berkas.stem.endsWith('Berkas siapa yang berada pada posisi kedua?') && !/(^|\. )(Ardi|Beni|Caca|Dini|Ega|Fina) berada/.test(berkas.stem + ' ' + berkas.explanation), 'Soal 40: pertanyaan dan pembahasan memakai "berkas X" secara konsisten');
  const seats = byId('tryout-ref-11-02').explanation.split('\n');
  check(seats[seats.findIndex((l) => l.includes('**Baris**')) - 1] === SALAH_SATU, 'Soal 41: tabel baris-kolom berjudul "Salah satu susunan yang memenuhi syarat"');
  // Soal 50: ketidakcukupan tiap pernyataan dicontohkan dengan dua kemungkinan yang hasilnya berbeda.
  for (const id of ['tryout-ref-00-19', 'tryout-ref-00-20', 'tryout-ref-00-23', 'tryout-ref-00-24', 'tryout-ref-00-27']) {
    const q = byId(id), insufficient = (q.explanation.match(/SAJA tidak cukup/g) ?? []).length, examples = (q.explanation.match(/^Contoh: /gm) ?? []).length;
    check(examples > 0 && examples === insufficient - (/masing-masing pernyataan SAJA tidak cukup/.test(q.explanation) ? 1 : 0), id + ': setiap pernyataan yang tidak cukup diberi contoh dua kemungkinan'); n++;
  }
  check(byId('tryout-ref-00-19').explanation.includes('19.200.000') && byId('tryout-ref-00-19').explanation.includes('7.200.000'), 'Soal 50: contoh 100/120 versus 80/140 dan 20/80 versus 80/140');
  // Generator Tabel Pernyataan dan Kombinasi optimal mengikuti naskah yang sama; huruf eliminasi tetap benar setelah opsi diacak.
  for (let seed = 0; seed < 20; seed++) {
    const draft = makeTiu(TIU_FAMILIES.find((f) => f.id === 'pernyataan-tabel')!, 'sedang', rng('qc2-pernyataan-' + seed)), q = { ...draft, id: 'p' + seed, no: 1 } as Question;
    const mix = rng('qc2-acak-' + seed).shuffle([0, 1, 2, 3, 4]), shuffled = { ...q, options: mix.map((i) => q.options[i]), answer: mix.indexOf(q.answer) };
    const text = explanationOf(shuffled), keyLetter = 'ABCDE'[shuffled.answer];
    check(new RegExp('^' + keyLetter + '\\. Kombinasi ' + q.options[q.answer].text + ' memuat tepat seluruh pernyataan benar', 'm').test(text) && (text.match(/^[A-E]\. Kombinasi /gm) ?? []).length === 5 && text.trim().endsWith('Jawaban yang benar adalah ' + keyLetter + '.'), 'Pembangkit Tabel Pernyataan: eliminasi lima opsi mengikuti huruf setelah diacak (' + seed + ')');
    const cost = makeTiu(TIU_FAMILIES.find((f) => f.id === 'cerita')!, 'sedang', rng('qc2-cerita-' + seed));
    check(cost.explanation.includes('| Kelayakan |') && cost.explanation.includes('Harga per kursi:') && cost.explanation.includes('bus disewa utuh'), 'Pembangkit Kombinasi optimal: tabel kelayakan dan harga per kursi bukan dasar jawaban (' + seed + ')');
    n += 2;
  }
  // Soal 36: bentuk pasangan alat–fungsi memuat objek, dan alasan pengecoh tidak mengulang kalimat generik maupun kalimat soal.
  check(RELATIONS.find((r) => r.id === 'fungsi')!.pairs.every(([, use]) => use.includes(' ')), 'Analogi alat dan fungsi: kegunaan selalu memuat objek ("memotong kayu", "membuka pintu")');
  for (let seed = 0; seed < 60; seed++) {
    const built = buildAnalogi(rng('qc2-analogi-' + seed)), wrong = built.options.filter((o, i) => i !== built.answer && !o.reversed);
    check(built.options.every((o) => !o.reason.includes('kesamaan tema')) && wrong.every((o) => !o.reason.includes('seperti pada soal')) && new Set(built.options.map((o) => o.reason)).size === 5, 'Analogi: alasan opsi khas, tanpa kalimat berulang (' + seed + ')');
    n++;
  }
  return { qc2: n };
}
