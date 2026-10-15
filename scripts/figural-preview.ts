// Contoh soal figural untuk ditinjau mata: satu berkas HTML berisi gambar, kunci, pembahasan, dan alasan tiap opsi.
// Jalankan:  npm run figural:preview -- --out <folder> [--per 3] [--seed CONTOH] [--png]
// `--png` juga menulis gambar PNG tiap soal bila pustaka sharp tersedia (tidak wajib).
import fs from 'node:fs';
import path from 'node:path';
import { questionSvg } from '../lib/figures';
import { rng } from '../lib/rng';
import { TIU_FAMILIES, makeTiu } from '../lib/tiu';
import type { Difficulty, Question } from '../lib/types';

const args = process.argv.slice(2);
const value = (key: string, fallback: string) => { const i = args.indexOf('--' + key); return i >= 0 ? args[i + 1] ?? fallback : fallback; };
const out = path.resolve(value('out', 'output/figural-contoh')), per = Number(value('per', '3')), seed = value('seed', 'CONTOH-FIGURAL');
fs.mkdirSync(out, { recursive: true });
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const levels: Difficulty[] = ['mudah', 'sedang', 'sulit', 'hots'];

(async () => {
  type Sharp = (input: Buffer, options: { density: number }) => { png(): { toFile(file: string): Promise<unknown> } };
  let sharp: Sharp | null = null;
  if (args.includes('--png')) { try { const name = 'sharp'; sharp = (await import(name)).default as Sharp; } catch { console.log('sharp tidak tersedia; hanya HTML yang ditulis.'); } }
  const sections: string[] = [];
  let total = 0;
  for (const family of TIU_FAMILIES.filter((f) => f.topic === 'Figural')) for (const level of levels) {
    const items: string[] = [];
    for (let i = 0; i < per; i++) {
      const draft = makeTiu(family, level, rng(seed + '|' + family.id + '|' + level + '|' + i));
      const q: Question = { ...draft, no: i + 1, id: family.id + '-' + level + '-' + i }, svg = questionSvg(q, true);
      total++;
      const name = family.id + '-' + level + '-' + (i + 1);
      if (sharp) await sharp(Buffer.from(svg), { density: 150 }).png().toFile(path.join(out, name + '.png'));
      items.push('<article><h3>' + esc(family.name) + ' · ' + level + ' · ' + esc(q.visual!.rule!.mekanisme) + ' · kunci ' + String.fromCharCode(65 + q.answer) + '</h3><p class="stem">' + esc(q.stem) + '</p><div class="art">' + svg + '</div>' +
        '<details><summary>Pembahasan</summary><p>' + esc(q.explanation).replace(/\n/g, '<br>') + '</p><ol type="A">' + q.options.map((o) => '<li' + (q === q && o.score ? ' class="kunci"' : '') + '>' + esc(o.reason) + '</li>').join('') + '</ol><p class="meta">' + esc(q.difficultyReason ?? '') + '</p></details></article>');
    }
    sections.push('<section><h2>' + esc(family.name) + ' — ' + level + '</h2>' + items.join('') + '</section>');
  }
  const html = '<!doctype html><html lang="id"><meta charset="utf-8"><title>Contoh soal figural TIU</title><style>body{font:15px/1.55 system-ui,sans-serif;margin:24px auto;max-width:900px;color:#19334f}h2{border-bottom:2px solid #dbe4ee;padding-bottom:4px;margin-top:40px}article{margin:18px 0;padding:14px;border:1px solid #dbe4ee;border-radius:10px;background:#fff}h3{font-size:14px;margin:0 0 6px}.stem{font-weight:600}.art svg{max-width:100%;height:auto}.kunci{background:#e8f5ee}.meta{color:#586c80;font-size:13px}details{margin-top:8px}</style><body><h1>Contoh soal figural TIU</h1><p>Seed <code>' + esc(seed) + '</code>, ' + total + ' soal. Aturan tidak tampil pada kalimat soal; uraiannya ada di pembahasan.</p>' + sections.join('') + '</body></html>';
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log(JSON.stringify({ out, questions: total, html: path.join(out, 'index.html'), png: Boolean(sharp) }));
  console.log('RINGKASAN -> ' + total + ' soal figural' + (sharp ? ', PNG ikut ditulis' : ''));
  console.log('BERKAS -> ' + path.join(out, 'index.html'));
})();
