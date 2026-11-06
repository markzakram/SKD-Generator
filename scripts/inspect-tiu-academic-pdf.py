"""Inspect actual exported PDF geometry/fonts and render review pages."""
import collections
import json
from pathlib import Path
import pymupdf

folder = Path('test-results')
document = pymupdf.open(folder / 'tiu-academic-all.pdf')
fonts = collections.Counter(); out = []; hits = {}
for index, page in enumerate(document):
    for marker in ['Soal 4 |', 'Soal 28 |', 'Soal 63 |', 'Soal 79 |', 'Soal 101 |', 'Soal 114 |', 'Soal 121 |']:
        if marker in page.get_text(): hits[marker] = index
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                font, size = span['font'], round(span['size'], 1)
                fonts[(font,size)] += 1
                x0,y0,x1,y1 = span['bbox']
                if x0 < 0 or y0 < 0 or x1 > page.rect.width+1 or y1 > page.rect.height+1: out.append([index+1,span['text'],span['bbox']])
                assert font in ['Times-Roman','Times-Bold'], (index,font)
                assert size in [8,9,10,12,17], (index,size)
                if size in [9,10,17]: assert index == 0, 'Metadata font outside cover'
                if size == 8: assert y0 > 800, 'Footer font in document body'
assert not out, out
for _,index in hits.items(): document[index].get_pixmap(matrix=pymupdf.Matrix(1.3,1.3)).save(folder / ('tiu-pdf-'+str(index+1)+'.png'))
preview = pymupdf.open()
for index in sorted(set(hits.values())): preview.insert_pdf(document,from_page=index,to_page=min(index+1,len(document)-1))
for page in preview: page.clean_contents()
preview.save(folder / 'tiu-academic-preview.pdf', garbage=4, deflate=True)
report = {'pages':len(document),'fonts':[[list(key),value] for key,value in fonts.items()],'outOfBounds':out,'hits':hits}
(folder / 'tiu-academic-pdf-check.json').write_text(json.dumps(report,indent=2))
print('PASS:', len(document), 'PDF pages; Times 12 pt body; all text within page bounds.')
