"""
SRCC Faculty / Teacher Timetable Scraper
Scrapes all 210 teachers from https://srcccollegetimetable.in/ and parses:
- Teacher ID, Name, Short Code, Primary Department
- Complete weekly schedule (Monday-Saturday)
- For each class: Time slot, Room No (R1-R37, T1-T54, PB, CL, SCR), Course/Section, Subject
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

BASE_URL = 'https://srcccollegetimetable.in/'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

STANDARD_PERIODS = [
    '8:30 AM to 9:30 AM',
    '9:30 AM to 10:30 AM',
    '10:30 AM to 11:30 AM',
    '11:30 AM to 12:30 PM',
    '12:30 PM to 1:30 PM',
    '2:00 PM to 3:00 PM',
    '3:00 PM to 4:00 PM',
    '4:00 PM to 5:00 PM',
    '5:00 PM to 6:00 PM'
]

DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

# Department Detection Dictionary
DEPT_MAP = {
    'commerce': 'Commerce',
    'economics': 'Economics',
    'math': 'Mathematics',
    'english': 'English',
    'pol.sc': 'Political Science',
    'political': 'Political Science',
    'phy.ed': 'Physical Education',
    'sports': 'Physical Education',
    'hindi': 'Hindi',
    'environmental': 'EVS',
    'evs': 'EVS',
    'computer': 'Computer Science'
}

class TimetableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_tr = False
        self.in_cell = False
        self.current_colspan = 1
        self.current_cell_text = []
        self.current_row = []
        self.rows = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'table' and attrs_dict.get('border') == '1':
            self.in_table = True
        if self.in_table:
            if tag == 'tr':
                self.in_tr = True
                self.current_row = []
            elif tag in ('td', 'th') and self.in_tr:
                self.in_cell = True
                try:
                    self.current_colspan = int(attrs_dict.get('colspan', 1))
                except (ValueError, TypeError):
                    self.current_colspan = 1
                self.current_cell_text = []

    def handle_endtag(self, tag):
        if self.in_table:
            if tag in ('td', 'th') and self.in_cell:
                raw_text = ''.join(self.current_cell_text).replace('&nbsp;', ' ')
                clean_text = ' '.join(raw_text.split())
                for _ in range(self.current_colspan):
                    self.current_row.append(clean_text)
                self.in_cell = False
            elif tag == 'tr' and self.in_tr:
                if self.current_row:
                    self.rows.append(self.current_row)
                self.in_tr = False
            elif tag == 'table':
                self.in_table = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell_text.append(data)


def discover_teachers():
    """Discover all teacher IDs and names from the official portal dropdown."""
    print("Fetching teacher directory from portal...")
    req = urllib.request.Request(BASE_URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')

    m = re.search(r'<select name="teacher"[^>]*>([\s\S]*?)</select>', html)
    if not m:
        raise Exception("Could not find 'teacher' select element on page!")

    options = re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m.group(1))
    teachers = []
    for val, text in options:
        val = val.strip()
        if not val:
            continue
        clean_text = ' '.join(text.replace('&nbsp;', ' ').split())
        teachers.append((val, clean_text))

    print(f"Discovered {len(teachers)} teachers.")
    return teachers


def extract_room_code(text):
    """Extract room code like R1-R37, T1-T54, PB2-PB4, SCR1-SCR4, CL1-CLIB, etc."""
    # Match R1..R37
    m = re.search(r'\b(R\d{1,2})\b', text, re.I)
    if m:
        return m.group(1).upper()
    # Match T1..T54
    m = re.search(r'\b(T\d{1,2})\b', text, re.I)
    if m:
        return m.group(1).upper()
    # Match PB2..PB4
    m = re.search(r'\b(PB\d{1,2})\b', text, re.I)
    if m:
        return m.group(1).upper()
    # Match SCR1..SCR4
    m = re.search(r'\b(SCR\d{1,2})\b', text, re.I)
    if m:
        return m.group(1).upper()
    # Match CL1..CLIB
    m = re.search(r'\b(CL(?:IB|\d))\b', text, re.I)
    if m:
        return m.group(1).upper()
    # Match Seminar / Library / Principal
    if re.search(r'seminar', text, re.I):
        return 'SEMINAR'
    if re.search(r'library', text, re.I):
        return 'LIBRARY'
    if re.search(r'playground|ground', text, re.I):
        return 'PLAYGROUND'
    
    # Generic Room suffix check e.g. -R15
    m = re.search(r'-(R\d+|T\d+|PB\d+|SCR\d+|CL\d+)', text, re.I)
    if m:
        return m.group(1).upper()

    return 'TBD'


def parse_class_entry(raw_text):
    """Parse raw class cell into structured details."""
    if not raw_text or not raw_text.strip():
        return None

    clean = raw_text.strip()
    room = extract_room_code(clean)

    # Class type
    class_type = 'Lecture'
    if clean.startswith('LAB') or 'LAB' in clean:
        class_type = 'Practical/Lab'
    elif clean.startswith('T-') or clean.startswith('TUT') or 'TUT' in clean:
        class_type = 'Tutorial'

    # Subject / Course extraction heuristics
    subject = ''
    subj_m = re.search(r'([A-Z]{2,6}(?:\s+[I|V|X]+)?)(?:-[A-Z0-9]+)?$', clean)
    if subj_m:
        subject = subj_m.group(1)

    # Course extraction
    course = ''
    if 'BCH' in clean:
        course = 'B.Com (Hons)'
    elif 'BAH' in clean or 'ECO' in clean:
        course = 'B.A. (Hons) Economics'
    elif 'M.COM' in clean:
        course = 'M.Com'
    elif 'MA-ECO' in clean:
        course = 'M.A. Economics'

    # Semester
    sem_m = re.search(r'SEM\s+([I|V|X]+)', clean, re.I)
    semester = f"Sem {sem_m.group(1)}" if sem_m else ''

    # Clean description
    desc = clean.replace('<----------------------->', '').strip()

    return {
        'raw': clean,
        'display': desc,
        'type': class_type,
        'room': room,
        'course': course,
        'semester': semester,
        'subject': subject
    }


def fetch_teacher_timetable(teacher_id, teacher_label, max_retries=3):
    """Fetch timetable HTML and parse rows for a single teacher."""
    data = urllib.parse.urlencode({
        'classId': '',
        'semester': '',
        'class_section': '',
        'teacher': teacher_id,
        'roomno': '',
        'submit': 'Go'
    }).encode('utf-8')

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                BASE_URL,
                data=data,
                headers={**HEADERS, 'Content-Type': 'application/x-www-form-urlencoded'}
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode('utf-8', errors='ignore')

            parser = TimetableParser()
            parser.feed(html)

            return {
                'id': teacher_id,
                'label': teacher_label,
                'rows': parser.rows,
                'success': True
            }
        except Exception as e:
            if attempt == max_retries - 1:
                return {
                    'id': teacher_id,
                    'label': teacher_label,
                    'rows': [],
                    'success': False,
                    'error': str(e)
                }
            time.sleep(0.8 * (attempt + 1))


def process_teacher_data(raw_teacher):
    """Transform raw table rows of a teacher into a structured profile and schedule."""
    t_id = raw_teacher['id']
    label = raw_teacher['label']

    # Extract clean name and short code: e.g. "Aayushi (cg16)" -> "Aayushi", "cg16"
    m_code = re.search(r'^(.*?)\s*\((.*?)\)$', label)
    if m_code:
        clean_name = m_code.group(1).strip()
        short_code = m_code.group(2).strip()
    else:
        clean_name = label
        short_code = ''

    # Department heuristics
    dept_votes = {}
    schedule = {day: [] for day in DAYS}
    total_teaching_periods = 0

    rows = raw_teacher.get('rows', [])
    if len(rows) > 1:
        # Row 0 is header with periods
        period_headers = rows[0][1:]

        for row in rows[1:]:
            if not row:
                continue
            day_name = row[0].strip()
            if day_name not in DAYS:
                continue

            cells = row[1:]
            for idx, cell_text in enumerate(cells):
                if idx >= len(period_headers):
                    break
                slot_name = period_headers[idx].strip()
                if not cell_text or not cell_text.strip() or 'LUNCH RECESS' in cell_text.upper():
                    continue

                parsed = parse_class_entry(cell_text)
                if parsed:
                    # check department hint
                    low_text = cell_text.lower()
                    for k, d in DEPT_MAP.items():
                        if k in low_text:
                            dept_votes[d] = dept_votes.get(d, 0) + 1

                    parsed['slot'] = slot_name
                    schedule[day_name].append(parsed)
                    total_teaching_periods += 1

    # Determine dominant department
    if dept_votes:
        dominant_dept = max(dept_votes.items(), key=lambda x: x[1])[0]
    else:
        dominant_dept = 'Commerce' # Default SRCC main faculty

    # Compute Initials for avatar: e.g. "Aditi Khanna" -> "AK", "Aayushi" -> "AA"
    name_parts = clean_name.split()
    if len(name_parts) >= 2:
        initials = (name_parts[0][0] + name_parts[1][0]).upper()
    elif len(name_parts) == 1 and len(name_parts[0]) >= 2:
        initials = name_parts[0][:2].upper()
    else:
        initials = clean_name[:2].upper() if clean_name else 'FA'

    return {
        'id': t_id,
        'label': label,
        'clean_name': clean_name,
        'short_code': short_code,
        'initials': initials,
        'department': dominant_dept,
        'total_teaching_periods': total_teaching_periods,
        'schedule': schedule
    }


def scrape_all_teachers():
    """Main orchestrator: discover and scrape all teachers concurrently."""
    teachers_list = discover_teachers()
    results = []

    print(f"\nScraping schedules for {len(teachers_list)} teachers (10 workers)...")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_map = {
            executor.submit(fetch_teacher_timetable, tid, tlabel): (tid, tlabel)
            for tid, tlabel in teachers_list
        }

        completed = 0
        for future in as_completed(future_map):
            raw = future.result()
            processed = process_teacher_data(raw)
            results.append(processed)
            completed += 1
            if completed % 25 == 0 or completed == len(teachers_list):
                print(f"  [{completed}/{len(teachers_list)}] Teachers scraped...")

    elapsed = time.time() - start_time
    print(f"\nScraped {len(results)} teachers in {elapsed:.2f} seconds.")

    # Sort naturally by teacher clean_name
    results.sort(key=lambda t: t['clean_name'].lower())

    departments = sorted(list(set(t['department'] for t in results)))

    payload = {
        'metadata': {
            'college': 'Shri Ram College of Commerce (SRCC)',
            'total_teachers': len(results),
            'last_synced': datetime.now().strftime('%d %b %Y, %I:%M %p'),
            'last_synced_iso': datetime.now().isoformat(),
            'departments': departments,
            'academic_periods': STANDARD_PERIODS,
            'days': DAYS
        },
        'teachers': results
    }

    return payload


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    web_app_dir = os.path.join(base_dir, 'web_app')
    preview_dir = os.path.join(base_dir, 'preview_web_app')
    os.makedirs(web_app_dir, exist_ok=True)

    payload = scrape_all_teachers()

    targets = [web_app_dir, preview_dir]
    for target_dir in targets:
        if os.path.exists(target_dir):
            out_json = os.path.join(target_dir, 'teachers_data.json')
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)

            out_js = os.path.join(target_dir, 'teachers_data.js')
            with open(out_js, 'w', encoding='utf-8') as f:
                f.write("window.SRCC_TEACHERS_DATA = ")
                json.dump(payload, f, indent=2, ensure_ascii=False)
                f.write(";\n")

            print(f"Exported teachers data to: {target_dir}")

    # Also update Downloads if on Windows
    user_home = os.path.expanduser("~")
    downloads_dir = os.path.join(user_home, "Downloads", "srcc_web_app_for_netlify")
    if os.path.exists(downloads_dir):
        out_json = os.path.join(downloads_dir, 'teachers_data.json')
        with open(out_json, 'w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        out_js = os.path.join(downloads_dir, 'teachers_data.js')
        with open(out_js, 'w', encoding='utf-8') as f:
            f.write("window.SRCC_TEACHERS_DATA = ")
            json.dump(payload, f, indent=2, ensure_ascii=False)
            f.write(";\n")
        print(f"Exported teachers data to: {downloads_dir}")

if __name__ == '__main__':
    main()
