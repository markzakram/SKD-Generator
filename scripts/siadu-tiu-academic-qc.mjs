import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.SKD_PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.SKD_BROWSER_EXECUTABLE?{executablePath:process.env.SKD_BROWSER_EXECUTABLE}:{})});
try {
  const page=await browser.newPage();
  await page.goto(process.env.SKD_BROWSER_URL??'http://127.0.0.1:3107');
  await page.addScriptTag({path:'test-results/siadu-importer-test.js'});
  const expected=JSON.parse(fs.readFileSync('test-results/tiu-academic-audit.json')).representatives;
  const parsed=await page.evaluate(async base64=>{
    const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    const result=await window.__siaduTest.readSiaduDocx(bytes.buffer);
    return {errors:result.errors,items:result.items.map(q=>{
      const div=document.createElement('div');div.innerHTML=q.explanationHtml;
      return {no:q.no,key:q.correctAnswer,mode:q.answerMode,errors:q.errors,modeErrors:window.__siaduTest.validateItemMode(q),letters:q.optionLettersFound,
        bold:div.querySelectorAll('strong,b').length,strike:div.querySelectorAll('s,del').length,color:div.querySelectorAll('span[style*="color"]').length,
        images:div.querySelectorAll('img').length,tables:div.querySelectorAll('table').length,externalImages:[...div.querySelectorAll('img')].filter(i=>!i.src.startsWith('data:image/')).length,
        remaining:/@acuan |@deret |@gambar |@graf |\*\*|~~|\$\$|\u0336|[𝟎-𝟿]/u.test(div.textContent)};
    })};
  },fs.readFileSync('test-results/tiu-academic-all-siadu.docx').toString('base64'));
  assert.deepEqual(parsed.errors,[]);assert.equal(parsed.items.length,expected.length);
  const totals={bold:0,strike:0,color:0,images:0,tables:0};
  parsed.items.forEach((item,i)=>{
    assert.deepEqual(item.errors,[],expected[i].id);assert.deepEqual(item.modeErrors,[],expected[i].id);
    assert.equal(item.no,String(i+1));assert.equal(item.key,String.fromCharCode(65+expected[i].answer));assert.equal(item.mode,'option_new');assert.equal(item.letters.join(''),'ABCDE');
    assert.equal(item.remaining,false,expected[i].id);assert.equal(item.externalImages,0,expected[i].id);
    for(const key in totals)totals[key]+=item[key];
    if(expected[i].explanation.includes('@acuan bank-'))assert.ok(item.images,expected[i].id);
  });
  assert.ok(totals.bold>100&&totals.strike>20&&totals.color>3&&totals.images>100&&totals.tables>30);
  fs.writeFileSync('test-results/tiu-academic-siadu-report.json',JSON.stringify({questions:parsed.items.length,totals},null,2));
  console.log('PASS: SiAdu DOCX readback',parsed.items.length,'questions',totals);
} finally {await browser.close();}
