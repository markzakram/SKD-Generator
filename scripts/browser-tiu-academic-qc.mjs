import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.SKD_PLAYWRIGHT_MODULE ?? 'playwright');
const { unzipSync, strFromU8 } = require('fflate');
const { DOMParser } = require('@xmldom/xmldom');
const report = JSON.parse(fs.readFileSync('test-results/tiu-academic-audit.json'));
const questions = report.representatives;
const browser = await chromium.launch({headless:true, ...(process.env.SKD_BROWSER_EXECUTABLE ? {executablePath:process.env.SKD_BROWSER_EXECUTABLE}: {})});
const page = await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
page.setDefaultTimeout(120000);
const errors = [], missingImages = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => {if(r.url().includes('/academic-bank/') && !r.ok()) missingImages.push(r.url());});
const dialog = page.getByRole('dialog',{name:'Ekspor paket soal'});
async function download(button, file) {
  const wait = page.waitForEvent('download',{timeout:300000});
  await dialog.getByRole('button',{name:button,exact:true}).click();
  const result = await wait;
  assert.equal(await result.failure(),null);
  await result.saveAs('test-results/'+file);
  await dialog.locator('.export-success').waitFor();
  assert.equal(await dialog.locator('.error-message').count(),0);
  return fs.readFileSync('test-results/'+file);
}
try {
  await page.goto(process.env.SKD_BROWSER_URL ?? 'http://127.0.0.1:3107/');
  await page.waitForFunction(() => document.querySelector('.save-status')?.textContent.includes('Tersimpan'));
  await page.locator('input[type=file]').first().setInputFiles('test-results/tiu-academic-fixture.json');
  const card = page.locator('.question-card').first();
  const seen = {bold:0,table:0,image:0,color:0,strike:0};
  for (const q of process.argv.includes('--exports-only') ? [] : questions) {
    await page.getByRole('button',{name:new RegExp('^Buka soal '+q.no+',')}).click();
    await card.locator('.explanation-body').waitFor();
    assert.equal(await card.locator('.math-error, .error-message').count(),0, q.id);
    const body = card.locator('.explanation-body'), text = await body.innerText();
    assert.ok(!/@acuan |@gambar |@deret |@graf |\*\*|~~|\u0336|[𝟎-𝟿]/u.test(text), q.id+': no raw formatting markers');
    const counts = await body.evaluate(el => ({bold:el.querySelectorAll('b, .explanation-heading, th').length,table:el.querySelectorAll('table').length,image:el.querySelectorAll('.explanation-chain svg').length,color:el.querySelectorAll('[data-warna]').length,strike:el.querySelectorAll('s').length}));
    for (const key in seen) seen[key] += counts[key];
    if (q.provenance?.lesson==='Silogisme') assert.ok(counts.bold, q.id+': original source emphasis');
    if (q.explanation.includes('@acuan bank-')) assert.ok(counts.image,q.id+': original source image');
    if (['tryout-ref-00-28','tryout-ref-00-04','tryout-ref-11-07'].includes(q.id)) await body.screenshot({path:'test-results/tiu-qc-'+q.id+'.png'});
  }
  const panel = page.getByRole('region',{name:'Unduh paket',exact:true});
  await panel.getByRole('button',{name:/^PDF/}).click();
  await dialog.getByLabel('Isi dokumen').selectOption('pembahasan');
  await download('Unduh 1 file PDF','tiu-academic-all.pdf');
  await dialog.getByRole('button',{name:/^Word SiAdu/}).click();
  const word = await download('Unduh 1 file Word SiAdu','tiu-academic-all-siadu.docx');
  const files=unzipSync(word),doc=new DOMParser().parseFromString(strFromU8(files['word/document.xml']),'text/xml');
  const paragraphs=Array.from(doc.getElementsByTagName('w:p'));
  assert.equal(paragraphs.filter(p=>p.textContent==='Pembahasan:').length,questions.length);
  assert.ok(!paragraphs.some(p=>/@acuan |@gambar |@deret |@graf |\*\*|~~|\u0336|[𝟎-𝟿]/u.test(p.textContent)),'No formatting markers in DOCX');
  const runs=Array.from(doc.getElementsByTagName('w:r'));
  const styles=strFromU8(files['word/styles.xml']);
  assert.match(styles,/w:ascii="Times New Roman"/);assert.match(styles,/w:sz w:val="24"/);assert.match(styles,/w:line="360"/);
  assert.ok(runs.filter(r=>r.getElementsByTagName('w:strike').length).length>20);
  assert.ok(runs.filter(r=>r.getElementsByTagName('w:b').length).length>100);
  assert.ok(runs.filter(r=>r.getElementsByTagName('w:color').length).length>3);
  assert.ok(doc.getElementsByTagName('w:tbl').length>=40);
  assert.ok(doc.getElementsByTagName('w:drawing').length>=50);
  assert.deepEqual(errors,[]);assert.deepEqual(missingImages,[]);
  // Source PNGs are embedded byte-for-byte, rather than enlarged by a canvas.
  const assets=JSON.parse(fs.readFileSync('data/tryout-images.json'));
  const media=Object.entries(files).filter(([name])=>name.startsWith('word/media/')).map(([,bytes])=>Buffer.from(bytes));
  for(const asset of Object.values(assets))assert.ok(media.some(bytes=>bytes.equals(fs.readFileSync('public'+asset.url))),asset.url+': original source bytes in Word');
  const previous=process.argv.includes('--exports-only')?JSON.parse(fs.readFileSync('test-results/tiu-academic-browser-report.json')):null;
  const summary={questions:questions.length,bank:questions.filter(q=>q.origin==='referensi').length,ui:previous?.ui??seen,word:{tables:doc.getElementsByTagName('w:tbl').length,images:doc.getElementsByTagName('w:drawing').length}};
  fs.writeFileSync('test-results/tiu-academic-browser-report.json',JSON.stringify(summary,null,2));
  console.log('PASS',summary);
} finally {await browser.close();}
