"""Optional source-maintenance helper; the web app uses the committed JSON."""
import json
import re
from pathlib import Path
import pdfplumber

root = Path(__file__).resolve().parent.parent
groups = []
current = None
pattern = re.compile(r"^([A-E])\s*(?:\(([1-5])\s*poin\)|[-–]\s*Skor\s*([1-5]))$", re.I)
# Sel terakhir tabel yang membentang antarhalaman ikut membawa catatan penyusunan panduan (judul "Kesulitan Contoh Soal n – ...",
# label Bloom, arahan penulisan, materi lain). Hanya kalimat alasan di awal sel yang disimpan; aturan yang sama dipakai
# scripts/import-references.mjs (cleanTkpNote) sebagai pengaman kedua.
NOTE = re.compile(r"(?:^|\s)(?:Hambatan\s+)?(?:Kesulitan\s+)+(?=Contoh Soal)|\bContoh Soal\s+\d+|\bLevel Bloom\s*:|\bTingkat Kesulitan\s*:|\bPrinsip Kunci\b|\bDiskresi dalam Soal\b|\bRentang Bloom\b|\bMateri Pokok\b|\bCara cepat\s*:|\bTips\s*&|^\s*[1-6]\.[1-5]\.\s")


def clean_reason(text):
    marker = NOTE.search(text)
    head = (text[: marker.start()] if marker else text).strip()
    kept = []
    for sentence in re.split(r"(?<=[.!?])\s+", head):
        if kept and (sentence[:1].islower() or NOTE.search(sentence)):
            break
        kept.append(sentence)
    return " ".join(kept).strip()


with pdfplumber.open(root / "references" / "panduan-tkp-jadiasn.pdf") as document:
    for page_number, page in enumerate(document.pages, 1):
        for table in page.extract_tables():
            for row in table:
                cells = [" ".join(cell.split()) for cell in row if cell and cell.strip()]
                if not cells:
                    continue
                match = pattern.match(cells[0])
                if match:
                    if match[1] == "A":
                        current = {}
                        groups.append(current)
                    if current is None:
                        raise RuntimeError("Score table starts before A")
                    current[match[1]] = {
                        "score": int(match[2] or match[3]),
                        "reason": " ".join(cells[1:]),
                        "pdf_page": page_number,
                    }
                elif current and len(cells) == 1 and cells[0] not in ("Alasan", "Opsi dan Skor"):
                    # A wrapped table row may continue on the next physical page.
                    if not row[0] and len(current):
                        last = list(current)[-1]
                        current[last]["reason"] += " " + cells[0]
if len(groups) != 26 or any(set(group) != set("ABCDE") for group in groups):
    raise RuntimeError("Expected 26 complete A–E score tables: " + str(len(groups)))
for group in groups:
    for item in group.values():
        item["reason"] = clean_reason(item["reason"])
if any(not item["reason"] for group in groups for item in group.values()):
    raise RuntimeError("An option reason is empty")
(root / "data" / "tkp-score-rows.json").write_text(json.dumps(groups, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"tables": len(groups), "rows": sum(map(len, groups))}))
