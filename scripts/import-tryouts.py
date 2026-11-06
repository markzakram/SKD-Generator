"""Reproducible import with source locations, explicit duplicates, and no inferred keys."""
import json, re, collections, statistics, hashlib
from pathlib import Path

ROOT = Path('references/tryouts-2027')
REPORT = {'files': [], 'duplicates': [], 'issues': [], 'corrections': []}
def norm(s): return re.sub(r'\W+', ' ', s.lower()).strip()
# Revisi akademik TWK (tahap 2): tip contoh tryout TWK. Tip lama mengajarkan rumus jawaban ("Apabila soal menyebut X, maka jawabannya mengarah ke Y");
# penggantinya petunjuk membaca soal. Nilai: (kelompok, tip baru); tip baru None = tip dihapus (butir tidak lagi punya tip). Dicatat di REPORT['corrections'].
TIP_REVISI = {
    "tryout-ref-03-01": ("utama", "Bedakan isi tuntutan daerah dari cara memperjuangkannya, lalu nilai tiap pilihan dari dampaknya terhadap persatuan."),
    "tryout-ref-03-02": ("utama", "Tentukan dahulu masalah inti yang dihadapi ASN, lalu nilai apakah tiap sikap menjawab masalah itu atau hanya menanggapi emosi publik."),
    "tryout-ref-03-04": ("utama", "Cari dasar ikatan antarwarga dalam kasus, apakah asal-usul, budaya, atau kedudukan dan partisipasi sebagai warga negara, lalu cocokkan dengan pengertian tiap bentuk nasionalisme."),
    "tryout-ref-03-05": ("utama", "Bandingkan kedua organisasi pada ciri yang diminta soal, yaitu siapa anggotanya dan seberapa luas jangkauannya, lalu singkirkan pilihan yang justru ciri organisasi pembanding."),
    "tryout-ref-03-06": ("utama", "Baca makna keputusan itu dari apa yang dilepaskan dan apa yang dipertahankan para pemimpin daerah, lalu pilih penafsiran yang tidak melampaui fakta dalam teks."),
    "tryout-ref-03-07": ("utama", "Tentukan apa yang sedang dipertahankan tokoh dalam kasus, lalu cocokkan dengan pengertian tiap nilai dasar bela negara dan bedakan nilai yang mirip dari objek yang dibela."),
    "tryout-ref-03-08": ("utama", "Cari akar masalah dalam kasus lebih dahulu, lalu pilih program yang langsung mengatasi akar itu sesuai bidang tugas ASN, bukan program yang hanya simbolis atau administratif."),
    "tryout-ref-03-11": ("utama", None),
    "tryout-ref-03-12": ("utama", "Telusuri akibat langsung dari ketergantungan dalam kasus, lalu tentukan gatra yang kemampuan dasarnya paling terguncang, bukan gatra yang hanya terdampak tidak langsung."),
    "tryout-ref-03-13": ("utama", "Pisahkan perilaku yang berkaitan dengan gaya hidup dari perilaku yang berkaitan dengan kerja atau kejujuran, lalu cocokkan dengan pengertian tiap nilai antikorupsi."),
    "tryout-ref-03-15": ("utama", "Tentukan siapa yang berinisiatif, apakah ada ancaman atau paksaan, dan apakah penerima memanfaatkan kewenangan jabatan; unsur-unsur itu membedakan jenis tindak pidana korupsi yang berdekatan."),
    "tryout-ref-03-16": ("utama", "Bandingkan isi dokumen yang diminta ditandatangani dengan fakta di lapangan, lalu pilih tindakan yang tidak mengesahkan data yang tidak sesuai meskipun ada tekanan atau janji perbaikan."),
    "tryout-ref-03-17": ("utama", "Cari risiko yang secara sadar ditanggung tokoh dan hubungannya dengan tindakannya, lalu bedakan dari nilai lain yang tampak dalam narasi tetapi bukan fokus pertanyaan."),
    "tryout-ref-03-19": ("utama", "Hubungkan peristiwa sejarah dalam soal dengan fungsi Pancasila yang paling langsung dijelaskan oleh fakta itu, lalu bedakan fungsi yang berdekatan satu per satu."),
    "tryout-ref-03-20": ("utama", "Periksa setiap pernyataan sejarah terhadap tahapan perumusan dan pengesahan, lalu cocokkan pernyataan yang benar dengan kombinasi nomor yang ditawarkan."),
    "tryout-ref-03-21": ("utama", "Ubah butir pengamalan dalam soal menjadi perilaku konkret, lalu cari tindakan yang benar-benar menjalankan butir itu, bukan tindakan baik lain yang bersumber dari sila yang berbeda."),
    "tryout-ref-03-22": ("utama", "Pastikan lebih dahulu pihak yang diikat oleh ketentuan pasal itu, lalu uji alasan yang ditawarkan setiap pilihan terhadap bunyi ketentuannya."),
    "tryout-ref-03-23": ("utama", "Telusuri tahapan Perppu menurut Pasal 22 beserta akibat hukum pada tiap tahap, lalu uji setiap pilihan terhadap akibat hukum ketika persetujuan DPR tidak diberikan."),
    "tryout-ref-03-24": ("utama", "Bandingkan cara pandang peserta forum terhadap laut dengan cara pandang Wawasan Nusantara, lalu periksa apakah tiap pilihan menilai pendapat itu dengan dasar yang benar."),
    "tryout-ref-03-25": ("utama", "Tentukan kalimat yang cakupannya paling luas dan didukung oleh kalimat lain, lalu singkirkan pilihan yang hanya merangkum satu kalimat penjelas atau menambah klaim di luar teks."),
    "tryout-ref-03-26": ("utama", "Periksa kebakuan setiap kata pada tiap kalimat berdasarkan KBBI V, tandai kalimat yang memuat bentuk tidak baku, lalu cocokkan dengan kombinasi nomor pada pilihan."),
    "tryout-ref-03-27": ("utama", "Periksa tiap kalimat terhadap kaidah tanda baca EYD V, terutama pada awal kalimat, di antara klausa, dan pada perincian, lalu tentukan kalimat yang melanggar kaidah."),
    "tryout-ref-03-29": ("utama", "Uji setiap kalimat dengan kaidah titik, koma, dan titik dua dalam EYD V, tandai kalimat yang benar, lalu cocokkan dengan kombinasi nomor pada pilihan."),
    "tryout-ref-03-30": ("utama", "Periksa kesejajaran bentuk unsur perincian dan kehematan kata, lalu pastikan perbaikan yang dipilih tidak menimbulkan kesalahan baru di bagian lain kalimat."),
    "tryout-ref-05-01": ("tambahan", "Tanyakan kemampuan apa yang dicapai warga dalam kasus, lalu bandingkan dengan pengertian tiap unsur nasionalisme, termasuk unsur yang tampak mirip."),
    "tryout-ref-05-03": ("tambahan", "Kaitkan peristiwa dengan tujuan yang hendak dicapai pihak Indonesia dan klaim yang hendak dibantah pihak lawan, lalu pilih makna yang menjelaskan hubungan keduanya, bukan sekadar hasil militernya."),
    "tryout-ref-05-13": ("tambahan", "Hubungkan keahlian warga dengan jenis ancaman yang dihadapi dalam kasus, lalu periksa apakah tiap pilihan menjelaskan hubungan itu dengan kepentingan negara atau hanya dengan manfaat teknisnya."),
    "tryout-ref-05-14": ("tambahan", "Telusuri sumber kerentanan dalam kasus dan apa yang diubah warga untuk mengurangi kerentanan itu, lalu pilih pilihan yang menghubungkan perubahan itu dengan dampaknya bagi kebutuhan strategis."),
    "tryout-ref-05-15": ("tambahan", "Perhatikan peran yang dijalankan warga dan aparat dalam kasus, lalu pilih pilihan yang menjelaskan makna kegiatan itu bagi bela negara, bukan sekadar manfaat teknis seperti kedisiplinan atau keberanian."),
    "tryout-ref-05-18": ("tambahan", "Identifikasi jenis ancaman dan dampaknya pada kepentingan negara dalam kasus, lalu bedakan pilihan yang menjelaskan hubungan itu dari pilihan yang hanya menyebut manfaat literasi atau komunikasi."),
}
TIP_RUJUKAN = 'QC akademik TWK (revisi tahap 2): tip berbentuk rumus jawaban diganti petunjuk membaca soal.'
# Tip contoh yang direvisi lewat "revisi" di data/tryout-twk-koreksi.json (tahap 2b) tidak ada di TIP_REVISI: satu butir, satu sumber tip.
# Koreksi TWK tahap 2b: data/tryout-twk-koreksi.json (ubah lewat berkas itu, bukan data/tryout-reference.json; impor ini idempoten, jalankan ulang saja).
#   "label":  { id: { bloom (C1-C6), difficulty (mudah|sedang|sulit), alasan, catatan? } }, wajib untuk setiap butir TWK yang diimpor. Menggantikan kesulitan dari
#             label sumber; label sumber tetap di provenance.declaredDifficulty dan disebut di difficultyReason. "alasan" (alasan operasi berpikir, bersih) masuk
#             ke difficultyReason. "catatan" (catatan telaah, untuk audit) hanya divalidasi bentuknya (teks) dan TIDAK dipakai: tidak masuk data soal maupun laporan.
#   "revisi": { id: { status, stem?, options[5 teks], answer, reasons[5], explanation, tip } }; answer harus sama dengan sumber (skor opsi tetap 5/0).
# Id di berkas koreksi yang tidak diimpor, butir TWK tanpa label, dan id di dua sumber tip menghentikan impor.
KOREKSI_PATH = Path('data/tryout-twk-koreksi.json')
KOREKSI_RUJUKAN = 'QC akademik TWK tahap 2b: telaah studio-soal-twk'
def load_koreksi():
    data = json.loads(KOREKSI_PATH.read_text(encoding='utf-8'))
    label, revisi = data.get('label', {}), data.get('revisi', {})
    errors = []
    def text(where, value):
        if not isinstance(value, str) or not value.strip(): errors.append(where + ': teks kosong atau bukan string')
    for key, entry in label.items():
        if entry.get('bloom') not in ('C1', 'C2', 'C3', 'C4', 'C5', 'C6'): errors.append(key + ': label.bloom harus C1-C6')
        if entry.get('difficulty') not in ('mudah', 'sedang', 'sulit'): errors.append(key + ': label.difficulty harus mudah, sedang, atau sulit')
        text(key + ' label.alasan', entry.get('alasan'))
        if 'catatan' in entry and not isinstance(entry['catatan'], str): errors.append(key + ': label.catatan harus teks')
    for key, entry in revisi.items():
        if not isinstance(entry.get('answer'), int) or not 0 <= entry['answer'] <= 4: errors.append(key + ': revisi.answer harus indeks 0-4')
        for field in ('options', 'reasons'):
            values = entry.get(field)
            if not isinstance(values, list) or len(values) != 5: errors.append(key + ': revisi.' + field + ' harus berisi 5 teks')
            else:
                for i, value in enumerate(values): text(key + ' revisi.' + field + '[' + str(i) + ']', value)
        for field in ('explanation', 'tip'): text(key + ' revisi.' + field, entry.get(field))
        if 'stem' in entry: text(key + ' revisi.stem', entry['stem'])
        if key not in label: errors.append(key + ': id revisi tidak punya entri label')
    both = sorted(set(TIP_REVISI) & set(revisi))
    if both: errors.append('tip dari dua sumber (TIP_REVISI dan revisi): ' + ', '.join(both))
    if errors: raise SystemExit('Berkas koreksi tryout TWK tidak valid: ' + '; '.join(errors))
    return label, revisi
def reason_2b(declared, old_level, entry):
    alasan = entry['alasan'].strip()
    if alasan[-1] not in '.!?': alasan += '.'
    same = 'sama dengan' if old_level == entry['difficulty'] else 'berbeda dari'
    return 'Label sumber: ' + declared + '. Telaah QC TWK tahap 2b menetapkan ' + entry['bloom'] + ' dan ' + entry['difficulty'] + ', ' + same + ' label sumber. ' + alasan + ' Estimasi akademik, belum dikalibrasi dari peserta.'
def metadata(lines, name):
    return next((line.split(':',1)[1].strip() for line in lines if re.match(re.escape(name)+r'\s*:',line,re.I)), '')
def main():
    records, signatures = [], {}
    koreksi_label, koreksi_revisi = load_koreksi()
    unlabeled = []
    # The Done Input version contains the earlier Bahasa Negara document plus complete metadata.
    REPORT['duplicates'].append({'file': 'Dhea_TWK - Bahasa Negara.docx', 'count': 12, 'canonical': 'Dhea_TWK (Bahasa Negara)_Done Input.docx', 'reason': 'Versi awal; gunakan versi Done Input dengan metadata lengkap.'})
    for path in sorted(ROOT.glob('[0-9][0-9].json')):
        doc = json.loads(path.read_text(encoding='utf-8')); index = int(path.stem)
        if index == 1: continue
        blocks = []
        for n, b in enumerate(doc['blocks']):
            if b['kind'] == 'p':
                for line in b['text'].splitlines():
                    if line.strip(): blocks.append({'kind':'p','text':line.strip(),'block':n})
                if b['images']: blocks.append({'kind':'image','ids':b['images'],'block':n})
            else: blocks.append(b | {'block': n})
        starts = [i for i,b in enumerate(blocks) if b['kind']=='p' and re.fullmatch(r'Soal\s+\d+',b['text'],re.I)]
        perfile = []
        for j, start in enumerate(starts):
            chunk = blocks[start:starts[j+1] if j+1<len(starts) else len(blocks)]
            number = int(re.search(r'\d+',chunk[0]['text'])[0]); key = f'tryout-ref-{index:02d}-{number:02d}'
            lines = [b.get('text','') for b in chunk]
            category, lesson, chapter = (metadata(lines,n) for n in ['Category','Lesson','Chapter'])
            declared = metadata(lines,'Tingkat Kesulitan')
            first = next((i for i,b in enumerate(chunk) if re.match(r'^A\s*\.',b.get('text',''))), -1)
            answer_at = next((i for i,b in enumerate(chunk) if re.match(r'^Jawaban\s*:',b.get('text',''),re.I)), -1)
            explanation_at = next((i for i,b in enumerate(chunk) if re.match(r'^Pembahasan\s*:',b.get('text',''),re.I)), -1)
            if min(first,answer_at,explanation_at)<0:
                REPORT['issues'].append({'id':key,'file':doc['file'],'reason':'Batas opsi/kunci/pembahasan tidak lengkap.'}); continue
            answer_match = re.search(r'Jawaban\s*:\s*([A-E])',chunk[answer_at]['text'],re.I)
            opts = []
            for b in chunk[first:answer_at]:
                line = b.get('text',''); match = re.match(r'^([A-E])\s*\.\s*(.*)',line)
                if match: opts.append({'letter':match[1], 'text':match[2]})
                elif line and opts: opts[-1]['text'] += '\n'+line
            if not answer_match or [o['letter'] for o in opts] != list('ABCDE'):
                REPORT['issues'].append({'id':key,'file':doc['file'],'reason':'Lima label opsi atau kunci tidak lengkap.'}); continue
            answer = ord(answer_match[1].upper())-65
            subtest = 'TKP' if index in [6,7,8] else 'TWK' if index in [2,3,4,5] else 'TIU'
            topic = chapter.replace('SKD_','') if subtest=='TWK' and chapter.startswith('SKD_') else 'Bahasa Negara' if subtest=='TWK' else chapter if subtest=='TKP' else 'Numerik' if index==0 else 'Verbal'
            start_stem = next((i+1 for i,b in enumerate(chunk[:first]) if b.get('text','').startswith('Bentuk Soal:')), 1)
            stem_blocks = chunk[start_stem:first]
            stem = '\n'.join(b['text'] for b in stem_blocks if b['kind']=='p')
            # Word stores mixed numbers as adjacent whole-number and fraction nodes.
            # An explicit plus avoids turning "16 3/8" into multiplication in plain text.
            if index==0 and number in [2,3]:
                mixed=lambda s:re.sub(r'(\d+)\((\d+)\)/\((\d+)\)',r'(\1 + (\2)/(\3))',s)
                stem=mixed(stem)
                for option in opts: option['text']=mixed(option['text'])
                REPORT['corrections'].append({'id':key,'change':'Pecahan campuran ditulis dengan tanda tambah eksplisit; nilai tidak berubah.'})
            tables = [b['rows'] for b in stem_blocks if b['kind']=='table']
            if len(tables)>1: REPORT['issues'].append({'id':key,'reason':'Lebih dari satu tabel stimulus; perlu pemeriksaan.'})
            exp = chunk[explanation_at+1:]
            tip_at = next((i for i,b in enumerate(exp) if re.match(r'^Cara cepat\s*:',b.get('text',''),re.I)),len(exp))
            tip = '\n'.join(b.get('text','') for b in exp[tip_at:]).removeprefix('Cara cepat:').strip()
            if key in TIP_REVISI:
                group, new_tip = TIP_REVISI[key]
                REPORT['corrections'].append({'id': key, 'change': 'Tip diganti petunjuk membaca soal.' if new_tip else 'Tip dihapus (tidak ada pengganti yang bukan rumus jawaban).', 'kelompok': group, 'lama': tip, 'baru': new_tip, 'rujukan': TIP_RUJUKAN})
                tip = new_tip or ''
            exp = exp[:tip_at]
            reason_at = next((i for i,b in enumerate(exp) if re.match(r'^(Alasan opsi|Pembahasan opsi|Analisis setiap opsi)',b.get('text',''),re.I)),len(exp))
            explanation = '\n'.join(b['text'] if b['kind']=='p' else '\n'.join(' | '.join(row) for row in b['rows']) if b['kind']=='table' else '' for b in exp[:reason_at]).strip()
            reason_lines = [b.get('text','') for b in exp[reason_at+1:]]
            reasons = {}
            current = None
            for line in reason_lines:
                match = re.match(r'^(?:Opsi\s+)?([A-E])(?:\s*\((\d)\s*[Pp]oin\))?\s*[.:]?\s+(.*)',line)
                if match:
                    current=match[1]; reasons[current] = (reasons.get(current,'')+' '+line).strip()
                elif current: reasons[current] += '\n'+line
            # Some Bahasa Negara sources explain several options in one paragraph.
            # Split only explicit "Opsi A ... Opsi B ..." boundaries, preserving
            # shared A-and-B reasoning without repeating the whole paragraph five times.
            joined=' '.join(reason_lines)
            for match in re.finditer(r'Opsi\s+([A-E](?:\s*(?:dan|,)\s*[A-E])*)\s+(.*?)(?=Opsi\s+[A-E]\b|$)',joined,re.S):
                for letter in re.findall(r'\b[A-E]\b',match[1]): reasons[letter]=match[2].strip()
            for letter in list(reasons):
                reasons[letter]=re.sub(r'^(?:Opsi\s+)?'+letter+r'(?=\s|[.:])\s*(?:\(\d\s*[Pp]oin\))?\s*[.:]?\s*','',reasons[letter]).strip()
            scores = {}
            for line in [b.get('text','') for b in exp]:
                match=re.match(r'^(?:Opsi\s+)?([A-E])\s*\((\d)\s*[Pp]oin\)',line)
                if match: scores[match[1]]=int(match[2])
            if subtest=='TKP' and (set(scores)!=set('ABCDE') or scores.get(chr(65+answer))!=5):
                REPORT['issues'].append({'id':key,'file':doc['file'],'reason':'Poin TKP belum lengkap atau berbeda dari kunci.','scores':scores}); continue
            for i,o in enumerate(opts):
                o['score']=scores[o['letter']] if subtest=='TKP' else 5 if i==answer else 0
                best=next((re.sub(r'^(?:Opsi\s+)?'+o['letter']+r'\s*\(5\s*[Pp]oin\)\s*','',b.get('text','')).strip() for b in exp if re.match(r'^(?:Opsi\s+)?'+o['letter']+r'\s*\(5\s*[Pp]oin\)',b.get('text',''))), '') if i==answer else ''
                o['reason']= reasons.get(o['letter'], best or 'Pilihan ini sesuai dengan konsep dan langkah pada pembahasan utama.' if i==answer else '\n'.join(reason_lines).strip() or 'Penjelasan per pilihan tidak dipisahkan dalam sumber; gunakan langkah penyelesaian pada pembahasan.')
                del o['letter']
            source_level = 'sulit' if declared.lower() in ['hots','sulit'] else 'mudah' if declared.lower()=='mudah' else 'sedang'
            label = koreksi_label.get(key) if subtest=='TWK' else None
            item={'id':key,'subtest':subtest,'topic':topic,'subtopic':chapter,'difficulty':label['difficulty'] if label else source_level,
              **({'bloom':label['bloom']} if label else {}),
              'stem':stem,'options':opts,'answer':answer,'explanation':explanation,'tip':tip,'source':doc['file']+f' — Soal {number}',
              'provenance':{'file':doc['file'],'question':number,'category':category,'lesson':lesson,'chapter':chapter,'declaredDifficulty':declared,'sourceHash':doc['sha256'],'block':chunk[0]['block'],'status':'accepted-example'},
              'difficultyReason':reason_2b(declared,source_level,label) if label else 'Label sumber: '+declared+'. Contoh mutu yang diterima pengguna; label HOTS disimpan terpisah dari estimasi kesulitan.',
              'pendingImages':[b for b in stem_blocks if b['kind']=='image']}
            if subtest=='TWK' and not label: unlabeled.append(key)
            if index==0 and number in [2,3]:
                item['explanation']=mixed(item['explanation'])
            if tables: item['table']={'headers':tables[0][0],'rows':tables[0][1:]}
            signature = norm(stem)+'|'+ '|'.join(sorted(norm(o['text']) for o in opts))
            if signature in signatures:
                REPORT['duplicates'].append({'id':key,'canonical':signatures[signature],'reason':'Stimulus dan lima opsi identik.'}); continue
            signatures[signature]=key
            # Revisi tahap 2b dipasang setelah pemeriksaan duplikat, yang tetap membandingkan teks sumber.
            if label:
                REPORT['corrections'].append({'id':key,'change':'Label TWK diganti: Bloom '+label['bloom']+', kesulitan '+label['difficulty']+' (label sumber '+declared+').','jenis':'label','bloom':label['bloom'],'kesulitan':label['difficulty'],'labelSumber':declared,'alasan':label['alasan'],'rujukan':KOREKSI_RUJUKAN})
            revision = koreksi_revisi.get(key)
            if revision:
                if revision['answer']!=answer:
                    raise SystemExit(f'Revisi {key}: answer {revision["answer"]} berbeda dari kunci sumber {answer}.')
                parts = []
                if 'stem' in revision and revision['stem']!=item['stem']: parts.append('stem'); item['stem']=revision['stem']
                changed_text = [chr(65+i) for i,o in enumerate(item['options']) if o['text']!=revision['options'][i]]
                changed_reason = [chr(65+i) for i,o in enumerate(item['options']) if o['reason']!=revision['reasons'][i]]
                for i,o in enumerate(item['options']): o['text']=revision['options'][i]; o['reason']=revision['reasons'][i]
                if changed_text: parts.append('teks opsi '+', '.join(changed_text))
                if changed_reason: parts.append('alasan opsi '+', '.join(changed_reason))
                if revision['explanation']!=item['explanation']: parts.append('pembahasan'); item['explanation']=revision['explanation']
                old_tip = item['tip']
                if revision['tip']!=old_tip: parts.append('tip'); item['tip']=revision['tip']
                REPORT['corrections'].append({'id':key,'change':'Butir direvisi (status '+str(revision.get('status',''))+'): '+(', '.join(parts) or 'tidak ada perubahan teks')+'.','jenis':'revisi','status':revision.get('status'),'bagian':parts,'tipLama':old_tip,'tipBaru':item['tip'],'rujukan':KOREKSI_RUJUKAN})
            records.append(item); perfile.append(key)
        REPORT['files'].append({'file':doc['file'],'questionsFound':len(starts),'imported':len(perfile)})
    unplaced = sorted(set(TIP_REVISI) - {r['id'] for r in records})
    if unplaced: raise SystemExit('Revisi tip untuk id yang tidak diimpor: ' + ', '.join(unplaced))
    twk_ids = {r['id'] for r in records if r['subtest']=='TWK'}
    missing_twk = sorted((set(koreksi_label) | set(koreksi_revisi)) - twk_ids)
    if missing_twk: raise SystemExit('Koreksi tryout TWK untuk id yang tidak diimpor sebagai TWK: ' + ', '.join(missing_twk))
    if unlabeled: raise SystemExit('Butir TWK tanpa label di ' + str(KOREKSI_PATH) + ': ' + ', '.join(unlabeled))
    Path('data/tryout-reference.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    REPORT['counts']=dict(collections.Counter(q['subtest'] for q in records))
    REPORT['pendingImages']=[q['id'] for q in records if q['pendingImages']]
    Path('data/tryout-import-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2),encoding='utf-8')
    raw_mapping = json.loads((ROOT/'mapping.json').read_text(encoding='utf-8'))
    source_rows = raw_mapping['1 TO 0 Latsol']['rows']
    catalog, inherited = [], ['', '', '']
    for row in source_rows:
        cells=row['cells']; number=row['row']
        if not 3 <= number <= 59: continue
        for col in range(3):
            if cells[col]: inherited[col]=cells[col].strip()
        subtest='TWK' if 'TWK' in inherited[0] else 'TIU' if 'TIU' in inherited[0] else 'TKP'
        chapter=cells[3].strip()
        topic=chapter.replace('SKD_','') if subtest=='TWK' and chapter.startswith('SKD_') else 'Bahasa Negara' if subtest=='TWK' else chapter if subtest=='TKP' else 'Figural' if number>=50 else 'Numerik' if number>=24 else 'Verbal'
        catalog.append({'id':f'map-{number:02d}', 'row':number,'subtest':subtest,'category':inherited[1],'lesson':inherited[2], 'chapter':chapter,'topic':topic,'count':int(cells[9] or 0),'exerciseCount':int(cells[13] or 0)})
    Path('data/skd-mapping.json').write_text(json.dumps({'file':'Mapping SKD 2027.xlsx','sheet':'1 TO 0 Latsol','comparisonSheet':'3 TO 0 Latsol','rows':catalog,'rotations':[r for r in raw_mapping['3 TO 0 Latsol']['rows'] if r['row']>=62]},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(REPORT,ensure_ascii=True))

if __name__=='__main__': main()
