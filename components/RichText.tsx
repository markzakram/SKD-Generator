import { mathHtml } from '@/lib/math';
import { richHtml } from '@/lib/richtext';

// Seperti MathText, ditambah penanda format sebaris pada teks pembahasan: **tebal** dan ~~coret~~ (lib/richtext.ts). Teks tanpa penanda tampil persis seperti MathText.
export default function RichText({ children, bold = false }: { children: string; bold?: boolean }) {
  return <span className="math-text" dangerouslySetInnerHTML={{ __html: richHtml(children, (text, style) => mathHtml(text, { ...style, bold: bold || style?.bold })) }}/>;
}
