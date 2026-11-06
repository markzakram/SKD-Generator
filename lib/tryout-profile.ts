import { ACCEPTED_BANK, BANK } from './bank';
import { chapterMatch, mappingMatch, profilePlan, MAPPING_ROWS, type MappingRow } from './mapping';
import { makeTiu, TIU_FAMILIES } from './tiu';
import { rng, type Rng } from './rng';
import type { BankItem, Difficulty, Package, Question, Settings } from './types';
import { validationBinding } from './binding';
import { makeChapterTiu, makeMappedTiu } from './tryout-patterns';
import { localRecipes, localRecipeKey, usesLocal, makeLocal, chooseLocal, replaceLocalQuestion } from './local';
import { constrainNarrativePackage } from './silo-production';
import { FIGURAL_FAMILIES, placeFiguralKey } from './figural';
import { bankSlots, EXCLUSIVE_TWK, exclusiveGroupOf, spreadLimit } from './generate';
import type { ContohSlot } from './tiu-logika';
import { argumenButirCount } from './tiu-argumen';

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
  return profilePool(row).filter((q)=>(settings.chapterCounts?chapterMatch(q,row):mappingMatch(q,row,packageIndex)) && (settings.difficulty==='campuran' || q.difficulty===settings.difficulty));
}
// ---- Jumlah per chapter (Settings.chapterCounts) ---------------------------------------------------------------------------------------------------------
// Pembangkit per baris: banyak butir berbeda yang aman diminta dari satu seed, per tingkat yang benar-benar dihasilkan, dan `campuran` untuk tanpa filter kesulitan. Angka diukur dari keragaman stimulus (kalimat, tabel, gambar)
// dengan cadangan supaya percobaan ulang tidak kehabisan; scripts/chapter-counts-checks.ts membuktikan angka yang membatasi. OPEN = pembangkit tidak membatasi pada batas 200 soal per paket.
const OPEN = 1000;
const argumenAll = argumenButirCount('sedang') + argumenButirCount('sulit');
export const CHAPTER_GENERATORS: Record<number, { campuran: number; levels: Partial<Record<Difficulty, number>> }> = {
  13:{campuran:OPEN,levels:{sedang:OPEN}},14:{campuran:OPEN,levels:{sedang:OPEN}},15:{campuran:OPEN,levels:{sedang:OPEN}},16:{campuran:72,levels:{mudah:72}},17:{campuran:argumenAll,levels:{sedang:argumenButirCount('sedang'),sulit:argumenButirCount('sulit')}},
  18:{campuran:OPEN,levels:{sedang:OPEN,sulit:OPEN}},19:{campuran:OPEN,levels:{sedang:OPEN,sulit:OPEN}},20:{campuran:OPEN,levels:{sedang:OPEN,sulit:OPEN}},22:{campuran:OPEN,levels:{sedang:OPEN}},23:{campuran:OPEN,levels:{sedang:400,sulit:OPEN}},
  24:{campuran:400,levels:{mudah:60,sedang:400}},25:{campuran:OPEN,levels:{sedang:OPEN}},26:{campuran:OPEN,levels:{sedang:OPEN}},27:{campuran:400,levels:{sedang:300,sulit:60}},39:{campuran:120,levels:{mudah:120}},40:{campuran:OPEN,levels:{sedang:OPEN,sulit:OPEN}},
  41:{campuran:OPEN,levels:{sulit:OPEN}},44:{campuran:400,levels:{sedang:400}},45:{campuran:70,levels:{sedang:70}},46:{campuran:OPEN,levels:{sedang:OPEN,sulit:OPEN}},47:{campuran:400,levels:{sedang:400,sulit:400}},48:{campuran:OPEN,levels:{sedang:OPEN}},49:{campuran:200,levels:{sulit:200}},
  50:{campuran:OPEN,levels:{mudah:OPEN,sedang:OPEN,sulit:OPEN}},51:{campuran:OPEN,levels:{mudah:OPEN,sedang:OPEN,sulit:OPEN}},52:{campuran:OPEN,levels:{mudah:600,sedang:600,sulit:OPEN}},53:{campuran:OPEN,levels:{mudah:500,sedang:OPEN,sulit:OPEN}},
};
// Kalimat soal tetap dan isinya ada pada opsi (Perkalian Setara, Pembagian Setara, Figural Ketidaksamaan): stimulus sama bukan berarti kembar.
export const OPTION_CONTENT_ROWS = [25,26,51];
// Sesudah contoh habis, baris ini boleh diisi pembangkit pada sumber contoh diterima (sama dengan kuota workbook untuk 16, 17, 18, 50–53; baris berkuota 0 yang punya pembangkit tepat ikut di sini).
const BANK_THEN_GENERATOR = [16,17,18,19,20,22,23,40,41,44,45,50,51,52,53];
const usesGeneratorOnly = (row: MappingRow, settings: Settings) => row.subtest==='TIU' && (SILO_ROWS.includes(row.row) || settings.tiuSource==='variation' && VARY_ROWS.includes(row.row));
export const chapterHasGenerator = (row: MappingRow, settings: Settings) => usesGeneratorOnly(row,settings) || BANK_THEN_GENERATOR.includes(row.row);
export type ChapterLimit = { max: number; source: string; hint: string };
// Maksimum soal per paket untuk satu chapter menurut sumber, kesulitan, jumlah paket, dan larangan pengulangan pada pengaturan ini.
export function chapterLimit(row: MappingRow, settings: Settings): ChapterLimit {
  const share = settings.uniqueAcross ? settings.packages : 1, perPackage = (stock: number) => Math.min(200, Math.floor(stock / share)), level = settings.difficulty;
  const repeatHint = share > 1 ? ' Kurangi paket atau izinkan pengulangan antarpaket.' : '';
  if (usesLocal(settings,row.subtest)) return { max: perPackage(localRecipes(row.subtest,[row.topic],level,[row.topic+'::'+row.chapter]).length), source: 'kombinasi model lokal', hint: (level==='campuran'?'':' Perluas kesulitan.') + repeatHint };
  const pool = profilePool(row).filter((q)=>chapterMatch(q,row) && (level==='campuran' || q.difficulty===level)), stock = bankSlots(pool,share);
  const generator = CHAPTER_GENERATORS[row.row], space = !generator ? 0 : level==='campuran' ? generator.campuran : generator.levels[level] ?? 0;
  const levelHint = level==='campuran' ? '' : ' Perluas kesulitan.';
  if (usesGeneratorOnly(row,settings)) return { max: perPackage(space), source: 'pembangkit chapter', hint: (space ? '' : ' Pembangkit chapter ini tidak menghasilkan tingkat '+level+'.'+levelHint) + repeatHint };
  if (BANK_THEN_GENERATOR.includes(row.row) && space) return { max: perPackage(stock+space), source: 'contoh diterima dan pembangkit chapter', hint: repeatHint };
  const name = row.subtest==='TKP' ? 'kasus orisinal' : row.subtest==='TIU' && !generator ? 'hanya contoh diterima' : 'contoh diterima';
  const sourceHint = row.subtest!=='TIU' ? ' Pilih Soal baru · generator lokal untuk stok lain.' : !generator ? ' Pembangkit chapter ini belum tersedia.' : !space ? ' Pembangkit chapter ini tidak menghasilkan tingkat '+level+'.' : ' Pilih Variasi TIU terhitung untuk memakai pembangkit.';
  return { max: perPackage(stock), source: name, hint: sourceHint + levelHint + repeatHint };
}
export function chapterLimitError(row: MappingRow & { count: number }, settings: Settings): string | undefined {
  const limit = chapterLimit(row,settings);
  return row.count > limit.max ? row.chapter + ': maksimum ' + limit.max + ' soal per paket (' + limit.source + '), diminta ' + row.count + '.' + limit.hint : undefined;
}
export function profileCapacityErrors(settings:Settings){
  const errors:string[]=[];
  if(settings.chapterCounts)return profilePlan(settings).flatMap((row)=>chapterLimitError(row,settings)??[]);
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
export function replaceMappedQuestion(current: Question, peers: Question[], seed: string, signature: (q:Question)=>string, exactChapter=false): Question {
  if(current.proof.kind==='local')return replaceLocalQuestion(current,peers,rng(seed));
  const row=MAPPING_ROWS.find((r)=>r.id===current.mappingId);
  if(!row)throw new Error('Chapter pengganti tidak ditemukan pada mapping.');
  const r=rng(seed),candidates=r.shuffle(profilePool(row).filter((q)=>!(row.subtest==='TIU'&&SILO_ROWS.includes(row.row))&&q.subtest===current.subtest&&q.topic===current.topic&&(row.subtest==='TKP'||q.subtopic===current.subtopic)&&q.difficulty===current.difficulty));
  for(const item of candidates){const q=sourceQuestion(item,row);if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return q;}
  if(current.subtest==='TIU')for(let attempt=0;attempt<100;attempt++){
    // Silogisme narasi: contoh blueprint yang belum dipakai lebih dahulu (contoh ke-`attempt` menurut urutan seed), baru pembangkit.
    const draft=(exactChapter?makeChapterTiu:makeMappedTiu)(row,current.difficulty,r,0,{seed,used:()=>attempt}),q={...draft,id:'mapped-replacement-'+seed+'-'+attempt,no:current.no};
    if(q.subtopic!==current.subtopic||q.difficulty!==current.difficulty)continue;
    // Figural: pengganti memakai huruf kunci butir yang diganti, jadi sebaran kunci figural paket tetap.
    if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return FIGURAL_FAMILIES.includes(q.family)?placeFiguralKey(q,current.answer):q;
  }
  throw new Error('Tidak ada pengganti unik untuk chapter dan kesulitan ini. Semua contoh yang cocok sudah dipakai; sunting soal atau susun ulang paket.');
}
// Kasus TKP orisinal: family = skenario dan origin 'kasus', sama dengan latihan bebas (lib/generate.ts), sehingga pemeriksaan skenario berlaku juga di sini.
const sourceQuestion = (item: BankItem, row: MappingRow): Question => ({ ...structuredClone(item), no:0, origin:item.kasus?'kasus':'referensi', family:item.kasus?item.kasus.skenario:'accepted-'+item.id,
  mappingId:row.id, proof:{ kind:'bank', id:item.id, answerText:item.options[item.answer].text } });

function generatedFallback(row: MappingRow, level: Difficulty, r: Rng, slot?: ContohSlot): Omit<Question,'id'|'no'> {
  if(row.subtest!=='TIU')throw new Error('Contoh diterima untuk '+row.chapter+' habis. Kurangi jumlah paket atau izinkan pemakaian ulang antarpaket.');
  // Memperkuat/Memperlemah Argumen: sesudah sembilan contoh diterima habis, butir dibangkitkan dari skenario tulisan tangan (lib/tiu-argumen.ts).
  if (row.row===17) return makeMappedTiu(row,level,r,0,slot);
  // Baris berkuota 0 pada workbook; hanya tercapai lewat jumlah per chapter.
  if ([19,20,22,23,40,41,44,45].includes(row.row)) return makeChapterTiu(row,level,r);
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
  const exact=!!settings.chapterCounts; // jumlah per chapter; seluruh percabangan `exact` tidak berlaku pada kuota workbook, sehingga rekaman seed tryout tidak bergeser
  const stimuli=new Set<string>();
  for (let p=0;p<settings.packages;p++) {
    const r=rng(settings.seed+'|tryout|'+p), local=new Set<string>(), localStimuli=new Set<string>(), questions: Question[]=[];
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
        const free=pool.filter((q)=>!local.has(signature(sourceQuestion(q,row))) && (!settings.uniqueAcross || !global.has(signature(sourceQuestion(q,row)))));
        // Jumlah per chapter: soal sekelompok eksklusif paling banyak satu per paket. Antarpaket anggota kelompok didahulukan, karena butir lain tidak punya larangan dan tetap bisa mengisi paket berikutnya (kapasitas: bankSlots).
        const open=exact?free.filter((q)=>!EXCLUSIVE_TWK[q.id]||!questions.some((x)=>exclusiveGroupOf(x)===EXCLUSIVE_TWK[q.id])):free;
        const available=exact&&settings.uniqueAcross&&settings.packages>1?[...open.filter((q)=>EXCLUSIVE_TWK[q.id]),...open.filter((q)=>!EXCLUSIVE_TWK[q.id])]:open;
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
            // Jumlah per chapter: contoh diterima bisa mendahului pembangkit, jadi yang dihitung hanya butir pembangkit (origin 'pola').
            const placed=(difficulty?:string)=>[...packages.flatMap((pack)=>pack.questions),...questions].filter((x)=>x.mappingId===row.id&&(!exact||x.origin==='pola')&&(!difficulty||x.difficulty===difficulty)).length;
            const argumenLevel=()=>{const want=placed()%2?'sulit':'sedang',other=want==='sulit'?'sedang':'sulit';return !exact||placed(want)<argumenButirCount(want)?want:other;};
            const level=settings.difficulty==='campuran'?(row.row===16?'mudah':row.row===17?argumenLevel():a.pick(['sedang','sulit'] as const)):settings.difficulty as Difficulty;
            // Silogisme narasi (baris 14 dan 15): contoh blueprint dipakai lebih dahulu, jumlah butir baris ini yang sudah ada menentukan contoh berikutnya; percobaan ulang langsung memakai pembangkit.
            // Jumlah per chapter: percobaan ulang silogisme tetap memakai keluarga rencana (`ulang`), supaya sebaran keluarga tidak bergeser oleh butir kembar.
            const retryPlan=exact&&SILO_ROWS.includes(row.row);
            const slot:ContohSlot|undefined=attempt===0||retryPlan?{seed:settings.seed,used:(key?:string)=>placed(key?.startsWith('nivel:')?key.slice(6):undefined),...(exact?{merata:true}:{}),...(attempt>0?{ulang:true}:{})}:undefined;
            const draft=fresh?(exact?makeChapterTiu:makeMappedTiu)(row,level,a,p,slot):generatedFallback(row,level,a,exact?slot:undefined);
            const candidate={ ...draft,id:'tryout-pattern-'+row.id+'-'+p+'-'+i+'-'+attempt,no:0 };
            const key=signature(candidate); if (local.has(key) || settings.uniqueAcross && global.has(key)) continue;
            if(exact){
              // Pembangkit bisa menghasilkan tingkat lain dari yang diminta (ditentukan isi butir). Stimulus yang sama dengan opsi berbeda tetap kembar bagi peserta; baris yang isinya ada pada opsi dikecualikan.
              if(settings.difficulty!=='campuran'&&candidate.difficulty!==settings.difficulty)continue;
              const stimulus=signature({...candidate,options:[]});
              if(!OPTION_CONTENT_ROWS.includes(row.row)&&(localStimuli.has(stimulus)||settings.uniqueAcross&&stimuli.has(stimulus)))continue;
            }
            q=candidate; break;
          }
        }
        if (!q) throw new Error(exact?'Tidak cukup variasi unik untuk '+row.chapter+': baru '+i+' dari '+row.count+' soal pada paket '+(p+1)+'.':'Tidak cukup variasi unik untuk '+row.chapter+'.');
        // Figural (baris 50–53): kunci dipindah ke huruf yang paling jarang dipakai kunci figural paket ini (pengacak turunan, tanpa undian aliran paket),
        // sehingga delapan butir figural tidak menumpuk di A. Sidik jari mengabaikan urutan opsi, jadi pemilihan butir tidak berubah.
        if(FIGURAL_FAMILIES.includes(q.family)){
          const used=[0,1,2,3,4].map((at)=>questions.filter((x)=>FIGURAL_FAMILIES.includes(x.family)&&x.answer===at).length),least=Math.min(...used);
          q=placeFiguralKey(q,rng(settings.seed+'|tryout|'+p+'|kunci-figural|'+questions.length).pick(used.flatMap((n,at)=>n===least?[at]:[])));
        }
        q.no=questions.length+1; q.binding=validationBinding(q);
        if(exact){const stimulus=signature({...q,options:[]});localStimuli.add(stimulus);stimuli.add(stimulus);}
        local.add(signature(q)); global.add(signature(q)); questions.push(q);
      }
    }
    packages.push({id:'SKD-'+String(p+1).padStart(2,'0'),seed:settings.seed+'|tryout|'+p,mode:settings.mode,duration:settings.duration,questions:constrainNarrativePackage(questions)});
  }
  return packages;
}
