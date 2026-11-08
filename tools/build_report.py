"""Собирает report/report.pdf из README.md: титульный лист + текст + скриншоты.

Запуск из корня репозитория:
    python3 tools/build_report.py           # черновик (недостающие скрины -> заглушки)
    python3 tools/build_report.py --final   # падает, если остались TODO или нет скринов
"""
import base64
import re
import subprocess
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "README.md"
HTML_OUT = ROOT / "report" / "report.html"
PDF_OUT = ROOT / "report" / "report.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

COVER = """
<section class="cover">
  <div class="univ">
    Федеральное государственное автономное образовательное учреждение высшего образования<br>
    «Национальный исследовательский университет ИТМО»
  </div>
  <div class="discipline">Дисциплина «Информационная безопасность»</div>
  <div class="work">Работа 7: Безопасность браузера и анализ сетевого трафика</div>
  <div class="author">
    Выполнил: Молодиченко Семен Андреевич<br>
    Группа: P3313
  </div>
  <div class="city">Санкт-Петербург<br>2026</div>
</section>
<div class="pagebreak"></div>
"""

CSS = """
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "PT Serif","Times New Roman",Georgia,serif; font-size: 11.5pt;
         line-height: 1.5; color: #1a1a1a; }
  h1 { font-size: 20pt; color: #0a3d62; border-bottom: 2px solid #0a3d62;
        padding-bottom: 6px; margin-top: 26px; }
  h2 { font-size: 15pt; color: #0a3d62; margin-top: 22px; }
  h3 { font-size: 12.5pt; color: #222; margin-top: 16px; }
  h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
  p, li { text-align: justify; }
  code { font-family: "SF Mono",Menlo,Consolas,monospace; font-size: 9.5pt;
          background: #f2f4f7; padding: 1px 4px; border-radius: 3px; }
  pre { background: #0b1021; color: #e6edf3; padding: 12px 14px; border-radius: 6px;
         page-break-inside: avoid; }
  pre code { background: none; color: inherit; font-size: 9pt; white-space: pre-wrap; }
  blockquote { border-left: 3px solid #0a3d62; margin: 12px 0; padding: 4px 12px;
               background: #f2f6fa; color: #333; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9.5pt;
           page-break-inside: avoid; }
  th, td { border: 1px solid #c3ccd6; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; color: #0a3d62; }
  tr:nth-child(even) td { background: #f7f9fc; }
  figure { margin: 14px 0; text-align: center; page-break-inside: avoid; }
  figure img { max-width: 100%; max-height: 120mm; border: 1px solid #c3ccd6; border-radius: 4px; }
  figcaption { font-size: 9pt; color: #555; font-style: italic; margin-top: 4px; }
  .missing { border: 2px dashed #c0392b; color: #c0392b; padding: 30px; font-family: sans-serif; }
  .pagebreak { page-break-after: always; }
  .cover { height: 255mm; display: flex; flex-direction: column; text-align: center;
            font-family: "Times New Roman",serif; }
  .cover .univ { font-size: 13pt; line-height: 1.5; margin-top: 8mm; }
  .cover .discipline { font-size: 13pt; margin-top: 70mm; }
  .cover .work { font-size: 16pt; font-weight: bold; margin-top: 10mm; }
  .cover .author { font-size: 13pt; margin-top: auto; text-align: right; }
  .cover .city { font-size: 13pt; margin-top: 18mm; }
  a { color: #0a4bd0; text-decoration: none; }
"""

IMG_RE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$", re.M)


def embed_images(md_text, missing):
    """Заменяет ![alt](path) на <figure> с base64-картинкой или заглушкой."""
    def repl(m):
        alt, rel = m.group(1), m.group(2)
        path = ROOT / rel
        if not path.exists():
            missing.append(rel)
            body = f'<div class="missing">Скриншот не добавлен: {rel}</div>'
        else:
            data = base64.b64encode(path.read_bytes()).decode()
            body = f'<img alt="{alt}" src="data:image/png;base64,{data}">'
        return f"<figure>{body}<figcaption>{alt}</figcaption></figure>"
    return IMG_RE.sub(repl, md_text)


def main():
    final = "--final" in sys.argv
    md_text = README.read_text(encoding="utf-8")
    todos = re.findall(r"\[TODO[^\]]*\]", md_text)
    missing = []
    md_text = embed_images(md_text, missing)

    if final and (todos or missing):
        print(f"Не готово: TODO={len(todos)}, нет скринов={len(missing)}")
        for item in missing:
            print("  -", item)
        sys.exit(1)

    body = markdown.markdown(md_text, extensions=["tables", "fenced_code"])
    html = (f'<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            f"<style>{CSS}</style></head><body>{COVER}{body}</body></html>")
    HTML_OUT.write_text(html, encoding="utf-8")

    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={PDF_OUT}", HTML_OUT.as_uri()],
                   check=True, capture_output=True)
    print(f"PDF: {PDF_OUT}")
    print(f"TODO осталось: {len(todos)}, скринов не хватает: {len(missing)}")
    for item in missing:
        print("  -", item)


if __name__ == "__main__":
    main()
