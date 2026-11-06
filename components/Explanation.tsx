import { diagramResult } from '@/lib/diagram';
import { parseExplanation } from '@/lib/explanation';
import { tableGrid } from '@/lib/table';
import RichText from './RichText';

// Pembahasan: blok terstruktur (sub-judul, daftar, tabel, persamaan) bila ada penandanya, selain itu satu paragraf seperti semula.
export default function Explanation({ text }: { text: string }) {
  const blocks = parseExplanation(text);
  if (!blocks) return <p className="explanation-text"><RichText>{text}</RichText></p>;
  return <div className="explanation-steps">{blocks.map((block, index) => {
    switch (block.k) {
      case 'gap': return <div key={index} className="explanation-gap" aria-hidden="true"/>;
      case 'heading': return <p key={index} className="explanation-heading">{block.text}</p>;
      case 'p': return <p key={index} className="explanation-line"><RichText>{block.text}</RichText></p>;
      case 'math': return <div key={index} className={'explanation-eq' + (block.text.includes('aligned') ? ' is-aligned' : '')}><RichText>{block.text}</RichText></div>;
      case 'box': return <div key={index} className="explanation-box">{block.lines.map((line, i) => <p key={i} className={line.startsWith('•') ? 'is-bullet' : undefined}><RichText>{line}</RichText></p>)}</div>;
      case 'chain': case 'figure': case 'graph': case 'guide': {
        // Diagram yang tidak dapat digambar (mis. bentuk figural tidak dikenal pada pembahasan hasil suntingan) menampilkan pesan, bukan membuat halaman gagal.
        const made = diagramResult(block);
        return 'error' in made ? <p key={index} className="explanation-line error-message" role="alert">Diagram tidak dapat digambar: {made.error}. Periksa baris diagram (@deret, @gambar, atau @graf) pada pembahasan.</p>
          : <div key={index} className={block.k === 'chain' ? 'explanation-chain' : 'explanation-chain explanation-' + block.k} dangerouslySetInnerHTML={{ __html: made.svg }}/>;
      }
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul';
        return <List key={index} className="explanation-list" start={block.ordered ? block.start : undefined}>{block.items.map((item, i) => <li key={i}><RichText>{item}</RichText></li>)}</List>;
      }
      case 'table': {
        const grid = tableGrid(block);
        return <div key={index} className="table-scroll"><table className={'explanation-table' + (grid.centered ? ' is-centered' : '')}>
          {grid.header && <thead><tr>{grid.header.map((cell, i) => <th key={i} colSpan={cell.span}><RichText bold>{cell.text}</RichText></th>)}</tr></thead>}
          <tbody>{grid.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} className={cell.mark ? 'is-marked' : undefined}><RichText bold={cell.mark}>{cell.text}</RichText></td>)}</tr>)}</tbody>
        </table></div>;
      }
    }
  })}</div>;
}
