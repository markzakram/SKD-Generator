'use client';
import { useEffect, useRef, useState } from 'react';
import { editQuestion } from '@/lib/quality';
import type { Question } from '@/lib/types';
import Icon from './Icon';

export default function QuestionEditor({ question, onSave, onClose }: { question: Question; onSave: (q: Question) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(structuredClone(question)), [error, setError] = useState('');
  const [stimulus, setStimulus] = useState(JSON.stringify({ table: question.table, visual: question.visual, figures: question.options.map((o) => o.figure ?? null) }, null, 2));
  const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); }, []);
  const save = () => {
    try {
      const data = JSON.parse(stimulus);
      const q = { ...draft, table: data.table, visual: data.visual, options: draft.options.map((o, i) => ({ ...o, figure: data.figures?.[i] ?? undefined })) };
      onSave(editQuestion(question, q));
    } catch (e) { setError(e instanceof Error ? e.message : 'Isi soal belum valid.'); }
  };
  return <dialog ref={ref} className="editor-dialog" onCancel={onClose}><div className="dialog-heading"><div><span className="eyebrow">REVISI SOAL {question.no}</span><h2>Sunting soal dan pembahasan</h2></div><button className="icon-button" aria-label="Tutup editor" onClick={onClose}><Icon name="close"/></button></div>
    <p className="help">Setelah disimpan, soal kembali ke status perlu revisi. Perubahan konten membutuhkan pemeriksaan kunci oleh penelaah.</p>
    <label className="field">Pertanyaan<textarea aria-label="Pertanyaan" rows={5} value={draft.stem} onChange={(e) => setDraft({ ...draft, stem: e.target.value })}/></label>
    <div className="field-pair"><label className="field">Kesulitan<select value={draft.difficulty === 'hots' ? 'sulit' : draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Question['difficulty'] })}><option value="mudah">Mudah</option><option value="sedang">Sedang</option><option value="sulit">Sulit</option></select></label><label className="field">Bloom<select value={draft.bloom ?? 'C3'} onChange={(e) => setDraft({ ...draft, bloom: e.target.value })}>{['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].map((b) => <option key={b}>{b}</option>)}</select></label></div>
    <label className="field">Alasan tingkat kesulitan<textarea rows={2} value={draft.difficultyReason ?? ''} onChange={(e) => setDraft({ ...draft, difficultyReason: e.target.value })}/></label>
    <fieldset><legend>Pilihan, kunci, dan alasan</legend>{draft.options.map((option, i) => <div key={i} className="edit-option"><div className="edit-option-head"><label className="check-row"><input type="radio" name="answer" checked={draft.answer === i} onChange={() => setDraft({ ...draft, answer: i, options: draft.options.map((o, j) => ({ ...o, score: draft.subtest === 'TKP' ? o.score : j === i ? 5 : 0 })) })}/><strong>Opsi {String.fromCharCode(65 + i)} · kunci terbaik</strong></label>{draft.subtest === 'TKP' && <label>Poin<input aria-label={'Poin opsi ' + String.fromCharCode(65 + i)} type="number" min={1} max={5} value={option.score} onChange={(e) => setDraft({ ...draft, options: draft.options.map((o, j) => j === i ? { ...o, score: Number(e.target.value) } : o) })}/></label>}</div>
      <label className="field">Teks opsi {String.fromCharCode(65 + i)}<textarea rows={2} value={option.text} onChange={(e) => setDraft({ ...draft, options: draft.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) })}/></label>
      <label className="field">Alasan opsi {String.fromCharCode(65 + i)}<textarea rows={2} value={option.reason} onChange={(e) => setDraft({ ...draft, options: draft.options.map((o, j) => j === i ? { ...o, reason: e.target.value } : o) })}/></label></div>)}</fieldset>
    <label className="field">Pembahasan<textarea aria-label="Pembahasan" rows={4} value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}/></label><label className="field">Sumber<input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}/></label>
    {draft.rubric && <fieldset><legend>Rubrik TKP</legend>{Object.entries(draft.rubric).map(([key, value]) => <label className="field" key={key}>{{ authority: 'Kewenangan', urgency: 'Urgensi', efficacy: 'Efektivitas', risk: 'Risiko', followUp: 'Tindak lanjut' }[key]}<textarea rows={2} value={value} onChange={(e) => setDraft({ ...draft, rubric: { ...draft.rubric!, [key]: e.target.value } })}/></label>)}</fieldset>}
    <details className="advanced"><summary>Stimulus tabel / gambar (JSON)<Icon name="chevron"/></summary><div className="advanced-body"><label className="field">Atribut stimulus<textarea className="code-input" rows={10} value={stimulus} onChange={(e) => setStimulus(e.target.value)}/></label></div></details>
    {error && <p className="error-message" role="alert">{error}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" onClick={save}>Simpan revisi</button></div>
  </dialog>;
}
