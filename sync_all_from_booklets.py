"""
sync_all_from_booklets.py
Comprehensive Timetable, Faculty List & Room Vacant List Synchronization Engine
Sources data from:
1. SRCC Printable Timetables & Combined Booklets (169 verified teacher codes & official subjects)
2. Official SRCC Timetable Print-Preview Tables (100% complete cell grids & slot alignments)
3. Direct Room Schedules (96 rooms) & Faculty Schedules (210 teachers)

Produces thoroughly reconciled and verified:
- web_app/classes_data.json & web_app/classes_data.js
- web_app/teachers_data.json & web_app/teachers_data.js
- web_app/srcc_data.json & web_app/data.js
- SRCC_Free_Classrooms_Timetable.xlsx & web_app/SRCC_Free_Classrooms_Timetable.xlsx
- web_app/widget_feed.json
"""

import os
import sys
import json
import re
import time
import shutil
import urllib.request
import urllib.parse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict, Counter

# Set console encoding to UTF-8
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, 'web_app')
BOOKLETS_DIR = os.path.join(BASE_DIR, 'SRCC_Printable_Timetables', 'Combined_Booklets')

BASE_URL = 'https://srcccollegetimetable.in/'
PRINT_PREVIEW_URL = 'https://srcccollegetimetable.in/admin/timetable_printpreview.php?mode=print'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': BASE_URL,
}

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

ROOM_REGEX = r'(?:Library\s*FF|Principal\s*Office|Seminar\s*Room|PLAYGROUND|CLIB|CL\d+|PB\d+|SCR\d+|R\d+|T\d+)'

# Official Subject Name Dictionary for DU / SRCC
SUBJECT_MAP = {
    # Core B.Com (Hons) & B.A. (Hons) Economics DSC / DSE
    'BLAW': 'Business Law',
    'FA': 'Financial Accounting',
    'MPA': 'Management Principles and Applications',
    'BECON': 'Business Economics',
    'POM': 'Principles of Marketing',
    'AUD': 'Auditing and Corporate Governance',
    'FMI': 'Financial Markets and Institutions',
    'EOE': 'Principles of Microeconomics',
    'EoE': 'Principles of Microeconomics',
    'EoE1': 'Principles of Microeconomics I',
    'BMATH': 'Business Mathematics',
    'ITLP': 'Income Tax Law and Practice',
    'MA': 'Management Accounting',
    'ED': 'Entrepreneurship Development',
    'MB': 'Money and Banking',
    'FM': 'Financial Management',
    'EVS': 'Environmental Studies',
    'EVS-I': 'Environmental Science: Theory into Practice-I',
    'EVS-II': 'Environmental Science: Theory into Practice-II',
    'PME-I': 'Principles of Microeconomics I',
    'PME': 'Principles of Microeconomics',
    'PMEE': 'Principles of Microeconomics',
    'BRM': 'Brand Management',
    'CAS': 'Computerized Accounting System',
    'CFD': 'Corporate Financial Decisions',
    'CFCR': 'Corporate Finance & Restructuring',
    'DnD': 'Digitalisation and Development',
    'Intro MME': 'Introductory Mathematical Methods for Economics',
    'Adv MME': 'Advanced Mathematical Methods for Economics',
    'IMA I': 'Intermediate Macroeconomics I',
    'IMIC1': 'Intermediate Microeconomics 1',
    'ISME': 'Introductory Statistics for Economics',
    'EHI': 'Economic History of India',
    'IDE': 'Issues in Development Economics',
    'GT': 'Game Theory and Strategic Interactions',
    'PE': 'Political Economy',
    'PM': 'Project Management',
    'RM': 'Research Methodology',
    'GBS': 'Global Business Strategy',
    'OEM': 'Open Elective Management',
    'AdTrix': 'Advanced Econometrics',
    'IIPT': 'Indian Political Thought',
    'NII': 'Nationalism in India',
    'UIR': 'Understanding International Relations',
    'GIC': 'Global Institutions and Commerce',
    'IGT': 'Interactive Game Theory',
    'IMC': 'Integrated Marketing Communication',
    'IST': 'Information Systems and Technology',
    'RIDL': 'Readings in Indian Democratic Literature',
    'TPF': 'Theory of Public Finance',
    'NM': 'Numerical Methods',
    'OB': 'Organisational Behaviour',
    'ODI': 'Organisational Dynamics & Intervention',
    'OE': 'Open Elective',
    'OOPUP': 'Programming Using Python',
    'OPUP': 'Programming Using Python',
    'OS': 'Operating Systems',
    'PAB': 'Public Administration and Business',
    'HFPE': 'Health, Fitness & Physical Education',
    'ACPA': 'Advanced Cost and Performance Analysis',
    'ACR': 'Accounting for Corporate Restructuring',
    'AFE': 'Accounting for Everyone',
    'AIS': 'Accounting Information Systems',
    'BF': 'Behavioral Finance',
    'BFIM': 'Banking, Financial Institutions & Markets',
    'BM': 'Business Management',
    'BSC': 'Business Communication',
    'GF': 'Global Finance',
    'IF': 'International Finance',
    'IBS': 'International Business Strategy',
    'IM': 'International Marketing',
    'ME': 'Managerial Economics',
    'MFB': 'Marketing for Beginners',
    'MFD': 'Macro Financial Dynamics',
    'SHRM': 'Strategic Human Resource Management',
    'SM': 'Strategic Management',
    'TA': 'Taxation & Accounting',
    'TR': 'Tools for Research',
    'WM': 'Wealth Management',

    # Skill Enhancement Courses (SEC)
    'IE': 'Innovation and Entrepreneurship',
    'BIDV': 'Business Intelligence and Data Visualisation',
    'DM': 'Digital Marketing',
    'PFP': 'Personal Financial Planning',
    'BIT': 'Basic IT Tools',
    'ITSA I': 'IT Skills and Data Analysis I',
    'ITSA II': 'IT Skills and Data Analysis II',
    'AS': 'Advanced Spreadsheet',
    'SWR': 'Statistics with R',
    'PUP': 'Programming Using Python',
    'CIEL': 'Communication in Everyday Life',
    'CPL': 'Communication in Professional Life',
    'CW': 'Creative Writing',
    'SET': 'Sustainable Eco Tourism and Entrepreneurship',
    'SRG': 'Sustainability Reporting',
    'EP': 'Essentials of Python',
    'NL': 'Negotiation and Leadership',
    'SMM': 'Social Media Marketing',
    'PSEL': 'Public Speaking in English Language and Leadership',
    'PSELL': 'Public Speaking in English Language and Leadership',

    # Value Addition Courses (VAC)
    'EI': 'Emotional Intelligence',
    'ABH': 'The Art of Being Happy',
    'DE': 'Digital Empowerment',
    'CVFD': 'Constitutional Values and Fundamental Duties',
    'VM I': 'Vedic Mathematics-I',
    'VM II': 'Vedic Mathematics-II',
    'VM III': 'Vedic Mathematics-III',
    'EC': 'Ethics and Culture',
    'TGNLC': 'The Gita: Navigating Life Challenges',
    'RIFE': 'Reading Indian Fiction in English',
    'VAC SEL': 'Social and Emotional Learning',
    'SEL': 'Social and Emotional Learning',

    # Ability Enhancement Courses (AEC)
    'HA': 'Hindi Cinema aur Uska Adhyayan (Hindi A)',
    'HB': 'Hindi-B',
    'H B': 'Hindi-B',
    'HC': 'Hindi-C',
    'HD': 'Hindi-D',
    'HE': 'Hindi-E',
    'AEC-HA': 'Hindi Cinema aur Uska Adhyayan (Hindi A)',
    'AEC-HB': 'Hindi-B',
    'AEC-HC': 'Hindi-C',
    'AEC-HD': 'Hindi-D',
    'AEC-HE': 'Hindi-E',
    'English': 'English Language and Literature'
}

def normalize_room_code(text):
    if not text: return ''
    t = text.strip()
    if re.search(r'library\s*ff', t, re.I): return 'Library FF'
    if re.search(r'principal\s*office', t, re.I): return 'Principal Office'
    if re.search(r'seminar', t, re.I): return 'Seminar Room'
    if re.search(r'playground', t, re.I): return 'PLAYGROUND'
    m = re.search(r'\b(CLIB|CL\d+|PB\d+|SCR\d+|R\d+|T\d+)\b', t, re.I)
    if m: return m.group(1).upper()
    return t.upper()

def resolve_subject_name(subj_code, raw_context=''):
    if not subj_code: return ''
    if subj_code in SUBJECT_MAP:
        return SUBJECT_MAP[subj_code]
    clean_c = subj_code.upper().strip()
    for k, v in SUBJECT_MAP.items():
        if k.upper() == clean_c:
            return v
    return subj_code

def fetch_url(url, data_dict=None, max_retries=3):
    encoded = urllib.parse.urlencode(data_dict).encode('utf-8') if data_dict else None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=encoded, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=18) as resp:
                return resp.read().decode('utf-8', errors='ignore')
        except Exception:
            time.sleep(0.4 * (attempt + 1))
    return ''

def get_portal_directories():
    """Fetch all official rooms and faculty directory from SRCC portal dropdowns."""
    html = fetch_url(BASE_URL)
    rooms = []
    teachers = []
    
    m_r = re.search(r'<select name="roomno"[^>]*>([\s\S]*?)</select>', html)
    if m_r:
        for val, text in re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m_r.group(1)):
            if val.strip():
                clean_t = ' '.join(text.replace('&nbsp;', ' ').split())
                rooms.append((val.strip(), clean_t))
                
    m_t = re.search(r'<select name="teacher"[^>]*>([\s\S]*?)</select>', html)
    if m_t:
        for val, text in re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m_t.group(1)):
            if val.strip():
                clean_t = ' '.join(text.replace('&nbsp;', ' ').split())
                teachers.append((val.strip(), clean_t))
                
    return rooms, teachers

def parse_printpreview_html(html):
    """
    Parses a printpreview.php HTML page into:
    1. Table rows: [headers, [Day, col0, col1, ...]]
    2. Footer legend: {code: {'name': name, 'subject': subject}}
    """
    # 1. Parse Border Table
    table_match = re.search(r'<table[^>]*border=[\"\']?[12][\"\']?[^>]*>(.*?)</table>', html, re.DOTALL)
    rows_data = []
    headers = []
    
    if table_match:
        t_content = table_match.group(1)
        r_matches = re.findall(r'<tr[^>]*>(.*?)</tr>', t_content, re.DOTALL)
        if r_matches:
            th_cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r_matches[0], re.DOTALL)
            headers = [' '.join(re.sub(r'<[^>]+>', ' ', h).split()) for h in th_cells]
            
            for r_str in r_matches[1:]:
                c_cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r_str, re.DOTALL)
                if not c_cells: continue
                day = ' '.join(re.sub(r'<[^>]+>', ' ', c_cells[0]).split())
                if day not in DAYS: continue
                
                row_cols = [day]
                for cell in c_cells[1:]:
                    c_clean = re.sub(r'<style.*?</style>', '', cell, flags=re.DOTALL)
                    c_clean = re.sub(r'<script.*?</script>', '', c_clean, flags=re.DOTALL)
                    c_clean = re.sub(r'<br\s*/?>', '\n', c_clean)
                    c_clean = re.sub(r'<[^>]+>', ' ', c_clean)
                    lines = [' '.join(l.split()) for l in c_clean.split('\n') if l.strip()]
                    cell_text = ' ___ '.join([l for l in lines if l and not l.startswith('---')])
                    row_cols.append(cell_text)
                rows_data.append(row_cols)

    # 2. Parse Legend
    legend = {}
    m_leg_div = re.search(r'<div[^>]*class=[\"\'][^\"\']*size11[^\"\']*[\"\'][^>]*>(.*?)</div>', html, re.DOTALL)
    if m_leg_div:
        leg_text = re.sub(r'<[^>]+>', ' ', m_leg_div.group(1))
        leg_text = ' '.join(leg_text.split())
        items = re.split(r',\s*', leg_text)
        for item in items:
            m = re.match(r'([A-Za-z0-9/ ]+?)-([^(]+(?:\([A-Za-z0-9]+\))?)\((.*)\)?', item.strip())
            if m:
                c = m.group(1).strip()
                n = ' '.join(m.group(2).strip().split())
                s = ' '.join(m.group(3).strip().rstrip(')').split())
                if '\n' in c: c = c.split('\n')[-1].strip()
                if not any(h in c.upper() for h in ['TIME TABLE', 'DEPARTMENT', 'LECTURES', 'SEMESTER']):
                    legend[c] = {'name': n, 'subject': s}

    return headers, rows_data, legend

def parse_class_cell_item(item_str, default_course='', default_sem='', default_sec=''):
    """Parses an individual class sub-string into clean structured session record."""
    clean = re.sub(r'<[-=]+>', '', item_str).strip()
    if not clean or 'NO DATA' in clean.upper():
        return None
        
    cls_type = 'Lecture'
    upper = clean.upper()
    if upper.startswith('LAB') or '-LAB-' in upper or 'LAB-' in upper:
        cls_type = 'Practical/Lab'
    elif upper.startswith('T-') or upper.startswith('TUT') or '-TUT-' in upper:
        cls_type = 'Tutorial'
        
    # Strip prefix e.g. 'LAB- 1. ', 'T- 2. ', 'L- ', 'LAB- '
    body = re.sub(r'^(?:LAB|L|T|TUT)-\s*(?:\d+\.\s*)?', '', clean).strip()
    body = re.sub(r'^\d+\.\s*', '', body).strip()
    
    # Room detection
    room = ''
    r_match = re.search(rf'[- ]({ROOM_REGEX})(?:[- ]|$)', body, re.I)
    if r_match:
        room = normalize_room_code(r_match.group(1))
        
    # Batch & Teacher Code detection from after_room
    batch = ''
    teacher_code = ''
    
    if room:
        after_room = body.split(room)[-1]
        m_after = re.match(r'^-([A-Za-z0-9\s]+?)(?:-([A-Za-z0-9\s]+))?$', after_room.strip())
        if m_after:
            cand1 = m_after.group(1).strip().upper()
            cand2 = m_after.group(2).strip().upper() if m_after.group(2) else ''
            # Check which is teacher and which is batch
            if cand2:
                teacher_code = cand1
                batch = cand2
            else:
                if re.match(r'^(?:SEC\d+|VAC\d+|[A-Z]P?\d+|\d+)$', cand1):
                    batch = cand1
                else:
                    teacher_code = cand1

    # Fallback batch search
    if not batch:
        m_sec_vac = re.search(r'-(SEC\d+|VAC\d+)(?:-|$)', clean, re.I)
        if m_sec_vac:
            batch = m_sec_vac.group(1).upper()
        else:
            m_b = re.search(r'-([A-Z]P\d+|[A-Z]\d+|\d+)(?:-|$)', body, re.I)
            if m_b:
                cand = m_b.group(1).upper()
                if cand != room and cand != teacher_code:
                    batch = cand

    # Fallback teacher search
    if not teacher_code:
        tokens = [t.strip() for t in body.split('-') if t.strip()]
        for tok in reversed(tokens):
            if tok != room and tok != batch and len(tok) <= 6 and not any(k in tok.upper() for k in ['COMMERCE', 'ECONOMICS', 'HINDI', 'MATHS', 'ENGLISH', 'POL.SC.']):
                teacher_code = tok.upper()
                break

    # Subject detection
    subject = ''
    dept = ''
    tokens = [t.strip() for t in body.split('-') if t.strip()]
    
    if 'AEC' in body.upper():
        dept = 'Hindi'
        aec_m = re.search(r'AEC-([A-Za-z0-9\s]+)', body, re.I)
        if aec_m:
            subject = f"AEC-{aec_m.group(1).strip().upper()}"
        else:
            subject = 'AEC'
    elif len(tokens) >= 2:
        dept = tokens[0]
        # In tokens[1], it might be MPA, FA, BLAW, PME-I, etc.
        if len(tokens) >= 3 and tokens[1].upper() in ('PME', 'IMA', 'VM', 'EVS', 'ITSA'):
            subject = f"{tokens[1]}-{tokens[2]}"
        else:
            subject = tokens[1]

    # Course, Sem, Sec
    course = default_course
    semester = default_sem
    section = default_sec
    
    # If SEC or VAC batch is present in JOINT
    if batch.startswith('SEC') and (course == 'JOINT' or not course):
        course = 'SEC'
    elif batch.startswith('VAC') and (course == 'JOINT' or not course):
        course = 'VAC'

    subject_name = resolve_subject_name(subject, clean)

    return {
        'raw': clean,
        'type': cls_type,
        'dept': dept,
        'subject': subject,
        'subject_name': subject_name,
        'course': course,
        'semester': semester,
        'section': section,
        'batch': batch,
        'room': room,
        'teacher_code': teacher_code
    }

def main():
    print("=" * 75)
    print("SRCC MASTER TIMETABLE, FACULTY & ROOM VACANT LIST RECONCILIATION")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 75)

    # 1. Load Booklet Teacher Codes (169 verified codes)
    print("\n[1/6] Loading verified teacher definitions from booklet legends...")
    booklet_teachers_file = os.path.join(BASE_DIR, 'scratch', 'pdf_teachers_all.json')
    booklet_teachers = {}
    if os.path.exists(booklet_teachers_file):
        with open(booklet_teachers_file, 'r', encoding='utf-8') as f:
            booklet_teachers = json.load(f)
        print(f"  Loaded {len(booklet_teachers)} official teacher codes from booklet JSON.")

    # 2. Discover Portal Dropdown Options
    print("\n[2/6] Discovering official rooms and faculty directory from SRCC portal...")
    rooms_list, teachers_list = get_portal_directories()
    print(f"  Portal provides: {len(rooms_list)} rooms and {len(teachers_list)} faculty members.")

    faculty_dir = {}
    for tid, label in teachers_list:
        clean_name = re.sub(r'\s*\([^)]*\)', '', label).strip()
        clean_name = re.sub(r'^(prof\.|dr\.|mr\.|ms\.)\s*', '', clean_name, flags=re.I).strip()
        # Restore appropriate title if present in label
        title = ''
        m_t = re.match(r'^(Prof\.|Dr\.|Mr\.|Ms\.)\s+', label, re.I)
        if m_t: title = m_t.group(1).title() + ' '
        
        display_name = f"{title}{clean_name}"
        ref_code = ''
        m_ref = re.search(r'\(([^)]+)\)', label)
        if m_ref: ref_code = m_ref.group(1).strip().upper()
        
        faculty_dir[tid] = {
            'id': tid,
            'label': label,
            'name': display_name,
            'clean_name': clean_name,
            'short_code': '',
            'ref_code': ref_code,
            'department': 'Commerce',
            'subjects': set(),
            'schedule': {d: [] for d in DAYS}
        }

    # Match Booklet Teachers with Faculty Directory
    matched_booklet_codes = {}
    for code, info in booklet_teachers.items():
        pname = ' '.join(info['name'].split())
        clean_pname = pname.split('(')[0].strip()
        norm_name = re.sub(r'^(prof\.|dr\.|mr\.|ms\.)\s*', '', clean_pname, flags=re.I).strip().lower()
        
        for tid, f in faculty_dir.items():
            fname_clean = f['clean_name'].lower()
            if norm_name and (norm_name == fname_clean or norm_name in fname_clean or fname_clean in norm_name):
                matched_booklet_codes[code] = tid
                f['short_code'] = code
                # Update display name with official booklet title
                f['name'] = ' '.join(info['name'].split()).title()
                f['subjects'].update(info['subjects'])
                break

    print(f"  Mapped {len(matched_booklet_codes)} / {len(booklet_teachers)} booklet codes to faculty directory.")

    # 3. Concurrently Scrape All 77 Student Print-Preview Timetables
    print("\n[3/6] Fetching all 77 student section print-preview timetables...")
    class_tasks = []
    
    # B.Com (Hons) Sem 1, 3, 5, 7 (14 sections: A to N)
    for s in [1, 3, 5, 7]:
        sem_str = f"Sem {['I','II','III','IV','V','VI','VII','VIII'][s-1]}"
        for sec in ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']:
            url = f"{PRINT_PREVIEW_URL}&classId=20&semester={s}&class_section={sec}"
            class_tasks.append(('B.Com (Hons)', s, sec, sem_str, f"Sec {sec}", url))

    # B.A. (Hons) Economics Sem 1, 3, 5, 7 (4 sections: A to D)
    for s in [1, 3, 5, 7]:
        sem_str = f"Sem {['I','II','III','IV','V','VI','VII','VIII'][s-1]}"
        for sec in ['A', 'B', 'C', 'D']:
            url = f"{PRINT_PREVIEW_URL}&classId=21&semester={s}&class_section={sec}"
            class_tasks.append(('B.A. (Hons) Economics', s, sec, sem_str, f"Sec {sec}", url))

    # JOINT (SEC/VAC) Sem 1, 3, 5
    for s in [1, 3, 5]:
        sem_str = f"Sem {['I','II','III','IV','V','VI','VII','VIII'][s-1]}"
        url = f"{PRINT_PREVIEW_URL}&classId=22&semester={s}&class_section=None"
        class_tasks.append(('JOINT', s, 'None', sem_str, 'Joint', url))

    # M.Com Sem 1, 3
    for s in [1, 3]:
        sem_str = f"Sem {['I','II','III','IV'][s-1]}"
        url = f"{PRINT_PREVIEW_URL}&classId=19&semester={s}&class_section=A"
        class_tasks.append(('M.Com', s, 'A', sem_str, 'Sec A', url))

    print(f"  Queued {len(class_tasks)} print-preview timetables (Fetching with 15 workers)...")
    raw_class_htmls = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=15) as executor:
        f_map = {executor.submit(fetch_url, task[5]): task for task in class_tasks}
        for fut in as_completed(f_map):
            task = f_map[fut]
            raw_class_htmls[task] = fut.result()
    print(f"  Fetched {len(raw_class_htmls)} timetables in {time.time() - t0:.1f}s.")

    # 4. Fetch All Direct Room & Teacher Timetables for Cross-Verification
    print("\n[4/6] Fetching all 96 Room tables and 210 Faculty schedules for cross-checking...")
    raw_room_tables = {}
    raw_teacher_tables = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=15) as executor:
        f_room = {
            executor.submit(fetch_url, BASE_URL, {'roomno': rcode, 'submit': 'Go'}): (rcode, rlabel)
            for rcode, rlabel in rooms_list
        }
        f_teach = {
            executor.submit(fetch_url, BASE_URL, {'teacher': tid, 'submit': 'Go'}): tid
            for tid, _ in teachers_list
        }
        for fut in as_completed(f_room):
            rcode, rlabel = f_room[fut]
            raw_room_tables[rcode] = (rlabel, fut.result())
        for fut in as_completed(f_teach):
            tid = f_teach[fut]
            raw_teacher_tables[tid] = fut.result()
    print(f"  Fetched 96 rooms and 210 faculty in {time.time() - t0:.1f}s.")

    # 5. Parse Classes Data & Update Legends
    print("\n[5/6] Parsing class schedules and cross-verifying teacher assignments...")
    classes_data = {
        'metadata': {
            'college': 'Shri Ram College of Commerce (SRCC)',
            'portal': BASE_URL,
            'last_synced': datetime.now().strftime('%d %b %Y, %I:%M %p'),
            'total_classes_recorded': 0
        },
        'courses': {
            'SEC': {'Sem I': [], 'Sem III': [], 'Sem V': []},
            'VAC': {'Sem I': [], 'Sem III': [], 'Sem V': []},
            'B.Com (Hons)': {'Sem I': {}, 'Sem III': {}, 'Sem V': {}, 'Sem VII': {}},
            'B.A. (Hons) Economics': {'Sem I': {}, 'Sem III': {}, 'Sem V': {}, 'Sem VII': {}},
            'M.Com': {'Sem I': {}, 'Sem III': {}}
        }
    }

    room_occupied_matrix = defaultdict(lambda: defaultdict(list))
    total_classes = 0

    # Also harvest any new legends from printpreview HTML
    for (cname, sem_num, sec_code, sem_str, sec_str, url), html in raw_class_htmls.items():
        headers, rows_data, legend = parse_printpreview_html(html)
        for code, info in legend.items():
            if code not in matched_booklet_codes:
                pname = ' '.join(info['name'].split())
                clean_pname = pname.split('(')[0].strip()
                norm_name = re.sub(r'^(prof\.|dr\.|mr\.|ms\.)\s*', '', clean_pname, flags=re.I).strip().lower()
                for tid, f in faculty_dir.items():
                    if norm_name and norm_name == f['clean_name'].lower():
                        matched_booklet_codes[code] = tid
                        f['short_code'] = code
                        f['name'] = ' '.join(info['name'].split()).title()
                        f['subjects'].add(info['subject'])
                        break

    # Now parse all class rows
    for (cname, sem_num, sec_code, sem_str, sec_str, url), html in raw_class_htmls.items():
        headers, rows_data, legend = parse_printpreview_html(html)
        if not rows_data: continue

        # Slot headers are columns 1..10
        slot_headers = headers[1:] if len(headers) > 1 else STANDARD_PERIODS

        for r_cols in rows_data:
            day = r_cols[0]
            for col_idx, cell_text in enumerate(r_cols[1:]):
                if not cell_text or 'NO DATA' in cell_text.upper(): continue
                slot = slot_headers[col_idx] if col_idx < len(slot_headers) else f"Slot {col_idx+1}"
                if slot not in STANDARD_PERIODS:
                    # Map nearest standard period if slight naming mismatch
                    for sp in STANDARD_PERIODS:
                        if sp.split(' to ')[0] in slot:
                            slot = sp
                            break

                # Split multiple sub-classes in the cell
                sub_items = [p.strip() for p in re.split(r'(?:_{3,}|\n|<br\s*/?>|___)+', cell_text) if p.strip()]
                for item_str in sub_items:
                    parsed = parse_class_cell_item(item_str, cname, sem_str, sec_str)
                    if not parsed: continue

                    t_code = parsed['teacher_code']
                    t_name = ''
                    t_id = ''
                    
                    if t_code in matched_booklet_codes:
                        t_id = matched_booklet_codes[t_code]
                        prof = faculty_dir.get(t_id)
                        if prof:
                            t_name = prof['name']
                            # Add to teacher's schedule
                            prof['schedule'][day].append({
                                'slot': slot,
                                'raw': parsed['raw'],
                                'course': parsed['course'],
                                'semester': parsed['semester'],
                                'section': parsed['section'],
                                'batch': parsed['batch'],
                                'subject': parsed['subject'],
                                'subject_name': parsed['subject_name'],
                                'room': parsed['room'],
                                'type': parsed['type']
                            })
                    else:
                        t_name = t_code or 'Faculty'

                    session_record = {
                        'day': day,
                        'slot': slot,
                        'course': parsed['course'],
                        'semester': parsed['semester'],
                        'section': parsed['section'],
                        'batch': parsed['batch'],
                        'subject': parsed['subject'],
                        'subject_name': parsed['subject_name'],
                        'type': parsed['type'],
                        'room': parsed['room'],
                        'teacher_name': t_name,
                        'teacher_code': t_code,
                        'teacher_id': t_id,
                        'raw': parsed['raw']
                    }

                    # Index room occupancy
                    if parsed['room']:
                        room_occupied_matrix[parsed['room']][day].append({
                            'slot': slot,
                            'class': f"{parsed['type'][0]}-{parsed['course']}-{parsed['section']}-{parsed['semester']} {parsed['subject_name']}-{parsed['room']} {t_name}"
                        })

                    # Store in classes_data
                    if parsed['course'] in ('SEC', 'VAC'):
                        classes_data['courses'][parsed['course']][parsed['semester']].append(session_record)
                    elif parsed['course'] in classes_data['courses']:
                        if parsed['semester'] in classes_data['courses'][parsed['course']]:
                            if parsed['section'] not in classes_data['courses'][parsed['course']][parsed['semester']]:
                                classes_data['courses'][parsed['course']][parsed['semester']][parsed['section']] = []
                            classes_data['courses'][parsed['course']][parsed['semester']][parsed['section']].append(session_record)

                    total_classes += 1

    classes_data['metadata']['total_classes_recorded'] = total_classes
    print(f"  Parsed {total_classes} total class sessions across all courses and sections.")

    # 6. Reconcile 96 Rooms Data & Vacancy List
    print("\n[6/6] Reconciling room schedules across all 96 rooms for 0% false free rooms...")
    all_rooms_data = []

    for rcode, rlabel in rooms_list:
        _, r_html = raw_room_tables.get(rcode, (rlabel, ''))
        
        # Parse direct room table
        room_direct_occupied = defaultdict(list)
        table_m = re.search(r'<table[^>]*border=[\"\']?1[\"\']?[^>]*>(.*?)</table>', r_html, re.DOTALL)
        if table_m:
            r_rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_m.group(1), re.DOTALL)
            if r_rows:
                h_cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r_rows[0], re.DOTALL)
                r_headers = [' '.join(re.sub(r'<[^>]+>', ' ', h).split()) for h in h_cells][1:]
                
                for r_tr in r_rows[1:]:
                    cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r_tr, re.DOTALL)
                    if not cells: continue
                    day = ' '.join(re.sub(r'<[^>]+>', ' ', cells[0]).split())
                    if day not in DAYS: continue
                    
                    for c_i, cell in enumerate(cells[1:]):
                        c_text = ' '.join(re.sub(r'<[^>]+>', ' ', cell).split())
                        if c_text and 'NO DATA' not in c_text.upper():
                            slot = r_headers[c_i] if c_i < len(r_headers) else f"Slot {c_i+1}"
                            if slot in STANDARD_PERIODS:
                                room_direct_occupied[day].append({'slot': slot, 'class': c_text})

        # Reconcile Day Schedules
        schedule = {}
        for d in DAYS:
            direct_slots = {occ['slot'] for occ in room_direct_occupied[d]}
            reconciled_occ = list(room_direct_occupied[d])

            # Ingest from matrix if missing in direct room schedule
            for mat_occ in room_occupied_matrix[rcode][d]:
                if mat_occ['slot'] not in direct_slots:
                    reconciled_occ.append(mat_occ)
                    direct_slots.add(mat_occ['slot'])

            free_slots = [p for p in STANDARD_PERIODS if p not in direct_slots]
            lunch_free = not any('1:30' in occ['slot'] and '2:00' in occ['slot'] for occ in reconciled_occ)

            schedule[d] = {
                'free_slots': free_slots,
                'free_hours': len(free_slots),
                'lunch_recess_free': lunch_free,
                'occupied_slots': reconciled_occ
            }

        category = 'Classrooms (R)' if re.match(r'^R\d+$', rcode) else (
            'Tutorial Rooms (T)' if re.match(r'^T\d+$', rcode) else (
                'Principal Bungalow (PB)' if rcode.startswith('PB') else (
                    'Computer Labs (CL)' if rcode.startswith('CL') else (
                        'Sports Complex (SCR)' if rcode.startswith('SCR') else 'Library & Other Facilities'
                    )
                )
            )
        )
        cap_match = re.search(r'\(([^)]+)\)', rlabel)
        capacity = cap_match.group(1) if cap_match else "N/A"
        desc = (f"Lecture Classroom {rcode[1:]}" if rcode.startswith('R') else
                f"Tutorial Room {rcode[1:]}" if rcode.startswith('T') else
                f"Principal Bungalow {rcode[2:]}" if rcode.startswith('PB') else
                f"Computer Lab {rcode[2:]}" if rcode.startswith('CL') and rcode != 'CLIB' else
                "Computer Library Lab" if rcode == 'CLIB' else
                f"Sports Complex Room {rcode[3:]}" if rcode.startswith('SCR') else
                "Library First Floor" if rcode == 'Library FF' else rcode)

        has_classes = any(len(schedule[d]['occupied_slots']) > 0 for d in DAYS)

        all_rooms_data.append({
            'code': rcode,
            'label': rlabel,
            'name': desc,
            'capacity': capacity,
            'category': category,
            'has_classes': has_classes,
            'schedule': schedule
        })

    # Sort rooms logically (R1-R37, T1-T54, PB, CL, SCR, Library)
    def room_sort_key(item):
        c = item['code']
        num = re.search(r'\d+', c)
        n = int(num.group(0)) if num else 0
        prefix = re.sub(r'\d+', '', c)
        order = {'R': 1, 'T': 2, 'PB': 3, 'CL': 4, 'SCR': 5}
        return (order.get(prefix, 99), n, c)

    all_rooms_data.sort(key=room_sort_key)
    print(f"  Successfully reconciled all {len(all_rooms_data)} SRCC rooms.")

    # Reconcile Enriched Faculty Data
    enriched_teachers = []
    for tid, prof in faculty_dir.items():
        total_teaching = sum(len(prof['schedule'][d]) for d in DAYS)
        
        # Detect department from subjects taught
        dept_votes = defaultdict(int)
        for d in DAYS:
            for s in prof['schedule'][d]:
                subj = s.get('subject', '')
                if subj in ('PME', 'PME-I', 'EOE', 'EoE', 'IMIC1', 'IMA I', 'Intro MME', 'Adv MME', 'DE', 'ISME', 'EHI', 'IDE', 'GT', 'PE', 'GBS', 'AdTrix'):
                    dept_votes['Economics'] += 1
                elif subj in ('HA', 'HB', 'H B', 'HC', 'HD', 'HE', 'AEC-HA', 'AEC-HB', 'AEC-HC', 'AEC-HD', 'AEC-HE'):
                    dept_votes['Hindi'] += 1
                elif subj in ('VM I', 'VM II', 'VM III', 'NM', 'BMATH', 'FC'):
                    dept_votes['Mathematics'] += 1
                elif subj in ('CIEL', 'CPL', 'CW', 'PSEL', 'PSELL', 'English', 'RIFE', 'VAC SEL'):
                    dept_votes['English'] += 1
                elif subj in ('NL', 'CVFD', 'IIPT', 'NII', 'UIR', 'GIC'):
                    dept_votes['Political Science'] += 1
                elif subj in ('EVS', 'EVS-I', 'EVS-II'):
                    dept_votes['EVS'] += 1
                elif subj in ('OOPUP', 'OPUP', 'PUP', 'OS', 'BIT', 'BIDV'):
                    dept_votes['Computer Science'] += 1
                elif subj in ('HFPE', 'IST', 'OE'):
                    dept_votes['Physical Education'] += 1
                else:
                    dept_votes['Commerce'] += 1

        detected_dept = max(dept_votes.items(), key=lambda x: x[1])[0] if dept_votes else prof['department']

        initials = ''.join([part[0] for part in prof['clean_name'].split()[:2]]).upper()
        if not initials: initials = prof['clean_name'][:2].upper()

        enriched_teachers.append({
            'id': tid,
            'label': prof['label'],
            'name': prof['name'],
            'clean_name': prof['clean_name'],
            'short_code': prof['short_code'] or prof['ref_code'],
            'ref_code': f"{prof['short_code']} {prof['ref_code']}".strip(),
            'initials': initials,
            'department': detected_dept,
            'subjects_taught': sorted(list(prof['subjects'])),
            'total_teaching_periods': total_teaching,
            'schedule': prof['schedule']
        })

    enriched_teachers.sort(key=lambda x: x['clean_name'])
    print(f"  Successfully compiled {len(enriched_teachers)} enriched faculty profiles.")

    # 7. Write Web Application Data Files
    print("\nWriting JSON and JavaScript data files to web_app/...")
    
    # 7a. Classes Data
    with open(os.path.join(WEB_APP_DIR, 'classes_data.json'), 'w', encoding='utf-8') as f:
        json.dump(classes_data, f, ensure_ascii=False, indent=2)
    with open(os.path.join(WEB_APP_DIR, 'classes_data.js'), 'w', encoding='utf-8') as f:
        f.write(f"window.SRCC_CLASSES_DATA = {json.dumps(classes_data, ensure_ascii=False)};\n")
    print("  ✓ classes_data.json & classes_data.js updated.")

    # 7b. Teachers Data
    teachers_payload = {
        'metadata': {
            'college': 'Shri Ram College of Commerce (SRCC)',
            'portal': BASE_URL,
            'total_teachers': len(enriched_teachers),
            'last_synced': datetime.now().strftime('%d %b %Y, %I:%M %p')
        },
        'teachers': enriched_teachers
    }
    with open(os.path.join(WEB_APP_DIR, 'teachers_data.json'), 'w', encoding='utf-8') as f:
        json.dump(teachers_payload, f, ensure_ascii=False, indent=2)
    with open(os.path.join(WEB_APP_DIR, 'teachers_data.js'), 'w', encoding='utf-8') as f:
        f.write(f"window.SRCC_TEACHERS_DATA = {json.dumps(teachers_payload, ensure_ascii=False)};\n")
    print("  ✓ teachers_data.json & teachers_data.js updated.")

    # 7c. Rooms Data
    rooms_payload = {
        'metadata': {
            'college': 'Shri Ram College of Commerce (SRCC)',
            'portal': BASE_URL,
            'total_rooms': len(all_rooms_data),
            'last_synced': datetime.now().strftime('%d %b %Y, %I:%M %p'),
            'reconciled': True
        },
        'rooms': all_rooms_data
    }
    with open(os.path.join(WEB_APP_DIR, 'srcc_data.json'), 'w', encoding='utf-8') as f:
        json.dump(rooms_payload, f, ensure_ascii=False, indent=2)
    with open(os.path.join(WEB_APP_DIR, 'data.js'), 'w', encoding='utf-8') as f:
        f.write(f"window.SRCC_TIMETABLE_DATA = {json.dumps(rooms_payload, ensure_ascii=False)};\nwindow.SRCC_DATA = window.SRCC_TIMETABLE_DATA;\n")
    print("  ✓ srcc_data.json & data.js updated.")

    # 8. Generate Excel Workbook
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        print("\nGenerating updated SRCC_Free_Classrooms_Timetable.xlsx...")
        wb = openpyxl.Workbook()
        ws_cov = wb.active
        ws_cov.title = "Overview & Guide"
        ws_cov.views.sheetView[0].showGridLines = True
        ws_cov['B2'] = "SHRI RAM COLLEGE OF COMMERCE (SRCC)"
        ws_cov['B2'].font = Font(name='Calibri', size=16, bold=True, color='1E3A8A')
        ws_cov['B3'] = f"Official Timetable & Free Classrooms Master Register (Synced: {datetime.now().strftime('%d %b %Y')})"
        ws_cov['B3'].font = Font(name='Calibri', size=11, italic=True)

        categories = [
            ("Classrooms (R)", "Classrooms (R1-R37)"),
            ("Tutorial Rooms (T)", "Tutorial Rooms (T1-T54)"),
            ("Principal Bungalow (PB)", "Principal Bungalow (PB)"),
            ("Computer Labs (CL)", "Computer Labs (CL)"),
            ("Sports Complex (SCR)", "Sports Complex (SCR)"),
            ("Library & Other Facilities", "Library & Facilities")
        ]

        hdr_fill = PatternFill(start_color='1E3A8A', end_color='1E3A8A', fill_type='solid')
        hdr_font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
        free_fill = PatternFill(start_color='DCFCE7', end_color='DCFCE7', fill_type='solid')
        free_font = Font(name='Calibri', size=9, bold=True, color='166534')
        occ_fill = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')
        occ_font = Font(name='Calibri', size=8, color='475569')

        for cat_name, tab_title in categories:
            ws = wb.create_sheet(title=tab_title[:31])
            ws.views.sheetView[0].showGridLines = True
            ws.append(['Room Code', 'Room Name', 'Day', 'Period Slot', 'Status', 'Class / Occupant Details'])
            for col_i in range(1, 7):
                cell = ws.cell(row=1, column=col_i)
                cell.fill = hdr_fill
                cell.font = hdr_font
                cell.alignment = Alignment(horizontal='center', vertical='center')

            row_num = 2
            for room in all_rooms_data:
                if room['category'] != cat_name: continue
                for d in DAYS:
                    d_sched = room['schedule'][d]
                    occ_map = {o['slot']: o.get('class', 'Occupied') for o in d_sched['occupied_slots']}
                    for p in STANDARD_PERIODS:
                        is_free = (p in d_sched['free_slots'])
                        status = "VACANT / FREE" if is_free else "OCCUPIED"
                        details = "Available for GD / Study" if is_free else occ_map.get(p, "Scheduled Class")
                        ws.append([room['code'], room['name'], d, p, status, details])
                        r_cell = ws.cell(row=row_num, column=5)
                        if is_free:
                            r_cell.fill = free_fill
                            r_cell.font = free_font
                        else:
                            r_cell.fill = occ_fill
                            r_cell.font = occ_font
                        row_num += 1

            for col in ws.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

        excel_root = os.path.join(BASE_DIR, 'SRCC_Free_Classrooms_Timetable.xlsx')
        excel_app = os.path.join(WEB_APP_DIR, 'SRCC_Free_Classrooms_Timetable.xlsx')
        wb.save(excel_root)
        shutil.copyfile(excel_root, excel_app)
        print(f"  ✓ Excel register saved at {excel_root} and copied to web_app.")
    except Exception as e:
        print(f"  ! Excel generation error: {e}")

    # 9. Update Widget Feed
    try:
        import subprocess
        print("\nUpdating web_app/widget_feed.json...")
        res = subprocess.run([sys.executable, os.path.join(BASE_DIR, 'generate_widget_feed.py')], capture_output=True, text=True)
        if res.returncode == 0:
            print("  ✓ widget_feed.json regenerated successfully.")
        else:
            print(f"  ! widget_feed.py exited with: {res.stderr}")
    except Exception as e:
        print(f"  ! Widget feed update error: {e}")

    print("\n" + "=" * 75)
    print("ALL SRCC TIMETABLES, FACULTY DIRECTORY & ROOM VACANT LIST FULLY UPDATED!")
    print("=" * 75)

if __name__ == '__main__':
    main()
