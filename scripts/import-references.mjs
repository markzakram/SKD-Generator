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

// ---- Pembahasan TWK: alasan per opsi, tanpa tips rumus ---------------------------------------------------------------
// Teks riset punya bagian "Pembahasan opsi yang salah" (judulnya bervariasi) dan blok "Cara cepat"/"Carcep"/"Tips & Trik" di
// akhir. Bagian pertama dipindahkan menjadi alasan tiap opsi (dipetakan lewat huruf asli sumber atau teks opsi); bagian kedua
// dibuang karena mengajarkan rumus jawaban mutlak. Opsi tanpa alasan spesifik dibiarkan kosong, bukan diisi kalimat generik.
const TIPS_LINE = /^(?:Tips\s*&\s*Tri(?:ck|k)|Cara\s+cepat|Carcep|Rumus\s+cepat)\b/i;
const WRONG_HEADING = /^(?:Pembahasan\s+Opsi\s+(?:yang\s+)?(?:Salah|Lainnya)|Alasan\s+Opsi\s+Lain(?:\s+yang)?\s+Salah|Opsi\s+salah)\s*:\s*$/i;
const LABEL_LINE = /^(?:Konsep[^:]{0,30}|Kata\s+kunci)\s*:\s*(.*)$/i;
const VERDICT = /^(?:salah|keliru|tidak tepat|kurang tepat)\b(?=\s*(?:[,.:;]|karena|sebab|$))\s*[,.:;]?\s*/i;
const BECAUSE = /^(?:karena|sebab)\b\s*/i;
const STOP_WORDS = new Set(['yang', 'dan', 'atau', 'dengan', 'untuk', 'dari', 'pada', 'dalam', 'adalah', 'yaitu', 'karena', 'sebagai', 'oleh', 'bagi', 'agar', 'juga', 'tidak', 'bukan', 'secara', 'dapat', 'akan', 'lebih', 'antara', 'terhadap', 'tersebut', 'merupakan', 'sehingga', 'melalui']);
const words = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const contentWords = (text) => new Set(words(text).filter((word) => word.length > 3 && !STOP_WORDS.has(word)));
const finishSentence = (text) => {
  const value = text.replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const capital = value[0].toUpperCase() + value.slice(1);
  return /[.!?…"”)]$/.test(capital) ? capital : capital + '.';
};
const leadingMarks = /^[\s,.:;–-]+/;
// Akhir pengulangan teks opsi di awal kalimat alasan (sumber sering menulis ulang opsinya sebelum alasannya); -1 bila tidak ada.
function echoEnd(text, option) {
  const target = words(option);
  const found = [...text.matchAll(/[\p{L}\p{N}]+/gu)];
  if (!target.length || found.length < target.length || !/^[^\p{L}\p{N}]*$/u.test(text.slice(0, found[0].index))) return -1;
  for (let i = 0; i < target.length; i++) if (found[i][0].toLowerCase() !== target[i]) return -1;
  const last = found[target.length - 1];
  return last.index + last[0].length;
}
// Pengulangan dibuang hanya bila diikuti tanda baca; bila kalimat berlanjut ("Gerakan Non-Blok adalah ..."), opsi itu subjeknya.
function stripEcho(text, option) {
  const end = echoEnd(text, option);
  return end >= 0 && /^\s*(?:[.,;:]|$)/.test(text.slice(end)) ? text.slice(end) : text;
}
function tidyReason(rest, option) {
  let reason = rest.replace(/\s+/g, ' ').trim().replace(leadingMarks, '').replace(VERDICT, '').replace(BECAUSE, '');
  reason = stripEcho(reason, option).replace(leadingMarks, '').replace(VERDICT, '').replace(BECAUSE, '').replace(leadingMarks, '');
  // Huruf opsi tidak boleh tertinggal di alasan: urutan opsi diacak saat paket dibuat.
  reason = reason.replace(/[,;]?\s*(?:sehingga\s+)?(?:opsi|pilihan)\s+[A-E]\s+(?:kurang tepat|salah|tidak tepat)\s*\.?$/i, '.')
    .replace(/\b(?:Opsi|Pilihan|opsi|pilihan)\s+[A-E]\b/g, 'pilihan ini');
  reason = finishSentence(reason);
  return reason.length >= 12 ? reason : '';
}
// Bagi baris pembahasan menjadi isi pembahasan (tanpa tips dan tanpa bagian opsi salah) dan baris alasan opsi salah.
function splitExplanation(lines) {
  const tipAt = lines.findIndex((line) => TIPS_LINE.test(line.trim()));
  const body = tipAt >= 0 ? lines.slice(0, tipAt) : lines;
  const headAt = body.findIndex((line) => WRONG_HEADING.test(line.trim()));
  if (headAt < 0) return { kept: body, wrong: [] };
  let end = headAt + 1;
  while (end < body.length && body[end].trim()) end++;
  return { kept: [...body.slice(0, headAt), ...body.slice(end)], wrong: body.slice(headAt + 1, end) };
}
// Satu entri = alasan untuk satu atau beberapa huruf opsi asli sumber. Tiga bentuk di sumber: "Opsi B salah karena ...",
// "B. teks opsi ..." / "B: ...", dan ringkas "A dan E terlalu berpihak; C hanya detail."
function parseWrongBlock(lines) {
  const text = lines.map((line) => line.trim()).filter(Boolean);
  if (!text.length) return [];
  if (text.every((line) => /^[A-E]\s*[.:]\s+\S/.test(line))) return text.map((line) => ({ letters: [line[0]], rest: line.replace(/^[A-E]\s*[.:]\s+/, '') }));
  const joined = text.join(' ');
  if (/(?:^|\s)Opsi\s+[A-E]\b/.test(joined)) {
    return joined.split(/(?=(?:^|\s)Opsi\s+[A-E]\b)/).map((part) => part.match(/^\s*Opsi\s+([A-E])\b\s*([\s\S]*)$/)).filter(Boolean)
      .map((found) => ({ letters: [found[1]], rest: found[2] }));
  }
  return text.flatMap((line) => line.split(';')).map((part) => part.trim().match(/^([A-E](?:\s*(?:dan|&|,)\s*[A-E])*)\s+(\S[\s\S]*)$/))
    .filter(Boolean).map((found) => ({ letters: found[1].match(/[A-E]/g), rest: found[2] }));
}
// Alasan per opsi dari bagian opsi salah. Kunci pemetaan: huruf asli sumber, kecuali teks opsi menunjukkan opsi lain.
function wrongReasons(lines, options, answer, id) {
  const reasons = Array(options.length).fill('');
  for (const entry of parseWrongBlock(lines)) {
    const echoed = options.findIndex((option) => echoEnd(entry.rest, option.text) >= 0);
    for (const letter of entry.letters) {
      let index = letter.charCodeAt(0) - 65;
      if (entry.letters.length === 1 && echoed >= 0 && echoed !== index) {
        report.corrections.push({ id, change: 'Mencocokkan alasan opsi berlabel ' + letter + ' dengan opsi ' + String.fromCharCode(65 + echoed) + ' berdasarkan teks opsi.' });
        index = echoed;
      }
      if (index === answer || reasons[index]) continue;
      reasons[index] = tidyReason(entry.rest, options[index].text);
    }
  }
  return reasons;
}
// Alasan opsi kunci: kalimat pembahasan inti yang paling banyak memakai kata dari opsi kunci dan menjelaskan hubungannya.
function proseOf(lines) {
  const prose = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^Pembahasan(?:\s+Jawaban\s+Benar)?\s*:?\s*$/i.test(line)) continue;
    const label = line.match(LABEL_LINE);
    if (label) { if (!label[1].trim()) while (i + 1 < lines.length && lines[i + 1].trim()) i++; continue; }
    prose.push(line.replace(/^Pembahasan\s+Jawaban\s+Benar\s*:\s*/i, '').replace(/^\d+\.\s+/, ''));
  }
  return prose;
}
const ABBREVIATION = /(?:\b(?:Ir|Dr|Drs|Prof|Hj|Mr|No|dr|dll|dsb|dst)|\bR\.A|\b[A-Z])\.$/;
function sentencesOf(lines) {
  const sentences = [];
  for (const line of lines) {
    let current = '';
    for (const chunk of line.split(/(?<=[.!?])\s+(?=[A-Z“"(])/)) {
      current = current ? current + ' ' + chunk : chunk;
      if (!ABBREVIATION.test(current)) { sentences.push(current); current = ''; }
    }
    if (current) sentences.push(current);
  }
  return sentences;
}
// Kalimat pembahasan sering membuka dengan "Opsi B paling tepat karena ..."; huruf opsi dan kata sambung pembuka dibuang.
function bareSentence(sentence) {
  return sentence
    .replace(/^(?:Opsi|Pilihan)\s+[A-E]\s+(?:paling\s+)?tepat(?:\s+sebagai\s+jawaban\s+\w+)?\s*,?\s*(?:karena\s+)?/i, '')
    .replace(/^(?:Opsi|Pilihan)\s+[A-E]\s+mencerminkan\s+konsep\s+ini,?\s*yaitu\s*(?:bahwa\s+)?/i, '')
    .replace(/^(?:Opsi|Pilihan)\s+[A-E]\s+(?=[“"])/, '')
    .replace(/^(?:mencerminkan|menunjukkan|menegaskan|menyatakan)\s+bahwa\s+/i, '')
    .replace(/^(?:Dalam konteks (?:ini|soal ini),\s*)?berarti\s+/i, '')
    .replace(/^(?:Oleh karena itu|Dengan demikian|Karena itu|Jadi|Maka|Selain itu)\s*,?\s*/i, '');
}
function keyReason(kept, keyText) {
  const key = contentWords(keyText);
  const scored = sentencesOf(proseOf(kept)).map((raw, index) => {
    const sentence = bareSentence(raw), own = contentWords(sentence);
    const overlap = [...own].filter((word) => key.has(word)).length;
    const cue = /karena|sehingga|mencerminkan|menunjukkan|merupakan|berarti|artinya|tepat|sesuai|menegaskan|memperkuat|mengutamakan/i.test(sentence) ? 1 : 0;
    const letterRef = /\b(?:Opsi|Pilihan)\s+[A-E]\b/.test(sentence) ? 1 : 0;
    const restatement = /^(?:Soal ini|Pada kalimat|Dalam konteks soal)/i.test(sentence) ? 1 : 0;
    const noSubject = /^(?:berarti|merupakan|mencerminkan|menunjukkan|Dalam konteks ini,\s*berarti)\b/i.test(sentence) ? 1 : 0;
    const pronoun = /^(?:Ia|Dia|Hal ini|Hal tersebut|Ini|Itu|Pernyataan ini|Tindakannya|Sikapnya)\b/.test(sentence) ? 1 : 0;
    const onlyOption = own.size > 0 && [...own].every((word) => key.has(word)) ? 1 : 0; // hanya mengulang teks opsi kunci
    const score = overlap * 3 + cue * 2 - letterRef * 12 - restatement * 5 - noSubject * 6 - pronoun * 8 - onlyOption * 100
      - (sentence.length > 320 ? 4 : 0) - (sentence.length < 30 ? 3 : 0) - index * 0.1;
    return { sentence, score };
  }).sort((a, b) => b.score - a.score);
  if (!scored.length) return '';
  // Kalimat sangat panjang dipotong sebelum anak kalimat penutup (", mencerminkan ...", ", sehingga ...") agar alasan tetap ringkas.
  let best = scored[0].sentence;
  const tail = best.length > 280 ? best.match(/^(.{80,}?),\s+(?:mencerminkan|sehingga|yaitu|agar|tetapi|namun|sedangkan)\b/) : null;
  if (tail) best = tail[1];
  return tidyReason(best, '');
}

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
  let body = lines.slice(explanationIndex + 1);
  // Berhenti di judul materi yang mengikuti soal terakhir tiap topik (judul kadang bersisa spasi di ujung baris).
  const materialIndex = body.findIndex((line) => topics.includes(line.trim()));
  if (materialIndex >= 0) body = body.slice(0, materialIndex);
  if (entry.topic === 'Bela Negara' && entry.number === 3) {
    body = body.map((line) => line.replace(/Opsi ([A-D]) (salah|Mampu)/g, (_, letter, rest) => 'Opsi ' + String.fromCharCode(letter.charCodeAt(0) + 1) + ' ' + rest));
    report.corrections.push({ id, change: 'Mencocokkan label pengecoh B–E dengan daftar opsi.' });
  }
  let { kept, wrong } = splitExplanation(body);
  let explanation = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (entry.topic === 'Nasionalisme' && entry.number === 4) {
    explanation = 'Edukasi mengenai dampak ujaran kebencian membantu peserta memahami akibat perilaku digital terhadap persatuan. Mengabaikan konten, membalas provokasi, sensor menyeluruh, atau menoleransi kebencian tidak membangun pemahaman tersebut.';
    kept = [explanation]; wrong = [];
    report.corrections.push({ id, change: 'Melengkapi pembahasan yang kosong.' });
  }
  if (entry.topic === 'Bahasa Negara' && entry.number === 5) {
    explanation = 'Teks menunjukkan bahwa kesenjangan pendidikan masih berlangsung dan program pemerintah belum sepenuhnya efektif. Kesimpulan harus memuat kedua informasi ini tanpa menggeneralisasi bahwa pemerintah gagal atau semua daerah kekurangan guru.';
    kept = [explanation]; wrong = [];
    report.corrections.push({ id, change: 'Melengkapi pembahasan yang kosong.' });
  }
  if (parsedOptions.length !== 5 || answer < 0 || answer > 4 || !explanation) throw new Error('Ekstraksi TWK gagal: ' + id);
  const optionTexts = parsedOptions.map((option) => ({ text: clean(option.text) }));
  const reasons = wrongReasons(wrong, optionTexts, answer, id);
  reasons[answer] = keyReason(kept, optionTexts[answer].text);
  twk.push({
    id, subtest: 'TWK', topic: entry.topic, subtopic: 'Contoh riset',
    difficulty, stem: lines.slice(1, firstOption).map(clean).filter(Boolean).join('\n\n'),
    options: optionTexts.map((option, i) => ({ text: option.text, score: i === answer ? 5 : 0, reason: reasons[i] })),
    answer, explanation, source: 'Riset Seleksi CPNS 2027, Bab 5.1 — ' + entry.topic + ', Soal ' + entry.number,
  });
}

// ---- Koreksi akademik TWK (revisi tahap 2): override per id dari data/twk-ref-koreksi.json ------------------------------------------------------
// Teks, kunci, dan label contoh TWK riset mengikuti standar produksi TWK (5 KD, level Bloom, subtopik nyata, alasan per opsi, tip = petunjuk membaca soal).
// Hasil telaah dan simulasi peserta dipasang di sini dan dicatat di report.corrections. Satu entri per id; format di berkas itu:
//   hanya label : topic, subtopic, bloom, difficulty, difficultyReason
//   penggantian penuh : label di atas + stem, options [{ text, reason } x5 dalam urutan akhir], answer (indeks kunci), explanation, tip
//   wajib di semua entri : rujukan (acuan QC), catatan (ringkasan perubahan)
// Setiap soal TWK riset wajib punya entri: soal tanpa Bloom atau dengan subtopik "Contoh riset" membuat impor gagal.
// Kunci berawalan "_" diabaikan. Alasan opsi dan pembahasan tidak boleh memuat huruf opsi (urutan opsi diacak saat paket dibuat).
const TWK_NAMES = { topic: 'KD', subtopic: 'subtopik', bloom: 'Bloom', difficulty: 'kesulitan', difficultyReason: 'alasan kesulitan', stem: 'stimulus', options: 'opsi dan alasan opsi', answer: 'kunci', explanation: 'pembahasan', tip: 'tip' };
const TWK_KEYS = [...Object.keys(TWK_NAMES), 'rujukan', 'catatan'];
const TWK_FULL = ['stem', 'options', 'answer', 'explanation', 'tip'];
const TWK_SENTENCE = (text) => /^[\p{Lu}“"(]/u.test(text) && /[.!?”")]$/.test(text);
const TWK_LETTER = /\b(?:Opsi|Pilihan|opsi|pilihan|Jawaban)\s+[A-E]\b/;
const TWK_NOTE = /Cara cepat|Tips\s*&|Carcep|Level Bloom|Contoh Soal\s+\d/i;
const TWK_FORMULA = /Apabila soal menyebut|mengarah ke/i;
function applyTwkCorrections(items, corrections) {
  const applied = [];
  const letter = (index) => String.fromCharCode(65 + index);
  const text = (id, part, value) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Koreksi TWK ' + id + ': ' + part + ' harus berupa teks tidak kosong.');
    return value.trim();
  };
  for (const [id, fix] of Object.entries(corrections)) {
    if (id.startsWith('_')) continue;
    const item = items.find((entry) => entry.id === id);
    if (!item) throw new Error('Koreksi TWK untuk id yang tidak ada: ' + id);
    if (!fix || typeof fix !== 'object' || Array.isArray(fix)) throw new Error('Koreksi TWK bukan objek: ' + id);
    const unknown = Object.keys(fix).filter((key) => !TWK_KEYS.includes(key));
    if (unknown.length) throw new Error('Koreksi TWK ' + id + ' memuat kunci tidak dikenal: ' + unknown.join(', '));
    const rujukan = clean(text(id, 'rujukan', fix.rujukan)), catatan = clean(text(id, 'catatan', fix.catatan));
    const full = TWK_FULL.filter((key) => fix[key] !== undefined);
    if (full.length && full.length !== TWK_FULL.length) throw new Error('Koreksi TWK ' + id + ': penggantian penuh harus memuat ' + TWK_FULL.join(', ') + '; kurang ' + TWK_FULL.filter((key) => !full.includes(key)).join(', ') + '.');
    const before = { kd: item.topic, subtopik: item.subtopic, kesulitan: item.difficulty, bloom: item.bloom ?? null, kunci: letter(item.answer) };
    const changed = [];
    const set = (key, value) => { if (JSON.stringify(item[key]) !== JSON.stringify(value)) changed.push(key); item[key] = value; };
    if (fix.topic !== undefined) {
      if (!topics.includes(fix.topic)) throw new Error('Koreksi TWK ' + id + ': topic harus salah satu dari ' + topics.join(', ') + '.');
      set('topic', fix.topic);
    }
    if (fix.subtopic !== undefined) {
      const subtopic = clean(text(id, 'subtopic', fix.subtopic));
      if (subtopic === 'Contoh riset') throw new Error('Koreksi TWK ' + id + ': subtopic tidak boleh "Contoh riset".');
      set('subtopic', subtopic);
    }
    if (fix.bloom !== undefined) {
      if (!/^C[1-6]$/.test(fix.bloom)) throw new Error('Koreksi TWK ' + id + ': bloom harus C1–C6.');
      set('bloom', fix.bloom);
    }
    if (fix.difficulty !== undefined) {
      if (!['mudah', 'sedang', 'sulit'].includes(fix.difficulty)) throw new Error('Koreksi TWK ' + id + ': difficulty harus mudah, sedang, atau sulit.');
      set('difficulty', fix.difficulty);
    }
    if (fix.difficultyReason !== undefined) set('difficultyReason', clean(text(id, 'difficultyReason', fix.difficultyReason)));
    if (full.length) {
      if (!Array.isArray(fix.options) || fix.options.length !== 5 || fix.options.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => !['text', 'reason'].includes(key)))) {
        throw new Error('Koreksi TWK ' + id + ': options harus lima objek berisi text dan reason.');
      }
      if (!Number.isInteger(fix.answer) || fix.answer < 0 || fix.answer > 4) throw new Error('Koreksi TWK ' + id + ': answer harus indeks 0–4.');
      const options = fix.options.map((entry, index) => {
        const reason = text(id, 'alasan opsi ' + letter(index), entry.reason).replace(/\s+/g, ' ');
        if (!TWK_SENTENCE(reason)) throw new Error('Koreksi TWK ' + id + ': alasan opsi ' + letter(index) + ' harus kalimat utuh (huruf kapital di awal, tanda baca di akhir).');
        return { text: clean(text(id, 'teks opsi ' + letter(index), entry.text)), score: index === fix.answer ? 5 : 0, reason };
      });
      if (new Set(options.map((option) => option.text)).size !== 5) throw new Error('Koreksi TWK ' + id + ': teks opsi harus berbeda satu sama lain.');
      if (new Set(options.map((option) => option.reason)).size !== 5) throw new Error('Koreksi TWK ' + id + ': alasan tiap opsi harus berbeda (alasan kunci tersendiri).');
      const tip = text(id, 'tip', fix.tip), explanation = text(id, 'explanation', fix.explanation), stem = text(id, 'stem', fix.stem);
      for (const [part, value] of [['pembahasan', explanation], ['tip', tip], ...options.map((option, index) => ['alasan opsi ' + letter(index), option.reason])]) {
        if (TWK_LETTER.test(value)) throw new Error('Koreksi TWK ' + id + ': ' + part + ' menyebut huruf opsi.');
        if (TWK_NOTE.test(value)) throw new Error('Koreksi TWK ' + id + ': ' + part + ' memuat sisa catatan penyusunan.');
      }
      if (TWK_FORMULA.test(tip)) throw new Error('Koreksi TWK ' + id + ': tip berbentuk rumus jawaban; tulis petunjuk membaca soal.');
      set('stem', stem); set('options', options); set('answer', fix.answer); set('explanation', explanation); set('tip', tip);
    }
    if (!changed.length) throw new Error('Koreksi TWK ' + id + ' tidak mengubah apa pun; hapus entrinya.');
    const after = { kd: item.topic, subtopik: item.subtopic, kesulitan: item.difficulty, bloom: item.bloom ?? null, kunci: letter(item.answer) };
    report.corrections.push({ id, change: 'Koreksi akademik TWK: ' + changed.map((key) => TWK_NAMES[key]).join(', ') + '.', rujukan, sebelum: before, sesudah: after, catatan });
    applied.push(id);
  }
  const missing = items.filter((item) => !item.bloom || item.subtopic === 'Contoh riset').map((item) => item.id);
  if (missing.length) throw new Error('Soal TWK riset tanpa Bloom atau subtopik nyata (tambahkan entri di data/twk-ref-koreksi.json): ' + missing.join(', '));
  return applied;
}
const twkCorrectionPath = path.join(dir, 'twk-ref-koreksi.json');
const twkCorrections = fs.existsSync(twkCorrectionPath) ? JSON.parse(fs.readFileSync(twkCorrectionPath, 'utf8')) : {};
const correctedTwk = applyTwkCorrections(twk, twkCorrections);
// Urutan kunci tetap; bloom, alasan kesulitan, dan tip hanya muncul bila ada.
twk.splice(0, twk.length, ...twk.map((item) => ({
  id: item.id, subtest: item.subtest, topic: item.topic, subtopic: item.subtopic, ...(item.bloom ? { bloom: item.bloom } : {}), difficulty: item.difficulty,
  ...(item.difficultyReason ? { difficultyReason: item.difficultyReason } : {}), stem: item.stem, options: item.options, answer: item.answer, explanation: item.explanation,
  ...(item.tip ? { tip: item.tip } : {}), source: item.source,
})));

// Penanda sisa catatan penyusunan panduan TKP (judul "Kesulitan Contoh Soal n – ...", label Bloom, arahan penulisan, materi lain).
const TKP_NOTE = /(?:^|\s)(?:Hambatan\s+)?(?:Kesulitan\s+)+(?=Contoh Soal)|\bContoh Soal\s+\d+|\bLevel Bloom\s*:|\bTingkat Kesulitan\s*:|\bPrinsip Kunci\b|\bDiskresi dalam Soal\b|\bRentang Bloom\b|\bMateri Pokok\b|\bCara cepat\s*:|\bTips\s*&|^\s*[1-6]\.[1-5]\.\s/;
// Ambil kalimat-kalimat awal sampai sebelum sisa catatan; potongan yang dimulai huruf kecil setelah titik adalah sisa kalimat lain.
function cleanTkpNote(text) {
  const marker = text.search(TKP_NOTE);
  const head = (marker >= 0 ? text.slice(0, marker) : text).trim();
  const kept = [];
  for (const sentence of head.split(/(?<=[.!?])\s+/)) {
    if (kept.length && (/^\p{Ll}/u.test(sentence) || TKP_NOTE.test(sentence))) break;
    kept.push(sentence);
  }
  return kept.join(' ').trim();
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
    const tableCell = scoreTables[index]?.[option.letter];
    if (!tableCell || tableCell.score !== scoreEntry?.score) throw new Error('Skor tabel PDF tidak sesuai ekstraksi teks: ' + id);
    // Sel tabel PDF yang membentang antarhalaman membawa sisa catatan penyusunan; hanya kalimat alasannya yang dipakai.
    return { text: clean(option.text), score: tableCell.score, reason: cleanTkpNote(tableCell.reason) };
  });
  const discussionStart = lines.findIndex((line) => /Pembahasan:/.test(line));
  const discussionEnd = lines.findIndex((line) => /Pembahasan setiap opsi:/.test(line));
  const explanation = cleanTkpNote(clean(lines.slice(discussionStart + 1, discussionEnd >= 0 ? discussionEnd : scoreLines[0]?.pos).join(' ')));
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
// ---- Koreksi akademik TKP (Tahap 3): override per id dari data/tkp-ref-koreksi.json ------------------------------------------------------
// Skor dan teks 26 contoh TKP mengikuti panduan; koreksi QC akademik boleh menyimpang darinya dan dicatat di report.corrections. Satu entri per id:
//   "tkp-ref-1": { "scores": [5, 4, 3, 2, 1],              // opsional; urutan opsi seperti di data/tkp-reference.json (A–E); permutasi 1–5, kunci = skor 5
//                  "stem": "...", "explanation": "...",    // opsional; pengganti teks utuh
//                  "options": [{ "text": "...", "reason": "..." }, {}, {}, {}, {}],   // opsional; lima elemen, tiap kunci di dalamnya opsional
//                  "catatan": "alasan koreksi" }           // wajib; ditulis ke report bersama nilai panduan dan nilai koreksi
// Kunci berawalan "_" diabaikan (catatan petunjuk). Berkas tidak ada atau tanpa entri = impor murni dari panduan.
// Uji alur: scripts/verify.ts mengunci alasan opsi A tkp-ref-1; perbarui bila koreksi mengubahnya.
const SENTENCE_REASON = (text) => /[.!?]$/.test(text) && text.split(/(?<=[.!?])\s+/).every((sentence) => /^\p{Lu}/u.test(sentence));
function applyTkpCorrections(items, corrections) {
  const allowed = ['scores', 'stem', 'explanation', 'options', 'catatan'];
  const applied = [];
  for (const [id, fix] of Object.entries(corrections)) {
    if (id.startsWith('_')) continue;
    const item = items.find((entry) => entry.id === id);
    if (!item) throw new Error('Koreksi TKP untuk id yang tidak ada: ' + id);
    if (!fix || typeof fix !== 'object' || Array.isArray(fix)) throw new Error('Koreksi TKP bukan objek: ' + id);
    const unknown = Object.keys(fix).filter((key) => !allowed.includes(key));
    if (unknown.length) throw new Error('Koreksi TKP ' + id + ' memuat kunci tidak dikenal: ' + unknown.join(', '));
    if (typeof fix.catatan !== 'string' || !clean(fix.catatan)) throw new Error('Koreksi TKP ' + id + ' wajib memuat "catatan" (alasan koreksi).');
    const letter = (index) => String.fromCharCode(65 + index);
    const before = { skor: item.options.map((option) => option.score), kunci: letter(item.answer) };
    const text = [];
    const replace = (part, old, value, assign) => {
      if (typeof value !== 'string' || !clean(value)) throw new Error('Koreksi TKP ' + id + ': ' + part + ' harus berupa teks tidak kosong.');
      const next = clean(value);
      if (next !== old) { text.push({ bagian: part, panduan: old, koreksi: next }); assign(next); }
    };
    if (fix.scores !== undefined) {
      if (!Array.isArray(fix.scores) || fix.scores.length !== 5 || !fix.scores.every(Number.isInteger) || [...fix.scores].sort().join('') !== '12345') throw new Error('Koreksi TKP ' + id + ': scores harus permutasi 1–5 dengan lima nilai.');
      item.options.forEach((option, index) => { option.score = fix.scores[index]; });
      item.answer = fix.scores.indexOf(5);
    }
    if (fix.stem !== undefined) replace('stem', item.stem, fix.stem, (value) => { item.stem = value; });
    if (fix.explanation !== undefined) replace('pembahasan', item.explanation, fix.explanation, (value) => { item.explanation = value; });
    if (fix.options !== undefined) {
      if (!Array.isArray(fix.options) || fix.options.length !== 5 || fix.options.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => !['text', 'reason'].includes(key)))) {
        throw new Error('Koreksi TKP ' + id + ': options harus lima objek berisi text dan/atau reason.');
      }
      fix.options.forEach((entry, index) => {
        if (entry.text !== undefined) replace('opsi ' + letter(index) + ' teks', item.options[index].text, entry.text, (value) => { item.options[index].text = value; });
        if (entry.reason !== undefined) {
          replace('opsi ' + letter(index) + ' alasan', item.options[index].reason, entry.reason, (value) => { item.options[index].reason = value; });
          if (!SENTENCE_REASON(item.options[index].reason)) throw new Error('Koreksi TKP ' + id + ': alasan opsi ' + letter(index) + ' harus kalimat utuh (huruf kapital di awal, tanda baca di akhir).');
        }
      });
    }
    if (new Set(item.options.map((option) => option.text)).size !== 5) throw new Error('Koreksi TKP ' + id + ': teks opsi harus berbeda satu sama lain.');
    const after = { skor: item.options.map((option) => option.score), kunci: letter(item.answer) };
    const changed = [...(JSON.stringify(before.skor) !== JSON.stringify(after.skor) ? ['skor'] : []), ...text.map((entry) => entry.bagian)];
    if (!changed.length) throw new Error('Koreksi TKP ' + id + ' tidak mengubah apa pun; hapus entrinya.');
    report.corrections.push({ id, change: 'Koreksi akademik TKP: ' + changed.join(', ') + '.', panduan: before, koreksi: after, ...(text.length ? { teks: text } : {}), alasan: clean(fix.catatan) });
    applied.push(id);
  }
  return applied;
}
const correctionPath = path.join(dir, 'tkp-ref-koreksi.json');
const tkpCorrections = fs.existsSync(correctionPath) ? JSON.parse(fs.readFileSync(correctionPath, 'utf8')) : {};
const correctedTkp = applyTkpCorrections(tkp, tkpCorrections);

for (const [name, data] of [['twk', twk], ['tkp', tkp]]) {
  fs.writeFileSync(path.join(dir, name + '-reference.json'), JSON.stringify(data, null, 2) + '\n');
  report.imported[name] = data.length;
}
if (correctedTwk.length) report.imported.twkCorrected = correctedTwk.length;
if (correctedTkp.length) report.imported.tkpCorrected = correctedTkp.length;
fs.writeFileSync(path.join(dir, 'reference-import-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
