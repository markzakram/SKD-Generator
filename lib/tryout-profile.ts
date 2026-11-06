import { ACCEPTED_BANK, BANK } from './bank';
import { mappingMatch, profilePlan, MAPPING_ROWS, type MappingRow } from './mapping';
import { makeTiu, TIU_FAMILIES } from './tiu';
import { rng, type Rng } from './rng';
import type { BankItem, Difficulty, Package, Question, Settings } from './types';
import { validationBinding } from './binding';
import { makeMappedTiu } from './tryout-patterns';
import { localRecipes, localRecipeKey, usesLocal, makeLocal, chooseLocal, replaceLocalQuestion } from './local';
import { constrainNarrativePackage } from './silo-production';
import { FIGURAL_FAMILIES, placeFiguralKey } from './figural';
import { spreadLimit } from './generate';

const familyByRow: Record<number, string> = { 13:'silogisme',14:'silogisme',15:'silogisme',16:'analogi',17:'argumen',18:'posisi',24:'pecahan',25:'setara',26:'setara',27:'data',30:'data',33:'data',39:'deret',46:'matriks-angka',47:'tabel',48:'pernyataan-tabel',49:'cerita',50:'fig-analogi',51:'fig-odd',52:'fig-serial',53:'fig-matrix' };
export const VARY_ROWS=[13,14,15,16,17,18,24,25,26,27,39,46,47,48,49,50,51,52,53];
// Silogisme (baris 13–15) selalu dibangkitkan menurut Blueprint Silogisme Tanpa Logika Kuantor (19 contoh blueprint lebih dahulu, keluarga modus beragam per paket; lib/silo-rencana.ts), juga pada
// profil contoh diterima: contoh tryout 09 untuk baris ini seluruhnya rantai kondisional positif dan memuat koma, "sehingga", serta kalimat pengisi (QC akademik #2, butir 31–35). Pada profil contoh
// diterima butir ini memakai pengacak turunan, jadi aliran bersama paket (pemilihan baris lain) tidak bergeser.
export const SILO_ROWS=[13,14,15];
export const PROFILE_SETTINGS = { profile: 'tryout-2027' as const, difficulty: 'campuran' as const, topics: [], subtopics: [], composition: undefined, blueprint: undefined };
// TKP profil tryout diambil dari kasus orisinal (data/tkp-kasus/, Tahap 3), bukan dari contoh tryout acuan: 45 TKP contoh diterima identik dengan dokumen
// acuan tim (QC akademik #2, keputusan user 3 Nov 2026). Contoh acuan TKP tetap di data/tryout-reference.json, hanya tidak dipilih di profil ini.
export const TRYOUT_TKP = BANK.filter((item) => item.subtest === 'TKP' && item.kasus);
const profilePool = (row: Pick<MappingRow, 'subtest'>) => row.subtest === 'TKP' ? TRYOUT_TKP : ACCEPTED_BANK;
// Sebaran pola/keputusan/peran/tempat kasus TKP per paket memakai batas yang sama dengan latihan bebas (spreadLimit, lib/generate.ts): dari kasus yang tersisa dipilih yang
// paling sedikit menambah kelebihan batas; seri diputus menurut urutan acak paket, jadi tidak ada undian tambahan. Kuota per bab tetap dari mapping.
const SPREAD_KEYS = ['pola', 'keputusan', 'peran', 'tempat'] as const;
function leastSpread(items: BankItem[], placed: Question[], total: number): BankItem | undefined {
  const penalty = (item: BankItem) => SPREAD_KEYS.reduce((sum, key) => {
    const count = placed.filter((q) => q.kasus?.[key] === item.kasus![key]).length, limit = spreadLimit(key, total);
    return sum + Math.max(0, count + 1 - limit) * 1000 + count / limit;
  }, 0);
  return items.reduce<BankItem | undefined>((best, item) => !best || penalty(item) < penalty(best) - 1e-9 ? item : best, undefined);
}
export function eligibleSources(row: MappingRow, settings: Settings, packageIndex: number) {
  return profilePool(row).filter((q)=>mappingMatch(q,row,packageIndex) && (settings.difficulty==='campuran' || q.difficulty===settings.difficulty));
}
export function profileCapacityErrors(settings:Settings){
  const errors:string[]=[];
  for(const row of profilePlan(settings)){
    if(usesLocal(settings,row.subtest)){
      const available=localRecipes(row.subtest,[row.topic],settings.difficulty,[row.topic+'::'+row.chapter]).length,needed=row.count*(settings.uniqueAcross?settings.packages:1);
      if(needed>available)errors.push('Variasi lokal '+row.chapter+': tersedia '+available+', diperlukan '+needed+'. Kurangi paket/soal, perluas kesulitan, atau izinkan pengulangan antarpaket.');
      continue;
    }
    if(row.subtest==='TIU'&&([...SILO_ROWS,16,17,18,50,51,52,53].includes(row.row)||settings.tiuSource==='variation'&&VARY_ROWS.includes(row.row)))continue;
    // Rotation pools overlap. A greedy reservation can wrongly exhaust a later
    // package, so match source IDs to package slots with reassignment.
    const slots:string[][]=[],assigned=new Map<string,number>();
    const place=(slot:number,seen:Set<string>):boolean=>{
      for(const id of slots[slot]){if(seen.has(id))continue;seen.add(id);const previous=assigned.get(id);
        if(previous===undefined||place(previous,seen)){assigned.set(id,slot);return true;}}
      return false;
    };
    for(let p=0;p<settings.packages;p++){
      const pool=eligibleSources(row,settings,p).map(q=>q.id);let enough=pool.length>=row.count;
      if(enough&&settings.uniqueAcross)for(let i=0;i<row.count;i++){slots.push(pool);if(!place(slots.length-1,new Set())){enough=false;break;}}
      if(!enough){errors.push((row.subtest==='TKP'?'Kasus orisinal TKP':'Contoh diterima')+' untuk '+row.chapter+': stok yang tersedia tidak cukup untuk '+row.count+' soal pada paket '+(p+1)+'. Kurangi jumlah paket, ubah sumber soal, atau izinkan pengulangan antarpaket.');break;}
    }
  }
  return errors;
}
export function replaceMappedQuestion(current: Question, peers: Question[], seed: string, signature: (q:Question)=>string): Question {
  if(current.proof.kind==='local')return replaceLocalQuestion(current,peers,rng(seed));
  const row=MAPPING_ROWS.find((r)=>r.id===current.mappingId);
  if(!row)throw new Error('Chapter pengganti tidak ditemukan pada mapping.');
  const r=rng(seed),candidates=r.shuffle(profilePool(row).filter((q)=>!(row.subtest==='TIU'&&SILO_ROWS.includes(row.row))&&q.subtest===current.subtest&&q.topic===current.topic&&(row.subtest==='TKP'||q.subtopic===current.subtopic)&&q.difficulty===current.difficulty));
  for(const item of candidates){const q=sourceQuestion(item,row);if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return q;}
  if(current.subtest==='TIU')for(let attempt=0;attempt<100;attempt++){
    // Silogisme narasi: contoh blueprint yang belum dipakai lebih dahulu (contoh ke-`attempt` menurut urutan seed), baru pembangkit.
    const draft=makeMappedTiu(row,current.difficulty,r,0,{seed,used:()=>attempt}),q={...draft,id:'mapped-replacement-'+seed+'-'+attempt,no:current.no};
    if(q.subtopic!==current.subtopic||q.difficulty!==current.difficulty)continue;
    // Figural: pengganti memakai huruf kunci butir yang diganti, jadi sebaran kunci figural paket tetap.
    if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return FIGURAL_FAMILIES.includes(q.family)?placeFiguralKey(q,current.answer):q;
  }
  throw new Error('Tidak ada pengganti unik untuk chapter dan kesulitan ini. Semua contoh yang cocok sudah dipakai; sunting soal atau susun ulang paket.');
}
// Kasus TKP orisinal: family = skenario dan origin 'kasus', sama dengan latihan bebas (lib/generate.ts), sehingga pemeriksaan skenario berlaku juga di sini.
const sourceQuestion = (item: BankItem, row: MappingRow): Question => ({ ...structuredClone(item), no:0, origin:item.kasus?'kasus':'referensi', family:item.kasus?item.kasus.skenario:'accepted-'+item.id,
  mappingId:row.id, proof:{ kind:'bank', id:item.id, answerText:item.options[item.answer].text } });

function generatedFallback(row: MappingRow, level: Difficulty, r: Rng): Omit<Question,'id'|'no'> {
  if(row.subtest!=='TIU')throw new Error('Contoh diterima untuk '+row.chapter+' habis. Kurangi jumlah paket atau izinkan pemakaian ulang antarpaket.');
  // Memperkuat/Memperlemah Argumen: sesudah sembilan contoh diterima habis, butir dibangkitkan dari skenario tulisan tangan (lib/tiu-argumen.ts).
  if (row.row===17) return makeMappedTiu(row,level,r);
  const family = TIU_FAMILIES.find((f)=>f.id===familyByRow[row.row]);
  if (!family) throw new Error('Pola pengganti belum tersedia untuk '+row.chapter+'.');
  // Do not fill a precise chapter using a related but different model.
  if (![16,18,50,51,52,53].includes(row.row)) throw new Error('Contoh diterima untuk '+row.chapter+' habis. Kurangi paket atau ubah filter; chapter tidak diganti dengan pola generik.');
  if (!family.levels.includes(level)) throw new Error('Pola '+row.chapter+' tidak mendukung kesulitan '+level+'. Gunakan campuran atau tingkat yang tersedia.');
  const difficulty=level;
  const draft = makeTiu(family,difficulty,r);
  return { ...draft, subtopic: row.chapter, mappingId: row.id, source: 'Variasi terhitung mengikuti mapping '+row.chapter+'; acuan: '+(row.row===18 ? 'Uma - Verbal Analitis' : row.row===16 ? 'Mapping SKD 2027.xlsx (contoh analogi dua kata belum disertakan)' : 'mesin figural proyek dan mapping 2027') };
}
export function generateTryout(settings: Settings, signature: (q: Question)=>string): Package[] {
  if (settings.blueprint) throw new Error('Profil tryout menggunakan kuota chapter pada workbook. Pilih latihan bebas untuk blueprint kesulitan manual.');
  if (settings.composition) throw new Error('Profil tryout mempertahankan tingkat pada contoh. Gunakan filter kesulitan atau latihan bebas untuk persentase manual.');
  const plan=profilePlan(settings), packages: Package[]=[], global=new Set<string>(),globalRecipes=new Set<string>();
  const tkpTotal=plan.filter((row)=>row.subtest==='TKP').reduce((n,row)=>n+row.count,0);
  const capacityErrors=profileCapacityErrors(settings);if(capacityErrors.length)throw new Error(capacityErrors[0]);
  for (let p=0;p<settings.packages;p++) {
    const r=rng(settings.seed+'|tryout|'+p), local=new Set<string>(), questions: Question[]=[];
    for (const row of plan) {
      const pool=r.shuffle(eligibleSources(row,settings,p));
      // Keep chapter coverage within grouped quotas instead of taking any three stories.
      const grouped = [27,33].includes(row.row) ? [...new Set(pool.map((q)=>q.subtopic))] : [];
      const targetChapters=grouped.length ? r.shuffle(grouped) : [];
      for (let i=0;i<row.count;i++) {
        if(usesLocal(settings,row.subtest)){
          const used=new Set(questions.map(localRecipeKey).filter(Boolean));
          const recipes=localRecipes(row.subtest,[row.topic],settings.difficulty,[row.topic+'::'+row.chapter]).filter(x=>!used.has(x.key)&&(!settings.uniqueAcross||!globalRecipes.has(x.key)));
          const recipe=chooseLocal(recipes,questions,r,packages.flatMap(p=>p.questions));if(!recipe)throw new Error('Variasi unik untuk '+row.chapter+' habis.');
          const q=makeLocal(recipe,r);q.id+='-p'+p;q.no=questions.length+1;q.mappingId=row.id;
          const key=signature(q);if(local.has(key)||settings.uniqueAcross&&global.has(key))throw new Error('Model lokal menghasilkan isi berulang.');
          globalRecipes.add(recipe.key);local.add(key);global.add(key);questions.push(q);continue;
        }
        const available=pool.filter((q)=>!local.has(signature(sourceQuestion(q,row))) && (!settings.uniqueAcross || !global.has(signature(sourceQuestion(q,row)))));
        const chapter=targetChapters.length ? targetChapters[i % targetChapters.length] : undefined;
        const item=row.subtest==='TKP' ? leastSpread(available,questions,tkpTotal) : available.find((q)=>!chapter || q.subtopic===chapter) ?? available[0];
        let q: Question | undefined;
        const silo=row.subtest==='TIU' && SILO_ROWS.includes(row.row) && settings.tiuSource!=='variation';
        const fresh=silo || settings.tiuSource==='variation' && row.subtest==='TIU' && VARY_ROWS.includes(row.row);
        if (item && !fresh) q=sourceQuestion(item,row);
        else {
          for (let attempt=0;attempt<300;attempt++) {
            // Percobaan pertama memakai aliran paket (konsumsi undian tetap). Percobaan ulang karena sidik jari kembar memakai pengacak turunan, sehingga jumlah
            // percobaan ulang (yang bergantung pada isi pembangkit) tidak menggeser pemilihan baris berikutnya pada seed yang sama.
            const a=attempt===0?(silo?rng(settings.seed+'|tryout|'+p+'|'+row.id+'|'+i+'|silo'):r):rng(settings.seed+'|tryout|'+p+'|'+row.id+'|'+i+'|ulang|'+attempt);
            // Baris 17 (argumen): tingkat bergantian sedang/sulit menurut jumlah butir baris itu yang sudah ada (tanpa undian aliran bersama), supaya lima paket x tiga butir memakai skenario berbeda.
            const placed=(difficulty?:string)=>[...packages.flatMap((pack)=>pack.questions),...questions].filter((x)=>x.mappingId===row.id&&(!difficulty||x.difficulty===difficulty)).length;
            const level=settings.difficulty==='campuran'?(row.row===16?'mudah':row.row===17?(placed()%2?'sulit':'sedang'):a.pick(['sedang','sulit'] as const)):settings.difficulty as Difficulty;
            // Silogisme narasi (baris 14 dan 15): contoh blueprint dipakai lebih dahulu, jumlah butir baris ini yang sudah ada menentukan contoh berikutnya; percobaan ulang langsung memakai pembangkit.
            const slot=attempt===0?{seed:settings.seed,used:(key?:string)=>placed(key?.startsWith('nivel:')?key.slice(6):undefined)}:undefined;
            const draft=fresh?makeMappedTiu(row,level,a,p,slot):generatedFallback(row,level,a);
            const candidate={ ...draft,id:'tryout-pattern-'+row.id+'-'+p+'-'+i+'-'+attempt,no:0 };
            const key=signature(candidate); if (local.has(key) || settings.uniqueAcross && global.has(key)) continue;
            q=candidate; break;
          }
        }
        if (!q) throw new Error('Tidak cukup variasi unik untuk '+row.chapter+'.');
        // Figural (baris 50–53): kunci dipindah ke huruf yang paling jarang dipakai kunci figural paket ini (pengacak turunan, tanpa undian aliran paket),
        // sehingga delapan butir figural tidak menumpuk di A. Sidik jari mengabaikan urutan opsi, jadi pemilihan butir tidak berubah.
        if(FIGURAL_FAMILIES.includes(q.family)){
          const used=[0,1,2,3,4].map((at)=>questions.filter((x)=>FIGURAL_FAMILIES.includes(x.family)&&x.answer===at).length),least=Math.min(...used);
          q=placeFiguralKey(q,rng(settings.seed+'|tryout|'+p+'|kunci-figural|'+questions.length).pick(used.flatMap((n,at)=>n===least?[at]:[])));
        }
        q.no=questions.length+1; q.binding=validationBinding(q);
        local.add(signature(q)); global.add(signature(q)); questions.push(q);
      }
    }
    packages.push({id:'SKD-'+String(p+1).padStart(2,'0'),seed:settings.seed+'|tryout|'+p,mode:settings.mode,duration:settings.duration,questions:constrainNarrativePackage(questions)});
  }
  return packages;
}
