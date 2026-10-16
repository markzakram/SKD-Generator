type Name = 'grid' | 'book' | 'guide' | 'arrow' | 'download' | 'refresh' | 'check' | 'chevron' | 'search' | 'close' | 'sliders' | 'clock' | 'spark' | 'file' | 'copy' | 'image';
const paths: Record<Name, React.ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  book: <><path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3Z"/><path d="M12 6v15"/></>,
  guide: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01"/></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></>,
  refresh: <><path d="M20 8a8 8 0 1 0 .2 7M20 3v5h-5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  sliders: <><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>,
  file: <><path d="M5 3h9l5 5v13H5Z"/><path d="M14 3v6h5M8 13h8M8 17h5"/></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/></>,
};
export default function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
