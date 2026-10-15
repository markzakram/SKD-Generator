import type { Rng } from '../rng';
import type { Difficulty, Scene } from '../types';
import { chooseWrong, tierOf, type Built } from './compose';
import { arahTerjauh, bangkitkan, cariPengecoh, sudutDari, sudutTampil, type Tingkat } from './garis';
import type { Op } from './ops';
import { flipScene, reach, rotateScene, rotationBetween } from './scene';
import { STEMS } from './stems';
import { capital, describeDiff, turnWord, type Namer } from './text';

// Soal dari gambar garis (keluarga bentuk dari benih): ketidaksamaan dan analogi dengan putaran/pencerminan sebagai hubungan.
const TINGKAT: Tingkat[] = ['mudah', 'sedang', 'sulit', 'sulit'];
const nama: Namer = (id) => id;
const dalamKotak = (s: Scene) => s.parts.every((p) => reach(p) <= 49);
const keempat = (text: string) => text.replace(/dari kedudukan yang benar/g, 'dari kedudukannya pada keempat gambar lain').replace(/dari gambar yang benar/g, 'dari keempat gambar lain');

// Empat gambar adalah putaran dari satu susunan yang sama; satu gambar bukan putaran susunan itu (pengecoh dengan satu beda konkret).
export function buildLineOdd(a: Rng, level: Difficulty): Built | null {
  const tingkat = TINGKAT[tierOf(level)], dasar = bangkitkan(a);
  const cacat = cariPengecoh(dasar.scene, [], a, tingkat, { profil: tingkat === 'sulit' ? dasar.scene : null });
  if (!cacat) return null;
  const sudut = sudutTampil(a, 5, tingkat), oddAt = a.int(0, 4);
  const scenes = sudut.map((deg, i) => rotateScene(i === oddAt ? cacat.scene : dasar.scene, deg));
  if (scenes.some((s) => !dalamKotak(s))) return null;
  const beda = describeDiff(dasar.scene, cacat.scene, nama);
  if (!beda) return null;
  const reasons = scenes.map((s, i) => i === oddAt ?
    'Gambar ini tidak sekelompok dengan keempat gambar lain: ' + keempat(beda) + '. Keempat gambar lain hanyalah putaran dari satu susunan yang sama, dan ' + cacat.prinsip + '.' :
    'Gambar ini sama dengan tiga gambar lain dan hanya diputar (titik terjauhnya dari pusat berada pada arah ' + arahTerjauh(s) + '° dari atas searah jarum jam); seluruh unsurnya bergerak bersama-sama sehingga susunannya tetap.');
  const reason = tingkat === 'sulit' ? 'Kelima gambar memakai unsur yang sama persis dengan hubungan antarunsur yang sama; yang berbeda hanya sudut antarunsur, sehingga jawaban hanya bisa dipastikan dengan membayangkan putarannya.' :
    tingkat === 'sedang' ? 'Putaran kelipatan 45° dan pengecoh yang bisa dikenali dari perbedaan jumlah, ukuran, atau letak unsur.' : 'Putaran kelipatan 90° dan perbedaan yang mudah dilihat (unsur hilang, bertambah, berubah ukuran, atau berpindah).';
  return {
    kind: 'ketidaksamaan', columns: 5, scenes: [], key: scenes[oddAt], wrong: [], options: scenes, answer: oddAt, reasons, keyReason: reasons[oddAt], namer: nama,
    rule: { mekanisme: 'ketidaksamaan-garis', aturan: ['Empat gambar adalah putaran dari satu susunan yang sama; satu gambar bukan putaran dari susunan itu'] },
    explanation: 'Empat gambar lainnya adalah pola yang sama persis, hanya ditampilkan pada sudut putar yang berbeda-beda: bila diputar seperlunya, keempatnya bertumpuk tepat satu sama lain (bentuk, jumlah, dan kedudukan relatif unsurnya tetap). ' +
      'Gambar yang berbeda tidak dapat ditumpangkan pada keempatnya karena ' + keempat(beda) + '.',
    difficultyReason: reason, stem: STEMS.ketidaksamaan[0],
  };
}

// Hubungan gambar pertama ke kedua berupa putaran (kadang didahului pencerminan); terapkan pada gambar ketiga.
export function buildLineAnalogi(a: Rng, level: Difficulty): Built | null {
  const tingkat = TINGKAT[tierOf(level)], A = bangkitkan(a), C = bangkitkan(a, [A.keluarga]);
  if (rotationBetween(A.scene, C.scene) !== null || rotationBetween(flipScene(A.scene), C.scene) !== null) return null;
  const cermin = a.next() < (tingkat === 'sulit' ? 0.4 : tingkat === 'sedang' ? 0.25 : 0.1), deg = a.pick(sudutDari(tingkat));
  const rel = (s: Scene, putar = deg, balik = cermin) => rotateScene(balik ? flipScene(s) : s, putar);
  const B = rel(A.scene), D = rel(C.scene), ops: Op[] = cermin ? [{ op: 'cermin' }, { op: 'putar', deg }] : [{ op: 'putar', deg }];
  const hubungan = cermin ? 'gambar dicerminkan lebih dulu terhadap sumbu tegak, lalu diputar ' + turnWord(deg) : 'seluruh gambar diputar ' + turnWord(deg);
  const because = 'pada pasangan pertama ' + hubungan;
  const candidates: { scene: Scene; rule: string; group: string }[] = [];
  for (const salah of a.shuffle(sudutDari(tingkat).filter((d) => d !== deg))) candidates.push({ scene: rel(C.scene, salah), rule: because, group: 'sudut' });
  candidates.push({ scene: rel(C.scene, deg, !cermin), rule: cermin ? 'pada pasangan pertama gambar dicerminkan terlebih dahulu' : 'pasangan pertama tidak memperlihatkan pencerminan', group: 'cermin' });
  const pakai = candidates.map((c) => c.scene);
  for (let i = 0; i < 3; i++) {
    const cacat = cariPengecoh(D, pakai, a, tingkat, { profil: tingkat === 'sulit' ? D : null, bandingPutaran: false, tanpa: ['cermin'] }); // pencerminan sudah diwakili pengecoh khusus di atas
    if (!cacat) break;
    pakai.push(cacat.scene);
    candidates.push({ scene: cacat.scene, rule: 'arah putarannya sudah benar, tetapi ' + cacat.prinsip, group: 'cacat' });
  }
  const wrong = chooseWrong(D, candidates, 4, a, true, dalamKotak);
  if (wrong.length < 4 || ![A.scene, B, C.scene, D].every(dalamKotak)) return null;
  return {
    kind: 'analogi', columns: 4, scenes: [A.scene, B, C.scene, null], key: D, wrong, namer: nama,
    rule: { mekanisme: 'analogi-garis', aturan: [capital(hubungan)], ops: ops as unknown as Record<string, unknown>[] },
    explanation: 'Berdasarkan pasangan gambar yang diketahui, hubungan gambar pertama terhadap gambar kedua adalah: ' + hubungan + '. Bentuk, jumlah, dan kedudukan relatif unsur tidak berubah; yang berubah hanya arah dan letaknya akibat perubahan itu.\n' +
      'Dengan menerapkan hubungan yang sama pada gambar ketiga, diperoleh gambar ketiga yang ' + (cermin ? 'tercermin lebih dulu lalu ' : '') + 'seluruh unsurnya ikut berputar ' + turnWord(deg) + ' bersama-sama.',
    keyReason: 'Memenuhi hubungan: ' + hubungan + '; seluruh unsur gambar ketiga berpindah bersama-sama sehingga bentuk dan kedudukan relatifnya tidak berubah.',
    difficultyReason: tingkat === 'sulit' ? 'Putaran 45°, 135°, 225°, atau 315° (tidak ada sisi yang tetap mendatar), sering didahului pencerminan; kelima opsi memakai unsur yang sama persis.' :
      tingkat === 'sedang' ? 'Putaran kelipatan 45°, kadang disertai pencerminan; pengecoh berupa sudut keliru, pencerminan yang salah, atau cacat unsur.' : 'Putaran kelipatan 90°; pengecoh mudah dikenali dari sudut yang keliru atau unsur yang berubah.',
    stem: STEMS.analogi[0],
  };
}
