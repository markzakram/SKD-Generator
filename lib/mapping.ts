import mapping from '@/data/skd-mapping.json';
import type { BankItem, Question, Settings, Subtest } from './types';

export type MappingRow = { id: string; row: number; subtest: Subtest; category: string; lesson: string; chapter: string; topic: string; count: number; exerciseCount: number };
export const MAPPING_ROWS = mapping.rows as MappingRow[];
export const MAPPING_SOURCE = { file: mapping.file, sheet: mapping.sheet };
const normalize = (text: string) => text.toLowerCase().replaceAll('&', 'dan').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function mappingMatch(item: Pick<BankItem, 'subtest' | 'topic' | 'subtopic'>, row: MappingRow, packageIndex = 0): boolean {
  if (item.subtest !== row.subtest || item.topic !== row.topic) return false;
  const chapter = normalize(item.subtopic), target = normalize(row.chapter);
  if (row.row <= 6 || row.subtest === 'TKP') return true;
  if (row.row === 24) return chapter.includes('operasi hitung') || chapter === 'berhitung dan pecahan';
  if (row.row === 27) {
    const rotations=[['Aljabar - Operasi Aljabar','Aljabar - Persamaan'],['Aljabar - Persamaan','Aljabar - Sistem Persamaan'],['Aljabar - Sistem Persamaan','Aljabar - Operasi Aljabar']];
    return rotations[packageIndex%3].map(normalize).includes(chapter);
  }
  if (row.row === 30) {
    const variants = ['Bilangan - Jenis dan Sifat Bilangan', 'Bilangan - Keterbagian Bilangan', 'Bilangan - Faktor dan Kelipatan'];
    return chapter === normalize(variants[packageIndex % 3]);
  }
  if (row.row === 33) {
    const rotations = [
      ['Soal Cerita - Geometri','Soal Cerita - Perbandingan Senilai dan Berbalik','Soal Cerita - Aljabar'],
      ['Soal Cerita - JKW (Jarak, Kecepatan, Waktu)','Soal Cerita - Geometri','Soal Cerita - Perbandingan Senilai dan Berbalik'],
      ['Soal Cerita - VDW (Volume, Debit, Waktu)','Soal Cerita - JKW (Jarak, Kecepatan, Waktu)','Soal Cerita - Aritmatika Sosial'],
    ];
    return rotations[packageIndex % 3].map(normalize).includes(chapter);
  }
  if (row.row === 39) return chapter.startsWith('deret angka') || chapter.startsWith('deret ');
  return chapter === target;
}
export function profilePlan(settings: Settings): (MappingRow & { count: number })[] {
  const allowed = MAPPING_ROWS.filter((row) => row.count && (settings.mode === 'SKD' || settings.mode === row.subtest) && (!settings.topics.length || settings.topics.includes(row.topic)) &&
    (!settings.subtopics.length || settings.subtopics.some((key) => key === row.topic+'::'+row.chapter)));
  if (!allowed.length) throw new Error('Tidak ada kuota tryout pada filter ini. Pilih profil latihan bebas untuk submateri tambahan.');
  if (settings.mode === 'SKD' && (settings.topics.length || settings.subtopics.length)) throw new Error('Profil SKD gabungan memakai seluruh materi pada mapping. Gunakan subtes khusus untuk memfilter materi.');
  const subtests=settings.mode==='SKD'?['TWK','TIU','TKP'] as const:[settings.mode];
  const counts={TWK:0,TIU:0,TKP:0};
  const weights={TWK:30,TIU:35,TKP:45};
  if(settings.mode==='SKD'){
    for(const s of subtests)counts[s]=Math.floor(settings.count*weights[s]/110);
    const ordered=[...subtests].sort((a,b)=>settings.count*weights[b]/110%1-settings.count*weights[a]/110%1);
    for(let remainder=settings.count-Object.values(counts).reduce((a,b)=>a+b,0),i=0;i<remainder;i++)counts[ordered[i]]++;
  }else counts[settings.mode]=settings.count;
  return subtests.flatMap((subtest)=>{
    const selected=allowed.filter((r)=>r.subtest===subtest),total=selected.reduce((sum,row)=>sum+row.count,0),count=counts[subtest];
    const rows=selected.map((row)=>({...row,count:Math.floor(count*row.count/total),fraction:count*row.count/total%1}));
    const ordered=[...rows].sort((a,b)=>b.fraction-a.fraction || a.row-b.row);
    for(let remainder=count-rows.reduce((sum,row)=>sum+row.count,0),i=0;i<remainder;i++)ordered[i].count++;
    return rows.filter((r)=>r.count);
  });
}
export function mappingFor(q: Pick<Question,'subtest'|'topic'|'subtopic'>): MappingRow | undefined {
  return MAPPING_ROWS.find((row) => mappingMatch(q,row));
}
export function profileCoverage(questions: Question[], settings: Settings) {
  return profilePlan(settings).map((row)=>({ ...row, actual: questions.filter((q)=>q.mappingId===row.id).length,
    included: questions.filter((q)=>q.mappingId===row.id && !q.review?.excluded).length,
    approved: questions.filter((q)=>q.mappingId===row.id && !q.review?.excluded && q.review?.status==='approved').length }));
}
