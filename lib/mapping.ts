import mapping from '@/data/skd-mapping.json';
import { BASELINE } from './config';
import type { BankItem, Mode, Question, Settings, Subtest } from './types';

export type MappingRow = { id: string; row: number; subtest: Subtest; category: string; lesson: string; chapter: string; topic: string; count: number; exerciseCount: number };
export const MAPPING_ROWS = mapping.rows as MappingRow[];
export const MAPPING_SOURCE = { file: mapping.file, sheet: mapping.sheet };
const normalize = (text: string) => text.toLowerCase().replaceAll('&', 'dan').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function mappingMatch(item: Pick<BankItem, 'subtest' | 'topic' | 'subtopic'>, row: MappingRow, packageIndex = 0): boolean {
  if (item.subtest !== row.subtest || item.topic !== row.topic) return false;
  const chapter = normalize(item.subtopic), target = normalize(row.chapter);
  if (row.row <= 6 || row.subtest === 'TKP') return true;
  // Baris 17 bertanda "/" ("Memperkuat/Memperlemah Argumen"), sedangkan nama keluarga pembangkit memakai "dan": normalize tidak menyamakannya.
  if (row.row === 17) return chapter === target || chapter === normalize('Memperkuat dan memperlemah argumen');
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
// Jumlah per chapter: chapter yang dipilih harus tepat. Rotasi kelompok paket (baris 27, 30, 33) dan gabungan semua deret (baris 39) hanya berlaku pada kuota workbook; baris lain sama dengan mappingMatch.
export function chapterMatch(item: Pick<BankItem, 'subtest' | 'topic' | 'subtopic'>, row: MappingRow): boolean {
  if (![27, 30, 33, 39].includes(row.row)) return mappingMatch(item, row);
  return item.subtest === row.subtest && item.topic === row.topic && normalize(item.subtopic) === normalize(row.chapter);
}
export const chapterTotal = (counts: Record<string, number>) => Object.values(counts).reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
// Jenis paket mengikuti isian: satu subtes bila hanya satu subtes terisi, selain itu gabungan. Isian kosong mempertahankan jenis sebelumnya.
export function chapterMode(counts: Record<string, number>, fallback: Mode): Mode {
  const subtests = [...new Set(MAPPING_ROWS.filter((row) => counts[row.id] > 0).map((row) => row.subtest))];
  return subtests.length === 1 ? subtests[0] : subtests.length ? 'SKD' : fallback;
}
// Durasi sebanding jumlah soal menurut baseline (100 menit untuk 110 soal).
export const chapterDuration = (total: number) => Math.max(1, Math.round(total * BASELINE.duration / 110));
// Pengaturan sesudah isian per chapter berubah: jumlah soal, jenis paket, dan durasi mengikuti isian; materi dan submateri tidak berlaku lagi.
export function withChapterCounts(settings: Settings, counts: Record<string, number>): Settings {
  const total = chapterTotal(counts);
  return { ...settings, profile: 'tryout-2027', chapterCounts: counts, count: total, mode: chapterMode(counts, settings.mode), duration: chapterDuration(total), topics: [], subtopics: [], composition: undefined, blueprint: undefined };
}
export function profilePlan(settings: Settings): (MappingRow & { count: number })[] {
  const custom = settings.chapterCounts;
  if (custom) return MAPPING_ROWS.filter((row) => custom[row.id] > 0).map((row) => ({ ...row, count: custom[row.id] }));
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
