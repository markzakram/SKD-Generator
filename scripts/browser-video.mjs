import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const dir = path.resolve('test-results'), base = process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107';
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1450, height: 1100 }, acceptDownloads: true });
await context.addInitScript(() => {
  window.__videoPngUrls = new Set();
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = create(blob); if (blob.type === 'image/png') window.__videoPngUrls.add(url); return url; };
  URL.revokeObjectURL = url => { window.__videoPngUrls.delete(url); revoke(url); };
});
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.setDefaultTimeout(60000);
const dialog = page.getByRole('dialog', { name: 'Video pembahasan', exact: true });
const queue = page.getByRole('complementary', { name: 'Antrean soal' });
async function enter() {
  assert.equal((await page.goto(base)).status(), 200);
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles(path.join(dir, 'academic-fixture.json'));
  await queue.getByRole('button', { name: /^Buka soal 8,/ }).click();
  await page.getByRole('button', { name: 'Video pembahasan', exact: true }).click();
  await dialog.waitFor();
}
async function prepare() {
  await dialog.getByRole('button', { name: /Siapkan.*pratinjau/ }).click();
  await dialog.getByText('Pratinjau siap.', { exact: false }).waitFor({ timeout: 240000 });
  assert.equal(await dialog.locator('.error-message').count(), 0);
}
async function captureStage(pattern, filename) {
  const options = await dialog.getByLabel('Lihat tahap pembahasan').locator('option').evaluateAll(nodes => nodes.map(n => ({ text: n.textContent, value: n.value })));
  const option = options.find(o => pattern.test(o.text)); assert.ok(option, pattern.toString());
  await dialog.getByLabel('Lihat tahap pembahasan').selectOption(option.value);
  await page.waitForTimeout(150);
  const img = dialog.locator('.video-preview img').first(); await img.waitFor();
  const bytes = await img.evaluate(async image => Array.from(new Uint8Array(await (await fetch(image.src)).arrayBuffer())));
  fs.writeFileSync(path.join(dir, filename), Buffer.from(bytes));
}
try {
  await enter();
  assert.ok(await dialog.getByRole('button', { name: 'Unduh MP4', exact: true }).isDisabled());
  await dialog.getByLabel('Tempo membaca').selectOption('fast');
  await dialog.getByLabel('Jeda sebelum jawaban').selectOption('0');
  await prepare();
  await captureStage(/Soal 8 · Pembahasan/, 'video-math.png');
  await dialog.screenshot({ path: path.join(dir, 'video-dialog.png') });
  const durationLabel = await dialog.locator('.video-totals').textContent();
  await dialog.getByRole('button', { name: 'Unduh MP4', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => [...document.querySelectorAll('dialog button')].some(b => b.textContent === 'Unduh MP4' && !b.disabled));

  // Cancel a real encoder job, then immediately retry with the same preview.
  await dialog.getByRole('button', { name: 'Unduh MP4', exact: true }).click();
  await dialog.getByRole('button', { name: 'Batalkan proses' }).click();
  await dialog.getByText('Dibatalkan.', { exact: false }).waitFor();
  const pending = page.waitForEvent('download', { timeout: 600000 });
  await dialog.getByRole('button', { name: 'Unduh MP4', exact: true }).click();
  const file = await pending;
  assert.equal(await file.failure(), null);
  await file.saveAs(path.join(dir, 'video-pembahasan.mp4'));
  await dialog.locator('.export-success').waitFor();
  assert.match(file.suggestedFilename(), /soal-8-pembahasan\.mp4$/);
  const bytes = fs.readFileSync(path.join(dir, 'video-pembahasan.mp4'));
  assert.equal(bytes.subarray(4, 8).toString(), 'ftyp'); assert.ok(bytes.length > 20000);
  // Parse MP4 metadata with a browser video element (no external codecs/tools required).
  const decoded = await page.evaluate(async b64 => {
    const data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
    try { const v = document.createElement('video'); v.src = url;
      await new Promise((resolve, reject) => { v.onloadedmetadata = resolve; v.onerror = reject; });
      const metadata = { width: v.videoWidth, height: v.videoHeight, duration: v.duration }, frames = [];
      const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      for (const at of [.6, v.duration * .55, v.duration - .6]) {
        await new Promise((resolve, reject) => { v.onseeked = resolve; v.onerror = reject; v.currentTime = at; });
        ctx.drawImage(v, 0, 0); frames.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return { metadata, frames };
    } finally { URL.revokeObjectURL(url); }
  }, bytes.toString('base64'));
  const { metadata, frames } = decoded;
  frames.forEach((frame, i) => fs.writeFileSync(path.join(dir, `video-decoded-${i + 1}.png`), Buffer.from(frame, 'base64')));
  // MP4 track handler types: a silent render must have a video track and no audio track.
  const handlers = [];
  function atoms(start, end) {
    for (let offset = start; offset + 8 <= end;) {
      const size = bytes.readUInt32BE(offset), kind = bytes.subarray(offset + 4, offset + 8).toString();
      if (size < 8 || offset + size > end) break;
      if (kind === 'hdlr') handlers.push(bytes.subarray(offset + 16, offset + 20).toString());
      if (['moov', 'trak', 'mdia'].includes(kind)) atoms(offset + 8, offset + size);
      offset += size;
    }
  }
  atoms(0, bytes.length); assert.ok(handlers.includes('vide') && !handlers.includes('soun'));
  assert.equal(metadata.width, 1280); assert.equal(metadata.height, 720); assert.ok(metadata.duration >= 25);
  console.log('MP4 PASS', JSON.stringify(metadata), durationLabel);

  await dialog.getByLabel('Soal dalam video').selectOption('package');
  await prepare();
  assert.match(await dialog.locator('.video-totals').textContent(), /12 soal/);
  assert.equal(await dialog.getByLabel('Lompat ke soal').locator('option').count(), 13);
  await captureStage(/Soal 1 · Pembahasan/, 'video-silogisme.png');
  await captureStage(/Soal 10 · Pahami soal/, 'video-figural.png');
  await captureStage(/Soal 12 · Jawaban/, 'video-tkp-poin.png');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth));
  await dialog.screenshot({ path: path.join(dir, 'video-mobile.png') });
  await page.setViewportSize({ width: 1450, height: 1100 });
  await dialog.getByRole('button', { name: 'Tutup video pembahasan' }).click();
  await page.getByLabel('Pilih beberapa soal', { exact: true }).check();
  // Number-grid selection labels are distinct from navigation labels.
  const checkboxes = queue.locator('input[type=checkbox]');
  if (await checkboxes.count()) { await checkboxes.nth(0).check(); await checkboxes.nth(2).check(); }
  else { await queue.locator('.number-button').nth(0).click(); await queue.locator('.number-button').nth(2).click(); }
  await page.getByRole('button', { name: 'Video pembahasan', exact: true }).click();
  await dialog.getByLabel('Soal dalam video').selectOption('selected');
  await prepare();
  assert.match(await dialog.locator('.video-totals').textContent(), /2 soal/);
  await dialog.getByLabel('Tutup video pembahasan').click();
  await page.waitForFunction(() => window.__videoPngUrls.size === 0);

  // Real 110-question generation: all chapters prepare, including matrix, tables, and local TWK/TKP.
  await page.getByLabel('Pilih beberapa soal', { exact: true }).uncheck();
  await page.locator('input[type=file]').first().setInputFiles(path.join(dir, 'video-full-fixture.json'));
  await page.getByRole('button', { name: 'Video pembahasan', exact: true }).click();
  await dialog.getByLabel('Soal dalam video').selectOption('package');
  await dialog.getByRole('button', { name: /Siapkan.*pratinjau/ }).click();
  await dialog.getByRole('button', { name: 'Batalkan proses' }).click();
  await dialog.getByText('Dibatalkan.', { exact: false }).waitFor();
  await page.waitForFunction(() => window.__videoPngUrls.size === 0);
  const started = Date.now(); await prepare();
  const fullLabel = await dialog.locator('.video-totals').textContent();
  assert.match(fullLabel, /110 soal/);
  assert.equal(await dialog.getByLabel('Lompat ke soal').locator('option').count(), 111);
  console.log('110-question preview PASS', fullLabel, Math.round((Date.now() - started) / 1000) + 's preparation');
  await dialog.getByLabel('Tutup video pembahasan').click();
  await page.waitForFunction(() => window.__videoPngUrls.size === 0);
  assert.deepEqual(errors, []);
  // No encoder: disabled MP4 export with a readable explanation, but usable preview.
  const fallbackContext = await browser.newContext();
  await fallbackContext.addInitScript(() => Object.defineProperty(window, 'VideoEncoder', { value: undefined, configurable: true }));
  const fallback = await fallbackContext.newPage(); await fallback.goto(base);
  await fallback.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await fallback.locator('input[type=file]').first().setInputFiles(path.join(dir, 'academic-fixture.json'));
  await fallback.getByRole('button', { name: 'Video pembahasan', exact: true }).click();
  const fallbackDialog = fallback.getByRole('dialog', { name: 'Video pembahasan', exact: true });
  await fallbackDialog.getByRole('button', { name: 'Siapkan pratinjau' }).click();
  await fallbackDialog.getByText('Pratinjau siap.', { exact: false }).waitFor();
  assert.ok(await fallbackDialog.getByRole('button', { name: 'Unduh MP4', exact: true }).isDisabled());
  assert.match(await fallbackDialog.textContent(), /Browser ini belum mendukung|Dukungan MP4 tidak dapat diperiksa/);
  await fallbackContext.close();
  fs.writeFileSync(path.join(dir, 'video-browser.json'), JSON.stringify({ status: 'PASS', metadata, bytes: bytes.length, durationLabel, fullLabel, silent: true, unsupportedBrowser: 'PASS', pngCleanup: 'PASS' }, null, 2));
  console.log('PASS: MP4, cancellation/retry, full package, selected questions, math/diagrams/TKP, mobile, no browser exceptions');
} catch (error) {
  await page.screenshot({ path: path.join(dir, 'video-failure.png') }).catch(() => {});
  console.error('Browser errors:', errors); throw error;
} finally { await browser.close(); }
