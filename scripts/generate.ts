import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate, normalizeSettings } from '../lib/generate';
import { auditPackages } from '../lib/validate';
import type { DifficultyFilter, Mode, Settings } from '../lib/types';
const args = process.argv.slice(2);
const value = (key: string, fallback: string) => {
  const index = args.indexOf('--' + key);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
// --chapter map-14=15 boleh diulang atau dipisah koma. Bila ada, paket memakai standar tryout 2027; jumlah soal, jenis paket, dan durasi mengikuti isian (lib/generate.ts: normalizeSettings).
const chapterItems = args.flatMap((arg, index) => arg === '--chapter' ? (args[index + 1] ?? '').split(',') : []).map((item) => item.trim());
const chapterCounts: Record<string, number> = {};
for (const item of chapterItems) {
  const match = /^([^=]+)=(.*)$/.exec(item);
  if (!match) throw new Error('Format --chapter harus id=jumlah, misalnya --chapter map-14=15. Diterima: "' + item + '".');
  if (match[1] in chapterCounts) throw new Error('Chapter ' + match[1] + ' disebut lebih dari sekali pada --chapter.');
  chapterCounts[match[1]] = Number(match[2]);
}
const custom = chapterItems.length > 0;
const mode = value('mode', 'SKD').toUpperCase() as Mode;
const count = mode === 'TWK' ? 30 : mode === 'TIU' ? 35 : mode === 'TKP' ? 45 : 110;
const settings = normalizeSettings({ mode, count: Number(value('soal', String(count))), ...(custom ? { chapterCounts } : {}),
  profile:value('profile',custom?'tryout-2027':'free') as Settings['profile'],twkSource:value('twk','accepted') as Settings['twkSource'],tkpSource:value('tkp','accepted') as Settings['tkpSource'],tiuSource:value('tiu','accepted') as Settings['tiuSource'],
  packages: Number(value('paket', '1')), seed: value('seed', DEFAULT_SETTINGS.seed),
  difficulty: value('kesulitan', 'campuran') as DifficultyFilter, uniqueAcross: !args.includes('--boleh-ulang') });
const packages = generate(settings);
const output = path.resolve(value('out', 'output'));
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'paket.json'), JSON.stringify({ version: 1, settings, packages }, null, 2));
const audit = auditPackages(packages, settings);
fs.writeFileSync(path.join(output, 'validasi.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ output, packages: packages.length, questions: audit.checked, valid: audit.ok }));
console.log(`RINGKASAN -> ${packages.length} paket, ${audit.checked} soal, ${audit.ok ? 'valid' : 'TIDAK valid (lihat validasi.json)'}`);
for (const file of ['paket.json', 'validasi.json']) console.log(`BERKAS -> ${path.join(output, file)}`);
