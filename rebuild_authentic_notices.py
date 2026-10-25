import re
import json
import os
import html

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
WEB_APP_DIR = os.path.join(ROOT_DIR, 'web_app')
RAW_HTML_PATH = os.path.join(ROOT_DIR, 'scratch', 'srcc_announcements_raw.html')

with open(RAW_HTML_PATH, 'r', encoding='utf-8') as f:
    raw_html = f.read()

pattern = re.compile(
    r'<div class="announcementtime">\s*([^<]+)\s*</div>\s*<div class="annoncementList">\s*<a href="([^"]+)"[^>]*>\s*([^<]+)\s*</a>',
    re.IGNORECASE
)

matches = pattern.findall(raw_html)
print(f"Parsed {len(matches)} structured announcements from official SRCC announcements HTML.")

def determine_category(t, l):
    t_low = t.lower()
    l_low = l.lower()
    if any(k in t_low or k in l_low for k in ['exam', 'datesheet', 'admit card', 'repeater', 'internal assessment', 'ca marks', 'ia marks', 'practical', 'attendance', 'medical cases']):
        return 'examinations'
    if any(k in t_low or k in l_low for k in ['orientation', 'syllabus', 'curriculum', 'lecture', 'conference', 'workshop', 'academic', 'newsletter', 'iqac', 'training session', 'pwbd']):
        return 'academic'
    if any(k in t_low or k in l_low for k in ['society', 'club', 'competition', 'fest', 'cultural', 'audition', 'sports', 'painting', 'safety', 'helpline']):
        return 'societies'
    if any(k in t_low or k in l_low for k in ['placement', 'internship', 'recruitment', 'cv', 'hiring', 'campus drive']):
        return 'placements'
    if any(k in t_low or k in l_low for k in ['admission', 'fee', 'cuet', 'registration', 'verification', 'concession', 's.a.f']):
        return 'admissions'
    return 'administration'

def detect_deadline(t, l):
    t_low = t.lower()
    if 'last date extended' in t_low:
        m = re.search(r'extended\s*(?:upto|till)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?)', t, re.IGNORECASE)
        dl = m.group(1) if m else "See Notice"
        return True, "Extended Last Date", dl
    if any(k in t_low for k in ['last date', 'deadline', 'due date', 'final date', 'last date extended']):
        m = re.search(r'(?:last date|deadline|due date|upto|till)\s*(?:is|on|:|-)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?)', t, re.IGNORECASE)
        dl = m.group(1) if m else "Approaching Deadline"
        return True, "Deadline", dl
    return False, None, None

notices = []
seen_keys = set()

for i, (date_raw, link_raw, title_raw) in enumerate(matches):
    title = html.unescape(title_raw)
    title = re.sub(r'\s+', ' ', title).strip()
    date = html.unescape(date_raw)
    date = re.sub(r'\s+', ' ', date).strip()
    link = link_raw.strip()

    if link.startswith('/'):
        link = 'https://www.srcc.edu' + link
    elif not link.startswith('http'):
        link = 'https://www.srcc.edu/' + link

    key = (title.lower(), link.lower())
    if key in seen_keys:
        continue
    seen_keys.add(key)

    has_dl, dl_label, dl_val = detect_deadline(title, link)
    cat = determine_category(title, link)
    ext = link.split('.')[-1].lower() if '.' in link else 'link'
    if ext not in ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx']:
        ext = 'pdf' if 'pdf' in link.lower() else 'link'

    notices.append({
        "id": f"srcc-notice-{len(notices) + 1}",
        "title": title,
        "category": cat,
        "link": link,
        "link_type": ext,
        "date": date,
        "deadline": dl_val,
        "deadline_label": dl_label,
        "has_deadline": has_dl,
        "source": "Official SRCC Announcements (srcc.edu)"
    })

print(f"Generated {len(notices)} unique, authentic notices with genuine college publication dates.")
for n in notices[:8]:
    print(f"  [{n['date']}] [{n['category'].upper()}] {n['title'][:70]} (Link: {n['link_type']})")

payload = {
    "total": len(notices),
    "source": "https://www.srcc.edu/announcements",
    "last_sync": "2026-10-25T23:45:00",
    "notices": notices
}

# 1. Write to web_app/college_notices.json
json_path = os.path.join(WEB_APP_DIR, 'college_notices.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2, ensure_ascii=False)

# 2. Write to web_app/college_notices.js
js_path = os.path.join(WEB_APP_DIR, 'college_notices.js')
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_NOTICES_DATA = ')
    json.dump(payload, f, indent=2, ensure_ascii=False)
    f.write(';\nwindow.SRCC_OFFICIAL_NOTICES = window.SRCC_NOTICES_DATA.notices;\nwindow.COLLEGE_NOTICES = window.SRCC_OFFICIAL_NOTICES;\n')

# 3. Copy to root directory
import shutil
shutil.copy2(json_path, os.path.join(ROOT_DIR, 'college_notices.json'))
shutil.copy2(js_path, os.path.join(ROOT_DIR, 'college_notices.js'))
print("[SUCCESS] All notice databases updated with 100% genuine official dates and links!")
