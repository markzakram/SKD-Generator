import { ACCEPTED_BANK } from './bank';
import { mappingMatch, profilePlan, MAPPING_ROWS, type MappingRow } from './mapping';
import { makeTiu, TIU_FAMILIES } from './tiu';
import { rng, type Rng } from './rng';
import type { BankItem, Difficulty, Package, Question, Settings } from './types';
import { validationBinding } from './binding';
import { makeMappedTiu } from './tryout-patterns';
import { localRecipes, localRecipeKey, usesLocal, makeLocal, chooseLocal, replaceLocalQuestion } from './local';

const familyByRow: Record<number, string> = { 13:'silogisme',14:'silogisme',15:'silogisme',16:'analogi',17:'argumen',18:'posisi',24:'pecahan',25:'setara',26:'setara',27:'data',30:'data',33:'data',39:'deret',46:'matriks-angka',47:'tabel',48:'pernyataan-tabel',49:'cerita',50:'fig-analogi',51:'fig-odd',52:'fig-serial',53:'fig-matrix' };
export const VARY_ROWS=[13,14,15,16,18,24,25,26,27,39,46,47,48,49,50,51,52,53];
export const PROFILE_SETTINGS = { profile: 'tryout-2027' as const, difficulty: 'campuran' as const, topics: [], subtopics: [], composition: undefined, blueprint: undefined };
export function eligibleSources(row: MappingRow, settings: Settings, packageIndex: number) {
  return ACCEPTED_BANK.filter((q)=>mappingMatch(q,row,packageIndex) && (settings.difficulty==='campuran' || q.difficulty===settings.difficulty));
}
export function profileCapacityErrors(settings:Settings){
  const errors:string[]=[];
  for(const row of profilePlan(settings)){
    if(usesLocal(settings,row.subtest)){
      const available=localRecipes(row.subtest,[row.topic],settings.difficulty,[row.topic+'::'+row.chapter]).length,needed=row.count*(settings.uniqueAcross?settings.packages:1);
      if(needed>available)errors.push('Variasi lokal '+row.chapter+': tersedia '+available+', diperlukan '+needed+'. Kurangi paket/soal, perluas kesulitan, atau izinkan pengulangan antarpaket.');
      continue;
    }
    if(row.subtest==='TIU'&&([16,18,50,51,52,53].includes(row.row)||settings.tiuSource==='variation'&&VARY_ROWS.includes(row.row)))continue;
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
      if(!enough){errors.push('Contoh diterima untuk '+row.chapter+': stok yang tersedia tidak cukup untuk '+row.count+' soal pada paket '+(p+1)+'. Kurangi jumlah paket, ubah sumber soal, atau izinkan pengulangan antarpaket.');break;}
    }
  }
  return errors;
}
export function replaceMappedQuestion(current: Question, peers: Question[], seed: string, signature: (q:Question)=>string): Question {
  if(current.proof.kind==='local')return replaceLocalQuestion(current,peers,rng(seed));
  const row=MAPPING_ROWS.find((r)=>r.id===current.mappingId);
  if(!row)throw new Error('Chapter pengganti tidak ditemukan pada mapping.');
  const r=rng(seed),candidates=r.shuffle(ACCEPTED_BANK.filter((q)=>q.subtest===current.subtest&&q.topic===current.topic&&q.subtopic===current.subtopic&&q.difficulty===current.difficulty));
  for(const item of candidates){const q=sourceQuestion(item,row);if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return q;}
  if(current.subtest==='TIU')for(let attempt=0;attempt<100;attempt++){
    const draft=makeMappedTiu(row,current.difficulty,r),q={...draft,id:'mapped-replacement-'+seed+'-'+attempt,no:current.no};
    if(q.subtopic!==current.subtopic||q.difficulty!==current.difficulty)continue;
    if(signature(q)!==signature(current)&&!peers.some((p)=>signature(p)===signature(q)))return q;
  }
  throw new Error('Tidak ada pengganti unik untuk chapter dan kesulitan ini. Semua contoh yang cocok sudah dipakai; sunting soal atau susun ulang paket.');
}
const sourceQuestion = (item: BankItem, row: MappingRow): Question => ({ ...structuredClone(item), no:0, origin:'referensi', family:'accepted-'+item.id,
  mappingId:row.id, proof:{ kind:'bank', id:item.id, answerText:item.options[item.answer].text } });

function generatedFallback(row: MappingRow, level: Difficulty, r: Rng): Omit<Question,'id'|'no'> {
  if(row.subtest!=='TIU')throw new Error('Contoh diterima untuk '+row.chapter+' habis. Kurangi jumlah paket atau izinkan pemakaian ulang antarpaket.');
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
        const item=available.find((q)=>!chapter || q.subtopic===chapter) ?? available[0];
        let q: Question | undefined;
        const fresh=settings.tiuSource==='variation' && row.subtest==='TIU' && VARY_ROWS.includes(row.row);
        if (item && !fresh) q=sourceQuestion(item,row);
        else {
          for (let attempt=0;attempt<300;attempt++) {
            const level=settings.difficulty==='campuran'?(row.row===16?'mudah':r.pick(['sedang','sulit'] as const)):settings.difficulty as Difficulty;
            const draft=fresh?makeMappedTiu(row,level,r,p):generatedFallback(row,level,r);
            const candidate={ ...draft,id:'tryout-pattern-'+row.id+'-'+p+'-'+i+'-'+attempt,no:0 };
            const key=signature(candidate); if (local.has(key) || settings.uniqueAcross && global.has(key)) continue;
            q=candidate; break;
          }
        }
        if (!q) throw new Error('Tidak cukup variasi unik untuk '+row.chapter+'.');
        q.no=questions.length+1; q.binding=validationBinding(q);
        local.add(signature(q)); global.add(signature(q)); questions.push(q);
      }
    }
    packages.push({id:'SKD-'+String(p+1).padStart(2,'0'),seed:settings.seed+'|tryout|'+p,mode:settings.mode,duration:settings.duration,questions});
  }
  return packages;
}
