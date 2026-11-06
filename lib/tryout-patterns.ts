import { isolated, type Rng } from './rng';
import type { Difficulty, Question } from './types';
import { calculate, entails, implies, not, variable, type Logic } from './solver';
import { dataCategory, DATA_LABELS, orders, type Model } from './models';
import { makeTiu, TIU_FAMILIES } from './tiu';
import { COMPARE, dataExplanation, equalityExplanation, pecahanExplanation } from './tiu-explain';
import { buildPosisi } from './tiu-posisi';
import { buildArgumen } from './tiu-argumen';
import { buildLogika, type ContohSlot } from './tiu-logika';
import { deretDistractors, deretDuaExplanation } from './tiu-deret';
import type { MappingRow } from './mapping';

type Draft = Omit<Question,'id'|'no'>;
const fmt=(n:number)=>String(Math.round(n*10000)/10000).replace('.',',');
function base(row:MappingRow,difficulty:Difficulty):Draft {
  return {subtest:'TIU',topic:row.topic,subtopic:row.chapter,mappingId:row.id,difficulty,bloom:'C4',family:'mapping-'+row.id,stem:'',options:[],answer:0,explanation:'',source:'Variasi baru dari pola tryout diterima; Mapping SKD 2027.xlsx, baris '+row.row,origin:'pola',proof:{kind:'manual',note:'Draf terstruktur, menunggu telaah.'},
    difficultyReason:'Kompleksitas berdasarkan jumlah hubungan yang harus digabung; bukan hasil kalibrasi peserta.'};
}
function choices(q:Draft,texts:string[],reasons:string[],answer=0,refs?:(number|undefined)[]):Draft {
  q.options=texts.map((text,i)=>({text,reason:reasons[i],score:i===answer?5:0,...(refs?.[i]!==undefined?{ref:refs[i]}:{})})); q.answer=answer; return q;
}
const places=(n:number)=>(String(Math.round(n*10000)/10000).split('.')[1]??'').length;
// `uniform` (baris 24, panduan PDF 63): semua opsi memakai jumlah desimal yang sama ("3,500; 3,250"), nilai dan urutan pengecoh tidak berubah.
function numeric(q:Draft,expression:string,wrong:[number,string][],uniform=false):Draft {
  const answer=calculate(expression), values:[number,string][]=[[Math.round(answer*10000)/10000,'Sesuai langkah penyelesaian dan target yang ditanyakan.']];
  for(const [n,reason] of wrong) { const rounded=Math.round(n*10000)/10000;if(Number.isFinite(rounded)&&!values.some(([v])=>Math.abs(v-rounded)<.000051))values.push([rounded,reason]); }
  if(values.length<5)throw new Error('Pengecoh model '+q.mappingId+' belum cukup.');
  const options=values.slice(0,5),digits=Math.max(...options.map(([v])=>places(v)));
  q=choices(q,options.map(([v])=>uniform?v.toFixed(digits).replace('.',','):fmt(v)),options.map(([,reason])=>reason));
  q.proof={kind:'numeric',expression,answer,values:options.map(([v])=>v)};return q;
}
function sufficiency(q:Draft,m:Extract<Model,{kind:'data'}>,description:string):Draft {
  const answer=dataCategory(m); q.stem=description+'\nPilih informasi yang cukup untuk menjawab pertanyaan tersebut.';
  // Pembahasan mengikuti format kecukupan data 2027 (lib/tiu-explain.ts): per pernyataan, lalu gabungan bila diperlukan.
  q.explanation=dataExplanation(m);
  q=choices(q,DATA_LABELS,DATA_LABELS.map((_,i)=>i===answer?'Kategori ini sesuai pengujian setiap pernyataan pada domain.':'Kategori ini keliru karena belum membedakan kepastian target dari diketahuinya semua variabel.'),answer);
  q.proof={kind:'model',model:m};return q;
}
function shuffle(q:Draft,r:Rng):Draft {
  const order=r.shuffle([0,1,2,3,4]),proof=q.proof;
  return {...q,options:order.map((i)=>q.options[i]),answer:order.indexOf(q.answer),proof:proof.kind==='numeric'?{...proof,values:order.map((i)=>proof.values[i])}:proof.kind==='logic'?{...proof,valid:order.map((i)=>proof.valid[i]),...(proof.entailment?{entailment:{...proof.entailment,conclusions:order.map((i)=>proof.entailment!.conclusions[i])}}:{})}:proof};
}
// Alasan per opsi hanya untuk silogisme (baris 13–15) dan analogi verbal (baris 16, lewat makeTiu); baris lain dikosongkan.
// `slot`: baris silogisme narasi memakai contoh blueprint lebih dahulu (lib/tiu-logika.ts); baris lain mengabaikannya.
export function makeMappedTiu(row:MappingRow,level:Difficulty,r:Rng,packageIndex=0,slot?:ContohSlot):Draft {
  const draft=buildMappedTiu(row,level,r,packageIndex,slot);
  return [13,14,15,16].includes(row.row)?draft:{...draft,options:draft.options.map((option)=>({...option,reason:''}))};
}
// Jumlah per chapter: chapter harus tepat. Baris 39 ("1 Towew") memakai deret satu larik; pembangkit baris itu pada kuota workbook menghasilkan dua larik dan dipertahankan supaya rekaman seed tryout tidak berubah.
export function makeChapterTiu(row:MappingRow,level:Difficulty,r:Rng,packageIndex=0,slot?:ContohSlot):Draft {
  if(row.row!==39)return makeMappedTiu(row,level,r,packageIndex,slot);
  const draft=makeTiu(TIU_FAMILIES.find((f)=>f.id==='deret')!,'mudah',r);
  return {...draft,subtopic:row.chapter,mappingId:row.id,source:base(row,'mudah').source,options:draft.options.map((option)=>({...option,reason:''}))};
}
// Baris dengan pembangkit sendiri yang direvisi berjalan pada pengacak turunan dan memajukan aliran bersama sebanyak versi lama (lib/rng.ts: isolated).
const ROW_DRAWS: Record<number,number> = { 13:6, 14:5, 15:5, 18:18, 39:8 };
function buildMappedTiu(row:MappingRow,level:Difficulty,shared:Rng,packageIndex=0,slot?:ContohSlot):Draft {
  const r=ROW_DRAWS[row.row]===undefined?shared:isolated(shared,'tiu-row|'+row.row,ROW_DRAWS[row.row]);
  let q=base(row,level);
  // Baris 19, 20, 22, 23, 40, 41, 44, 45 berkuota 0 pada workbook, jadi hanya tercapai lewat jumlah per chapter. Baris 40 = 2 towew: tingkat mudah pada keluarga `deret` berarti 1 towew, jadi tidak dipakai.
  if([16,19,20,22,23,40,41,44,45,50,51,52,53].includes(row.row)){
    const id=({16:'analogi',19:'peringkat',20:'jadwal',22:'kategori',23:'rute',40:'deret',41:'tiga-jalur',44:'selang-seling',45:'fibonacci',50:'fig-analogi',51:'fig-odd',52:'fig-serial',53:'fig-matrix'} as Record<number,string>)[row.row],family=TIU_FAMILIES.find((f)=>f.id===id)!;
    const wanted=row.row===40&&level==='mudah'?'sedang':level;
    const draft=makeTiu(family,family.levels.includes(wanted)?wanted:family.levels[0],r);
    return {...draft,subtopic:row.chapter,mappingId:row.id,source:q.source};
  }
  if([13,14,15].includes(row.row)){
    q.difficulty='sedang';q.bloom='C3';q.difficultyReason='Menggabungkan dua atau tiga hubungan implikasi yang eksplisit; label tidak dinaikkan hanya karena narasi lebih panjang.';
    // Blueprint Silogisme Tanpa Logika Kuantor (akademik, 28 Okt 2026): baris 13 = chapter "3 Premis" (Silogisme Biasa, tiga premis, kadang dengan ekuivalensi), baris 14 = "2 Premis - Narasi",
    // baris 15 = "3 Premis - Narasi". Chapter "2 Premis" (Biasa) tidak ada pada mapping 2027; ia tampil lewat pola umum `silogisme` (lib/tiu.ts), bukan lewat baris tryout.
    // Seluruh keacakan memakai `r`, pengacak turunan baris ini (ROW_DRAWS), sehingga butir lain pada seed yang sama tidak bergeser.
    // Pada pembuatan paket (`slot`), keluarga modus lima butir silogisme sepaket diatur perencana supaya beragam (lib/silo-rencana.ts): MP, MT, SK, SD, NEG, atau TDS, masing-masing paling banyak sekali per paket.
    const built=buildLogika(row.row===14?'n2':row.row===15?'n3':'b3',r,slot,slot&&row.count>0?{baris:row.row as 13|14|15,paket:packageIndex,perPaket:row.count,...(slot.merata?{merata:true}:{})}:undefined);
    q.stem=built.stem;q.explanation=built.explanation;q.bloom=built.bloom;
    if(built.source)q.source=built.source; // contoh blueprint menyebut asalnya
    if(built.difficultyReason)q.difficultyReason=built.difficultyReason; // alasan menurut pola yang dipakai (hukum tiap langkah, TDS, ekuivalensi, narasi)
    q=choices(q,built.options.map((o)=>o.text),built.options.map((o)=>o.reason),built.answer,built.options.map((o)=>o.ref));
    q.proof={kind:'model',model:built.model};
    return q;
  }
  if(row.row===17){
    // Memperkuat/Memperlemah Argumen (lib/tiu-argumen.ts). Contoh diterima dipakai pada profil contoh diterima; baris ini hanya dibangkitkan pada profil variasi, pengganti butir,
    // dan sesudah sembilan contoh habis. Butir diambil dari daftar berurutan menurut seed (skenario berbeda sampai habis); undian tidak diambil dari aliran bersama, sehingga
    // pemilihan butir lain pada seed yang sama tidak bergeser (sebelumnya baris ini tidak mengundi apa pun pada profil variasi).
    const wanted=level==='sulit'||level==='hots'?'sulit':'sedang',built=slot?buildArgumen(wanted,shared,{seed:slot.seed,index:slot.used('nivel:'+wanted as never)}):buildArgumen(wanted,shared);
    q.difficulty=built.difficulty;q.bloom=built.bloom;q.difficultyReason=built.difficultyReason;q.stem=built.stem;q.explanation=built.explanation;
    q.source='Variasi baru dari pola contoh diterima Memperkuat/Memperlemah Argumen (Andika, Verbal Analitis); Mapping SKD 2027.xlsx, baris '+row.row;
    q=choices(q,built.options.map((o)=>o.text),built.options.map(()=>''),built.answer);
    q.proof={kind:'model',model:{kind:'argument',direction:built.direction,scenario:built.scenario,options:built.options}};
    return q;
  }
  if(row.row===18){
    // Susunan & Posisi menurut Panduan Produksi Soal TIU JadiASN (lib/tiu-posisi.ts): linear, duduk melingkar, atau baris-kolom; jawaban tunggal dibuktikan pemecah brute force.
    const built=buildPosisi(level==='sulit'||level==='hots'?'sulit':'sedang',r);
    q.difficulty=built.difficulty;q.bloom=built.bloom;q.difficultyReason=built.difficultyReason;q.stem=built.stem;q.explanation=built.explanation;
    q=choices(q,built.options.map((o)=>o.text),built.options.map(()=>''),built.answer);
    q.proof={kind:'model',model:{kind:'arrangement',geo:built.geo,names:built.names,...(built.anchor?{anchor:built.anchor}:{}),clues:built.clues,options:built.options}};
    return q;
  }
  if(row.row===24){
    const a=r.int(1,7),b=r.int(1,3),c=r.int(1,4),whole=level==='mudah'?0:r.int(2,8),expression=whole+'+'+a+'/8+'+b+'/4-'+c+'/8',answer=calculate(expression);
    q.stem='Hasil dari '+(whole?whole+' + ':'')+a+'/8 + '+b+'/4 − '+c+'/8 adalah ...';
    q.explanation=pecahanExplanation(whole,a,b,c,8);
    q.difficulty=whole?'sedang':'mudah';q.bloom='C3';q.difficultyReason=whole?'Menyamakan penyebut dan menggabungkan hasil dengan bagian bulat.':'Menyamakan dua penyebut dan menjumlahkan pembilang.';
    return shuffle(numeric(q,expression,[[whole+(a+b-c)/8,'Penyebut disamakan tanpa mengubah pembilang pecahan seperempat.'],[whole+(a+2*b+c)/8,'Tanda pengurangan terakhir berubah menjadi penambahan.'],[(a+2*b-c)/8,'Bagian bilangan bulat belum ditambahkan.'],[whole+(a+2*b)/8,'Suku pecahan terakhir belum dikurangkan.'],[whole+(a+b-c)/20,'Pembilang dan penyebut dijumlahkan langsung.'],[whole+(a-c)/8,'Suku pecahan berpenyebut empat tidak ikut dijumlahkan.'],[whole+(a+2*b-c)/4,'Penyebut akhir memakai empat, padahal pecahan sudah diubah menjadi seperdelapan.']],true),r);
  }
  if(row.row===25||row.row===26){
    q.difficulty='sedang';q.bloom='C3';q.difficultyReason='Membandingkan dua hasil kali atau rasio dan mengeliminasi pasangan yang tidak setara.';
    const texts:string[]=[],reasons:string[]=[],division=row.row===26;
    for(let i=0;i<5;i++){
      const start=r.int(12,36)*10,a=r.int(3,9),b=r.int(3,9)+10,delta=i===0?0:r.int(1,4)*10;
      // Undian tetap sama seperti sebelumnya (pemilihan butir lain tidak bergeser). Dua pengecoh yang kebetulan kembar (peluang kecil) dibedakan tanpa undian baru:
      // unit digeser 10 sampai pasangannya belum pernah muncul, sehingga kelima opsi selalu berbeda.
      for(let unit=start;;unit+=10){
        const left=division?unit*a+' ÷ '+a:a+' × '+unit*b,right=division?(unit*b+delta)+' ÷ '+b:b+' × '+(unit*a+delta),text=left+COMPARE+right;
        if(texts.includes(text))continue;
        texts.push(text);
        const x=division?unit:a*unit*b,y=division?(unit*b+delta)/b:b*(unit*a+delta);
        reasons.push('Ruas kiri = '+fmt(x)+'; ruas kanan = '+fmt(y)+'. '+(i===0?'Kedua nilai sama.':'Selisihnya tidak nol, sehingga tidak setara.'));
        break;
      }
    }
    q.stem=division?'Pengelola membandingkan keluaran per jam dari lima pasangan mesin. Pasangan perhitungan yang menunjukkan laju sama adalah ...':'Petugas membandingkan lima pasangan rencana pengiriman. Jumlah barang diperoleh dari banyak paket dikalikan isi paket. Pasangan yang menghasilkan jumlah sama adalah ...';
    q=choices(q,texts,reasons);q.explanation=equalityExplanation(texts);
    q.proof={kind:'model',model:{kind:'equality'}};q.tip=division?'Untuk a/b = c/d, periksa a × d = c × b.':'Pembagian kedua hasil kali dengan faktor yang sama menjaga kesetaraan.';return shuffle(q,r);
  }
  if(row.row===27){
    const x=r.int(3,10),y=r.int(2,9),pattern=r.int(0,4),m:Extract<Model,{kind:'data'}>={kind:'data',domain:20,target:r.pick(['x','sum','product']),first:[],second:[]};
    m.first=pattern===0?[{op:'x',value:x}]:pattern===3?[{op:'sum',value:x+y}]:[{op:'product',value:x*y}];
    // Pola 3 dahulu mengulang jumlah yang sama pada (2); kini (2) berupa selisih supaya kedua pernyataan berbeda fungsi.
    m.second=pattern===1?[{op:'x',value:x}]:pattern===4?[{op:'xGt',value:1}]:[{op:'difference',value:x-y}];
    const show=(c:typeof m.first[number])=>(c.op==='x'?'x = ':c.op==='sum'?'x + y = ':c.op==='product'?'xy = ':c.op==='difference'?'x − y = ':'x > ')+c.value;
    const target=m.target==='x'?'x':m.target==='sum'?'x + y':'xy';
    const intro='x dan y adalah bilangan bulat positif paling besar 20. Berapakah nilai '+target+'?';
    q=sufficiency(q,m,intro+'\n(1) '+show(m.first[0])+'.\n(2) '+show(m.second[0])+'.');
    q.difficulty=dataCategory(m)===2&&m.first[0].op==='product'?'sulit':'sedang';q.difficultyReason=q.difficulty==='sulit'?'Menggabungkan hubungan hasil kali dan selisih serta menguji ketunggalan target.':'Menguji kecukupan setiap pernyataan dan gabungannya pada domain eksplisit.';
    // Kategori kecukupan data punya urutan baku (acuan 2027): opsi tidak diacak. Undian tetap diambil dan diabaikan agar pemilihan
    // butir berikutnya pada seed yang sama tidak bergeser.
    r.shuffle([0,1,2,3,4]);return q;
  }
  if(row.row===39){
    q.difficulty='sedang';q.difficultyReason='Memisahkan dua jalur aritmetika dan melanjutkan jalur sesuai posisi target.';
    const a=r.int(2,9),b=r.int(20,35),stepA=r.int(2,7),stepB=r.int(3,8),values=Array.from({length:8},(_,i)=>i%2?b+Math.floor(i/2)*stepB:a+Math.floor(i/2)*stepA),answer=a+4*stepA;
    const odd={op:'+' as const,n:stepA},even={op:'+' as const,n:stepB},distractors=deretDistractors('dua',values,answer,{lanes:[odd,even]},r);
    q.stem='Tentukan bilangan selanjutnya: '+values.join(', ')+', ...';q.explanation=deretDuaExplanation(values,odd,even,answer);
    const made=numeric(q,a+'+4*'+stepA,distractors.map((d):[number,string]=>[d.value,d.reason]));
    if(made.proof.kind==='numeric')made.proof={...made.proof,distractors};
    return shuffle(made,r);
  }
  const existing=({46:'matriks-angka',47:'tabel',48:'pernyataan-tabel',49:'cerita'} as Record<number,string>)[row.row];
  if(existing){const family=TIU_FAMILIES.find((f)=>f.id===existing)!;const draft=makeTiu(family,family.levels.includes(level)?level:family.levels[0],r);return{...draft,subtopic:row.chapter,mappingId:row.id,source:q.source,tip:row.row===47?undefined:draft.tip??'Uji setiap opsi terhadap seluruh informasi; periksa satuan dan batasan sebelum menghitung hasil akhir.'};}
  void packageIndex; throw new Error('Variasi baru belum tersedia untuk '+row.chapter+'.');
}
