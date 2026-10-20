import { useEffect, useRef } from 'react';

type Actions = { next: () => void; prev: () => void; approve: () => void; revise: () => void };

// Pintasan papan ketik Ruang kurasi: J soal berikutnya, K sebelumnya, A setujui, R tandai perlu revisi.
// Handler terbaru disimpan di ref supaya listener window cukup dipasang sekali tanpa closure basi.
export default function useReviewShortcuts(actions: Actions) {
  const latest = useRef(actions);
  useEffect(() => { latest.current = actions; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;
      // Checkbox dan radio tidak menerima huruf, jadi A tetap jalan setelah "Saya telah memeriksa" dicentang.
      if (target?.closest('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (key === 'j') latest.current.next();
      else if (key === 'k') latest.current.prev();
      else if (key === 'a' && !e.repeat) latest.current.approve();
      else if (key === 'r' && !e.repeat) latest.current.revise();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
