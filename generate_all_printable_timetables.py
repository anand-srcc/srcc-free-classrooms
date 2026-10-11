import os
import sys
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
import pypdf

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = 'https://srcccollegetimetable.in/admin/timetable_printpreview.php?mode=print'
OUTPUT_DIR = os.path.abspath('SRCC_Printable_Timetables')
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

os.makedirs(OUTPUT_DIR, exist_ok=True)
TEMP_HTML_DIR = os.path.join(OUTPUT_DIR, '_temp_html')
os.makedirs(TEMP_HTML_DIR, exist_ok=True)

# 1-Page Fit CSS (prevents page 2 overflow, fits 100% of schedule onto 1 single sheet of A4 Landscape)
PRINT_CSS = """
<base href="https://srcccollegetimetable.in/admin/">
<style>
@page {
    size: A4 landscape;
    margin: 4mm 5mm 4mm 5mm;
}
* {
    box-sizing: border-box !important;
}
html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    zoom: 0.78 !important;
}
.print_none, #print, input[type="button"], input[type="submit"], button {
    display: none !important;
}
table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-bottom: 2px !important;
    page-break-inside: avoid !important;
}
th, td {
    border: 1px solid #333 !important;
    padding: 2px 3px !important;
    font-size: 9.5px !important;
    line-height: 1.15 !important;
}
#print_heading td {
    border: none !important;
    padding: 1px !important;
}
#print_heading font {
    font-size: 14px !important;
}
h1, h2, h3, p {
    margin: 1px 0 !important;
}
</style>
"""

tasks = []

# 1. B.Com (Hons) (classId 20)
bcom_sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
for sem in [1, 2, 3, 5, 7]:
    for sec in bcom_sections:
        target_dir = os.path.join(OUTPUT_DIR, 'BCom_Hons', f'Semester_{sem}')
        pdf_name = f"BCom_Sem{sem}_Sec_{sec}.pdf"
        tasks.append({
            'course': 'B.Com (Hons)',
            'classId': 20,
            'semester': sem,
            'section': sec,
            'url': f"{BASE_URL}&classId=20&semester={sem}&class_section={sec}",
            'dir': target_dir,
            'filename': pdf_name,
            'label': f"B.Com (Hons) Sem {sem} Sec {sec}"
        })

# 2. B.A. (Hons) Economics (classId 21)
eco_sections = ['A', 'B', 'C', 'D']
for sem in [1, 2, 3, 5, 7]:
    for sec in eco_sections:
        target_dir = os.path.join(OUTPUT_DIR, 'BA_Economics', f'Semester_{sem}')
        pdf_name = f"BA_Eco_Sem{sem}_Sec_{sec}.pdf"
        tasks.append({
            'course': 'B.A. (Hons) Economics',
            'classId': 21,
            'semester': sem,
            'section': sec,
            'url': f"{BASE_URL}&classId=21&semester={sem}&class_section={sec}",
            'dir': target_dir,
            'filename': pdf_name,
            'label': f"B.A. (Hons) Eco Sem {sem} Sec {sec}"
        })

# 3. SEC / VAC / Joint (classId 22)
for sem in [1, 3, 5]:
    target_dir = os.path.join(OUTPUT_DIR, 'SEC_VAC_Joint')
    pdf_name = f"SEC_VAC_Joint_Sem{sem}.pdf"
    tasks.append({
        'course': 'SEC / VAC Joint',
        'classId': 22,
        'semester': sem,
        'section': '',
        'url': f"{BASE_URL}&classId=22&semester={sem}",
        'dir': target_dir,
        'filename': pdf_name,
        'label': f"SEC/VAC Joint Sem {sem}"
    })

print(f"Total timetables to process: {len(tasks)}")

def fetch_and_save_html(item):
    os.makedirs(item['dir'], exist_ok=True)
    temp_html = os.path.join(TEMP_HTML_DIR, f"{item['classId']}_{item['semester']}_{item['section'] or 'joint'}.html")
    try:
        req = urllib.request.Request(item['url'], headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        if '<head>' in html:
            html = html.replace('<head>', '<head>' + PRINT_CSS)
        else:
            html = PRINT_CSS + html
        
        with open(temp_html, 'w', encoding='utf-8') as f:
            f.write(html)
        item['temp_html'] = temp_html
        item['pdf_path'] = os.path.join(item['dir'], item['filename'])
        return (item, True, None)
    except Exception as e:
        return (item, False, str(e))

print("[1/3] Downloading fresh print-preview HTML...")
with ThreadPoolExecutor(max_workers=12) as executor:
    download_results = list(executor.map(fetch_and_save_html, tasks))

successful_html = [r[0] for r in download_results if r[1]]
print(f"Downloaded {len(successful_html)}/{len(tasks)} HTML files.")

print("\n[2/3] Rendering 1-page perfect PDFs via Chrome Headless...")
rendered_count = 0
for idx, item in enumerate(successful_html, 1):
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={item['pdf_path']}",
        item['temp_html']
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if os.path.exists(item['pdf_path']) and os.path.getsize(item['pdf_path']) > 1000:
            rendered_count += 1
            if idx % 15 == 0 or idx == len(successful_html):
                print(f"  Rendered {idx}/{len(successful_html)}: {item['label']}")
        else:
            print(f"  [Warning] Render issue: {item['label']}")
    except Exception as e:
        print(f"  [Error] {item['label']}: {e}")

print(f"Total PDFs rendered: {rendered_count}/{len(successful_html)}")

# [3/3] Build Combined Booklets using PdfWriter
print("\n[3/3] Generating Combined Booklets (Each section = Exactly 1 Page)...")
BOOKLET_DIR = os.path.join(OUTPUT_DIR, 'Combined_Booklets')
os.makedirs(BOOKLET_DIR, exist_ok=True)

def merge_list(out_filename, items_list):
    writer = pypdf.PdfWriter()
    added = 0
    for it in items_list:
        p = it['pdf_path']
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            try:
                writer.append(p)
                added += 1
            except Exception as e:
                pass
    if added > 0:
        out_path = os.path.join(BOOKLET_DIR, out_filename)
        with open(out_path, 'wb') as f:
            writer.write(f)
        writer.close()
        print(f"  Booklet '{out_filename}': {added} sections merged (Total pages: {len(pypdf.PdfReader(out_path).pages)})")

merge_list('BCom_Sem1_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 1])
merge_list('BCom_Sem2_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 2])
merge_list('BCom_Sem3_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 3])
merge_list('BCom_Sem5_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 5])
merge_list('BCom_Sem7_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 7])

merge_list('BA_Eco_Sem1_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 1])
merge_list('BA_Eco_Sem2_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 2])
merge_list('BA_Eco_Sem3_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 3])
merge_list('BA_Eco_Sem5_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 5])
merge_list('BA_Eco_Sem7_All_Sections.pdf', [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 7])

merge_list('SEC_VAC_All_Semesters.pdf', [t for t in successful_html if t['course'] == 'SEC / VAC Joint'])

active_items = (
    [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] in [1, 3, 5]] +
    [t for t in successful_html if t['course'] == 'B.Com (Hons)' and t['semester'] == 7 and t['section'] == 'A'] +
    [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] in [1, 3, 5]] +
    [t for t in successful_html if t['course'] == 'B.A. (Hons) Economics' and t['semester'] == 7 and t['section'] == 'A'] +
    [t for t in successful_html if t['course'] == 'SEC / VAC Joint']
)
merge_list('SRCC_Complete_Active_Timetables_Booklet.pdf', active_items)

# Clean temp html
try:
    for f in os.listdir(TEMP_HTML_DIR):
        os.remove(os.path.join(TEMP_HTML_DIR, f))
    os.rmdir(TEMP_HTML_DIR)
except Exception:
    pass

print("\nAll PDFs and Booklets re-rendered with perfect 1-page fit!")
