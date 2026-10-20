import type { Rng } from './rng';
import type { Difficulty, Question } from './types';
import { calculate, entails, implies, not, variable, type Logic } from './solver';
import { dataCategory, DATA_LABELS, orders, type Model } from './models';
import { makeTiu, TIU_FAMILIES } from './tiu';
import type { MappingRow } from './mapping';

type Draft = Omit<Question,'id'|'no'>;
const fmt=(n:number)=>String(Math.round(n*10000)/10000).replace('.',',');
function base(row:MappingRow,difficulty:Difficulty):Draft {
  return {subtest:'TIU',topic:row.topic,subtopic:row.chapter,mappingId:row.id,difficulty,bloom:'C4',family:'mapping-'+row.id,stem:'',options:[],answer:0,explanation:'',source:'Variasi baru dari pola tryout diterima; Mapping SKD 2027.xlsx, baris '+row.row,origin:'pola',proof:{kind:'manual',note:'Draf terstruktur, menunggu telaah.'},
    difficultyReason:'Kompleksitas berdasarkan jumlah hubungan yang harus digabung; bukan hasil kalibrasi peserta.'};
}
function choices(q:Draft,texts:string[],reasons:string[],answer=0):Draft {
  q.options=texts.map((text,i)=>({text,reason:reasons[i],score:i===answer?5:0})); q.answer=answer; return q;
}
function numeric(q:Draft,expression:string,wrong:[number,string][]):Draft {
  const answer=calculate(expression), values:[number,string][]=[[Math.round(answer*10000)/10000,'Sesuai langkah penyelesaian dan target yang ditanyakan.']];
  for(const [n,reason] of wrong) { const rounded=Math.round(n*10000)/10000;if(Number.isFinite(rounded)&&!values.some(([v])=>Math.abs(v-rounded)<.000051))values.push([rounded,reason]); }
  if(values.length<5)throw new Error('Pengecoh model '+q.mappingId+' belum cukup.');
  const options=values.slice(0,5); q=choices(q,options.map(([v])=>fmt(v)),options.map(([,reason])=>reason));
  q.proof={kind:'numeric',expression,answer,values:options.map(([v])=>v)};return q;
}
function sufficiency(q:Draft,m:Extract<Model,{kind:'data'}>,description:string):Draft {
  const answer=dataCategory(m); q.stem=description+'\nPilih informasi yang cukup untuk menjawab pertanyaan tersebut.';
  const detail=(conditions:typeof m.first)=>{
    const pairs:{x:number;y:number;value:number}[]=[];
    for(let x=1;x<=m.domain;x++)for(let y=1;y<=m.domain;y++)if(conditions.every((c)=>c.op==='xGt'?x>c.value:c.op==='yGt'?y>c.value:(c.op==='x'?x:c.op==='y'?y:c.op==='sum'?x+y:c.op==='difference'?x-y:x*y)===c.value))pairs.push({x,y,value:m.target==='x'?x:m.target==='sum'?x+y:x*y});
    const a=pairs[0],b=pairs.find((p)=>p.value!==a?.value);
    return !b?'Cukup: semua '+pairs.length+' pasangan memberi target '+a.value+'.':'Belum cukup. Contoh (x,y)=('+a.x+','+a.y+') memberi '+a.value+', sedangkan ('+b.x+','+b.y+') memberi '+b.value+'.';
  };
  q.explanation='Konsep: kecukupan berarti nilai target sama untuk seluruh keadaan yang memenuhi informasi.\nPernyataan (1): '+detail(m.first)+'\nPernyataan (2): '+detail(m.second)+'\nGabungan (1) dan (2): '+detail([...m.first,...m.second])+'\nHasil: '+DATA_LABELS[answer];
  q=choices(q,DATA_LABELS,DATA_LABELS.map((_,i)=>i===answer?'Kategori ini sesuai pengujian setiap pernyataan pada domain.':'Kategori ini keliru karena belum membedakan kepastian target dari diketahuinya semua variabel.'),answer);
  q.proof={kind:'model',model:m};q.tip='Periksa targetnya lebih dahulu; tidak selalu harus mengetahui x dan y secara terpisah.';return q;
}
function shuffle(q:Draft,r:Rng):Draft {
  const order=r.shuffle([0,1,2,3,4]),proof=q.proof;
  return {...q,options:order.map((i)=>q.options[i]),answer:order.indexOf(q.answer),proof:proof.kind==='numeric'?{...proof,values:order.map((i)=>proof.values[i])}:proof.kind==='logic'?{...proof,valid:order.map((i)=>proof.valid[i]),...(proof.entailment?{entailment:{...proof.entailment,conclusions:order.map((i)=>proof.entailment!.conclusions[i])}}:{})}:proof};
}
export function makeMappedTiu(row:MappingRow,level:Difficulty,r:Rng,packageIndex=0):Draft {
  let q=base(row,level);
  if([16,50,51,52,53].includes(row.row)){
    const id=({16:'analogi',50:'fig-analogi',51:'fig-odd',52:'fig-serial',53:'fig-matrix'} as Record<number,string>)[row.row],family=TIU_FAMILIES.find((f)=>f.id===id)!;
    const draft=makeTiu(family,family.levels.includes(level)?level:family.levels[0],r);
    return {...draft,subtopic:row.chapter,mappingId:row.id,source:q.source};
  }
  if([13,14,15].includes(row.row)){
    q.difficulty='sedang';q.bloom='C3';q.difficultyReason='Menggabungkan dua atau tiga hubungan implikasi yang eksplisit; label tidak dinaikkan hanya karena narasi lebih panjang.';
    const context=r.pick([
      ['produk lulus uji ketahanan','produk masuk katalog','produk mendapat kode pelacakan','produk memperoleh jadwal pengiriman'],
      ['peserta menuntaskan orientasi','peserta mendapat akses laboratorium','peserta mendapat jadwal praktik','peserta dapat memakai alat simulasi'],
      ['berkas lolos pemeriksaan awal','berkas masuk antrean verifikasi','berkas mendapat nomor proses','berkas dapat dipantau pemohon'],
      ['kegiatan mendapat persetujuan lokasi','kegiatan masuk agenda kawasan','kegiatan mendapat jadwal panggung','kegiatan memperoleh akses listrik'],
      ['benih lolos uji mutu','benih masuk persediaan tanam','benih mendapat label asal','benih masuk daftar pengiriman'],
      ['pesanan tuntas dibayar','pesanan masuk daftar pengambilan','pesanan mendapat nomor pengiriman','pesanan mendapat jadwal distribusi'],
    ]),[a,b,c,d]=context,p=variable('p'),s=variable('q'),t=variable('r'),u=variable('s');
    let premises:Logic[],conclusions:Logic[],texts:string[];
    if(row.row===14){
      premises=[implies(p,s),implies(s,t)];conclusions=[implies(p,t),implies(t,p),implies(not(p),not(t)),implies(s,p),implies(t,s)];
      q.stem='Dalam pengelolaan layanan, setiap kondisi berikut berlaku untuk objek yang sama. Jika '+a+', maka '+b+'. Setiap objek dengan kondisi '+b+' juga memenuhi kondisi '+c+'.\nKesimpulan yang pasti benar adalah ...';
      texts=['Jika '+a+', maka '+c+'.','Jika '+c+', maka '+a+'.','Jika tidak benar bahwa '+a+', maka tidak benar bahwa '+c+'.','Jika '+b+', maka '+a+'.','Jika '+c+', maka '+b+'.'];
      q.explanation='Premis 1: p → q.\nPremis 2: q → r.\nDari keduanya, p → r melalui silogisme. Ini adalah hubungan bersyarat; soal tidak menyatakan bahwa p sedang terjadi. Membalik arah atau menolak anteseden tidak sah.';
    }else if(row.row===15){
      premises=[implies(p,s),implies(s,t),implies(t,u)];conclusions=[implies(p,u),implies(u,p),implies(not(p),not(u)),implies(t,p),implies(u,s)];
      q.stem='Pengelola menetapkan bahwa jika '+a+', maka '+b+'. Jika '+b+', maka '+c+'. Setiap kondisi '+c+' menjamin '+d+'.\nKesimpulan yang pasti benar berdasarkan ketiga hubungan tersebut adalah ...';
      texts=['Jika '+a+', maka '+d+'.','Jika '+d+', maka '+a+'.','Jika tidak benar bahwa '+a+', maka tidak benar bahwa '+d+'.','Jika '+c+', maka '+a+'.','Jika '+d+', maka '+b+'.'];
      q.explanation='Premis 1: p → q.\nPremis 2: q → r.\nPremis 3: r → s.\nLangkah 1: gabungkan p → q dan q → r menjadi p → r.\nLangkah 2: gabungkan p → r dengan r → s menjadi p → s. Tidak ada izin untuk membalik rantai.';
    }else{
      const negative=r.next()<.5;premises=[implies(p,s),implies(s,t),negative?not(t):p];conclusions=negative?[not(p),p,s,t,implies(not(p),t)]:[t,not(t),not(s),not(p),implies(t,not(s))];
      q.stem='Premis 1: Jika '+a+', maka '+b+'.\nPremis 2: Jika '+b+', maka '+c+'.\nPremis 3: '+(negative?'Tidak benar bahwa '+c:a)+'.\nKesimpulan yang pasti benar adalah ...';
      texts=negative?['Tidak benar bahwa '+a+'.',a+'.',b+'.',c+'.','Jika tidak benar bahwa '+a+', maka '+c+'.']:[c+'.','Tidak benar bahwa '+c+'.','Tidak benar bahwa '+b+'.','Tidak benar bahwa '+a+'.','Jika '+c+', maka tidak benar bahwa '+b+'.'];
      q.explanation=negative?'Premis p → q, q → r, dan ¬r. Modus tollens memberi ¬q, kemudian ¬p. Menolak akibat sah; membalik implikasi tidak sah.':'Premis p → q, q → r, dan p. Modus ponens memberi q, kemudian r. Kesimpulan harus berlaku untuk objek yang sama.';
    }
    const valid=entails(premises,conclusions);
    q=choices(q,texts,texts.map((_,i)=>i===0?'Diperoleh dari rantai premis yang searah.':i===1?'Membalik implikasi atau bertentangan dengan konsekuensi premis.':i===2?'Menolak anteseden tidak mengizinkan penolakan akibat.':'Tidak benar pada semua model yang memenuhi premis.'));
    q.proof={kind:'logic',valid,entailment:{premises,conclusions}};q.tip='Tuliskan panah implikasi sebelum membaca pilihan; pertahankan arah dan subjeknya.';return shuffle(q,r);
  }
  if(row.row===18){
    q.difficulty='sulit';q.difficultyReason='Enam objek dengan posisi tetap, hubungan kiri-kanan, dan pasangan berdampingan yang harus digabung.';
    const names=r.shuffle(['Ardi','Beni','Caca','Dini','Ega','Fina','Gani','Hira','Intan','Joko']).slice(0,6),[a,b,c,d,e,f]=names;
    const constraints:Extract<Model,{kind:'ordering'}>['constraints']=[{a:c,op:'at',value:4},{a:b,b:c,op:'adjacent'},{a:c,b:f,op:'adjacent'},{a:a,b:b,op:'before'},{a:a,b:d,op:'adjacent'},{a:f,b:e,op:'before'}];
    const model:Extract<Model,{kind:'ordering'}>={kind:'ordering',names:r.shuffle(names),constraints,query:{position:2}},possible=orders(model),answer=possible[0][1];
    q.stem='Enam berkas milik '+model.names.join(', ')+' disusun dari kiri ke kanan pada posisi 1 sampai 6. '+c+' berada di posisi keempat. '+b+' tepat di kiri '+c+'. '+f+' tepat di kanan '+c+'. '+a+' di kiri '+b+'. '+d+' tepat di kanan '+a+'. '+e+' di kanan '+f+'.\nBerkas siapa yang berada pada posisi kedua?';
    const texts=[answer,...names.filter((n)=>n!==answer).slice(0,4)];q=choices(q,texts,texts.map((n)=>n===answer?'Diperoleh setelah posisi tetap dan pasangan berdampingan ditempatkan.':'Penempatan ini melanggar setidaknya satu batasan posisi.'));
    q.explanation='Langkah 1: tempatkan '+c+' pada posisi 4, sehingga '+b+' pada 3 dan '+f+' pada 5.\nLangkah 2: '+e+' harus pada 6. Tersisa posisi 1 dan 2.\nLangkah 3: pasangan '+a+'–'+d+' harus mengisi posisi 1 dan 2.\nSusunan: '+possible[0].join(' – ')+'. Maka posisi kedua adalah '+answer+'.';
    q.proof={kind:'model',model};q.tip='Mulai dari posisi yang pasti; kata tepat berarti tidak ada celah.';return shuffle(q,r);
  }
  if(row.row===24){
    const a=r.int(1,7),b=r.int(1,3),c=r.int(1,4),whole=level==='mudah'?0:r.int(2,8),expression=whole+'+'+a+'/8+'+b+'/4-'+c+'/8',answer=calculate(expression);
    q.stem='Hasil dari '+(whole?whole+' + ':'')+a+'/8 + '+b+'/4 − '+c+'/8 adalah ...';
    q.explanation='Langkah 1: samakan penyebut menjadi 8; '+b+'/4 = '+2*b+'/8.\nLangkah 2: jumlahkan pembilang: ('+a+' + '+2*b+' − '+c+')/8 = '+fmt((a+2*b-c)/8)+'.\nLangkah 3: tambahkan bagian bulat '+whole+', sehingga hasilnya '+fmt(answer)+'.';
    q.tip='Samakan penyebut sebelum menjumlahkan atau mengurangi pembilang.';
    q.difficulty=whole?'sedang':'mudah';q.bloom='C3';q.difficultyReason=whole?'Menyamakan penyebut dan menggabungkan hasil dengan bagian bulat.':'Menyamakan dua penyebut dan menjumlahkan pembilang.';
    return shuffle(numeric(q,expression,[[whole+(a+b-c)/8,'Penyebut disamakan tanpa mengubah pembilang pecahan seperempat.'],[whole+(a+2*b+c)/8,'Tanda pengurangan terakhir berubah menjadi penambahan.'],[(a+2*b-c)/8,'Bagian bilangan bulat belum ditambahkan.'],[whole+(a+2*b)/8,'Suku pecahan terakhir belum dikurangkan.'],[whole+(a+b-c)/20,'Pembilang dan penyebut dijumlahkan langsung.'],[whole+(a-c)/8,'Suku pecahan berpenyebut empat tidak ikut dijumlahkan.'],[whole+(a+2*b-c)/4,'Penyebut akhir memakai empat, padahal pecahan sudah diubah menjadi seperdelapan.']]),r);
  }
  if(row.row===25||row.row===26){
    q.difficulty='sedang';q.bloom='C3';q.difficultyReason='Membandingkan dua hasil kali atau rasio dan mengeliminasi pasangan yang tidak setara.';
    const texts:string[]=[],reasons:string[]=[],division=row.row===26;
    for(let i=0;i<5;i++){
      const unit=r.int(12,36)*10,a=r.int(3,9),b=r.int(3,9)+10,delta=i===0?0:r.int(1,4)*10;
      const left=division?unit*a+' ÷ '+a:a+' × '+unit*b,right=division?(unit*b+delta)+' ÷ '+b:b+' × '+(unit*a+delta);
      texts.push(left+' = '+right);
      const x=division?unit:a*unit*b,y=division?(unit*b+delta)/b:b*(unit*a+delta);
      reasons.push('Ruas kiri = '+fmt(x)+'; ruas kanan = '+fmt(y)+'. '+(i===0?'Kedua nilai sama.':'Selisihnya tidak nol, sehingga tidak setara.'));
    }
    q.stem=division?'Pengelola membandingkan keluaran per jam dari lima pasangan mesin. Pasangan perhitungan yang menunjukkan laju sama adalah ...':'Petugas membandingkan lima pasangan rencana pengiriman. Jumlah barang diperoleh dari banyak paket dikalikan isi paket. Pasangan yang menghasilkan jumlah sama adalah ...';
    q=choices(q,texts,reasons);q.explanation='Langkah 1: '+(division?'bandingkan hasil pembagian atau gunakan perkalian silang.':'bandingkan hasil kali, bukan hanya salah satu faktor.')+'\nLangkah 2: '+reasons[0]+'\nDigit akhir dapat dipakai untuk eliminasi, tetapi kesamaan digit akhir belum membuktikan hasilnya sama.';
    q.proof={kind:'model',model:{kind:'equality'}};q.tip=division?'Untuk a/b = c/d, periksa a × d = c × b.':'Pembagian kedua hasil kali dengan faktor yang sama menjaga kesetaraan.';return shuffle(q,r);
  }
  if(row.row===27){
    const x=r.int(3,10),y=r.int(2,9),pattern=r.int(0,4),m:Extract<Model,{kind:'data'}>={kind:'data',domain:20,target:r.pick(['x','sum','product']),first:[],second:[]};
    m.first=pattern===0?[{op:'x',value:x}]:pattern===3?[{op:'sum',value:x+y}]:[{op:'product',value:x*y}];
    m.second=pattern===1?[{op:'x',value:x}]:pattern===3?[{op:'sum',value:x+y}]:pattern===4?[{op:'xGt',value:1}]:[{op:'difference',value:x-y}];
    const show=(c:typeof m.first[number])=>(c.op==='x'?'x = ':c.op==='sum'?'x + y = ':c.op==='product'?'xy = ':c.op==='difference'?'x − y = ':'x > ')+c.value;
    const target=m.target==='x'?'x':m.target==='sum'?'x + y':'xy';
    const intro='x dan y adalah bilangan bulat positif paling besar 20. Berapakah nilai '+target+'?';
    q=sufficiency(q,m,intro+'\n(1) '+show(m.first[0])+'.\n(2) '+show(m.second[0])+'.');
    q.difficulty=dataCategory(m)===2&&m.first[0].op==='product'?'sulit':'sedang';q.difficultyReason=q.difficulty==='sulit'?'Menggabungkan hubungan hasil kali dan selisih serta menguji ketunggalan target.':'Menguji kecukupan setiap pernyataan dan gabungannya pada domain eksplisit.';
    return shuffle(q,r);
  }
  if(row.row===39){
    q.difficulty='sedang';q.difficultyReason='Memisahkan dua jalur aritmetika dan melanjutkan jalur sesuai posisi target.';
    const a=r.int(2,9),b=r.int(20,35),stepA=r.int(2,7),stepB=r.int(3,8),values=Array.from({length:8},(_,i)=>i%2?b+Math.floor(i/2)*stepB:a+Math.floor(i/2)*stepA),answer=a+4*stepA;
    q.stem='Tentukan bilangan selanjutnya: '+values.join(', ')+', ...';q.explanation='Pisahkan suku pada posisi ganjil dan genap.\nGanjil: '+[a,a+stepA,a+2*stepA,a+3*stepA].join(', ')+', bertambah '+stepA+'.\nGenap: '+[b,b+stepB,b+2*stepB,b+3*stepB].join(', ')+', bertambah '+stepB+'.\nSuku ke-9 meneruskan jalur ganjil: '+values[6]+' + '+stepA+' = '+answer+'.';
    q.tip='Nomori posisi terlebih dahulu; selisih antarsuku berdekatan dapat menutupi dua jalur.';
    return shuffle(numeric(q,a+'+4*'+stepA,[[values[7]+stepB,'Melanjutkan jalur genap pada posisi ganjil.'],[values[6]+stepB,'Memakai selisih jalur genap.'],[values[6],'Mengulang suku ganjil sebelumnya.'],[answer+stepA,'Maju dua langkah pada jalur ganjil.'],[a+4*stepB,'Menerapkan selisih jalur lain sepanjang deret.'],[answer-stepA*2,'Mundur satu langkah pada jalur ganjil.']]),r);
  }
  const existing=({46:'matriks-angka',47:'tabel',48:'pernyataan-tabel',49:'cerita'} as Record<number,string>)[row.row];
  if(existing){const family=TIU_FAMILIES.find((f)=>f.id===existing)!;const draft=makeTiu(family,family.levels.includes(level)?level:family.levels[0],r);return{...draft,subtopic:row.chapter,mappingId:row.id,source:q.source,tip:draft.tip??'Uji setiap opsi terhadap seluruh informasi; periksa satuan dan batasan sebelum menghitung hasil akhir.'};}
  void packageIndex; throw new Error('Variasi baru belum tersedia untuk '+row.chapter+'.');
}
