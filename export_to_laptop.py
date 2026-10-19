import os
import json
import csv
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(ROOT_DIR, "web_app")

DESKTOP_DIR = r"C:\Users\anand_fua08yg\OneDrive\Desktop\SRCC_All_Data"
DOWNLOADS_DIR = r"C:\Users\anand_fua08yg\Downloads\SRCC_All_Data"

TARGET_DIRS = [DESKTOP_DIR, DOWNLOADS_DIR]

ALL_DATA_FILES = [
    "exam_codes_data.json",
    "exam_codes_data.js",
    "classes_data.json",
    "classes_data.js",
    "teachers_data.json",
    "teachers_data.js",
    "srcc_data.json",
    "data.js",
    "college_notices.json",
    "college_notices.js",
    "faculty_leaves.json",
    "faculty_leaves.js",
    "wifi_data.json",
    "wifi_data.js",
    "campus_map_data.json",
    "directory_data.json",
    "widget_feed.json",
    "SRCC_Free_Classrooms_Timetable.xlsx"
]

def export_exam_codes_csv(out_dir):
    src = os.path.join(WEB_APP_DIR, "exam_codes_data.json")
    if not os.path.exists(src):
        return
    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    csv_path = os.path.join(out_dir, "SRCC_Exam_Codes_and_Syllabi.csv")
    fields = [
        "upc", "title", "programme", "department", "semester",
        "category", "type", "course_no", "credits", "theory",
        "tutorial", "practical", "syllabus_url", "is_srcc_offered"
    ]
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for row in data:
            writer.writerow({k: row.get(k, "") for k in fields})

def generate_offline_html_viewer(out_dir):
    src_json = os.path.join(WEB_APP_DIR, "exam_codes_data.json")
    with open(src_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SRCC & DU Exam Codes & Syllabi (Offline Laptop Viewer)</title>
  <style>
    :root {{
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --tag-core: #22c55e;
      --tag-dse: #a855f7;
      --tag-ge: #3b82f6;
      --tag-sec: #f59e0b;
      --tag-vac: #ec4899;
      --tag-aec: #14b8a6;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }}
    .header {{
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }}
    h1 {{ font-size: 1.5rem; font-weight: 700; color: #fff; }}
    .subtitle {{ color: var(--muted); font-size: 0.9rem; margin-top: 4px; }}
    .search-box {{
      width: 100%;
      max-width: 420px;
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: #fff;
      font-size: 0.95rem;
      outline: none;
    }}
    .search-box:focus {{ border-color: var(--accent); }}
    .filter-bar {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 20px;
    }}
    .pill {{
      padding: 6px 14px;
      border-radius: 20px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--muted);
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }}
    .pill.active, .pill:hover {{
      background: var(--accent);
      color: #0f172a;
      font-weight: 600;
      border-color: var(--accent);
    }}
    .stats {{ color: var(--muted); font-size: 0.9rem; margin-bottom: 16px; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }}
    .card {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      transition: transform 0.15s, border-color 0.15s;
    }}
    .card:hover {{
      transform: translateY(-2px);
      border-color: var(--accent);
    }}
    .tags {{ display: flex; flex-wrap: wrap; gap: 6px; }}
    .badge {{
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      background: #334155;
      color: #cbd5e1;
    }}
    .badge-core {{ background: rgba(34, 197, 94, 0.2); color: #4ade80; }}
    .badge-dse {{ background: rgba(168, 85, 247, 0.2); color: #c084fc; }}
    .badge-ge {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; }}
    .badge-sec {{ background: rgba(245, 158, 11, 0.2); color: #fbbf24; }}
    .badge-vac {{ background: rgba(236, 72, 153, 0.2); color: #f472b6; }}
    .badge-aec {{ background: rgba(20, 184, 166, 0.2); color: #2dd4bf; }}
    .title {{ font-size: 1.05rem; font-weight: 600; color: #fff; }}
    .upc-row {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: monospace;
      font-size: 0.9rem;
      background: #0f172a;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #1e293b;
      color: #38bdf8;
    }}
    .meta-details {{
      font-size: 0.85rem;
      color: var(--muted);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}
    .link-btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      border-radius: 6px;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: background 0.2s;
    }}
    .link-btn:hover {{
      background: var(--accent);
      color: #0f172a;
    }}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>SRCC & DU Exam Codes & Official Syllabi</h1>
      <div class="subtitle">Complete offline archive saved directly on your laptop | 454 Verified Papers</div>
    </div>
    <input type="text" id="searchInput" class="search-box" placeholder="Search by paper title, UPC, semester...">
  </div>

  <div class="filter-bar" id="pillFilter">
    <button class="pill active" data-prog="ALL">All Papers (454)</button>
    <button class="pill" data-prog="B.Com. (Hons.)">B.Com. (Hons.)</button>
    <button class="pill" data-prog="B.A. (Hons.) Economics">B.A. (Hons.) Economics</button>
    <button class="pill" data-prog="SEC">Skill Enhancement (SEC)</button>
    <button class="pill" data-prog="AEC">Ability Enhancement (AEC)</button>
    <button class="pill" data-prog="VAC">Value Addition (VAC)</button>
    <button class="pill" data-prog="GE (Elective)">Generic Elective (GE)</button>
  </div>

  <div class="stats" id="statsCount">Showing 454 papers</div>

  <div class="grid" id="papersGrid"></div>

  <script>
    const data = {json.dumps(data)};
    let activeProg = 'ALL';
    let searchQuery = '';

    const grid = document.getElementById('papersGrid');
    const stats = document.getElementById('statsCount');
    const searchInput = document.getElementById('searchInput');
    const pills = document.querySelectorAll('.pill');

    function getBadgeClass(cat) {{
      const c = (cat || '').toUpperCase();
      if (c.includes('CORE')) return 'badge-core';
      if (c.includes('DSE')) return 'badge-dse';
      if (c.includes('GE')) return 'badge-ge';
      if (c.includes('SEC')) return 'badge-sec';
      if (c.includes('VAC')) return 'badge-vac';
      if (c.includes('AEC')) return 'badge-aec';
      return '';
    }}

    function render() {{
      const filtered = data.filter(item => {{
        if (activeProg !== 'ALL') {{
          const p = (item.programme || '').toUpperCase();
          const target = activeProg.toUpperCase();
          if (!p.includes(target) && !((item.category || '').toUpperCase().includes(target))) {{
            return false;
          }}
        }}
        if (searchQuery) {{
          const q = searchQuery.toLowerCase();
          const title = (item.title || '').toLowerCase();
          const upc = (item.upc || '').toLowerCase();
          const sem = (item.semester || '').toLowerCase();
          const cno = (item.course_no || '').toLowerCase();
          if (!title.includes(q) && !upc.includes(q) && !sem.includes(q) && !cno.includes(q)) {{
            return false;
          }}
        }}
        return true;
      }});

      stats.textContent = `Showing ${{filtered.length}} of ${{data.length}} papers`;

      grid.innerHTML = filtered.map(item => `
        <div class="card">
          <div>
            <div class="tags">
              <span class="badge ${{getBadgeClass(item.category)}}">${{item.category || item.type || 'Course'}}</span>
              ${{item.semester ? `<span class="badge">Sem ${{item.semester}}</span>` : ''}}
              ${{item.course_no ? `<span class="badge">${{item.course_no}}</span>` : ''}}
            </div>
            <h3 class="title" style="margin-top: 10px;">${{item.title}}</h3>
          </div>

          <div>
            <div class="upc-row">
              <span style="color: var(--muted); font-size: 0.75rem;">UPC:</span>
              <strong>${{item.upc || 'TBA'}}</strong>
            </div>

            <div class="meta-details" style="margin-top: 10px;">
              <div><strong>Programme:</strong> ${{item.programme || 'DU UGCF'}}</div>
              <div><strong>Credits:</strong> ${{item.credits || '4'}} (${{item.theory || 0}}L + ${{item.tutorial || 0}}T + ${{item.practical || 0}}P)</div>
            </div>
          </div>

          ${{item.syllabus_url ? `<a href="${{item.syllabus_url}}" target="_blank" class="link-btn">Official DU Syllabus PDF &rarr;</a>` : ''}}
        </div>
      `).join('');
    }}

    searchInput.addEventListener('input', (e) => {{
      searchQuery = e.target.value.trim();
      render();
    }});

    pills.forEach(p => {{
      p.addEventListener('click', () => {{
        pills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        activeProg = p.dataset.prog;
        render();
      }});
    }});

    render();
  </script>
</body>
</html>
"""
    viewer_path = os.path.join(out_dir, "Browse_All_Papers_Offline.html")
    with open(viewer_path, "w", encoding="utf-8") as f:
        f.write(html_content)

def main():
    print("[INFO] Saving all SRCC data directly onto your laptop...")
    
    for target in TARGET_DIRS:
        os.makedirs(target, exist_ok=True)
        print(f"\n[INFO] Populating target directory: {target}")
        
        # 1. Copy all datasets
        for fname in ALL_DATA_FILES:
            src = os.path.join(WEB_APP_DIR, fname)
            if not os.path.exists(src):
                src = os.path.join(ROOT_DIR, fname)
            if os.path.exists(src):
                dst = os.path.join(target, fname)
                shutil.copy2(src, dst)
        
        # 2. Export Excel-compatible CSV with all papers
        export_exam_codes_csv(target)
        
        # 3. Generate offline 1-click HTML viewer
        generate_offline_html_viewer(target)
        
        print(f"[SUCCESS] Successfully saved datasets, CSV, and Offline Viewer to: {target}")

    print("\n[COMPLETE] All data is now permanently saved locally on your laptop!")

if __name__ == "__main__":
    main()
