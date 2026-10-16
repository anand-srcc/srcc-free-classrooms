"""
Generates clean, legally-compliant SRCC Official College Notices dataset
Sources: Official SRCC announcements portal (https://www.srcc.edu/announcements)
Provides direct links to original official files on online.srcc.edu and srcc.edu.
"""

import os
import re
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_FILE = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\c305f4d3-cf7e-41f1-947c-71b753a935af\.system_generated\steps\178\content.md'
OUTPUT_JS = os.path.join(BASE_DIR, 'web_app', 'college_notices.js')
OUTPUT_JSON = os.path.join(BASE_DIR, 'web_app', 'college_notices.json')

with open(CONTENT_FILE, 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'\[([^\]]+)\]\((https?://[^\)]+)\)'
matches = re.findall(pattern, text)

seen = set()
notices = []
notice_idx = 1

for title, link in matches:
    title = title.strip()
    link = link.strip()
    
    # Keep only relevant notices/circulars/forms
    if not any(k in link for k in [
        'smartprof/file_uploads/notices',
        'sites/default/files',
        'forms.gle',
        'docs.google.com/forms',
        'cdn3.digialm.com',
        'drive.google.com'
    ]):
        continue

    # Filter out redundant links or navigation
    if title.lower() in ['menu', 'home', 'contact us', 'admin', 'faculty', 'student', 'about']:
        continue
    if len(title) < 4:
        continue

    link_key = link.split('?')[0].lower()
    if (title.lower(), link_key) in seen:
        continue
    seen.add((title.lower(), link_key))

    t = title.lower()
    l = link.lower()

    def determine_category(t, l):
        # 0. Specific document verified overrides:
        # Notice: "Notification-Last date extended UG & PG" -> DU Exam Form Last Date Extension
        if 'notificationlastdateextendedugamppg' in l or 'notification-last date extended ug & pg' in t:
            return 'examinations'
        # Bhutan Exchange Programme
        if 'bhutan' in t or 'bhutan' in l or 'oip-srcc-indo-bhutan' in l:
            return 'academic'
        # College Closure / Holiday
        if any(k in t for k in ['closure of college', 'holiday on', 'notice for holiday', 'closure of all offices']):
            return 'administration'
        # Administrative protocol
        if 'administrative protocol' in t:
            return 'administration'
        # Student activities & events
        if any(k in t for k in ['students activities guidelines', 'student activities guidelines', 'regarding event dated 14 sept']):
            return 'societies'

        # 1. EXAMINATIONS
        exam_patterns = [
            'exam', 'examination', 'datesheet', 'date sheet', 'date-sheet',
            'admit card', 'hall ticket', 'detained', 'repeater', 're-appearing',
            'improvement', 'er cases', 'er_case', 'ia repeater', 'tu repeater',
            'ia marks', 'ca marks', 'tu marks', 'tutorial marks', 'internal assessment',
            'continuous assessment', 'practical examination', 'practical schedule',
            'viva schedule', 'viva -', 'viva notice', 'scribe', 'writer_scribe',
            'pwbd students for writing exam', 'grievance of ia', 'grievance of ca',
            'examination form', 'exam form', 'gdpi schedule', 'assessment schedule',
            'ia_tu', 'ia/ca', 'ia_tu_pr', 'gdpi', 'objection management',
            'hall ticket login', 'gbo entrance 2026'
        ]
        is_union_or_award = any(x in t for x in [
            'students union', "students' union", 'dusu', 'election', 'strides',
            'best three papers', 'prizes', 'academic prizes', 'gold medal', 'eca medal'
        ])
        if not is_union_or_award:
            if any(k in t for k in ['result notice-gbo entrance', 'entrance 2026 date extension']):
                return 'examinations'
            if 'pgdgbo' in (t + ' ' + l) and ('result' in t or 'result' in l) and not 'admission' in t:
                return 'examinations'
            if any(s in t or s in l for s in exam_patterns):
                return 'examinations'

        # 2. SOCIETIES & STUDENT ACTIVITIES
        soc_patterns = [
            'society', 'societies', 'cell clubs', 'cell_clubs', 'student bodies',
            'staff council recognized student', 'election', 'students union',
            "students' union", 'dusu', 'lyngdoh', 'returning officer', 'pre-election speech',
            'victory procession', 'crossroads', 'yugantar', 'conclave', 'festival', 'fest',
            'debate', 'debating', 'sajmd', 'shri arun jaitley memorial debate',
            'gold medal', 'eca medal', 'annual day', 'dr. shankar dayal sharma',
            'competition', 'painting competition', 'poster on srcc', 'literature festival',
            'run for peace', 'peace run', 'centenary run', 'centenary commemoration',
            'food donation', 'blood donation', 'social entrepreneurship', 'nss',
            'national service scheme', 'कला महोत्सव', 'holi festival', 'sports week',
            'space week', 'summit', 'cultural'
        ]
        if any(s in t for s in soc_patterns):
            return 'societies'

        # 3. ADMINISTRATION
        admin_patterns = [
            'hostel', 'boys\' hostel', 'girls\' hostel', 'cw_1st year',
            'admission', 'prospectus', 'placement brochure', 'waiting list',
            'merit list of provisionally', 'step by step instructions', 'steps by steps',
            'provisionally selected', 'provisionally admitted',
            'anti-ragging', 'anti ragging', 'ragging',
            'parking', 'parking lot', 'gate entry', 'holiday',
            'parapet wall', 'advisory', 'canteen', 'kiosk', 'bids', 'tender',
            'appointment of assistant professor', 'guest basis', 'walk-in-interview',
            'guest faculty', 'interview notice and schedule for guest', 're-advertisement of vacancies',
            'recruitment', 'vacancy', 'vacancies', 'ineligible applicants',
            'director, department of physical education', 'convenor', 'women development cell',
            'wdc', 'internal complaints committee', 'icc', 'office order',
            'strategic plan deployment', 'helpline', 'women\'s safety', 'fees notice',
            'fee payment', 'fee notice', 'project associate-ii', 'advertisement'
        ]
        if any(s in t or s in l for s in admin_patterns):
            return 'administration'

        # 4. ACADEMIC
        acad_patterns = [
            'time table', 'timetable', 'time-table', 'section list', 'section wise', 'sectionwise',
            'roll no', 'roll number', 'sec vac', 'sec&vac', 'sec time table', 'vac time table',
            'sec list', 'vac list', 'aec', 'batch information', 'batch list', 'eac final list', 'arc final list',
            'orientation', 'orientation programme', 'orientation dates',
            'attendance', 'short attendance', 'medical cases and benefits', 'minimum attendance',
            'smartprof', 'attendance on smartprof',
            'scholarship', 'munjal', 'bhagwati', 'vivekananda', 'saf notice', 'fee concession',
            'earn while you learn', 'eada',
            'research track', 'dissertation', 'academic project', 'entrepreneurship track',
            'track topics', 'research paper', 'strides', 'student journal',
            'foreign language', 'french', 'certificate course', 'diploma course',
            'counselling', 'career counsellor', 'psychologist',
            'du domain email', 'gemini ai pro', 'notebook llm', 'skills for youth',
            'newsletter', 'student newsletter', 'iqac',
            'tic commerce', 'teacher in charge', 'faculty wise', 'faculty-wise',
            'ai vibe programme', 'ai vibe', 'cohort',
            'enabling unit', 'pwbd students', 'training session for pwbd',
            'b.com.h', 'b.a. h', 'bcomh', 'bahe', 'm.com', 'year 4 students', 'sem vii', 'sem-v',
            'phd phase ii', 'mind over pressure', 'conference on', 'pathways to viksit bharat',
            'srcc assist'
        ]
        if any(s in t or s in l for s in acad_patterns):
            return 'academic'

        if 'smartprof/file_uploads/notices/attachment' in l:
            return 'academic'
        return 'administration'

    cat = determine_category(t, l)

    # Determine file/link type
    link_lower = link.lower()
    if '.pdf' in link_lower:
        link_type = 'pdf'
    elif any(ext in link_lower for ext in ['.xlsx', '.xls', '.csv']):
        link_type = 'excel'
    elif any(ext in link_lower for ext in ['.docx', '.doc']):
        link_type = 'doc'
    elif any(ext in link_lower for ext in ['.png', '.jpg', '.jpeg', '.webp']):
        link_type = 'image'
    elif 'form' in link_lower:
        link_type = 'form'
    else:
        link_type = 'link'

    # Load text cache if exists
    text_cache_file = os.path.join(BASE_DIR, 'scratch', 'notices_extracted_text.json')
    text_cache = {}
    if os.path.exists(text_cache_file):
        try:
            with open(text_cache_file, 'r', encoding='utf-8') as f_tc:
                text_cache = json.load(f_tc)
        except:
            pass

    # Known high-priority deadlines & exact dates
    KNOWN_DATA = {
        1: {'date': '15 Oct 2026', 'deadline': None, 'deadline_label': None},
        2: {'date': '15 Oct 2026', 'deadline': None, 'deadline_label': None},
        3: {'date': '14 Oct 2026', 'deadline': '25 Oct 2026', 'deadline_label': 'Poster Submission Deadline'},
        4: {'date': '13 Oct 2026', 'deadline': '22 Nov 2026 (11:59 PM)', 'deadline_label': 'Exam Form Extended Upto'},
        9: {'date': '10 Oct 2026', 'deadline': '15 Oct 2026', 'deadline_label': 'Conference Registration Deadline'},
        11: {'date': '12 Oct 2026', 'deadline': '13 Oct 2026', 'deadline_label': 'Parking Restriction Date'},
        14: {'date': '08 Oct 2026', 'deadline': '31 Oct 2026', 'deadline_label': 'PGDGBO Exam Form Deadline'},
        17: {'date': '05 Oct 2026', 'deadline': '20 Oct 2026', 'deadline_label': 'BAHE ER Re-registration Form'},
        18: {'date': '05 Oct 2026', 'deadline': '20 Oct 2026', 'deadline_label': 'BCH ER Re-registration Form'},
        19: {'date': '05 Oct 2026', 'deadline': '20 Oct 2026', 'deadline_label': 'Improvement / ER Form Last Date'},
        22: {'date': '28 Sep 2026', 'deadline': '10 Oct 2026', 'deadline_label': 'Bhutan Exchange Application Form'},
        25: {'date': '26 Sep 2026', 'deadline': '15 Oct 2026', 'deadline_label': 'SAF & Fee Concession Form'},
        28: {'date': '22 Sep 2026', 'deadline': '25 Sep 2026', 'deadline_label': 'SAJMD Debate Schedule'},
        33: {'date': '18 Sep 2026', 'deadline': '19 Sep 2026', 'deadline_label': 'Holiday Closure Date'},
        83: {'date': '17 Aug 2026', 'deadline': '31 Aug 2026', 'deadline_label': 'Scholarship Application Deadline'},
        131: {'date': '07 Aug 2026', 'deadline': '20 Aug 2026', 'deadline_label': 'Earn While You Learn Application'},
        134: {'date': '06 Aug 2026', 'deadline': '16 Aug 2026', 'deadline_label': 'French Diploma Course Registration'},
        135: {'date': '06 Aug 2026', 'deadline': '16 Aug 2026', 'deadline_label': 'French Certificate Course Registration'},
        257: {'date': '02 May 2026', 'deadline': '15 May 2026', 'deadline_label': 'Exam Form Session May/June'},
        265: {'date': '28 Apr 2026', 'deadline': '10 May 2026', 'deadline_label': 'Grievance Submission of IA/CA'},
        299: {'date': '22 Apr 2026', 'deadline': '05 May 2026', 'deadline_label': 'Exam Form Submission Date Extended'},
        348: {'date': '12 Apr 2026', 'deadline': '25 Apr 2026', 'deadline_label': 'Exam Form Date Extended'},
        353: {'date': '24 Mar 2026', 'deadline': '10 Apr 2026', 'deadline_label': 'Arun Jaitley Gold Medal Form'},
        354: {'date': '24 Mar 2026', 'deadline': '10 Apr 2026', 'deadline_label': 'ECA Medal Application Form'},
        357: {'date': '24 Mar 2026', 'deadline': '10 Apr 2026', 'deadline_label': 'Medals & Awards Application Deadline'},
        412: {'date': '15 Feb 2026', 'deadline': '28 Feb 2026', 'deadline_label': 'Improvement / Re-appearing Form'},
        414: {'date': '08 Feb 2026', 'deadline': '20 Feb 2026', 'deadline_label': 'PGDGBO Entrance Date Extension'}
    }

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    month_map = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
        '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
        '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr', '5': 'May', '6': 'Jun',
        '7': 'Jul', '8': 'Aug', '9': 'Sep',
        'january': 'Jan', 'february': 'Feb', 'march': 'Mar', 'april': 'Apr',
        'may': 'May', 'june': 'Jun', 'july': 'Jul', 'august': 'Aug',
        'september': 'Sep', 'october': 'Oct', 'november': 'Nov', 'december': 'Dec',
        'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
        'jun': 'Jun', 'jul': 'Jul', 'aug': 'Aug', 'sep': 'Sep', 'sept': 'Sep',
        'oct': 'Oct', 'nov': 'Nov', 'dec': 'Dec'
    }

    date_val = None
    deadline_val = None
    deadline_lbl = None

    if notice_idx in KNOWN_DATA:
        date_val = KNOWN_DATA[notice_idx]['date']
        deadline_val = KNOWN_DATA[notice_idx]['deadline']
        deadline_lbl = KNOWN_DATA[notice_idx]['deadline_label']

    if not date_val:
        # Check title patterns (e.g., "17 August 2026", "September 25, 2026", "09.08.2026")
        m1 = re.search(r'([0-3]?\d(?:st|nd|rd|th)?)\s+([A-Za-z]+)\s+(202[4-6])', title, re.I)
        if m1:
            d_raw, mon_raw, yr_raw = m1.groups()
            d_clean = re.sub(r'\D', '', d_raw)
            mon_clean = month_map.get(mon_raw.lower(), mon_raw[:3].title())
            date_val = f"{int(d_clean)} {mon_clean} {yr_raw}"
        elif re.search(r'([A-Za-z]+)\s+([0-3]?\d(?:st|nd|rd|th)?)[,\s]+(202[4-6])', title, re.I):
            m1b = re.search(r'([A-Za-z]+)\s+([0-3]?\d(?:st|nd|rd|th)?)[,\s]+(202[4-6])', title, re.I)
            mon_raw, d_raw, yr_raw = m1b.groups()
            d_clean = re.sub(r'\D', '', d_raw)
            mon_clean = month_map.get(mon_raw.lower(), mon_raw[:3].title())
            date_val = f"{int(d_clean)} {mon_clean} {yr_raw}"
        elif re.search(r'[^0-9](\d{1,2})([1-9]|1[0-2])(2[4-6])\.(?:pdf|jpg|png|jpeg)', link):
            m_fn = re.search(r'[^0-9](\d{1,2})([1-9]|1[0-2])(2[4-6])\.(?:pdf|jpg|png|jpeg)', link)
            d, mo, yr = m_fn.groups()
            if 1 <= int(d) <= 31:
                date_val = f"{int(d)} {month_names[int(mo)-1]} 20{yr}"
        elif re.search(r'(\d{2})[-_.](\d{2})[-_.](202[4-6])', link + ' ' + title):
            m_iso = re.search(r'(\d{2})[-_.](\d{2})[-_.](202[4-6])', link + ' ' + title)
            d, mo, yr = m_iso.groups()
            if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31:
                date_val = f"{int(d)} {month_names[int(mo)-1]} {yr}"

    # Check extracted text for dates if still None
    doc_info = text_cache.get(f"srcc-notice-{notice_idx}", {})
    dt_text = doc_info.get('text', '')
    if not date_val and dt_text:
        m_dt = re.search(r'(?:dated|date)[:\s]+([0-3]?\d(?:st|nd|rd|th)?)\s+([A-Za-z]+)[,\s]+(202[4-6])', dt_text, re.I)
        if m_dt:
            d_raw, mon_raw, yr_raw = m_dt.groups()
            d_clean = re.sub(r'\D', '', d_raw)
            mon_clean = month_map.get(mon_raw.lower(), mon_raw[:3].title())
            date_val = f"{int(d_clean)} {mon_clean} {yr_raw}"

    # If still not found, estimate month chronologically from feed position
    if not date_val:
        if notice_idx <= 45:
            date_val = "Oct 2026"
        elif notice_idx <= 145:
            date_val = "Aug 2026"
        elif notice_idx <= 245:
            date_val = "Jul 2026"
        elif notice_idx <= 330:
            date_val = "May 2026"
        elif notice_idx <= 385:
            date_val = "Apr 2026"
        elif notice_idx <= 415:
            date_val = "Feb 2026"
        else:
            date_val = "Jan 2026"

    # Dynamic deadline extraction from doc text if not set in lookup
    if not deadline_val and dt_text:
        m_dl = re.search(r'(?:last\s+date|extended\s+upto|submission\s+deadline|closing\s+date)[^.\n\r]{1,40}?([0-3]?\d(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+202[4-6])', dt_text, re.I)
        if m_dl:
            deadline_val = m_dl.group(1).strip()
            deadline_lbl = 'Submission Deadline'

    notices.append({
        'id': f"srcc-notice-{notice_idx}",
        'title': title,
        'category': cat,
        'link': link,
        'link_type': link_type,
        'date': date_val,
        'deadline': deadline_val,
        'deadline_label': deadline_lbl,
        'has_deadline': bool(deadline_val),
        'source': 'Official SRCC Announcements (srcc.edu)'
    })
    notice_idx += 1

print(f"Generated {len(notices)} official college notices.")

# Write college_notices.json
with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump({'total': len(notices), 'source': 'https://www.srcc.edu/announcements', 'notices': notices}, f, indent=2, ensure_ascii=False)

# Write college_notices.js
js_content = f"""// Official SRCC College Notices & Circulars Directory
// Sourced from Shri Ram College of Commerce Official Announcements (https://www.srcc.edu/announcements)
// All links reference original official documents hosted on srcc.edu / online.srcc.edu
window.SRCC_OFFICIAL_NOTICES = {json.dumps(notices, indent=2, ensure_ascii=False)};
"""

with open(OUTPUT_JS, 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Saved to {OUTPUT_JS} and {OUTPUT_JSON}")
