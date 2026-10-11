import os
import json

base_dir = os.path.abspath('SRCC_Printable_Timetables')

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SRCC Official Printable Timetables | Shri Ram College of Commerce</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #800000;
      --primary-light: #9e1b1b;
      --primary-gradient: linear-gradient(135deg, #800000 0%, #4a0000 100%);
      --gold: #d4af37;
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: #090d16;
      background-image: 
        radial-gradient(at 0% 0%, rgba(128, 0, 0, 0.25) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.15) 0px, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      padding: 24px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header */
    header {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 28px 36px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 20px;
      box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .crest {
      width: 68px;
      height: 68px;
      border-radius: 14px;
      background: linear-gradient(135deg, #800000, #300);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      box-shadow: 0 8px 20px rgba(128, 0, 0, 0.4);
      border: 1px solid rgba(212, 175, 55, 0.3);
    }

    .brand h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #fff;
    }

    .brand p {
      font-size: 13px;
      color: var(--gold);
      font-weight: 500;
      margin-top: 2px;
    }

    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      padding: 8px 16px;
      border-radius: 30px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .meta-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 8px var(--success);
    }

    /* Booklets Hero Section */
    .booklets-section {
      background: linear-gradient(135deg, rgba(128, 0, 0, 0.25) 0%, rgba(30, 41, 59, 0.5) 100%);
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-radius: 20px;
      padding: 24px 30px;
      margin-bottom: 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }

    .section-title {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .booklets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }

    .booklet-card {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.2s ease;
      text-decoration: none;
      color: inherit;
    }

    .booklet-card:hover {
      transform: translateY(-3px);
      border-color: var(--gold);
      box-shadow: 0 10px 25px -5px rgba(212, 175, 55, 0.15);
    }

    .booklet-card .b-title {
      font-family: 'Outfit', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }

    .booklet-card .b-desc {
      font-size: 12px;
      color: var(--text-muted);
    }

    .booklet-card .b-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: var(--primary-gradient);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.1);
    }

    /* Filters */
    .controls {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 4px;
      gap: 4px;
    }

    .filter-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    .filter-btn:hover {
      color: #fff;
    }

    .filter-btn.active {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 4px 12px rgba(128, 0, 0, 0.4);
    }

    /* Timetables Grid */
    .timetables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      transition: all 0.2s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 12px 24px -10px rgba(0,0,0,0.5);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .card-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-bcom {
      background: rgba(128, 0, 0, 0.3);
      color: #ff9999;
      border: 1px solid rgba(128, 0, 0, 0.5);
    }

    .badge-eco {
      background: rgba(14, 165, 233, 0.2);
      color: #7dd3fc;
      border: 1px solid rgba(14, 165, 233, 0.4);
    }

    .badge-sec {
      background: rgba(212, 175, 55, 0.2);
      color: #fde047;
      border: 1px solid rgba(212, 175, 55, 0.4);
    }

    .card-title {
      font-family: 'Outfit', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin-top: 6px;
    }

    .card-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .card-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      font-family: inherit;
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: var(--primary-gradient);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #a00000 0%, #6a0000 100%);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #cbd5e1;
      border: 1px solid var(--card-border);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
    }

    /* Print Preview Modal / Frame */
    .print-frame {
      display: none;
    }
  </style>
</head>
<body>

  <div class="container">
    <header>
      <div class="brand">
        <div class="crest">🏛️</div>
        <div>
          <h1>Shri Ram College of Commerce</h1>
          <p>Official Print-Ready Timetable Archive • Academic Session 2026-27</p>
        </div>
      </div>
      <div class="meta-badge">
        <div class="dot"></div>
        <span>Vector Print Engine • A4 Landscape Ready</span>
      </div>
    </header>

    <!-- Combined Booklets Section -->
    <div class="booklets-section">
      <div class="section-title">
        <span>📑</span> Single-Click Master Print Booklets (Merged All-in-One PDFs)
      </div>
      <div class="booklets-grid">
        <a href="Combined_Booklets/BCom_Sem1_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.Com (Hons) Sem I Booklet</div>
          <div class="b-desc">All Sections A to N combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (14 Sections)</div>
        </a>
        <a href="Combined_Booklets/BCom_Sem3_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.Com (Hons) Sem III Booklet</div>
          <div class="b-desc">All Sections A to N combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (14 Sections)</div>
        </a>
        <a href="Combined_Booklets/BCom_Sem5_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.Com (Hons) Sem V Booklet</div>
          <div class="b-desc">All Sections A to N combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (14 Sections)</div>
        </a>
        <a href="Combined_Booklets/BA_Eco_Sem1_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.A. (Hons) Eco Sem I Booklet</div>
          <div class="b-desc">All Sections A to D combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (4 Sections)</div>
        </a>
        <a href="Combined_Booklets/BA_Eco_Sem3_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.A. (Hons) Eco Sem III Booklet</div>
          <div class="b-desc">All Sections A to D combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (4 Sections)</div>
        </a>
        <a href="Combined_Booklets/BA_Eco_Sem5_All_Sections.pdf" target="_blank" class="booklet-card">
          <div class="b-title">B.A. (Hons) Eco Sem V Booklet</div>
          <div class="b-desc">All Sections A to D combined into 1 printable PDF document.</div>
          <div class="b-btn">📥 Open / Print Booklet (4 Sections)</div>
        </a>
        <a href="Combined_Booklets/SEC_VAC_All_Semesters.pdf" target="_blank" class="booklet-card">
          <div class="b-title">SEC / VAC / Joint Booklet</div>
          <div class="b-desc">All Value Addition & Skill Enhancement batches combined.</div>
          <div class="b-btn">📥 Open / Print Booklet (Sem 1, 3, 5)</div>
        </a>
        <a href="Combined_Booklets/SRCC_Complete_Active_Timetables_Booklet.pdf" target="_blank" class="booklet-card">
          <div class="b-title">🌟 Master College Print Book</div>
          <div class="b-desc">Complete college timetable across all active degrees and sections.</div>
          <div class="b-btn">📥 Open Full Master Booklet</div>
        </a>
      </div>
    </div>

    <!-- Controls / Filters -->
    <div class="controls">
      <div class="filter-group" id="courseFilters">
        <button class="filter-btn active" data-course="all">All Degrees</button>
        <button class="filter-btn" data-course="bcom">B.Com (Hons)</button>
        <button class="filter-btn" data-course="eco">B.A. (Hons) Economics</button>
        <button class="filter-btn" data-course="sec_vac">SEC / VAC Joint</button>
      </div>

      <div class="filter-group" id="semFilters">
        <button class="filter-btn active" data-sem="all">All Semesters</button>
        <button class="filter-btn" data-sem="1">Semester 1</button>
        <button class="filter-btn" data-sem="2">Semester 2</button>
        <button class="filter-btn" data-sem="3">Semester 3</button>
        <button class="filter-btn" data-sem="5">Semester 5</button>
        <button class="filter-btn" data-sem="7">Semester 7</button>
      </div>
    </div>

    <!-- Timetables Grid -->
    <div class="timetables-grid" id="grid">
      <!-- Injected via JavaScript -->
    </div>
  </div>

  <iframe id="printIframe" class="print-frame"></iframe>

  <script>
    // Data list of all generated files
    const items = [];
"""

# Scan directories and populate items in JavaScript
items = []

# B.Com
bcom_dir = os.path.join(base_dir, 'BCom_Hons')
if os.path.exists(bcom_dir):
    for sem_folder in sorted(os.listdir(bcom_dir)):
        sem_num = sem_folder.replace('Semester_', '')
        sub = os.path.join(bcom_dir, sem_folder)
        if os.path.isdir(sub):
            for f in sorted(os.listdir(sub)):
                if f.endswith('.pdf'):
                    sec = f.replace(f"BCom_Sem{sem_num}_Sec_", '').replace('.pdf', '')
                    rel_path = f"BCom_Hons/{sem_folder}/{f}"
                    items.append({
                        'course': 'bcom',
                        'courseName': 'B.Com (Hons)',
                        'badgeClass': 'badge-bcom',
                        'sem': sem_num,
                        'sec': sec,
                        'title': f"B.Com (Hons) - Sec {sec}",
                        'subtitle': f"Semester {sem_num} • Shri Ram College of Commerce",
                        'path': rel_path
                    })

# Eco
eco_dir = os.path.join(base_dir, 'BA_Economics')
if os.path.exists(eco_dir):
    for sem_folder in sorted(os.listdir(eco_dir)):
        sem_num = sem_folder.replace('Semester_', '')
        sub = os.path.join(eco_dir, sem_folder)
        if os.path.isdir(sub):
            for f in sorted(os.listdir(sub)):
                if f.endswith('.pdf'):
                    sec = f.replace(f"BA_Eco_Sem{sem_num}_Sec_", '').replace('.pdf', '')
                    rel_path = f"BA_Economics/{sem_folder}/{f}"
                    items.append({
                        'course': 'eco',
                        'courseName': 'B.A. (Hons) Economics',
                        'badgeClass': 'badge-eco',
                        'sem': sem_num,
                        'sec': sec,
                        'title': f"B.A. (Hons) Eco - Sec {sec}",
                        'subtitle': f"Semester {sem_num} • Shri Ram College of Commerce",
                        'path': rel_path
                    })

# SEC / VAC
sec_dir = os.path.join(base_dir, 'SEC_VAC_Joint')
if os.path.exists(sec_dir):
    for f in sorted(os.listdir(sec_dir)):
        if f.endswith('.pdf'):
            sem_num = f.replace('SEC_VAC_Joint_Sem', '').replace('.pdf', '')
            rel_path = f"SEC_VAC_Joint/{f}"
            items.append({
                'course': 'sec_vac',
                'courseName': 'SEC / VAC Joint',
                'badgeClass': 'badge-sec',
                'sem': sem_num,
                'sec': 'Joint',
                'title': f"SEC / VAC Joint Sem {sem_num}",
                'subtitle': f"Semester {sem_num} • All Value Addition Batches",
                'path': rel_path
            })

items_json = json.dumps(items, indent=2)

html_content += f"""
    const timetables = {items_json};

    let activeCourse = 'all';
    let activeSem = 'all';

    function render() {{
      const grid = document.getElementById('grid');
      grid.innerHTML = '';

      const filtered = timetables.filter(item => {{
        const courseMatch = activeCourse === 'all' || item.course === activeCourse;
        const semMatch = activeSem === 'all' || item.sem === activeSem;
        return courseMatch && semMatch;
      }});

      if (filtered.length === 0) {{
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No timetables found matching selected filters.</div>`;
        return;
      }}

      filtered.forEach(item => {{
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div>
            <div class="card-header">
              <span class="card-badge ${{item.badgeClass}}">${{item.courseName}}</span>
              <span style="font-size: 11px; color: var(--text-muted);">Sem ${{item.sem}}</span>
            </div>
            <div class="card-title">${{item.title}}</div>
            <div class="card-subtitle">${{item.subtitle}}</div>
          </div>
          <div class="card-actions">
            <a href="${{item.path}}" target="_blank" class="btn btn-secondary">
              📄 Open PDF
            </a>
            <button onclick="printFile('${{item.path}}')" class="btn btn-primary">
              🖨️ Print
            </button>
          </div>
        `;
        grid.appendChild(card);
      }});
    }}

    function printFile(filePath) {{
      const iframe = document.getElementById('printIframe');
      iframe.src = filePath;
      iframe.onload = () => {{
        iframe.contentWindow.print();
      }};
    }}

    // Filter Listeners
    document.getElementById('courseFilters').addEventListener('click', (e) => {{
      if (e.target.tagName === 'BUTTON') {{
        document.querySelectorAll('#courseFilters .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeCourse = e.target.getAttribute('data-course');
        render();
      }}
    }});

    document.getElementById('semFilters').addEventListener('click', (e) => {{
      if (e.target.tagName === 'BUTTON') {{
        document.querySelectorAll('#semFilters .filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeSem = e.target.getAttribute('data-sem');
        render();
      }}
    }});

    // Initial render
    render();
  </script>
</body>
</html>
"""

with open(os.path.join(base_dir, 'Print_Portal.html'), 'w', encoding='utf-8') as f:
    f.write(html_content)

print(f"Print Portal generated at {os.path.join(base_dir, 'Print_Portal.html')}")
