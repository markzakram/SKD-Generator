import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';
import './controls.css';
import './export.css';
import './seed.css';
import './video.css';

// Keduanya font variabel, jadi bobot tidak perlu dituliskan. Variabelnya dipasang di <html> agar :root bisa memakainya
// (--font-display dan --font-body di globals.css).
const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-manrope' });
const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: 'SKD Studio — Generator Soal JadiASN',
  description: 'Susun paket TWK, TIU, dan TKP, tinjau pembahasannya, dan ekspor naskah untuk latihan CPNS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={manrope.variable + ' ' + dmSans.variable}><body>{children}</body></html>;
}
