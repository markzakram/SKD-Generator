import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SETTINGS } from '../lib/config';
import { generate, normalizeSettings } from '../lib/generate';
import { auditPackages } from '../lib/validate';
import type { DifficultyFilter, Mode } from '../lib/types';
const args = process.argv.slice(2);
const value = (key: string, fallback: string) => {
  const index = args.indexOf('--' + key);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
};
const mode = value('mode', 'SKD').toUpperCase() as Mode;
const count = mode === 'TWK' ? 30 : mode === 'TIU' ? 35 : mode === 'TKP' ? 45 : 110;
const settings = normalizeSettings({ ...DEFAULT_SETTINGS, mode, count: Number(value('soal', String(count))),
  packages: Number(value('paket', '1')), seed: value('seed', DEFAULT_SETTINGS.seed),
  difficulty: value('kesulitan', 'campuran') as DifficultyFilter, uniqueAcross: !args.includes('--boleh-ulang') });
const packages = generate(settings);
const output = path.resolve(value('out', 'output'));
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'paket.json'), JSON.stringify({ version: 1, settings, packages }, null, 2));
const audit = auditPackages(packages, settings);
fs.writeFileSync(path.join(output, 'validasi.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify({ output, packages: packages.length, questions: audit.checked, valid: audit.ok }));
