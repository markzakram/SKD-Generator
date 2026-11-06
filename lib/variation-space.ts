import { bankFor } from './bank';
import { LOCAL_MODELS, localRecipes, usesLocal } from './local';
import { profilePlan } from './mapping';
import { chapterHasGenerator, eligibleSources, SILO_ROWS, VARY_ROWS } from './tryout-profile';
import { TIU_FAMILIES } from './tiu';
import { buildBlueprint } from './blueprint';
import type { Settings, Subtest } from './types';

export type VariationSource = { id: string; subtest: Subtest; topic: string; name: string; kind: 'local' | 'bank' | 'parameter'; size: number | null; variables: string; limit: string };
export function variationSpace(settings: Settings): VariationSource[] {
  const sources: VariationSource[] = [];
  const active = settings.mode === 'SKD' ? ['TWK', 'TIU', 'TKP'] as const : [settings.mode];
  const plan = settings.profile === 'tryout-2027' ? profilePlan(settings) : null;
  const blueprint = plan ? null : buildBlueprint(settings);
  const selectedTopics = (subtest: Subtest) => plan ? [...new Set(plan.filter((row) => row.subtest === subtest).map((row) => row.topic))] : [...new Set(blueprint!.filter((row) => row.subtest === subtest && row.count > 0).map((row) => row.topic))];
  for (const subtest of active) {
    const topics = selectedTopics(subtest);
    if (!topics.length) continue;
    if (usesLocal(settings, subtest)) {
      const selectedChapters = plan ? plan.filter((row) => row.subtest === subtest).map((row) => row.topic + '::' + row.chapter) : settings.subtopics;
      const recipes = localRecipes(subtest, topics, settings.difficulty, selectedChapters);
      for (const model of LOCAL_MODELS.filter((m) => recipes.some((r) => r.model === m.id))) {
        const list = recipes.filter((r) => r.model === model.id), contexts = new Set(list.map((r) => r.context)).size, states = new Set(list.map((r) => r.state)).size;
        const variables = [...new Set(model.contexts.flatMap((context) => Object.keys(context).filter((key) => key !== 'intro')))];
        sources.push({ id: model.id, subtest, topic: model.topic, name: model.concept, kind: 'local', size: list.length,
          variables: contexts + ' konteks × ' + states + ' kondisi' + (variables.length ? '; isian: ' + variables.join(', ') : '') + '. Fakta, tindakan, peringkat, dan alasan mengikuti kondisi.',
          limit: 'Kombinasi model yang ditulis penulis; urutan opsi tidak dihitung. Konteks berbeda dapat memakai pola keputusan yang sama.' });
      }
      continue;
    }
    if (plan) {
      for (const row of plan.filter((row) => row.subtest === subtest)) {
        const pool = [...new Map(Array.from({ length: settings.packages }, (_, p) => eligibleSources(row, settings, p)).flat().map((q) => [q.id, q])).values()];
        const parameter = subtest === 'TIU' && (settings.tiuSource === 'variation' && VARY_ROWS.includes(row.row) || SILO_ROWS.includes(row.row) || !pool.length || !!settings.chapterCounts && chapterHasGenerator(row, settings)); // silogisme selalu dibangkitkan (lib/tryout-profile.ts)
        if (parameter) sources.push({ id: row.id, subtest, topic: row.topic, name: row.chapter, kind: 'parameter', size: null,
          variables: row.topic === 'Figural' ? 'Bentuk, posisi, rotasi, jumlah, isian, dan aturan hubungan gambar.' : row.topic === 'Numerik' ? 'Angka, data tabel, operasi, serta pengecoh dari hasil perhitungan.' : 'Pasangan kata, premis, relasi, objek, atau batasan susunan sesuai chapter.',
          limit: 'Rentang mengikuti pembangkit chapter. Total kombinasi valid belum dihitung; gunakan uji seed untuk mengukur sampel.' });
        else sources.push({ id: row.id, subtest, topic: row.topic, name: row.chapter, kind: 'bank', size: pool.length,
          variables: 'Pemilihan butir dari ' + pool.length + ' contoh yang cocok dengan filter dan rotasi paket.', limit: 'Isi bank tetap. Mengganti seed tidak menulis kasus baru untuk jalur ini.' });
      }
    } else {
      const pool = bankFor(subtest, topics, settings.difficulty, settings.subtopics);
      for (const topic of topics) {
        const items = pool.filter((item) => item.topic === topic);
        if (items.length) sources.push({ id: 'bank-' + subtest + '-' + topic, subtest, topic, name: topic, kind: 'bank', size: items.length,
          variables: subtest === 'TKP' && items.some((q) => q.kasus) ? 'Kasus tersimpan: ' + new Set(items.flatMap((q) => q.kasus ? [q.kasus.pola] : [])).size + ' pola keputusan; peran, kewenangan, tempat, dan fakta penentu tersedia pada metadata kasus.' : 'Pemilihan butir dan urutan opsi bila butir mengizinkan pengacakan.',
          limit: 'Stok butir yang lolos filter; kapasitas paket dapat lebih kecil karena larangan kasus/pola yang berulang.' });
      }
      if (subtest === 'TIU') for (const family of TIU_FAMILIES.filter((f) => topics.includes(f.topic) && (settings.difficulty === 'campuran' || f.levels.includes(settings.difficulty)) && (!settings.subtopics.length || settings.subtopics.includes(f.topic + '::' + f.name)))) {
        sources.push({ id: family.id, subtest, topic: family.topic, name: family.name, kind: 'parameter', size: null,
          variables: family.topic === 'Figural' ? 'Bentuk, posisi, rotasi, pencerminan, jumlah, isian, dan aturan hubungan.' : family.topic === 'Numerik' ? 'Nilai angka, operasi, data, hasil, dan pengecoh terhitung.' : 'Kata/objek, premis, relasi, serta batasan sesuai keluarga soal.',
          limit: 'Parameter dibatasi pembangkit dan validator. Jumlah keseluruhan kombinasi valid belum dihitung.' });
      }
    }
  }
  return sources;
}
export const SOURCE_LABELS = { local: 'Model lokal', bank: 'Bank soal', parameter: 'Pola berparameter' };
