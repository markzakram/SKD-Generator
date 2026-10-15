'use client';
import { useEffect, useRef, useState } from 'react';
import { blankAnswers } from '@/lib/pilot';
import type { Package, PilotAnswer, PilotSession, Workspace } from '@/lib/types';
import QuestionCard from './QuestionCard';

export default function PilotRunner({ workspace, pack, onFinish, onClose }: { workspace: Workspace; pack: Package; onFinish: (s: PilotSession) => void; onClose: () => void }) {
  const [index, setIndex] = useState(0), [participant, setParticipant] = useState(''), [started, setStarted] = useState(false), [remaining, setRemaining] = useState(pack.duration * 60), [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState(blankAnswers(pack));
  const liveAnswers = useRef(answers), entered = useRef(0), current = useRef(0), submitted = useRef(false), deadline = useRef(0);
  liveAnswers.current = answers; current.current = index;
  const record = (): PilotAnswer[] => {
    const list = liveAnswers.current.map((a, i) => i === current.current ? { ...a, seconds: a.seconds + Math.round((performance.now() - entered.current) / 10) / 100 } : a);
    entered.current = performance.now(); liveAnswers.current = list; setAnswers(list); return list;
  };
  const finish = () => {
    if (submitted.current) return; submitted.current = true; setBusy(true);
    onFinish({ id: crypto.randomUUID(), workspaceId: workspace.id, version: workspace.version, packageId: pack.id, participant: participant.trim() || 'Anonim', finishedAt: new Date().toISOString(), answers: record() });
  };
  const latestFinish = useRef(finish); latestFinish.current = finish;
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(() => { const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)); setRemaining(left); if (!left) latestFinish.current(); }, 1000);
    const unload = (e: BeforeUnloadEvent) => { if (!submitted.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', unload); };
  }, [started]);
  if (!started) return <section className="panel pilot-intro"><span className="eyebrow">UJI PESERTA</span><h2>Kerjakan paket latihan</h2><p>{pack.questions.length} soal disetujui · {pack.duration} menit. Kunci dan pembahasan muncul kembali setelah sesi selesai.</p><label className="field">Kode peserta<input value={participant} onChange={(e) => setParticipant(e.target.value)} placeholder="Contoh P-001, tanpa data pribadi" maxLength={100}/></label><p className="help">Sesi ini mencatat pilihan dan waktu tiap soal. Selesaikan sesi sebelum menutup tab.</p><div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Kembali</button><button className="primary-button" onClick={() => { entered.current = performance.now(); deadline.current = Date.now() + pack.duration * 60000; setStarted(true); }}>Mulai pengerjaan</button></div></section>;
  const q = pack.questions[index];
  return <div className="pilot-layout"><div className="pilot-top"><strong>{answers.filter((a) => a.choice !== null).length} / {answers.length} terjawab</strong><span className="timer">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span></div>
    <QuestionCard question={q} showAnswers={false} hideExplanation choice={answers[index].choice} onChoose={(choice) => setAnswers(answers.map((a, i) => i === index ? { ...a, choice } : a))}/>
    <div className="prev-next"><button className="secondary-button" disabled={!index || busy} onClick={() => { record(); setIndex(index - 1); }}>Sebelumnya</button><button className="text-button" disabled={busy} onClick={() => setAnswers(answers.map((a, i) => i === index ? { ...a, choice: null } : a))}>Kosongkan jawaban</button><button className="secondary-button" disabled={index === pack.questions.length - 1 || busy} onClick={() => { record(); setIndex(index + 1); }}>Berikutnya</button></div>
    <div className="question-grid pilot-numbers">{pack.questions.map((q, i) => <button key={q.id} className={'number-button ' + (answers[i].choice !== null ? 'approved ' : '') + (i === index ? 'active' : '')} onClick={() => { record(); setIndex(i); }}>{i + 1}</button>)}</div>
    <button className="primary-button" disabled={busy} onClick={finish}>Selesaikan sesi{answers.some((a) => a.choice === null) ? ' · ada jawaban kosong' : ''}</button>
  </div>;
}
