// Penalaran langkah demi langkah untuk soal susunan dan posisi: penyaringan domain posisi tiap orang oleh petunjuk (propagasi), pencoretan kursi yang sudah dipakai,
// dan pengujian andaian bila buntu. Setiap langkah mencatat langkah lain yang menjadi dasarnya (`deps`), sehingga pembahasan hanya memuat langkah yang benar-benar
// diperlukan untuk menempatkan orang, dan setiap kalimat pembahasan berasal dari penalaran yang sama yang menurunkan jawaban (dan diperiksa ulang oleh brute force).
import { holds, persons, seatCount, type Fact, type Geo } from './posisi-model';

export type Conflict = { clue: number; person: string; seat?: number; deps: number[] };
export type Step =
  | { id: number; kind: 'clue'; clue: number; person: string; before: number[]; after: number[]; ctx: Record<string, number[]>; deps: number[] }
  | { id: number; kind: 'elim'; person: string; holder: string; seat: number; before: number[]; after: number[]; deps: number[] }
  | { id: number; kind: 'single'; person: string; seat: number; before: number[]; after: number[]; deps: number[] }
  | { id: number; kind: 'refute'; person: string; seat: number; chain: Step[]; conflict: Conflict; deps: number[] };
export type Deduction = { solved: boolean; steps: Step[]; positions: Record<string, number>; domains: Record<string, number[]>; refutations: number };

export const MAX_CHAIN = 4; // paling banyak langkah di dalam satu pengandaian yang ditampilkan
const sorted = (set: Iterable<number>) => [...set].sort((a, b) => a - b);

class State {
  dom: Map<string, Set<number>>;
  cause: Map<string, Map<number, number>>; // orang -> kursi -> langkah yang mencoret kursi itu (tidak ada: dicoret sejak awal)
  constructor(dom: Map<string, Set<number>>, cause: Map<string, Map<number, number>>) { this.dom = dom; this.cause = cause; }
  clone() { return new State(new Map([...this.dom].map(([name, set]) => [name, new Set(set)])), new Map([...this.cause].map(([name, map]) => [name, new Map(map)]))); }
}

type Ctx = { geo: Geo; names: string[]; clues: Fact[]; clueWho: string[][]; seats: number; full: boolean };

// Apakah `person` di `seat` masih dapat memenuhi fakta `f` bila orang lain di dalam fakta memilih kursi dari domain mereka (opsional: dengan satu kursi tambahan).
function supported(ctx: Ctx, st: State, f: Fact, who: string[], person: string, seat: number, extra?: { name: string; seat: number }): boolean {
  const others = who.filter((name) => name !== person), assign = new Map<string, number>([[person, seat]]);
  const rec = (k: number): boolean => {
    if (k === others.length) return holds(f, (name) => assign.get(name)!, ctx.geo);
    const name = others[k], options = new Set(st.dom.get(name)!);
    if (extra && extra.name === name) options.add(extra.seat);
    for (const s of options) {
      if ([...assign.values()].includes(s)) continue;
      assign.set(name, s);
      if (rec(k + 1)) return true;
      assign.delete(name);
    }
    return false;
  };
  return rec(0);
}

// Dasar penalaran bila `person` terkunci pada satu kursi: semua langkah yang mencoret kursi lainnya.
const placedDeps = (st: State, person: string, keep: number) => [...(st.cause.get(person) ?? new Map<number, number>())].filter(([seat]) => seat !== keep).map(([, id]) => id);

type Run = { st: State; log: Step[]; next: () => number };

function propagate(ctx: Ctx, run: Run): Conflict | undefined {
  const { st, log } = run;
  const handled = new Set<string>();
  let conflict: Conflict | undefined;
  const remove = (person: string, seats: number[], id: number) => {
    const domain = st.dom.get(person)!, map = st.cause.get(person) ?? new Map<number, number>();
    seats.forEach((seat) => { domain.delete(seat); map.set(seat, id); });
    st.cause.set(person, map);
  };
  const fail = (person: string, clue: number) => { if (!conflict) conflict = { clue, person, deps: [...(st.cause.get(person) ?? new Map<number, number>()).values()] }; };
  const applyClue = (k: number): boolean => {
    const f = ctx.clues[k], who = ctx.clueWho[k];
    let changed = false;
    for (const person of who) {
      if (conflict) return changed;
      const before = sorted(st.dom.get(person)!), keep = before.filter((seat) => supported(ctx, st, f, who, person, seat));
      if (keep.length === before.length) continue;
      const removed = before.filter((seat) => !keep.includes(seat)), deps = new Set<number>(), others = who.filter((name) => name !== person);
      for (const seat of removed) {
        let found = false;
        for (const q of others) for (const [t, id] of st.cause.get(q) ?? []) if (!st.dom.get(q)!.has(t) && supported(ctx, st, f, who, person, seat, { name: q, seat: t })) { deps.add(id); found = true; }
        if (!found) for (const q of others) for (const id of (st.cause.get(q) ?? new Map<number, number>()).values()) deps.add(id);
      }
      const ctxDomains = Object.fromEntries(others.map((q) => [q, sorted(st.dom.get(q)!)])), id = run.next();
      remove(person, removed, id);
      log.push({ id, kind: 'clue', clue: k, person, before, after: keep, ctx: ctxDomains, deps: [...deps] });
      if (!keep.length) fail(person, k);
      changed = true;
    }
    return changed;
  };
  const different = (): boolean => {
    let changed = false;
    for (const [holder, domain] of [...st.dom]) {
      if (domain.size !== 1 || conflict) continue;
      const seat = [...domain][0], key = holder + ':' + seat;
      if (handled.has(key)) continue;
      handled.add(key);
      const deps = placedDeps(st, holder, seat);
      for (const [person, other] of [...st.dom]) {
        if (person === holder || !other.has(seat)) continue;
        const before = sorted(other), id = run.next();
        remove(person, [seat], id);
        log.push({ id, kind: 'elim', person, holder, seat, before, after: sorted(other), deps });
        if (!other.size) fail(person, -1);
        changed = true;
      }
    }
    if (ctx.full && !conflict) for (let seat = 0; seat < ctx.seats; seat++) {
      const holders = [...st.dom].filter(([, domain]) => domain.has(seat)).map(([name]) => name);
      if (!holders.length) { conflict = { clue: -1, person: '', seat, deps: [...st.cause.values()].flatMap((map) => map.has(seat) ? [map.get(seat)!] : []) }; break; }
      if (holders.length === 1 && st.dom.get(holders[0])!.size > 1) {
        const person = holders[0], before = sorted(st.dom.get(person)!), deps = [...st.cause].flatMap(([name, map]) => name !== person && map.has(seat) ? [map.get(seat)!] : []), id = run.next();
        remove(person, before.filter((s) => s !== seat), id);
        log.push({ id, kind: 'single', person, seat, before, after: [seat], deps });
        changed = true;
      }
    }
    return changed;
  };
  for (let round = 0; round < 60 && !conflict; round++) {
    let changed = false;
    // Petunjuk posisi langsung lebih dahulu, lalu petunjuk yang pasangannya sudah terkunci (penalaran berantai).
    const score = (k: number) => { const f = ctx.clues[k]; return f.k === 'at' || f.k === 'row' || f.k === 'col' ? 3 : ctx.clueWho[k].filter((name) => st.dom.get(name)!.size === 1).length; };
    const queue = ctx.clues.map((_, k) => k).sort((x, y) => score(y) - score(x) || x - y);
    for (const k of queue) { if (conflict) break; if (applyClue(k)) changed = true; }
    if (!conflict && different()) changed = true;
    if (!changed) break;
  }
  return conflict;
}

// Langkah yang diperlukan (penutup transitif dari `seeds`) di dalam `steps`.
export function closure(steps: Step[], seeds: number[]): Set<number> {
  const byId = new Map(steps.map((step) => [step.id, step] as const)), need = new Set<number>(), stack = [...seeds];
  while (stack.length) {
    const id = stack.pop()!, step = byId.get(id);
    if (!step || need.has(id)) continue;
    need.add(id);
    stack.push(...step.deps);
  }
  return need;
}

export function deduce(geo: Geo, names: string[], clues: Fact[], anchor?: string, allowRefute = true): Deduction {
  const seats = seatCount(geo), all = Array.from({ length: seats }, (_, i) => i);
  const ctx: Ctx = { geo, names, clues, clueWho: clues.map((f) => [...new Set(persons(f))]), seats, full: names.length === seats };
  let counter = 0;
  const run: Run = { st: new State(new Map(names.map((name) => [name, new Set(all)])), new Map()), log: [], next: () => ++counter };
  if (anchor !== undefined) { run.st.dom.set(anchor, new Set([0])); }
  const out: Deduction = { solved: false, steps: run.log, positions: {}, domains: {}, refutations: 0 };
  const finish = (): Deduction => {
    out.domains = Object.fromEntries([...run.st.dom].map(([name, set]) => [name, sorted(set)]));
    out.positions = Object.fromEntries([...run.st.dom].filter(([, set]) => set.size === 1).map(([name, set]) => [name, [...set][0]]));
    out.solved = names.every((name) => name in out.positions);
    return out;
  };
  if (propagate(ctx, run)) return finish();
  for (let guard = 0; guard < 80 && allowRefute; guard++) {
    if ([...run.st.dom.values()].every((set) => set.size === 1)) break;
    let progressed = false;
    const candidates = [...run.st.dom].filter(([, set]) => set.size > 1).sort((x, y) => x[1].size - y[1].size || names.indexOf(x[0]) - names.indexOf(y[0]));
    // Pengujian andaian: semua kandidat dicoba, dan yang dasarnya paling pendek dipakai (pembahasan tetap ringkas). Andaian yang butuh lebih dari MAX_CHAIN langkah ditolak.
    let best: { person: string; seat: number; chain: Step[]; conflict: Conflict; outer: number[] } | undefined;
    search: for (const [person, set] of candidates) for (const seat of sorted(set)) {
      const trial = run.st.clone(), trialLog: Step[] = [], assume = run.next();
      const rest = sorted(trial.dom.get(person)!).filter((s) => s !== seat);
      trial.dom.get(person)!.clear(); trial.dom.get(person)!.add(seat);
      const map = trial.cause.get(person) ?? new Map<number, number>(); rest.forEach((s) => map.set(s, assume)); trial.cause.set(person, map);
      const conflict = propagate(ctx, { st: trial, log: trialLog, next: run.next });
      if (!conflict) continue;
      const need = closure(trialLog, conflict.deps), chain = trialLog.filter((step) => need.has(step.id));
      const outer = new Set<number>();
      for (const step of chain) for (const dep of step.deps) if (!trialLog.some((s) => s.id === dep) && dep !== assume) outer.add(dep);
      for (const dep of conflict.deps) if (!trialLog.some((s) => s.id === dep) && dep !== assume) outer.add(dep);
      if (!best || chain.length < best.chain.length) best = { person, seat, chain, conflict, outer: [...outer] };
      if (best.chain.length <= 1) break search;
    }
    if (best && best.chain.length <= MAX_CHAIN) {
      const { person, seat } = best, id = run.next();
      run.st.dom.get(person)!.delete(seat);
      const cause = run.st.cause.get(person) ?? new Map<number, number>(); cause.set(seat, id); run.st.cause.set(person, cause);
      run.log.push({ id, kind: 'refute', person, seat, chain: best.chain, conflict: best.conflict, deps: best.outer });
      out.refutations++;
      if (!run.st.dom.get(person)!.size || propagate(ctx, run)) return finish();
      progressed = true;
    }
    if (!progressed) break;
  }
  return finish();
}

// Langkah yang perlu ditampilkan: hanya yang menjadi dasar penempatan semua orang yang domainnya sudah tunggal.
export function neededSteps(d: Deduction, domains = d.domains): Step[] {
  const seeds: number[] = [];
  // Dasar penempatan orang p: langkah yang mencoret tiap kursi selain kursi p. Dihitung dari catatan langkah (kursi yang dicoret) tanpa State.
  const removedBy = new Map<string, Map<number, number>>();
  for (const step of d.steps) {
    const gone = step.kind === 'refute' ? [step.seat] : step.before.filter((s) => !step.after.includes(s));
    const map = removedBy.get(step.person) ?? new Map<number, number>();
    gone.forEach((s) => map.set(s, step.id));
    removedBy.set(step.person, map);
  }
  for (const [name, domain] of Object.entries(domains)) if (domain.length === 1) for (const [seat, id] of removedBy.get(name) ?? []) if (seat !== domain[0]) seeds.push(id);
  const need = closure(d.steps, seeds);
  return d.steps.filter((step) => need.has(step.id));
}
