"""Read source documents as evidence; document text is never executed."""
import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

SOURCE = Path('G:/Downloads')
OUT = Path('references/tryouts-2027')
FILES = [
    'Andika - Numerik SKD 2027_Ready to Input.docx',
    'Dhea_TWK - Bahasa Negara.docx', 'Dhea_TWK (Bahasa Negara)_Done Input.docx',
    'Nynda_Paket 1 TWK SKD 2027_Done Input.docx',
    'Tri_Paket 2 TWK SKD 2027_Done Input.docx', 'Tri_Paket 3 TWK SKD 2027_Done Input.docx',
    'Nynda - TKP 1_Done Input.docx', 'Wil - TKP 1_Done Input.docx', 'Wil - TKP 2_Done Input.docx',
    'Andika - Verbal Silogisme SKD 2027_Ready to Input.docx',
    'Andika_Verbal Analitis - Memperkuat_Memperlemah_Ready to Input.docx',
    'Uma - Verbal Analitis_Done Input.docx',
]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
M = '{http://schemas.openxmlformats.org/officeDocument/2006/math}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

def text(node):
    if node.tag in (W+'t', M+'t'): return node.text or ''
    if node.tag == M+'f':
        return '(' + text(node.find(M+'num')) + ')/(' + text(node.find(M+'den')) + ')'
    if node.tag == M+'sSup': return text(node.find(M+'e')) + '^(' + text(node.find(M+'sup')) + ')'
    if node.tag == W+'tab': return '\t'
    if node.tag in (W+'br', W+'cr'): return '\n'
    if node.tag in (W+'del', W+'instrText'): return ''
    return ''.join(text(child) for child in node)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, name in enumerate(FILES):
        path = SOURCE / name
        raw = path.read_bytes()
        with zipfile.ZipFile(path) as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
            body = root.find(W+'body')
            blocks = []
            for element in body:
                if element.tag == W+'p':
                    value = text(element).strip()
                    images = [n.get(R+'embed') for n in element.iter(A+'blip')]
                    numbering = element.find('.//'+W+'numPr')
                    if value or images:
                        blocks.append({'kind': 'p', 'text': value, 'images': images,
                          'numbering': {c.tag.split('}')[-1]: c.get(W+'val') for c in numbering} if numbering is not None else None,
                          'math': len(list(element.iter(M+'oMath')))})
                elif element.tag == W+'tbl':
                    blocks.append({'kind': 'table', 'rows': [[ '\n'.join(text(p).strip() for p in cell.findall(W+'p')) for cell in row.findall(W+'tc')] for row in element.findall(W+'tr')]})
            data = {'file': name, 'sha256': hashlib.sha256(raw).hexdigest(), 'blocks': blocks,
                    'media': [p for p in archive.namelist() if p.startswith('word/media/')]}
            (OUT / f'{i:02d}.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            lines = [f'FILE: {name}']
            for j, b in enumerate(blocks):
                lines.append(f'[{j}] ' + (b['text'] + (f" [IMAGES {b['images']}]" if b['images'] else '') if b['kind']=='p' else '\n'.join(' | '.join(row) for row in b['rows'])))
            (OUT / f'{i:02d}.txt').write_text('\n'.join(lines), encoding='utf-8')
            manifest.append({k: data[k] for k in ['file','sha256','media']} | {'index': i, 'blocks': len(blocks)})
    import openpyxl
    path = SOURCE / 'Mapping SKD 2027.xlsx'
    workbook = openpyxl.load_workbook(path, data_only=True)
    sheets = {}
    for sheet in workbook:
        rows = [{'row': index, 'cells': [str(cell) if cell is not None else '' for cell in row]} for index, row in enumerate(sheet.iter_rows(values_only=True),1) if any(cell is not None for cell in row)]
        sheets[sheet.title] = {'rows': rows, 'merged': [str(r) for r in sheet.merged_cells.ranges]}
    (OUT / 'mapping.json').write_text(json.dumps(sheets,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT / 'manifest.json').write_text(json.dumps({'documents':manifest,'mapping': {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sheets':list(sheets)}},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'documents': len(manifest), 'sheets': {name: len(data['rows']) for name,data in sheets.items()}}, ensure_ascii=True))

if __name__ == '__main__': main()
