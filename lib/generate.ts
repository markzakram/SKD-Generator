import { BANK, BANK_MAP, bankFor } from './bank';
import { BASELINE, DEFAULT_SETTINGS, TOPICS } from './config';
import { figureSignature } from './figures';
import { rng, type Rng } from './rng';
import { TIU_FAMILIES, makeTiu } from './tiu';
import type { BankItem, DifficultyFilter, Mode, Package, Question, Settings, Subtest } from './types';
import { auditPackages } from './validate';

export function normalizeSettings(input: Partial<Settings>): Settings {
  const value = { ...DEFAULT_SETTINGS, ...input };
  if (!['SKD', 'TWK', 'TIU', 'TKP'].includes(value.mode)) throw new Error('Subtes tidak dikenal.');
  if (!['campuran', 'mudah', 'sedang', 'sulit', 'hots'].includes(value.difficulty)) throw new Error('Tingkat kesulitan tidak dikenal.');
  for (const [key, maximum] of [['packages', 50], ['count', 200], ['duration', 300]] as const) {
    if (!Number.isInteger(value[key]) || value[key] < 1 || value[key] > maximum) throw new Error(key + ' harus berupa bilangan bulat 1–' + maximum + '.');
  }
  if (value.packages * value.count > 4000) throw new Error('Maksimal 4.000 soal per proses. Kurangi jumlah paket atau soal.');
  if (typeof value.uniqueAcross !== 'boolean') throw new Error('Pilihan pengulangan harus berupa boolean.');
  if (typeof value.seed !== 'string' || !value.seed.trim() || value.seed.length > 100) throw new Error('Seed harus berisi 1–100 karakter.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 150) throw new Error('Judul harus berisi 1–150 karakter.');
  if (!Array.isArray(value.topics) || value.topics.some((topic) => typeof topic !== 'string')) throw new Error('Pilihan materi tidak valid.');
  const available = value.mode === 'SKD' ? Object.values(TOPICS).flat() : TOPICS[value.mode];
  if (value.topics.some((topic) => !available.includes(topic))) throw new Error('Materi tidak sesuai dengan subtes yang dipilih.');
  if (!Array.isArray(value.subtopics) || value.subtopics.some((topic) => typeof topic !== 'string')) throw new Error('Pilihan submateri tidak valid.');
  const eligibleSubtopics = [...BANK, ...TIU_FAMILIES.map((family) => ({ ...family, subtopic: family.name }))]
    .filter((item) => available.includes(item.topic)).map((item) => item.topic + '::' + item.subtopic);
  if (value.subtopics.some((topic) => !eligibleSubtopics.includes(topic))) throw new Error('Submateri tidak sesuai subtes yang dipilih.');
  if (value.mode === 'SKD' && value.count < 3) throw new Error('Paket gabungan memerlukan minimal tiga soal.');
  return { ...value, seed: value.seed.trim(), title: value.title.trim(), topics: [...new Set(value.topics)] };
}
export function distribution(mode: Mode, count: number): Record<Subtest, number> {
  if (mode !== 'SKD') return { TWK: mode === 'TWK' ? count : 0, TIU: mode === 'TIU' ? count : 0, TKP: mode === 'TKP' ? count : 0 };
  const exact = Object.entries(BASELINE.counts).map(([subtest, n]) => ({ subtest: subtest as Subtest, raw: count * n / 110 }));
  const result = { TWK: 0, TIU: 0, TKP: 0 };
  exact.forEach((item) => { result[item.subtest] = Math.floor(item.raw); });
  exact.sort((a, b) => (b.raw % 1) - (a.raw % 1));
  const remainder = count - Object.values(result).reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[exact[i].subtest]++;
  return result;
}
export const normalizeText = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function fingerprint(question: Question): string {
  const visual = question.visual ? question.visual.figures.map((figure) => figure ? figureSignature(figure) : '?').join(';') : '';
  const options = question.options.map((option) => option.figure ? figureSignature(option.figure) : normalizeText(option.text)).sort().join('|');
  return normalizeText(question.stem) + '|' + JSON.stringify(question.table ?? '') + '|' + visual + '|' + options;
}
const familyFor = (item: BankItem) => item.id.includes('-case-') ? item.id.replace(/-\d+$/, '') : item.id;
function fromBank(item: BankItem): Question {
  return {
    ...item, no: 0, options: item.options.map((option) => ({ ...option })), family: familyFor(item),
    origin: item.id.includes('-ref-') ? 'referensi' : 'kasus',
    proof: { kind: 'bank', id: item.id, answerText: item.options[item.answer].text },
  };
}
function shuffled(question: Question, random: Rng): Question {
  const order = random.shuffle([0, 1, 2, 3, 4]);
  const proof = question.proof;
  const remapLabels = (text: string) => question.origin === 'referensi' ?
    text.replace(/\b[A-E]\b/g, (letter) => String.fromCharCode(65 + order.indexOf(letter.charCodeAt(0) - 65))) : text;
  return {
    ...question, options: order.map((i) => ({ ...question.options[i], reason: remapLabels(question.options[i].reason) })),
    answer: order.indexOf(question.answer), explanation: remapLabels(question.explanation),
    proof: proof.kind === 'numeric' ? { ...proof, values: order.map((i) => proof.values[i]) } :
      proof.kind === 'logic' ? { ...proof, valid: order.map((i) => proof.valid[i]),
        ...(proof.entailment ? { entailment: { ...proof.entailment, conclusions: order.map((i) => proof.entailment!.conclusions[i]) } } : {}) } : proof,
  };
}
function planTopics(topics: string[], count: number, random: Rng): string[] {
  const sorted = random.shuffle(topics);
  return Array.from({ length: count }, (_, index) => sorted[index % sorted.length]);
}
export function capacity(settings: Settings) {
  const counts = distribution(settings.mode, settings.count);
  return (['TWK', 'TKP'] as const).filter((subtest) => counts[subtest]).map((subtest) => ({
    subtest, available: bankFor(subtest, settings.topics, settings.difficulty, settings.subtopics).length,
    required: counts[subtest] * (settings.uniqueAcross ? settings.packages : 1),
  }));
}
export function generate(settingsInput: Partial<Settings>): Package[] {
  const settings = normalizeSettings(settingsInput);
  const counts = distribution(settings.mode, settings.count);
  for (const entry of capacity(settings)) if (entry.required > entry.available) {
    throw new Error('Persediaan ' + entry.subtest + ' untuk filter ini ' + entry.available + ' butir, sedangkan permintaan ' +
      entry.required + '. Kurangi jumlah, perluas materi/kesulitan, atau izinkan soal dipakai kembali di paket berbeda.');
  }
  const globalUsed = new Set<string>();
  const globalBankUsed = new Set<string>();
  const packages: Package[] = [];
  for (let p = 0; p < settings.packages; p++) {
    const random = rng(settings.seed + '|' + p);
    const localUsed = new Set<string>(), localBankUsed = new Set<string>(), usedFamilies = new Set<string>();
    const questions: Question[] = [];
    for (const subtest of ['TWK', 'TIU', 'TKP'] as const) {
      if (!counts[subtest]) continue;
      const topics = TOPICS[subtest].filter((topic) => !settings.topics.length || settings.topics.includes(topic));
      if (!topics.length) throw new Error('Pilih setidaknya satu materi untuk ' + subtest + '.');
      const pool = subtest === 'TIU' ? [] : random.shuffle(bankFor(subtest, topics, settings.difficulty, settings.subtopics));
      const familyPool = TIU_FAMILIES.filter((family) => topics.includes(family.topic) &&
        (settings.difficulty === 'campuran' || family.levels.includes(settings.difficulty)) &&
        (!settings.subtopics.length || settings.subtopics.includes(family.topic + '::' + family.name)));
      const availableTopics = subtest === 'TIU' ? topics.filter((topic) => familyPool.some((family) => family.topic === topic)) :
        topics.filter((topic) => pool.some((item) => item.topic === topic));
      if (!availableTopics.length) throw new Error('Tidak ada soal ' + subtest + ' pada filter kesulitan ini.');
      const plan = planTopics(availableTopics, counts[subtest], random);
      for (let index = 0; index < plan.length; index++) {
        let question: Question | undefined;
        const target = plan[index];
        if (subtest !== 'TIU') {
          const candidates = pool.filter((item) => !localBankUsed.has(item.id) && (!settings.uniqueAcross || !globalBankUsed.has(item.id)));
          const choose = (items: BankItem[]) => items.find((item) => !usedFamilies.has(familyFor(item))) ?? items[0];
          const item = choose(candidates.filter((item) => item.topic === target)) ?? choose(candidates);
          if (!item) throw new Error('Bahan ' + subtest + ' habis. Kurangi paket atau perluas filter.');
          localBankUsed.add(item.id); globalBankUsed.add(item.id); usedFamilies.add(familyFor(item));
          question = fromBank(item);
        } else {
          const families = familyPool.filter((family) => family.topic === target);
          for (let attempt = 0; attempt < 600; attempt++) {
            const family = families[(index + attempt) % families.length];
            const level = settings.difficulty === 'campuran' ? random.pick(family.levels) : settings.difficulty;
            const draft = makeTiu(family, level, random);
            const candidate: Question = { ...draft, id: 'tiu-' + family.id + '-' + p + '-' + index + '-' + attempt, no: 0 };
            const signature = fingerprint(candidate);
            if (localUsed.has(signature) || (settings.uniqueAcross && globalUsed.has(signature))) continue;
            question = candidate; break;
          }
          if (!question) throw new Error('Variasi TIU untuk filter ini tidak cukup. Kurangi jumlah atau tambahkan materi.');
        }
        const signature = fingerprint(question);
        if (localUsed.has(signature) || (settings.uniqueAcross && globalUsed.has(signature))) {
          throw new Error('Butir berulang ditemukan. Kurangi jumlah paket atau perluas filter.');
        }
        localUsed.add(signature); globalUsed.add(signature);
        questions.push({ ...shuffled(question, random), no: questions.length + 1 });
      }
    }
    packages.push({ id: 'SKD-' + String(p + 1).padStart(2, '0'), mode: settings.mode, seed: settings.seed + '|' + p,
      duration: settings.duration, questions });
  }
  const audit = auditPackages(packages, settings);
  if (!audit.ok) throw new Error('Paket gagal validasi: ' + audit.errors.slice(0, 3).join('; '));
  return packages;
}
export const sourceItem = (id: string) => BANK_MAP.get(id);
