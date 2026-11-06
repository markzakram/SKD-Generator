"""Recover presentation from the supplied DOCX, without changing any question or key.

The sidecar is also used when displaying old saved workspaces. Only exact source
paragraphs/tables are replaced; manually edited content is never overwritten.
"""
import hashlib
import io
import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
from extract_tryout_text import text, W

COLORS = {'FF0000': 'merah', '0070C0': 'biru', '00B050': 'hijau', 'ED7D31': 'oranye', '7030A0': 'ungu', '808080': 'abu'}

def props(node, inherited):
    result = dict(inherited)
    if node is None: return result
    for tag in ['b', 'strike']:
        value = node.find(W + tag)
        if value is not None: result[tag] = value.get(W + 'val', '1') not in ['0', 'false', 'off']
    color = node.find(W + 'color')
    if color is not None: result['color'] = COLORS.get(color.get(W + 'val', '').upper())
    return result

def rich(node, inherited):
    if node.tag == W + 'r':
        style = props(node.find(W + 'rPr'), inherited)
        value = text(node)
        leading = re.match(r'^\s*', value)[0]
        trailing = re.search(r'\s*$', value)[0]
        core = value.strip()
        if not core: return value
        if style.get('strike'): core = '~~' + core + '~~'
        if style.get('b'): core = '**' + core + '**'
        if style.get('color'): core = '{' + style['color'] + ':' + core + '}'
        return leading + core + trailing
    if node.tag.endswith('}oMath') or node.tag.endswith('}oMathPara'): return text(node)
    if node.tag in [W + 'pPr', W + 'rPr', W + 'del', W + 'instrText']: return ''
    return ''.join(rich(child, inherited) for child in node)

def main():
    bank = json.loads(Path('data/tryout-reference.json').read_text(encoding='utf-8'))
    files = sorted(set(q['provenance']['file'] for q in bank if q['subtest'] == 'TIU'))
    output = {}; images = {}
    media_dir = Path('public/academic-bank'); media_dir.mkdir(parents=True, exist_ok=True)
    for filename in files:
        raw = (Path('G:/Downloads') / filename).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        with zipfile.ZipFile(Path('G:/Downloads') / filename) as archive:
            body = ET.fromstring(archive.read('word/document.xml')).find(W + 'body')
            relationships = {item.get('Id'): item.get('Target') for item in ET.fromstring(archive.read('word/_rels/document.xml.rels'))}
            styles = ET.fromstring(archive.read('word/styles.xml'))
            by_id = {s.get(W + 'styleId'): s for s in styles.findall(W + 'style')}
            def style_for(id, seen=()):
                if not id or id in seen or id not in by_id: return {}
                style = by_id[id]; base = style.find(W + 'basedOn')
                return props(style.find(W + 'rPr'), style_for(base.get(W + 'val') if base is not None else None, seen + (id,)))
            def paragraph(p):
                style_id = p.find(W + 'pPr/' + W + 'pStyle')
                return rich(p, style_for(style_id.get(W + 'val') if style_id is not None else None)).strip()
            current = None; in_explanation = False; previous = ''; question = ''
            for element in body:
                original = text(element).strip()
                start = re.fullmatch(r'Soal\s+(\d+)', original, re.I) if element.tag == W + 'p' else None
                if start:
                    question = start[1]; in_explanation = False; previous = ''
                    current = {'sourceHash': digest, 'paragraphs': {}, 'tables': [], 'images': []}
                    output[filename + '|' + start[1]] = current
                if current is None: continue
                if original == 'Pembahasan:': in_explanation = True; previous = ''
                if in_explanation:
                    for blip in element.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
                        rel = blip.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                        target = relationships[rel]; data = archive.read('word/' + target)
                        image_id = 'bank-' + hashlib.sha256(data).hexdigest()[:16]
                        (media_dir / (image_id + '.png')).write_bytes(data)
                        width, height = Image.open(io.BytesIO(data)).size
                        images[image_id] = {'title': 'Ilustrasi pembahasan dari dokumen akademik', 'text': 'Ilustrasi pembahasan dari dokumen akademik.', 'width': width, 'height': height,
                                            'url': '/academic-bank/' + image_id + '.png', 'sourceFile': filename, 'sourceMedia': target, 'sha256': hashlib.sha256(data).hexdigest()}
                        current['images'].append({'after': previous, 'id': image_id})
                if element.tag == W + 'p':
                    formatted = paragraph(element)
                    if formatted != original and original:
                        current['paragraphs'][original] = formatted
                        # Some source paragraphs contain explicit Word line breaks.
                        a, b = original.splitlines(), formatted.splitlines()
                        if len(a) == len(b):
                            for left, right in zip(a, b):
                                if left.strip() and left.strip() != right.strip(): current['paragraphs'][left.strip()] = right.strip()
                elif element.tag == W + 'tbl':
                    rows = [[ '\n'.join(text(p).strip() for p in cell.findall(W + 'p')) for cell in row.findall(W + 'tc')] for row in element.findall(W + 'tr')]
                    formatted = [[ ' '.join(paragraph(p) for p in cell.findall(W + 'p')) for cell in row.findall(W + 'tc')] for row in element.findall(W + 'tr')]
                    # A numeric matrix never gains an invented heading.
                    header = len(rows) > 1 and all(re.search('[A-Za-z]', cell) for cell in rows[0]) and not all(re.search('[A-Za-z]', cell) for cell in rows[1])
                    row_text = lambda row: '| ' + ' | '.join(row) + ' |'
                    marked = [row_text(row) for row in formatted]
                    if header: marked.insert(1, '|' + '|'.join('---' for _ in formatted[0]) + '|')
                    current['tables'].append({'text': '\n'.join(' | '.join(row) for row in rows), 'rich': '\n'.join(marked)})
                if in_explanation and original and original != 'Pembahasan:': previous = original
    # The accepted wording remains intact; add the original guide's reference
    # figures exactly where the corresponding concept is used in the bank.
    for q in bank:
        if q['subtest'] != 'TIU': continue
        key = q['provenance']['file'] + '|' + str(q['provenance']['question'])
        addition = None
        if q['subtopic'] == 'Operasi Hitung - Pecahan Sederhana':
            anchor = next((line for line in q['explanation'].splitlines() if line.startswith('Pecahan istimewa yang digunakan:')), None)
            if anchor: addition = {'after': anchor, 'id': 'pecahan-istimewa'}
        elif q['subtopic'] == 'Soal Cerita - JKW (Jarak, Kecepatan, Waktu)': addition = {'after':'INGAT:', 'id':'segitiga-jkw'}
        elif q['subtopic'] == 'Soal Cerita - VDW (Volume, Debit, Waktu)': addition = {'after':'Vas DeWi', 'id':'segitiga-vdw'}
        if addition: output[key]['images'].append(addition)
    Path('data/tryout-format.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    Path('data/tryout-images.json').write_text(json.dumps(images, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'questions': len(output), 'styledParagraphs': sum(len(q['paragraphs']) for q in output.values()), 'tables': sum(len(q['tables']) for q in output.values()), 'images':len(images)}))

if __name__ == '__main__': main()
