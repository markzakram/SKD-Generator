import type { ExportFormat, Package } from '@/lib/types';
import Icon from './Icon';

export default function ExportPanel({ pack, seed, onExport, onCompare }: { pack: Package; seed: string; onExport: (format: ExportFormat) => void; onCompare: () => void }) {
  return <section className="export-panel" aria-label="Unduh paket">
    <div className="export-panel-title"><strong>Unduh paket</strong><span>{pack.id} · seed {seed}</span><button className="text-button seed-compare-link" onClick={onCompare}>Bandingkan seed ini</button></div>
    <div className="export-panel-actions">
      <button className="export-shortcut" onClick={() => onExport('pdf')}><Icon name="file"/><span><strong>PDF</strong><small>Naskah cetak & pembahasan</small></span><Icon name="download" size={16}/></button>
      <button className="export-shortcut" onClick={() => onExport('siadu')}><Icon name="book"/><span><strong>Word SiAdu</strong><small>Satu DOCX atau ZIP per subtes</small></span><Icon name="download" size={16}/></button>
      <button className="text-button" onClick={() => onExport('docx')}>Format lainnya</button>
    </div>
  </section>;
}
