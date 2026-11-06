import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync } = require('fflate');
const directory = path.resolve('test-results'); fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SKD_BROWSER_EXECUTABLE ? { executablePath: process.env.SKD_BROWSER_EXECUTABLE } : {}) });
const context = await browser.newContext({ viewport: { width: 1512, height: 1100 }, acceptDownloads: true });
const page = await context.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message));
const base = process.env.SKD_BROWSER_URL ?? 'http://localhost:3000';
const download = async (action, filename, target = page) => { const promise = target.waitForEvent('download', { timeout: 60000 }); await action(); const d = await promise; await d.saveAs(path.join(directory, filename)); return fs.readFileSync(path.join(directory, filename)); };
const approve = async () => { await page.getByLabel('Nama penelaah').fill('Penelaah QA'); await page.getByLabel('Catatan pemeriksaan').fill('Stimulus, kunci, seluruh opsi, dan pembahasan telah diperiksa dalam pengujian aplikasi.'); await page.getByLabel('Saya telah memeriksa', { exact: false }).check(); await page.getByRole('button', { name: 'Setujui soal', exact: true }).click(); };
// Saklar kurasi dibaca dari lib/config.ts (KURASI_AKTIF) supaya skrip mengikuti pengaturan saat ini: false = tanpa persetujuan/keluarkan, dengan ganti nomor.
const kurasi = /KURASI_AKTIF\s*:\s*boolean\s*=\s*true/.test(fs.readFileSync('lib/config.ts', 'utf8'));
const buat = () => page.locator('main').getByRole('button', { name: kurasi ? 'Buat paket untuk dikurasi' : 'Buat paket', exact: true });
try {
  assert.equal((await page.goto(base)).status(), 200);
  await buat().waitFor();
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.screenshot({ path: path.join(directory, 'generator-desktop-v2.png'), fullPage: true });
  await page.getByRole('button',{name:/Latihan bebas/}).click();
  await page.getByRole('button', { name: /^TIU/ }).click();
  await page.getByLabel('Soal per paket', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'Figural', exact: true }).click();
  await buat().click();
  await page.locator('.question-card').waitFor();
  assert.equal(await page.locator('.number-button').count(), 8);
  assert.equal(await page.locator('.correct-option').count(), 1);
  if (!kurasi) { // fitur telaah disembunyikan: tab "Hasil paket", tanpa tombol keputusan, TopBar menampilkan jumlah soal
    assert.equal(await page.getByRole('button', { name: 'Hasil paket', exact: true }).count(), 1);
    for (const name of ['Setujui soal', 'Tandai perlu revisi', 'Simpan catatan sebagai draf', 'Keluarkan dari paket']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0);
    assert.equal(await page.getByLabel('Nama penelaah').count(), 0); assert.equal(await page.getByLabel('Filter status').count(), 0);
    assert.ok((await page.locator('.topbar-progress').textContent()).includes('8 soal')); assert.ok(!(await page.locator('.topbar-package').textContent()).includes('disetujui'));
  }
  await page.screenshot({ path: path.join(directory, 'review-desktop-v2.png'), fullPage: true });
  if (kurasi) { await approve();
  assert.equal(await page.locator('.number-button.approved').count(), 1); }
  await page.getByRole('button', { name: 'Sunting soal', exact: true }).click();
  const stem = page.locator('.editor-dialog').getByLabel('Pertanyaan', { exact: true });
  await stem.fill((await stem.inputValue()) + ' Perhatikan seluruh ciri pada stimulus.');
  await page.getByRole('button', { name: 'Simpan revisi', exact: true }).click();
  await page.locator('.editor-dialog').waitFor({ state: 'detached' });
  if (kurasi) {
  assert.equal(await page.locator('.number-button.revision').count(), 1);
  assert.equal(await page.locator('.number-button.approved').count(), 0);
  await approve();
  await page.getByRole('button', { name: 'Keluarkan dari paket', exact: true }).click();
  assert.equal(await page.locator('.number-button.excluded').count(), 1);
  await page.getByRole('button', { name: 'Kembalikan ke paket', exact: true }).click();
  await page.getByRole('button', { name: 'Ganti soal', exact: true }).click();
  await page.getByRole('button', { name: 'Setujui soal', exact: true }).waitFor();
  assert.equal(await page.locator('.error-message').count(), 0);
  await approve();
  } else {
    // Ganti nomor ini: nomor tetap, soal berganti, tersimpan sebagai versi baru.
    await page.getByRole('button', { name: 'Ganti nomor ini', exact: true }).click();
    await page.locator('.notice-message').filter({ hasText: '1 nomor diganti' }).waitFor();
    assert.equal(await page.locator('.number-button').count(), 8); assert.equal(await page.locator('.error-message').count(), 0);
    // Mode pilih pada peta nomor: Pilih semua, Kosongkan, lalu ganti dua nomor sekaligus.
    await page.getByRole('button', { name: 'Pilih nomor', exact: true }).click();
    await page.getByRole('button', { name: 'Pilih semua', exact: true }).click(); await page.getByRole('button', { name: 'Ganti nomor terpilih (8)' }).waitFor();
    await page.getByRole('button', { name: 'Kosongkan', exact: true }).click(); assert.equal(await page.getByRole('button', { name: 'Ganti nomor terpilih (0)' }).isDisabled(), true);
    await page.getByRole('checkbox', { name: /^Pilih soal 2 / }).check(); await page.getByRole('checkbox', { name: /^Pilih soal 5 / }).check();
    await page.getByRole('button', { name: 'Ganti nomor terpilih (2)' }).click();
    await page.locator('.notice-message').filter({ hasText: '2 nomor diganti (2, 5)' }).waitFor();
    assert.equal(await page.locator('.number-button').count(), 8); assert.equal(await page.getByRole('button', { name: 'Ganti nomor terpilih (0)' }).isDisabled(), true);
    assert.deepEqual(await page.locator('.queue-no').allTextContents(), ['01', '02', '03', '04', '05', '06', '07', '08']);
    await page.getByRole('button', { name: 'Selesai pilih', exact: true }).click();
  }
  const backup = JSON.parse((await download(() => page.getByRole('button', { name: 'Cadangan', exact: true }).click(), 'cadangan-v2.json')).toString());
  assert.ok(backup.snapshots.length >= (kurasi ? 6 : 3)); assert.equal(backup.result.packages[0].questions.length, 8);
  await page.getByRole('button', { name: 'Ekspor paket', exact: true }).click();
  let data = JSON.parse((await download(async () => { await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^JSON/ }).click(); await page.locator('.export-dialog .primary-button').click(); }, 'approved-v2.json')).toString());
  if (kurasi) { assert.equal(data.packages[0].questions.length, 1); assert.equal(data.packages[0].questions[0].review.status, 'approved');
  await page.getByLabel('Status soal yang disertakan').selectOption('draft'); }
  else { assert.equal(await page.getByLabel('Status soal yang disertakan').count(), 0); assert.equal(data.packages[0].questions.length, 8); assert.ok(!data.settings.title.includes('Draf kurasi')); }
  await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^PDF/ }).click(); await page.getByLabel('Isi dokumen').selectOption('soal');
  const pdf = await download(() => page.locator('.export-dialog .primary-button').click(), 'soal-figural-v2.pdf'); assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^Word biasa/ }).click(); await page.getByLabel('Isi dokumen').selectOption('pembahasan');
  const word = await download(() => page.locator('.export-dialog .primary-button').click(), 'pembahasan-figural-v2.docx'); const parts = unzipSync(word);
  assert.ok(parts['word/document.xml']); assert.equal((new TextDecoder().decode(parts['word/document.xml']).match(/name="figural-/g)??[]).length,8);
  if (!kurasi) assert.ok(!new TextDecoder().decode(parts['word/document.xml']).includes('DRAF KURASI'));
  await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^CSV/ }).click(); const csv = await download(() => page.locator('.export-dialog .primary-button').click(), 'bank-v2.csv'); assert.ok(csv.toString().includes('Catatan kurasi'));
  await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^JSON/ }).click(); data = JSON.parse((await download(() => page.locator('.export-dialog .primary-button').click(), 'draft-v2.json')).toString()); assert.equal(data.packages[0].questions.length, 8);
  await page.getByRole('group', { name: 'Format berkas' }).getByRole('button', { name: /^PDF/ }).click(); await page.getByLabel('Pisahkan per paket dalam ZIP').check(); const zip = await download(() => page.locator('.export-dialog .primary-button').click(), 'paket-v2.zip'); assert.equal(Object.keys(unzipSync(zip)).length, 1);
  await page.getByLabel('Tutup dialog ekspor').click();
  await page.getByRole('button', { name: 'Evaluasi peserta', exact: true }).click();
  const html = (await download(() => page.getByRole('button', { name: 'Unduh berkas uji untuk peserta' }).click(), 'uji-peserta-v2.html')).toString();
  assert.ok(!html.includes('"answer":')); assert.ok(!html.includes('"score":')); assert.ok(!html.includes('"explanation":'));
  const shared = kurasi ? 1 : 8; // soal yang ikut uji peserta: yang disetujui saat kurasi aktif, semua soal paket bila tidak
  await page.getByRole('button', { name: 'Mulai uji di perangkat ini' }).click();
  await page.getByLabel('Kode peserta', { exact: true }).fill('QA-001'); await page.getByRole('button', { name: 'Mulai pengerjaan', exact: true }).click();
  assert.equal(await page.locator('.explanation').count(), 0);
  await page.locator('.option-choice').first().click(); await page.getByRole('button', { name: /Selesaikan sesi/ }).click();
  await page.locator('.analysis-table').waitFor(); assert.ok((await page.locator('.review-summary').textContent()).includes('1'));
  const offline = await context.newPage(); offline.on('pageerror', (e) => errors.push(e.message)); await offline.goto(pathToFileURL(path.join(directory, 'uji-peserta-v2.html')).href);
  await offline.locator('#participant').fill('QA-002'); await offline.locator('#begin').click(); await offline.locator('#options button').last().click(); await offline.locator('#finish').click();
  const result = JSON.parse((await download(() => offline.locator('#download').click(), 'hasil-peserta-v2.json', offline)).toString()); assert.equal(result.answers.length, shared); await offline.close();
  await page.locator('input[type=file]').nth(1).setInputFiles(path.join(directory, 'hasil-peserta-v2.json'));
  await page.waitForFunction(() => document.querySelector('.review-summary strong')?.textContent === '2');
  await page.locator('input[type=file]').nth(1).setInputFiles(path.join(directory, 'hasil-peserta-v2.json'));
  await page.screenshot({ path: path.join(directory, 'analysis-desktop-v2.png'), fullPage: true });
  await page.reload(); await page.locator('.question-card').waitFor(); if (kurasi) assert.equal(await page.locator('.number-button.approved').count(), 1);
  await page.getByRole('button', { name: 'Riwayat paket', exact: true }).click(); assert.equal(await page.locator('.history-card').count(), 1);
  await page.locator('.history-card summary').click(); await page.locator('.version-list button').last().click();
  await page.locator('.question-card').waitFor(); if (kurasi) assert.equal(await page.locator('.number-button.approved').count(), 0);
  await page.locator('input[type=file]').first().setInputFiles(path.join(directory, 'cadangan-v2.json'));
  if (kurasi) await page.waitForFunction(() => document.querySelectorAll('.number-button.approved').length === 1);
  else await page.locator('.notice-message').filter({ hasText: 'Cadangan berhasil dimuat' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Review mobile overflow');
  await page.screenshot({ path: path.join(directory, 'review-mobile-v2.png'), fullPage: true });
  await page.getByRole('button', { name: 'Buat paket', exact: true }).click(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Generator mobile overflow');
  await page.screenshot({ path: path.join(directory, 'generator-mobile-v2.png'), fullPage: true });
  await page.getByRole('button', { name: 'Pustaka soal', exact: true }).click(); assert.ok((await page.locator('.bank-stats').textContent()).includes('167 butir')); assert.ok((await page.locator('.bank-stats').textContent()).includes('305 butir'));
  await page.getByRole('button', { name: 'Panduan', exact: true }).click(); assert.equal(await page.locator('.guide-step').count(), 6);
  const valid = await context.request.post(base + '/api/generate', { data: { mode: 'TWK', count: 5, packages: 1 } }); assert.equal(valid.status(), 200); assert.equal((await valid.json()).audit.checked, 5);
  assert.equal((await context.request.post(base + '/api/generate', { data: { mode: 'INVALID' } })).status(), 400);
  assert.deepEqual(errors, []);
  const report = { status: 'PASS', exports: 6, persistence: true, curation: kurasi, replaceSelected: !kurasi, revisions: true, participantImport: true, offlineQuiz: true, mobileOverflow: false, browserErrors: errors };
  fs.writeFileSync(path.join(directory, 'browser-report-v2.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await page.screenshot({ path: path.join(directory, 'failure-v2.png'), fullPage: true });
  console.log(JSON.stringify({ pageErrors: errors, alerts: await page.locator('[role=alert]').allTextContents(), body: (await page.locator('body').innerText()).slice(0, 7000) }));
  throw error;
} finally { await browser.close(); }
