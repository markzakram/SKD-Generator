'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { actualBlueprint } from '@/lib/blueprint';
import { LABELS } from '@/lib/config';
import { qualitySummary, setReview, STATUS_LABELS } from '@/lib/quality';
import { copyQuestionImage } from '@/lib/take-actions';
import { togglePick } from '@/lib/take';
import type { BlueprintRow, Package, Question, ReviewStatus, Settings } from '@/lib/types';
import { profileCoverage } from '@/lib/mapping';
import Icon from './Icon';
import QuestionCard from './QuestionCard';
import QuestionEditor from './QuestionEditor';
import ReviewQueue from './ReviewQueue';
import TakePanel, { Toast, useToast } from './TakeTools';
import { markOf, useIssueLists } from './review-quality';
import useReviewShortcuts from './useReviewShortcuts';

const matchesStatus = (q: Question, status: string) => status === 'all' || (status === 'excluded' ? !!q.review?.excluded : !q.review?.excluded && q.review?.status === status);
// Isi hanya angka = nomor soal persis (mengetik "1" tidak ikut menjaring 10 sampai 19); selain itu cocok sebagian pada stem, submateri, dan nomor.
const matchesSearch = (q: Question, term: string) => {
  const text = term.trim().toLowerCase();
  if (!text) return true;
  if (/^\d+$/.test(text)) return q.no === Number(text);
  return (q.stem + ' ' + q.subtopic + ' ' + q.no).toLowerCase().includes(text);
};

export default function Workbench({ pack, blueprint, settings, title = '', reviewer, onReviewer, onChange, onReplace }: { pack: Package; blueprint?: BlueprintRow[]; settings?: Settings; title?: string; reviewer: string; onReviewer: (s: string) => void; onChange: (q: Question, label: string) => void; onReplace: (q: Question) => void }) {
  const [selected, setSelected] = useState(pack.questions[0]?.id), [search, setSearch] = useState(''), [subtest, setSubtest] = useState('all'), [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(false), [showAnswers, setShowAnswers] = useState(true), [participantView, setParticipantView] = useState(false), [note, setNote] = useState(''), [ackKey, setAckKey] = useState(''), [error, setError] = useState(''), [hintOpen, setHintOpen] = useState(false);
  const [pick, setPick] = useState(false), [picked, setPicked] = useState<Set<string>>(() => new Set()), { toast, notify } = useToast();
  const ackRef = useRef<HTMLInputElement>(null), reviewerRef = useRef<HTMLInputElement>(null), noteRef = useRef<HTMLTextAreaElement>(null), mainRef = useRef<HTMLDivElement>(null), scrollRef = useRef<HTMLDivElement>(null);
  const lists = useIssueLists(pack.questions);
  const summary = useMemo(() => qualitySummary(pack.questions, lists), [pack.questions, lists]);
  const marks = useMemo(() => new Map(pack.questions.map((item, i) => [item.id, markOf(item, lists[i])])), [pack.questions, lists]);
  const position = useMemo(() => new Map(pack.questions.map((item, i) => [item.id, i])), [pack.questions]);
  const filtered = useMemo(() => pack.questions.filter((item) => (subtest === 'all' || item.subtest === subtest) && matchesStatus(item, status) && matchesSearch(item, search)), [pack.questions, subtest, status, search]);
  const q = pack.questions.find((item) => item.id === selected) ?? pack.questions[0];
  const issues = q ? lists[position.get(q.id) ?? 0] ?? [] : [];
  // Centang terikat ke versi soal yang sedang tampil, jadi otomatis lepas saat pindah soal atau status berubah (tanpa jeda efek).
  const reviewKey = q ? q.id + '@' + (q.review?.updatedAt ?? '') : '', ack = !!q && ackKey === reviewKey;
  const coverage = useMemo(() => [...new Map([...(blueprint ?? []), ...actualBlueprint(pack.questions)].map((r) => [r.subtest + r.topic + r.difficulty, r])).values()], [blueprint, pack.questions]);
  // Syarat persetujuan sama dengan tombol "Setujui soal"; tombol dan pintasan A memakai daftar ini.
  const blockers = q ? [!ack && 'centang kotak pemeriksaan', !reviewer.trim() && 'isi nama penelaah', issues.some((i) => i.level === 'error') && 'perbaiki kegagalan validasi', q.review?.excluded && 'kembalikan soal ke paket'].filter((b): b is string => typeof b === 'string') : [];
  const canApprove = blockers.length === 0;
  useEffect(() => { setNote(q?.review?.note ?? ''); setAckKey(''); setError(''); setHintOpen(false); }, [q?.id, q?.review?.updatedAt]);
  // Soal baru dibaca dari awal: area gulir (tengah di layar lebar, kolom kanan di layar menengah) kembali ke atas.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; if (mainRef.current) mainRef.current.scrollTop = 0; }, [q?.id]);
  const review = (state: ReviewStatus) => {
    if (!q) return false;
    try { onChange(setReview(q, state, note, reviewer), 'Soal ' + q.no + ': ' + STATUS_LABELS[state]); return true; } catch (e) { setError(e instanceof Error ? e.message : 'Persetujuan gagal.'); return false; }
  };
  // Prev/next di bawah kartu mengikuti urutan paket. J/K mengikuti hasil filter; bila soal aktif di luar filter, yang dipilih soal terdekat sesudah/sebelum nomornya.
  const navigate = (offset: number) => { const next = q && pack.questions[(position.get(q.id) ?? 0) + offset]; if (next) setSelected(next.id); };
  const neighbor = (direction: 1 | -1) => {
    if (!q) return undefined;
    const at = position.get(q.id) ?? 0;
    return direction > 0 ? filtered.find((item) => (position.get(item.id) ?? 0) > at) : [...filtered].reverse().find((item) => (position.get(item.id) ?? 0) < at);
  };
  const step = (direction: 1 | -1) => { const next = neighbor(direction); if (next) setSelected(next.id); };
  useReviewShortcuts({
    next: () => step(1), prev: () => step(-1),
    approve: () => {
      if (!q) return;
      if (!canApprove) { setHintOpen(true); (!ack ? ackRef : !reviewer.trim() ? reviewerRef : null)?.current?.focus(); return; }
      const next = neighbor(1); // dicari sebelum status berubah supaya filter "Draf" tidak menggeser acuan
      if (review('approved') && next) setSelected(next.id);
    },
    // R pada soal yang sudah "Perlu revisi" tanpa catatan baru tidak menulis versi lagi; cukup fokus ke catatan.
    revise: () => { if ((q?.review?.status === 'revision' && note === (q.review.note ?? '')) || review('revision')) noteRef.current?.focus(); },
  });
  if (!q) return null;
  const mapped = settings?.profile === 'tryout-2027' ? profileCoverage(pack.questions, settings) : [];
  // Dipanggil langsung dari klik tombol gambar supaya izin clipboard dari klik tetap berlaku.
  const copyImage = (target: 'stimulus' | number) => {
    copyQuestionImage(q, target).then(() => notify({ kind: 'ok', text: 'Tersalin: gambar ' + (target === 'stimulus' ? 'soal ' : 'opsi ' + String.fromCharCode(65 + target) + ' soal ') + q.no + ' sebagai PNG.' }))
      .catch((e) => notify({ kind: 'error', text: e instanceof Error ? e.message : 'Gambar gagal disalin.' }));
  };
  const toggleExcluded = () => onChange({ ...q, review: { ...q.review!, excluded: !q.review?.excluded, status: 'draft', reviewer: undefined, reviewedAt: undefined, updatedAt: new Date().toISOString() } }, 'Soal ' + q.no + (q.review?.excluded ? ' dikembalikan' : ' dikeluarkan'));
  return <div className="review-workspace">
    <div className="review-strip" role="group" aria-label="Ringkasan kurasi">
      <div><strong>{summary.approved}<span> / {summary.included}</span></strong><span>Soal disetujui</span></div><div><strong>{summary.revision}</strong><span>Perlu revisi</span></div><div><strong>{summary.flagged}</strong><span>Perlu perhatian mutu</span></div><div><strong>{summary.verified}</strong><span>Memiliki solver</span></div><div><strong>{summary.excluded}</strong><span>Dikeluarkan</span></div>
    </div>
    <div className="review-stage">
      <ReviewQueue total={pack.questions.length} items={filtered} activeId={q.id} marks={marks} pick={pick} picked={picked} onSelect={setSelected}
        onTogglePick={(id) => { setPicked(togglePick(picked, id)); setSelected(id); }} search={search} onSearch={setSearch} subtest={subtest} onSubtest={setSubtest} status={status} onStatus={setStatus}/>
      <div className="review-main" ref={mainRef}>
        <section className="review-center" aria-label="Soal yang ditelaah">
          <div className="review-toolbar">
            <div className="review-toolbar-row">
              <span className={'status-badge ' + (q.review?.excluded ? 'excluded' : q.review?.status)}>{q.review?.excluded ? 'Dikeluarkan' : STATUS_LABELS[q.review?.status ?? 'draft']}</span><span className="muted">Revisi {q.review?.revision ?? 1}</span>
              <div className="mode-toggle" role="group" aria-label="Mode tampilan soal"><button type="button" aria-pressed={!participantView} onClick={() => setParticipantView(false)}>Penelaah</button><button type="button" aria-pressed={participantView} onClick={() => setParticipantView(true)}>Tampilan peserta</button></div>
              <label className="check-row"><input type="checkbox" checked={showAnswers && !participantView} disabled={participantView} onChange={(e) => setShowAnswers(e.target.checked)}/><span>Tampilkan pembahasan</span></label>
              <div className="review-toolbar-actions"><button className="secondary-button" onClick={() => setEditing(true)}><Icon name="file" size={16}/>Sunting soal</button><button className="secondary-button" onClick={() => onReplace(q)}><Icon name="refresh" size={16}/>Ganti soal</button><button className="text-button danger" onClick={toggleExcluded}>{q.review?.excluded ? 'Kembalikan ke paket' : 'Keluarkan dari paket'}</button></div>
            </div>
            <TakePanel question={q} pack={pack} title={title} visible={filtered} pick={pick} onPick={setPick} picked={picked} onPicked={setPicked} notify={notify}/>
          </div>
          <div className="review-center-scroll" ref={scrollRef}>
            <div className="review-card-wrap"><QuestionCard key={q.id + ':' + showAnswers + ':' + participantView} question={q} showAnswers={showAnswers && !participantView} hideExplanation={participantView} onCopyImage={copyImage}/></div>
            <details className="panel coverage"><summary>Komposisi aktual setelah kurasi<Icon name="chevron"/></summary><p className="help">Mengeluarkan soal atau mengubah kesulitannya dapat mengubah blueprint. Bandingkan kuota rencana dengan jumlah aktif dan disetujui sebelum ekspor.</p><div className="table-scroll"><table><thead><tr><th>Materi</th><th>Tingkat</th><th>Rencana</th><th>Aktif</th><th>Disetujui</th></tr></thead><tbody>{coverage.map((row) => <tr key={row.subtest + row.topic + row.difficulty}><td>{row.subtest} · {row.topic}</td><td>{LABELS[row.difficulty]}</td><td>{blueprint?.find((r) => r.subtest === row.subtest && r.topic === row.topic && r.difficulty === row.difficulty)?.count ?? '—'}</td><td>{pack.questions.filter((item) => item.subtest === row.subtest && item.topic === row.topic && item.difficulty === row.difficulty && !item.review?.excluded).length}</td><td>{pack.questions.filter((item) => item.subtest === row.subtest && item.topic === row.topic && item.difficulty === row.difficulty && !item.review?.excluded && item.review?.status === 'approved').length}</td></tr>)}</tbody></table></div></details>
            {!!mapped.length && <details className="panel coverage mapping-coverage" open><summary>Kesesuaian mapping tryout 2027<Icon name="chevron"/></summary><p className="help">Kuota mengikuti chapter. Periksa selisih setelah mengeluarkan atau menyunting soal.</p><div className="table-scroll"><table><thead><tr><th>Chapter</th><th>Rencana</th><th>Aktif</th><th>Disetujui</th></tr></thead><tbody>{mapped.map((row) => <tr key={row.id}><td><small>{row.subtest} · {row.lesson}</small>{row.chapter}</td><td>{row.count}</td><td className={row.included !== row.count ? 'coverage-gap' : ''}>{row.included}</td><td>{row.approved}</td></tr>)}</tbody></table></div></details>}
          </div>
          <div className="review-prevnext"><button className="text-button" disabled={q.no === 1} onClick={() => navigate(-1)}>← Soal sebelumnya</button><span><b>{q.no}</b> / {pack.questions.length}</span><button className="text-button" disabled={q.no === pack.questions.length} onClick={() => navigate(1)}>Soal berikutnya →</button></div>
        </section>
        <aside className="quality-panel" aria-label="Mutu dan keputusan">
          <div className="decision-body">
            <section className="decision-section"><h2 className="decision-label">Mutu</h2>
              <div className="quality-list">{issues.map((issue, i) => <div key={i} className={'quality-item ' + issue.level}><Icon name={issue.level === 'error' ? 'close' : issue.level === 'warning' ? 'guide' : 'check'} size={16}/><p>{issue.text}</p></div>)}{!issues.some((i) => i.level === 'error') && <div className="quality-item passed"><Icon name="check" size={16}/><p>Struktur dan skor lolos pemeriksaan.</p></div>}</div>
              <div className="difficulty-note"><strong>{LABELS[q.difficulty]}{q.bloom ? ' · Bloom ' + q.bloom : ''}</strong><p>{q.difficultyReason}</p></div>
              {q.rubric && <details className="rubric" open><summary>Rubrik keputusan TKP<Icon name="chevron"/></summary><dl>{Object.entries(q.rubric).map(([key, value]) => <div key={key}><dt>{{ authority: 'Kewenangan', urgency: 'Urgensi', efficacy: 'Efektivitas', risk: 'Risiko', followUp: 'Tindak lanjut' }[key]}</dt><dd>{value}</dd></div>)}</dl></details>}
              <p className="source-note">{q.source}</p>
            </section>
            <section className="decision-section"><h2 className="decision-label">Keputusan</h2>
              <label className="field">Nama penelaah<input ref={reviewerRef} value={reviewer} maxLength={100} placeholder="Nama penanggung jawab kurasi" onChange={(e) => onReviewer(e.target.value)}/></label>
              <label className="field">Catatan pemeriksaan<textarea ref={noteRef} rows={3} value={note} maxLength={3000} onChange={(e) => setNote(e.target.value)} placeholder="Ketepatan kunci, mutu pengecoh, dan bagian yang perlu direvisi…"/></label>
              <label className="check-row acknowledgement"><input ref={ackRef} type="checkbox" checked={ack} onChange={(e) => setAckKey(e.target.checked ? reviewKey : '')}/><span>Saya telah memeriksa stimulus, semua pilihan, kunci, dan pembahasan soal ini.</span></label>
            </section>
          </div>
          <div className="decision-actions">
            {q.review?.reviewer && <p className="help">Disetujui oleh {q.review.reviewer} pada {new Date(q.review.reviewedAt!).toLocaleString('id-ID')}.</p>}
            {hintOpen && !canApprove && <p className="decision-hint" role="status">Belum bisa disetujui: {blockers.join('; ')}.</p>}
            {error && <p className="error-message" role="alert">{error}</p>}
            <button className="primary-button full-width" aria-keyshortcuts="A" disabled={!canApprove} onClick={() => review('approved')}><Icon name="check"/>Setujui soal</button>
            <button className="secondary-button full-width" aria-keyshortcuts="R" onClick={() => review('revision')}>Tandai perlu revisi</button>
            <button className="text-button" onClick={() => review('draft')}>Simpan catatan sebagai draf</button>
            <p className="shortcut-hint"><kbd>J</kbd><kbd>K</kbd> pindah · <kbd>A</kbd> setujui · <kbd>R</kbd> revisi</p>
          </div>
        </aside>
      </div>
    </div>
    {editing && <QuestionEditor question={q} onClose={() => setEditing(false)} onSave={(updated) => { onChange(updated, 'Revisi konten soal ' + q.no); setEditing(false); }}/>}<Toast toast={toast} onClose={() => notify(null)}/>
  </div>;
}
