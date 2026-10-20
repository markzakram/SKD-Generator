"""Reproducible import with source locations, explicit duplicates, and no inferred keys."""
import json, re, collections, statistics, hashlib
from pathlib import Path

ROOT = Path('references/tryouts-2027')
REPORT = {'files': [], 'duplicates': [], 'issues': [], 'corrections': []}
def norm(s): return re.sub(r'\W+', ' ', s.lower()).strip()
def metadata(lines, name):
    return next((line.split(':',1)[1].strip() for line in lines if re.match(re.escape(name)+r'\s*:',line,re.I)), '')
def main():
    records, signatures = [], {}
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
            item={'id':key,'subtest':subtest,'topic':topic,'subtopic':chapter,'difficulty':'sulit' if declared.lower() in ['hots','sulit'] else 'mudah' if declared.lower()=='mudah' else 'sedang',
              'stem':stem,'options':opts,'answer':answer,'explanation':explanation,'tip':tip,'source':doc['file']+f' — Soal {number}',
              'provenance':{'file':doc['file'],'question':number,'category':category,'lesson':lesson,'chapter':chapter,'declaredDifficulty':declared,'sourceHash':doc['sha256'],'block':chunk[0]['block'],'status':'accepted-example'},
              'difficultyReason':'Label sumber: '+declared+'. Contoh mutu yang diterima pengguna; label HOTS disimpan terpisah dari estimasi kesulitan.',
              'pendingImages':[b for b in stem_blocks if b['kind']=='image']}
            if index==0 and number in [2,3]:
                item['explanation']=mixed(item['explanation'])
            if tables: item['table']={'headers':tables[0][0],'rows':tables[0][1:]}
            signature = norm(stem)+'|'+ '|'.join(sorted(norm(o['text']) for o in opts))
            if signature in signatures:
                REPORT['duplicates'].append({'id':key,'canonical':signatures[signature],'reason':'Stimulus dan lima opsi identik.'}); continue
            signatures[signature]=key
            records.append(item); perfile.append(key)
        REPORT['files'].append({'file':doc['file'],'questionsFound':len(starts),'imported':len(perfile)})
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
