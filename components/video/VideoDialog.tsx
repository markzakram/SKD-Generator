'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { download, fileSlug } from '@/lib/export';
import { prepareVideoSlides, releaseVideoSlides } from '@/lib/video-assets';
import { VIDEO, STAGE_LABEL, videoQuestions, videoTiming, videoTime, type VideoPace, type VideoScope, type VideoSlide } from '@/lib/video-plan';
import type { Package, Question } from '@/lib/types';
import ExplanationVideo from './ExplanationVideo';
import Icon from '../Icon';

export default function VideoDialog({ pack, question, picked, title, onClose }: {
  pack: Package; question: Question; picked: ReadonlySet<string>; title: string; onClose: () => void;
}) {
  const [scope, setScope] = useState<VideoScope>('current'), [pace, setPace] = useState<VideoPace>('normal'), [think, setThink] = useState(5);
  const [slides, setSlides] = useState<VideoSlide[]>([]), [busy, setBusy] = useState<'prepare' | 'render' | ''>('');
  const [progress, setProgress] = useState(0), [status, setStatus] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [supported, setSupported] = useState<boolean | null>(null), [supportNote, setSupportNote] = useState('Memeriksa dukungan MP4…');
  const dialog = useRef<HTMLDialogElement>(null), player = useRef<PlayerRef>(null), controller = useRef<AbortController | null>(null);
  const assets = useRef<VideoSlide[]>([]), alive = useRef(true), lock = useRef(false), finished = useRef<Blob | null>(null);
  const questions = videoQuestions(pack.questions, question.id, picked, scope);
  const project = useMemo(() => videoTiming(slides, pace, think), [slides, pace, think]);
  const chapters = project.slides.filter((s, i, all) => !i || all[i - 1].questionId !== s.questionId);
  const selectedCount = videoQuestions(pack.questions, question.id, picked, 'selected').length;
  const activeCount = videoQuestions(pack.questions, question.id, picked, 'package').length;
  const filename = `${fileSlug(title)}-${fileSlug(pack.id)}-${scope === 'package' ? 'paket' : questions.length === 1 ? 'soal-' + questions[0].no : 'terpilih-' + questions.length}-pembahasan.mp4`;

  useEffect(() => {
    alive.current = true;
    const element = dialog.current, trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = 'hidden';
    let checking = true;
    import('@remotion/web-renderer').then(({ canRenderMediaOnWeb }) => canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width: VIDEO.width, height: VIDEO.height, muted: true }))
      .then(result => { if (checking) { setSupported(result.canRender); setSupportNote(result.canRender ? '' : 'Browser ini belum mendukung pembuatan MP4. Gunakan Chrome atau Edge terbaru di komputer. Pratinjau tetap dapat digunakan.'); } })
      .catch(() => { if (checking) { setSupported(false); setSupportNote('Dukungan MP4 tidak dapat diperiksa. Coba buka kembali melalui Chrome atau Edge terbaru.'); } });
    return () => {
      checking = false; alive.current = false; controller.current?.abort(); releaseVideoSlides(assets.current); assets.current = []; finished.current = null;
      element?.close(); document.body.style.overflow = overflow; requestAnimationFrame(() => trigger?.focus());
    };
  }, []);
  const clearResult = () => { finished.current = null; setSuccess(''); setError(''); };
  const resetPlayback = () => { player.current?.pause(); player.current?.seekTo(0); clearResult(); };
  const changeScope = (next: VideoScope) => {
    player.current?.pause(); releaseVideoSlides(assets.current); assets.current = []; setSlides([]); setScope(next); clearResult(); setStatus('');
  };
  const run = async (kind: 'prepare' | 'render', job: (signal: AbortSignal) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; controller.current = new AbortController(); const signal = controller.current.signal;
    setBusy(kind); setProgress(0); setError(''); setSuccess(''); player.current?.pause();
    try { await job(signal); }
    catch (e) { if (alive.current) { if (signal.aborted) setStatus('Dibatalkan. Anda dapat mencoba lagi.'); else { setError(e instanceof Error ? e.message : 'Video gagal dibuat. Coba beberapa soal terlebih dahulu.'); setStatus(''); } } }
    finally { lock.current = false; if (alive.current) setBusy(''); }
  };
  const prepare = () => run('prepare', async signal => {
    releaseVideoSlides(assets.current); assets.current = []; setSlides([]); finished.current = null;
    const made = await prepareVideoSlides(questions, signal, (done, total, count) => {
      if (alive.current) { setProgress(done / total); setStatus(`Menyiapkan soal ${Math.min(done + 1, total)} dari ${total} · ${count} layar`); }
    });
    if (!alive.current || signal.aborted) { releaseVideoSlides(made); signal.throwIfAborted(); return; }
    assets.current = made; setSlides(made); setStatus('Pratinjau siap. Periksa alur video, lalu unduh MP4.');
  });
  const render = () => {
    if (!project.slides.length || !supported) return;
    if (finished.current) { download(finished.current, filename); return; }
    return run('render', async signal => {
      setStatus('Memulai pembuatan MP4…');
      const { renderMediaOnWeb } = await import('@remotion/web-renderer'); signal.throwIfAborted();
      let lastUpdate = 0;
      const result = await renderMediaOnWeb({
        composition: { component: ExplanationVideo, id: 'SKD-Pembahasan', width: VIDEO.width, height: VIDEO.height,
          fps: VIDEO.fps, durationInFrames: project.durationInFrames, defaultProps: { project } },
        inputProps: { project }, container: 'mp4', videoCodec: 'h264', muted: true, videoBitrate: 'medium',
        signal, pageResponsiveness: 'high', isProduction: process.env.NODE_ENV === 'production',
        // Do not claim free-license eligibility for the user's organization. An optional purchased key can be configured at deployment.
        licenseKey: process.env.NEXT_PUBLIC_REMOTION_LICENSE_KEY || null,
        onProgress: ({ progress: value }) => {
          if (!alive.current || (performance.now() - lastUpdate < 250 && value < 1)) return;
          lastUpdate = performance.now(); setProgress(value); setStatus(`Membuat MP4 · ${Math.round(value * 100)}%`);
        },
      });
      signal.throwIfAborted(); const blob = await result.getBlob(); signal.throwIfAborted();
      if (!alive.current) return;
      finished.current = blob; download(blob, filename); setStatus('');
      setSuccess(`MP4 siap diunduh · ${questions.length} soal · ${videoTime(project.durationInFrames / VIDEO.fps)} · ${(blob.size / 1024 / 1024).toFixed(1)} MB. Periksa unduhan browser Anda.`);
    });
  };
  return <dialog ref={dialog} className="video-dialog" aria-labelledby="video-heading" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="video-heading"><div><span className="eyebrow">VIDEO OPSIONAL</span><h2 id="video-heading">Video pembahasan</h2><p>Visual bertahap tanpa suara. Satu MP4 untuk soal yang Anda pilih.</p></div>
      <button className="icon-button" aria-label="Tutup video pembahasan" onClick={onClose}><Icon name="close"/></button></div>
    <div className="video-body">
      <div className="video-settings">
        <fieldset disabled={!!busy}><legend className="sr-only">Pengaturan video</legend>
          <label className="field">Soal dalam video<select value={scope} onChange={e => changeScope(e.target.value as VideoScope)}>
            <option value="current" disabled={!!question.review?.excluded}>Soal ini · nomor {question.no}</option>
            <option value="selected" disabled={!selectedCount}>Soal terpilih · {selectedCount} soal</option>
            <option value="package" disabled={!activeCount}>Seluruh paket · {activeCount} soal</option>
          </select></label>
          <p className="help">Untuk beberapa nomor, tutup dialog lalu aktifkan “Pilih beberapa soal” di daftar soal. Soal yang dikeluarkan dilewati.</p>
          <label className="field">Tempo membaca<select value={pace} onChange={e => { resetPlayback(); setPace(e.target.value as VideoPace); }}>
            <option value="slow">Pelan</option><option value="normal">Normal</option><option value="fast">Cepat</option>
          </select></label>
          <label className="field">Jeda sebelum jawaban<select value={think} onChange={e => { resetPlayback(); setThink(Number(e.target.value)); }}>
            <option value={0}>Tanpa jeda tambahan</option><option value={5}>5 detik</option><option value={10}>10 detik</option><option value={15}>15 detik</option>
          </select></label>
        </fieldset>
        <div className="video-specs"><span>MP4 · 720p</span><span>16:9 · 24 fps</span><span>Tanpa suara</span></div>
        <button className="secondary-button" disabled={!!busy || !questions.length} onClick={prepare}><Icon name="video"/>{slides.length ? 'Siapkan ulang pratinjau' : 'Siapkan pratinjau'}</button>
        <p className="help">Durasi menyesuaikan panjang isi. Soal → pilihan → jawaban → pembahasan. Poin A–E ikut ditampilkan untuk TKP.</p>
      </div>
      <div className="video-preview">
        {project.slides.length ? <>
          <Player ref={player} component={ExplanationVideo} inputProps={{ project }} durationInFrames={project.durationInFrames} fps={VIDEO.fps}
            compositionWidth={VIDEO.width} compositionHeight={VIDEO.height} style={{ width: '100%' }} controls={!busy} showVolumeControls={false} initiallyMuted
            clickToPlay={!busy} spaceKeyToPlayOrPause={!busy} aria-label="Pratinjau video pembahasan"/>
          <div className="video-totals"><strong>{project.questionCount} soal · {project.slides.length} layar</strong><span>Durasi {videoTime(project.durationInFrames / VIDEO.fps)}</span></div>
          <label className="field">Lompat ke soal<select disabled={!!busy} defaultValue="" onChange={e => { player.current?.seekTo(Number(e.target.value)); player.current?.pause(); }}>
            <option value="" disabled>Pilih nomor soal</option>{chapters.map(s => <option key={s.questionId} value={s.from}>Soal {s.questionNo} · {s.subtest} · {videoTime(s.from / VIDEO.fps)}</option>)}
          </select></label>
          <label className="field">Lihat tahap pembahasan<select disabled={!!busy} defaultValue="" onChange={e => { player.current?.seekTo(Number(e.target.value)); player.current?.pause(); }}>
            <option value="" disabled>Pilih layar</option>{project.slides.map((s, i) => <option key={i} value={s.from + 10}>Soal {s.questionNo} · {STAGE_LABEL[s.stage]} · {s.page}/{s.pages}</option>)}
          </select></label>
        </> : <div className="video-empty"><Icon name="video" size={40}/><h3>Dari soal menjadi video</h3><p>Pilih cakupan lalu siapkan pratinjau. Rumus dan gambar tetap terbaca, pembahasan panjang dibagi menjadi beberapa layar.</p><span>TWK · TIU · TKP</span></div>}
      </div>
    </div>
    <div className="video-footer">
      {status && <p className="video-status" role="status">{status}</p>}
      {busy && <progress value={progress} max={1} aria-label={busy === 'prepare' ? 'Persiapan video' : 'Pembuatan MP4'}/>}
      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="export-success" role="status">{success}</p>}
      {supportNote && <p className="help">{supportNote}</p>}
      <div className="video-actions"><p className="help">Video dibuat di perangkat Anda, tanpa API AI. Biarkan tab ini terbuka selama proses. Paket lengkap dapat membutuhkan waktu lebih lama.</p>
        {busy ? <button className="secondary-button" onClick={() => controller.current?.abort()}>Batalkan proses</button> : <button className="primary-button" disabled={!slides.length || !supported} onClick={render}><Icon name="download"/>{finished.current ? 'Unduh ulang MP4' : 'Unduh MP4'}</button>}
      </div>
      <details className="video-about"><summary>Tentang Remotion & privasi</summary><p>Isi soal dan video diproses di browser. Remotion mengirim telemetri lisensi (IP, domain, jenis dan status render), tanpa isi video. Penggunaan organisasi mengikuti <a href="https://www.remotion.pro/license" target="_blank" rel="noreferrer">lisensi Remotion</a>. <a href="https://www.remotion.dev/docs/telemetry" target="_blank" rel="noreferrer">Informasi telemetri</a>.</p></details>
    </div>
  </dialog>;
}
