import { Fragment } from 'react';
import Icon from './Icon';

export type TopBarProps = {
  crumb: string[];                          // segmen setelah "Workspace", mis. ['Ruang kurasi'] atau ['Evaluasi peserta', 'Sesi pengerjaan']
  detail?: string;                          // nama workspace dan versinya; disembunyikan di layar sempit
  showPackage: boolean;                     // pemilih paket, progres, dan tombol hanya di Ruang kurasi dan Evaluasi peserta
  packages: { id: string }[];
  active: number;
  onActive: (index: number) => void;
  approved: number;
  included: number;
  onBackup: () => void;
  onExport: () => void;
  saved: string;
};

// Bilah atas 52 px: lokasi, pemilih paket dengan progres persetujuan, aksi paket, dan status simpan.
export default function TopBar({ crumb, detail, showPackage, packages, active, onActive, approved, included, onBackup, onExport, saved }: TopBarProps) {
  return <header className="topbar">
    <nav className="breadcrumb" aria-label="Lokasi">
      <span>Workspace</span>
      {crumb.map((item) => <Fragment key={item}><span className="crumb-sep" aria-hidden="true">/</span><span className="crumb-current">{item}</span></Fragment>)}
      {detail && <><span className="crumb-sep crumb-detail-sep" aria-hidden="true">/</span><span className="crumb-current crumb-detail" title={detail}>{detail}</span></>}
    </nav>
    {showPackage && <div className="topbar-package">
      <label className="topbar-select"><span>Paket</span><select aria-label="Paket aktif" value={active} onChange={(e) => onActive(Number(e.target.value))}>{packages.map((p, i) => <option key={p.id} value={i}>{p.id}</option>)}</select></label>
      <span className="topbar-progress"><b>{approved}/{included}</b> disetujui</span>
      <span className="approval-track topbar-track" role="img" aria-label={'Progres persetujuan ' + (included ? Math.round(approved / included * 100) : 0) + ' persen'}><span style={{ width: (included ? approved / included * 100 : 0) + '%' }}/></span>
    </div>}
    {showPackage && <div className="topbar-actions">
      <button className="secondary-button" onClick={onBackup}><Icon name="download" size={16}/>Cadangan</button>
      <button className="primary-button" onClick={onExport}><Icon name="file" size={16}/>Ekspor paket</button>
    </div>}
    <div className="save-status" role="status"><span className={saved.startsWith('Tersimpan') ? 'online-dot' : 'pending-dot'}/>{saved}</div>
  </header>;
}
