import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'data');
fs.mkdirSync(dir, { recursive: true });
const report = { imported: {}, excluded: [], corrections: [] };
const clean = (text) => text.replace(/\f/g, '').replace(/\s+/g, ' ').trim();
const optionPattern = /^([A-E])\.\s*/;
const questionOptions = (lines) => {
  const options = [];
  let current = null;
  for (const line of lines) {
    const found = line.match(optionPattern);
    if (found) {
      current = { letter: found[1], text: line.replace(optionPattern, '') };
      options.push(current);
    } else if (current && line.trim()) current.text += ' ' + line.trim();
  }
  return options;
};

const twkLines = fs.readFileSync(path.join(root, 'references/riset-cpns-2027.txt'), 'utf8').split(/\r?\n/);
const topics = ['Nasionalisme', 'Integritas', 'Bela Negara', 'Pilar Negara', 'Bahasa Negara'];
const starts = [];
let topic = '';
let chapter = false;
twkLines.forEach((line, index) => {
  if (line.startsWith('5.1.')) chapter = true;
  if (line.startsWith('5.2.')) chapter = false;
  if (!chapter) return;
  if (topics.includes(line.trim())) topic = line.trim();
  const match = line.match(/^SOAL (\d+)/);
  if (match) starts.push({ index, topic, number: Number(match[1]) });
});
const twk = [];
for (let index = 0; index < starts.length; index++) {
  const entry = starts[index];
  const id = 'twk-ref-' + topics.indexOf(entry.topic) + '-' + entry.number;
  if ((entry.topic === 'Bela Negara' && entry.number === 5) ||
      (entry.topic === 'Integritas' && entry.number === 6) ||
      (entry.topic === 'Bahasa Negara' && entry.number === 6)) {
    report.excluded.push({ id, reason: 'Duplikasi, konteks sejarah yang perlu verifikasi, atau klasifikasi analogi kalimat.' });
    continue;
  }
  const lines = twkLines.slice(entry.index + 1, starts[index + 1]?.index ?? twkLines.findIndex((line) => line.startsWith('5.2.')));
  const difficulty = clean(lines.find((line) => line.startsWith('Tingkat Kesulitan:')) ?? '').split(':')[1]?.trim().toLowerCase();
  const firstOption = lines.findIndex((line) => /^A\./.test(line));
  const answerIndex = lines.findIndex((line) => /^Jawaban:/.test(line));
  const explanationIndex = lines.findIndex((line) => /^Pembahasan:/.test(line));
  const parsedOptions = questionOptions(lines.slice(firstOption, answerIndex));
  const answer = (lines[answerIndex]?.match(/Jawaban:\s*([A-E])/)?.[1] ?? '').charCodeAt(0) - 65;
  let explanation = lines.slice(explanationIndex + 1).join('\n').trim();
  // Stop at the material header which follows the final question of a topic.
  for (const nextTopic of topics) {
    const materialIndex = explanation.indexOf('\n' + nextTopic + '\n');
    if (materialIndex >= 0) explanation = explanation.slice(0, materialIndex).trim();
  }
  if (entry.topic === 'Nasionalisme' && entry.number === 4) {
    explanation = 'Edukasi mengenai dampak ujaran kebencian membantu peserta memahami akibat perilaku digital terhadap persatuan. Mengabaikan konten, membalas provokasi, sensor menyeluruh, atau menoleransi kebencian tidak membangun pemahaman tersebut.';
    report.corrections.push({ id, change: 'Melengkapi pembahasan yang kosong.' });
  }
  if (entry.topic === 'Bahasa Negara' && entry.number === 5) {
    explanation = 'Teks menunjukkan bahwa kesenjangan pendidikan masih berlangsung dan program pemerintah belum sepenuhnya efektif. Kesimpulan harus memuat kedua informasi ini tanpa menggeneralisasi bahwa pemerintah gagal atau semua daerah kekurangan guru.';
    report.corrections.push({ id, change: 'Melengkapi pembahasan yang kosong.' });
  }
  if (entry.topic === 'Bela Negara' && entry.number === 3) {
    explanation = explanation.replace(/Opsi ([A-D]) (salah|Mampu)/g, (_, letter, rest) => 'Opsi ' + String.fromCharCode(letter.charCodeAt(0) + 1) + ' ' + rest);
    report.corrections.push({ id, change: 'Mencocokkan label pengecoh B–E dengan daftar opsi.' });
  }
  if (parsedOptions.length !== 5 || answer < 0 || answer > 4 || !explanation) throw new Error('Ekstraksi TWK gagal: ' + id);
  twk.push({
    id, subtest: 'TWK', topic: entry.topic, subtopic: 'Contoh riset',
    difficulty, stem: lines.slice(1, firstOption).map(clean).filter(Boolean).join('\n\n'),
    options: parsedOptions.map((option, i) => ({
      text: clean(option.text), score: i === answer ? 5 : 0,
      reason: i === answer ? 'Pilihan yang sesuai dengan penjelasan kunci.' : 'Bandingkan cakupan pilihan ini dengan konsep dan kata kunci pada pembahasan.',
    })),
    answer, explanation, source: 'Riset Seleksi CPNS 2027, Bab 5.1 — ' + entry.topic + ', Soal ' + entry.number,
  });
}

const tkpLines = fs.readFileSync(path.join(root, 'references/panduan-tkp-jadiasn.txt'), 'utf8')
  .split(/\r?\n/).map((line) => line.replace(/\f/g, '')).filter((line) => !/^\s*\d+\s*$/.test(line));
const tkpTopics = ['Pelayanan Publik', 'Jejaring Kerja', 'Sosial Budaya', 'Teknologi Informasi dan Komunikasi', 'Profesionalisme', 'Anti Radikalisme'];
const tkpStarts = [];
let section = null;
tkpLines.forEach((line, index) => {
  const heading = line.match(/^\s*([1-6])\.([1-5])\.\s+([^.]*)$/);
  if (heading) section = { topic: tkpTopics[Number(heading[1]) - 1], subtopic: clean(heading[3]) };
  if (/^\s*Contoh Soal \d+/.test(line) && section) tkpStarts.push({ index, ...section });
});
const tkp = [];
const scoreTables = JSON.parse(fs.readFileSync(path.join(dir, 'tkp-score-rows.json'), 'utf8'));
for (let index = 0; index < tkpStarts.length; index++) {
  const entry = tkpStarts[index];
  const id = 'tkp-ref-' + (index + 1);
  const lines = tkpLines.slice(entry.index + 1, tkpStarts[index + 1]?.index);
  const firstOption = lines.findIndex((line) => /^\s*A\./.test(line));
  const answerIndex = lines.findIndex((line) => /^\s*Jawaban:/.test(line));
  const levelIndex = lines.findIndex((line) => /^\s*Tingkat Kesulitan:/.test(line));
  const bloom = lines.join('\n').match(/Level Bloom:\s*(C[1-6])/)?.[1];
  const parsedOptions = questionOptions(lines.slice(firstOption, answerIndex).map((line) => line.trim()));
  const answer = (lines[answerIndex]?.match(/Jawaban:\s*([A-E])/)?.[1] ?? '').charCodeAt(0) - 65;
  const scoreLines = [];
  lines.forEach((line, pos) => {
    const match = line.match(/^\s*([A-E])\s*(?:\(([1-5])\s*poin\)|[-–]\s*Skor\s*([1-5]))\s*(.*)$/i);
    if (match) scoreLines.push({ pos, letter: match[1], score: Number(match[2] ?? match[3]), first: match[4] });
  });
  const optionData = parsedOptions.map((option) => {
    const scoreEntry = scoreLines.find((score) => score.letter === option.letter);
    const next = scoreLines.find((score) => score.pos > (scoreEntry?.pos ?? Infinity))?.pos ?? lines.length;
    const fragments = scoreEntry ? [scoreEntry.first, ...lines.slice(scoreEntry.pos + 1, next)] : [];
    const stop = fragments.findIndex((line) => /Cara cepat:|^\s*[1-6]\.[1-5]\.|Rentang Bloom|Prinsip Kunci|Materi Pokok/.test(line));
    const reason = clean((stop >= 0 ? fragments.slice(0, stop) : fragments).filter((line) => !/Opsi dan Skor|^\s*Alasan\s*$/.test(line)).join(' '));
    const tableCell = scoreTables[index]?.[option.letter];
    if (!tableCell || tableCell.score !== scoreEntry?.score) throw new Error('Skor tabel PDF tidak sesuai ekstraksi teks: ' + id);
    return { text: clean(option.text), score: tableCell.score, reason: tableCell.reason };
  });
  const discussionStart = lines.findIndex((line) => /Pembahasan:/.test(line));
  const discussionEnd = lines.findIndex((line) => /Pembahasan setiap opsi:/.test(line));
  const explanation = clean(lines.slice(discussionStart + 1, discussionEnd >= 0 ? discussionEnd : scoreLines[0]?.pos).join(' '));
  if (optionData.length !== 5 || optionData.some((option) => !option.score || !option.reason) || optionData[answer]?.score !== 5) {
    throw new Error('Ekstraksi skor/opsi TKP gagal: ' + id);
  }
  tkp.push({
    id, subtest: 'TKP', topic: entry.topic, subtopic: entry.subtopic, bloom,
    difficulty: clean(lines[levelIndex] ?? '').split(':')[1]?.trim().toLowerCase() ?? 'hots',
    stem: lines.slice(levelIndex + 1, firstOption).map(clean).filter(Boolean).join(' '),
    options: optionData, answer, explanation,
    source: 'Panduan Produksi Soal TKP JadiASN — ' + entry.topic + ', contoh ' + (index + 1),
  });
}
for (const [name, data] of [['twk', twk], ['tkp', tkp]]) {
  fs.writeFileSync(path.join(dir, name + '-reference.json'), JSON.stringify(data, null, 2) + '\n');
  report.imported[name] = data.length;
}
fs.writeFileSync(path.join(dir, 'reference-import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
