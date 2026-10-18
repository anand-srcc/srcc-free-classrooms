"""
Live SRCC College Notices Automated Scraper & Monitor (24*7 Every 3 Hours)
Safeguards Netlify Build Credits: Only modifies files if actual new notices are detected.
"""

import os
import sys
import re
import json
import urllib.request
from html.parser import HTMLParser
from datetime import datetime

# Prevent Windows console charmap UnicodeEncodeError
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, 'web_app')
JSON_FILE = os.path.join(WEB_APP_DIR, 'college_notices.json')
JS_FILE = os.path.join(WEB_APP_DIR, 'college_notices.js')

class NoticeLinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_a = False
        self.current_href = ''
        self.current_text = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self.in_a = True
            attr_dict = dict(attrs)
            self.current_href = attr_dict.get('href', '')
            self.current_text = []

    def handle_data(self, data):
        if self.in_a:
            self.current_text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == 'a':
            self.in_a = False
            text = ' '.join(self.current_text).strip()
            # Clean non-breaking spaces and excessive whitespaces
            text = re.sub(r'\s+', ' ', text).strip()
            if self.current_href and len(text) > 4:
                if any(k in self.current_href for k in ['files', 'Attachment', 'smartprof', '.pdf', '.png', '.jpg', 'forms.gle', 'docs.google.com/forms']):
                    if text.lower() not in ['read more', 'click here', 'download', 'view', 'link', 'details']:
                        # Fix relative URLs
                        href = self.current_href.strip()
                        if href.startswith('/'):
                            href = 'https://www.srcc.edu' + href
                        elif not href.startswith('http'):
                            href = 'https://www.srcc.edu/' + href
                        self.links.append({'title': text, 'link': href})

def determine_category(t, l):
    t_low = t.lower()
    l_low = l.lower()
    if any(k in t_low or k in l_low for k in ['exam', 'datesheet', 'admit card', 'repeater', 'internal assessment', 'ca marks', 'ia marks', 'practical']):
        return 'examinations'
    if any(k in t_low or k in l_low for k in ['orientation', 'syllabus', 'curriculum', 'lecture', 'conference', 'workshop', 'academic']):
        return 'academic'
    if any(k in t_low or k in l_low for k in ['society', 'club', 'competition', 'fest', 'cultural', 'audition', 'sports']):
        return 'societies'
    if any(k in t_low or k in l_low for k in ['placement', 'internship', 'recruitment', 'cv', 'hiring', 'campus drive']):
        return 'placements'
    if any(k in t_low or k in l_low for k in ['admission', 'fee', 'cuet', 'registration', 'verification']):
        return 'admissions'
    return 'administration'

def detect_deadline(t, l):
    t_low = t.lower()
    if 'last date extended' in t_low:
        m = re.search(r'extended\s*(?:upto|till)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?)', t, re.IGNORECASE)
        dl = m.group(1) if m else "See Notice"
        return True, "Extended Last Date", dl
    if any(k in t_low for k in ['last date', 'deadline', 'due date', 'final date']):
        m = re.search(r'(?:last date|deadline|due date|upto|till)\s*(?:is|on|:|-)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?)', t, re.IGNORECASE)
        dl = m.group(1) if m else "Approaching Deadline"
        return True, "Deadline", dl
    return False, None, None

def fetch_live_notices():
    url = 'https://www.srcc.edu/announcements'
    print(f"[*] Fetching live announcements from {url}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    try:
        html = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[!] Warning: Could not fetch announcements: {e}")
        return []

    parser = NoticeLinkParser()
    parser.feed(html)
    return parser.links

def main():
    live_items = fetch_live_notices()
    if not live_items:
        print("[-] No items fetched or connection timed out.")
        return

    # Load existing notices
    existing_data = {"total": 0, "notices": []}
    existing_keys = set()
    if os.path.exists(JSON_FILE):
        try:
            with open(JSON_FILE, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            for n in existing_data.get('notices', []):
                key = (n.get('title', '').strip().lower(), n.get('link', '').strip().lower())
                existing_keys.add(key)
        except Exception as e:
            print(f"[!] Warning reading existing notices: {e}")

    new_notices = []
    for item in live_items:
        title = item['title']
        link = item['link']
        key = (title.strip().lower(), link.strip().lower())
        if key in existing_keys:
            continue

        has_dl, dl_label, dl_val = detect_deadline(title, link)
        cat = determine_category(title, link)
        ext = link.split('.')[-1].lower() if '.' in link else 'link'
        if ext not in ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx']:
            ext = 'pdf' if 'pdf' in link.lower() else 'link'

        now_str = datetime.now().strftime('%d %b %Y')
        new_notice = {
            "id": f"srcc-notice-{len(existing_data.get('notices', [])) + len(new_notices) + 1}",
            "title": title,
            "category": cat,
            "link": link,
            "link_type": ext,
            "date": now_str,
            "deadline": dl_val,
            "deadline_label": dl_label,
            "has_deadline": has_dl,
            "source": "Official SRCC Announcements (srcc.edu)"
        }
        new_notices.append(new_notice)
        existing_keys.add(key)

    if not new_notices:
        print("[✓] All notices are currently up to date. Zero modifications made.")
        print("[✓] Netlify build credits 100% preserved (No git diff triggered).")
        return

    print(f"[+] Detected {len(new_notices)} NEW official notices!")
    for nn in new_notices[:5]:
        print(f"    - [{nn['category'].upper()}] {nn['title']} ({nn['link']})")

    # Combine new notices at the top
    combined = new_notices + existing_data.get('notices', [])
    updated_payload = {
        "total": len(combined),
        "source": "https://www.srcc.edu/announcements",
        "last_sync": datetime.now().isoformat(),
        "notices": combined
    }

    # Write JSON
    with open(JSON_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated_payload, f, indent=2, ensure_ascii=False)

    # Write JS
    with open(JS_FILE, 'w', encoding='utf-8') as f:
        f.write('window.SRCC_NOTICES_DATA = ')
        json.dump(updated_payload, f, indent=2, ensure_ascii=False)
        f.write(';\nwindow.SRCC_OFFICIAL_NOTICES = window.SRCC_NOTICES_DATA.notices;\n')

    # Also update root copy if exists
    try:
        import shutil
        shutil.copy2(JSON_FILE, os.path.join(BASE_DIR, 'college_notices.json'))
        shutil.copy2(JS_FILE, os.path.join(BASE_DIR, 'college_notices.js'))
    except Exception:
        pass

    print(f"[✓] Successfully updated {JSON_FILE} and {JS_FILE} with {len(combined)} total notices.")

if __name__ == '__main__':
    main()
