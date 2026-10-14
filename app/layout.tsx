import type { Metadata } from 'next';
import './globals.css';
import './controls.css';

export const metadata: Metadata = {
  title: 'SKD Studio — Generator Soal JadiASN',
  description: 'Susun paket TWK, TIU, dan TKP, tinjau pembahasannya, dan ekspor naskah untuk latihan CPNS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
