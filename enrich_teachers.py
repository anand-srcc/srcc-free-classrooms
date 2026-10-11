"""
Enrich SRCC Teachers Data with:
1. Genuine Teacher Short Codes (HHK for Harish Kumar, AYJ for Abhay Jain, etc.)
2. Remove cg16 / hg4 from public short_code (keep in ref_code)
3. Split concatenated classes into individual distinct records
4. Extract Subjects with full official names (EVS, BLAW, FA, MPA, BECON, POM, etc.)
5. Extract Section & Batch (including practical batches like JP1 -> J1, NP2 -> N2)
6. Format clean display string for schedules
"""

import json
import re
import os

ROOM_REGEX = r'(?:R\d+|T\d+|PB\d+|SCR\d+|CL\d+|CLIB|Library FF|LIBRARY|SEMINAR|PLAYGROUND)'

# Comprehensive Subject Dictionary for SRCC & Delhi University
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
    'EVS-I': 'Environmental Studies I (Theory into Practice)',
    'EVS-II': 'Environmental Studies II (Theory into Practice)',
    'PME-I': 'Principles of Microeconomics I',
    'PME': 'Principles of Microeconomics',
    'PMEE': 'Principles of Microeconomics',

    # Economics Hons Core & Electives
    'Intro MME': 'Introductory Mathematical Methods for Economics',
    'Adv MME': 'Advanced Mathematical Methods for Economics',
    'IMA I': 'Intermediate Macroeconomics I',
    'IMIC1': 'Intermediate Microeconomics I',
    'ISME': 'Introductory Statistics for Economics',
    'DE': 'Development Economics',
    'EHI': 'Economic History of India',
    'IDE': 'Issues in Development Economics',
    'GT': 'Game Theory',
    'PE': 'Political Economy',
    'PM': 'Project Management',
    'RM': 'Research Methodology',
    'GBS': 'Global Business Strategy',
    'OEM': 'Open Elective Management',
    'AdTrix': 'Advanced Econometrics',
    'IIPT': 'Indian Political Thought',
    'NL': 'Nationalism in India',
    'NII': 'Nationalism and Indian Identity',
    'UIR': 'Understanding International Relations',
    'GIC': 'Global Institutions and Commerce',
    'IGT': 'Interactive Game Theory',
    'IMC': 'Integrated Marketing Communication',
    'IST': 'Information Systems and Technology',
    'RIDL': 'Readings in Indian Democratic Literature',

    # Electives, GE, SEC, VAC
    'AS': 'Applied Statistics',
    'BIT': 'Business Information Technologies',
    'ITSA I': 'Introduction to Statistics and Analysis I',
    'ITSA II': 'Introduction to Statistics and Analysis II',
    'BIDV': 'Business Intelligence & Data Visualization',
    'BADS': 'Business Analytics & Data Science',
    'BDE': 'Business Data Ecosystem',
    'DEC': 'Digital Economy & E-Commerce',
    'EC': 'E-Commerce',
    'ECom': 'E-Commerce',
    'DA': 'Data Analysis',
    'DM': 'Digital Marketing',
    'DMS': 'Database Management Systems',
    'CAS': 'Computerized Accounting System',
    'CFD': 'Corporate Financial Decisions',
    'CFCR': 'Corporate Finance & Restructuring',
    'CIEL': 'Communication in Everyday Life',
    'CPL': 'Communication in Professional Life',
    'CVFD': 'Constitutional Values and Fundamental Duties',
    'DnD': 'Digitalization and Development',
    'EI': 'Economics of Industry',
    'EP': 'Economic Policy',
    'FC': 'Finance for Everyone',
    'FOC': 'Fundamentals of Computing',
    'FP': 'Financial Planning',
    'PFP': 'Personal Financial Planning',
    'GF': 'Global Finance',
    'IF': 'International Finance',
    'IE': 'International Economics',
    'IBS': 'International Business Strategy',
    'IM': 'International Marketing',
    'ISM': 'Information Systems Management',
    'ITL': 'Income Tax Law',
    'ITPD': 'IT for Professional Development',
    'ME': 'Managerial Economics',
    'MFB': 'Marketing for Beginners',
    'MFD': 'Macro Financial Dynamics',
    'NM': 'Numerical Methods',
    'OB': 'Organizational Behavior',
    'ODI': 'Organizational Dynamics & Intervention',
    'OE': 'Open Elective',
    'OOPUP': 'Programming Using Python',
    'OPUP': 'Programming Using Python',
    'PUP': 'Programming Using Python',
    'OS': 'Operating Systems',
    'PAB': 'Public Administration and Business',
    'PSEL': 'Professional Skills in English Language',
    'PSELL': 'Professional Skills in English Language',
    'RIFE': 'Reading Indian Fiction in English',
    'SET': 'Statistical Economics & Techniques',
    'SHRM': 'Strategic Human Resource Management',
    'SM': 'Strategic Management',
    'SMM': 'Social Media Marketing',
    'SRG': 'Social Responsibility & Governance',
    'SWR': 'Statistics with R',
    'TA': 'Taxation & Accounting',
    'TGNLC': 'The Gita for Navigating Life Challenges',
    'TPF': 'Theory of Public Finance',
    'TR': 'Tools for Research',
    'VAC SEL': 'Value Addition Course Elective',
    'VM I': 'Vedic Mathematics I',
    'VM II': 'Vedic Mathematics II',
    'VM III': 'Vedic Mathematics III',
    'WM': 'Wealth Management',
    'BF': 'Behavioral Finance',
    'BFIM': 'Banking, Financial Institutions & Markets',
    'BM': 'Business Management',
    'BRM': 'Brand Management',
    'BSC': 'Business Communication',
    'CW': 'Creative Writing',
    'DTHRS': 'Design Thinking & HR Systems',
    'HFPE': 'Health, Fitness & Physical Education',
    'HA': 'Hindi Cinema aur Uska Adhyayan (Hindi A)',
    'HB': 'Hindi Gadhya (Hindi B)',
    'HC': 'Hindi Bhasha aur Sahitya (Hindi C)',
    'HD': 'Hindi Gadhy: Udbhav aur Vikas (Hindi D)',
    'HE': 'Hindi Sahitya (Hindi E)',
    'H B': 'Hindi B',
    'ABH': 'The Art of Being Happy',
    'ACPA': 'Advanced Cost and Performance Analysis',
    'ACR': 'Accounting for Corporate Restructuring',
    'AFE': 'Accounting for Everyone',
    'AIS': 'Accounting Information Systems',
    'English': 'English'
}

def parse_single_class(raw_part, slot):
    clean = re.sub(r'<[-=]+>', '', raw_part).strip()
    if not clean:
        return None

    # 1. Class Type
    cls_type = 'Lecture'
    if clean.startswith('LAB') or 'LAB-' in clean:
        cls_type = 'Practical/Lab'
    elif clean.startswith('T-') or clean.startswith('TUT') or '-TUT-' in clean:
        cls_type = 'Tutorial'

    # 2. Course
    course = ''
    if 'BCH' in clean:
        course = 'B.Com (Hons)'
    elif 'BAHE' in clean or 'BAH' in clean or 'ECO' in clean:
        course = 'B.A. (Hons) Economics'
    elif 'MCOM' in clean or 'M.COM' in clean:
        course = 'M.Com'
    elif 'MA-ECO' in clean:
        course = 'M.A. Economics'

    # 3. Semester
    sem_m = re.search(r'SEM\s*([IVX]+)', clean, re.I)
    semester = f"Sem {sem_m.group(1).upper()}" if sem_m else ''

    # 4. Section
    sec_m = re.search(r'-([A-Z])-SEM', clean, re.I)
    if sec_m:
        section = f"Sec {sec_m.group(1).upper()}"
    elif 'JOINT' in clean:
        section = 'Joint'
    else:
        section = ''

    # 5. Room
    room_m = re.search(rf'-({ROOM_REGEX})(?:-|$)', clean, re.I)
    room = room_m.group(1).upper() if room_m else ''
    if room.upper() == 'CLIB':
        room = 'CLIB'
    elif 'LIBRARY' in room.upper():
        room = 'Library FF'

    # 6. Batch (including practical batches like JP1, AP2, NP3, and tutorials J1, A2)
    batch = ''
    raw_batch = ''
    batch_m = re.search(r'-(NP\d+|VAC\d+|SEC\d+|[A-Z]P\d+|[A-Z]\d+|\d+)$', clean, re.I)
    if batch_m:
        b_candidate = batch_m.group(1).upper()
        if b_candidate != room and not re.match(r'^(R\d+|T\d+|PB\d+|SCR\d+|CL\d+)$', b_candidate, re.I):
            raw_batch = b_candidate
            p_match = re.match(r'^([A-Z])P(\d+)$', b_candidate)
            if p_match:
                # Normalize practical batch: e.g. JP1 -> J1
                batch = f"{p_match.group(1)}{p_match.group(2)}"
            else:
                batch = b_candidate

    # 7. Subject
    subj = ''
    if 'EVS-II' in clean or 'EVS-2' in clean:
        subj = 'EVS-II'
    elif 'EVS-I' in clean or 'EVS-1' in clean:
        subj = 'EVS-I'
    elif '-EVS-' in clean:
        subj = 'EVS'
    elif '-PME-I-' in clean or clean.endswith('-PME-I'):
        subj = 'PME-I'
    elif re.search(rf'SEM\s*[IVX]+English-(?:{ROOM_REGEX}|$)', clean, re.I):
        subj = 'English'
    elif re.search(rf'SEM\s*[IVX]+Hindi-(?:{ROOM_REGEX}|$)', clean, re.I):
        subj = 'Hindi'
    else:
        m = re.search(rf'SEM\s*[IVX]+[A-Za-z\.\s]*-([A-Za-z0-9\.\(\)\/\s\+&]{{2,15}})-(?:{ROOM_REGEX}|SEC\d+|VAC\d+|-)', clean, re.I)
        if m:
            subj = m.group(1).strip()
        else:
            m2 = re.search(rf'-([A-Za-z0-9\.\(\)\/\s\+&]{{2,15}})-(?:{ROOM_REGEX}|SEC\d+|VAC\d+|-)', clean, re.I)
            if m2:
                subj = m2.group(1).strip()
            else:
                m3 = re.search(r'-([A-Za-z0-9\.\(\)\/\s\+&]{2,15})-$', clean)
                if m3:
                    subj = m3.group(1).strip()

    # Filter out false subject extractions
    if subj in ('Commerce', 'Economics', 'Mathematics', 'Phy.Ed', 'SEM', 'JOINT', 'Library FF', 'FF'):
        subj = ''
    if re.match(r'^(NP|VAC|SEC|[A-Z])\d+$', subj, re.I):
        subj = ''
    if re.match(r'^[A-Z]P\d+$', subj, re.I):
        subj = ''
    if subj in ('I', 'II', 'III', 'IV', 'V', 'VI'):
        subj = ''

    # Full subject name
    subject_name = SUBJECT_MAP.get(subj, subj)
    if 'VAC' in clean.upper():
        if subj == 'DE':
            subject_name = 'Digital Empowerment'
        elif subj == 'EC':
            subject_name = 'Ethics and Culture'
        elif subj == 'EI':
            subject_name = 'Emotional Intelligence'
        elif subj == 'FC':
            subject_name = 'Financial Literacy'

    # Formatted display string
    parts = []
    if subject_name and subject_name != subj:
        parts.append(f"{subject_name} ({subj})")
    elif subj:
        parts.append(subj)
    if course:
        parts.append(course)
    if semester:
        parts.append(semester)
    if section:
        parts.append(section)
    if batch:
        p_m = re.match(r'^([A-Z])(\d+)$', batch)
        if p_m:
            sec_l, b_num = p_m.group(1), p_m.group(2)
            parts.append(f"({sec_l}{b_num} / {sec_l}P{b_num})")
        elif raw_batch and raw_batch != batch:
            parts.append(f"({batch} / {raw_batch})")
        else:
            parts.append(f"({batch})")

    return {
        'raw': clean,
        'display': clean,
        'type': cls_type,
        'room': room,
        'course': course,
        'semester': semester,
        'section': section,
        'batch': batch,
        'raw_batch': raw_batch,
        'subject': subj,
        'subject_name': subject_name,
        'slot': slot,
        'formatted_display': ' · '.join(parts)
    }

def enrich():
    with open('web_app/srcc_data.json', 'r', encoding='utf-8') as f:
        rooms_data = json.load(f)

    with open('web_app/teachers_data.json', 'r', encoding='utf-8') as f:
        teachers_data = json.load(f)

    # Build room slots lookup: (room, day, slot) -> [class strings]
    room_slots = {}
    for r in rooms_data['rooms']:
        for day, sched in r.get('schedule', {}).items():
            for occ in sched.get('occupied_slots', []):
                k = (r['code'].strip().upper(), day, occ['slot'])
                if k not in room_slots:
                    room_slots[k] = []
                room_slots[k].append(occ['class'])

    EXCLUDE_CODES = {'VAC1', 'VAC2', 'NP1', 'NP2', 'NP3', 'J1', 'J2', 'A1', 'A2', 'A3', 'B1', 'B2', 'B3',
                     'C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'E1', 'E2', 'E3', 'F1', 'F2', 'F3', 'G1', 'G2',
                     'G3', 'H1', 'H2', 'H3', 'I1', 'I2', 'I3', 'K1', 'K2', 'K3', 'L1', 'L2', 'L3', 'M1',
                     'M2', 'M3', 'N1', 'N2', 'N3', 'O1', 'O2', 'O3', 'SEM', 'SEC', 'LAB', 'TUT', 'HE', 'HB', 'HD'}

    ECO_NUM_MAP = {
        'Aditi': 'A21',
        'Aditi Khanna': 'AK24',
        'Akanksha Gupta': 'AG11',
        'Chandrabhushan': 'CB29',
        'David A Longkumer': 'DA',
        'Harshita Chechani': 'HC',
        'Himanshu Takia': 'HT5',
        'Hritika Chauhan': 'HC26',
        'Ishika Tiwar': 'IT3',
        'Jasmine Kaur': 'JK12',
        'Kashish Gupta': 'KG1',
        'Katyayani': 'KA25',
        'Kopal Gupta': 'KG7',
        'Kritika Gambhir': 'KG',
        'Mamoon Rasheed': 'MR',
        'Manasvi Chowdhury': 'MG15',
        'Mugdha Khandelwal': 'MK4',
        'Mukti Sri Narain': 'MSN28',
        'Palak Baghla': 'PB27',
        'Samiksha Kapoor': 'SK2',
        'Seema Kumari': 'SK20',
        'Shiuli Saha': 'SS6',
        'Shruti Kashyap': 'SK19',
    }

    def is_valid_teacher_code(code):
        if not code:
            return False
        c = code.upper().strip()
        if c in EXCLUDE_CODES:
            return False
        if re.match(r'^(SEC|VAC|NP|BATCH|LAB|TUT)\d*$', c, re.I):
            return False
        if re.match(r'^[A-Z]\d+$', c) and not re.match(r'^(CG|HG|CSG|EG|[A-Z]{2,})\d+$', c):
            return False
        if re.match(r'^\d+$', c):
            return False
        if len(c) < 2 or len(c) > 6:
            return False
        return True

    # 1. Map teacher short codes
    for t in teachers_data['teachers']:
        name = t.get('clean_name', '')
        label = t.get('label', '')
        dept = t.get('department', '')

        assigned_code = ''
        if name in ECO_NUM_MAP:
            assigned_code = ECO_NUM_MAP[name]
        else:
            # Check parenthesized code in label: e.g. "Abhilash (hg4)" -> "HG4", "Aayushi (cg16)" -> "CG16"
            m = re.search(r'\((.*?)\)', label)
            if m:
                c = m.group(1).strip().upper()
                if re.match(r'^(CG|HG|CSG|EG)\d+$', c, re.I):
                    assigned_code = c
                elif re.match(r'^\d+$', c) and dept == 'Economics':
                    assigned_code = f"EG{c}"

            if not assigned_code:
                m2 = re.match(r'^(Commerce|Eco|Hindi|Cs)\s*Guest\s*(\d+)$', name, re.I)
                if m2:
                    prefix = {'COMMERCE': 'CG', 'ECO': 'EG', 'HINDI': 'HG', 'CS': 'CSG'}.get(m2.group(1).upper(), 'G')
                    assigned_code = f"{prefix}{m2.group(2)}"

        # Check candidate codes from room slots
        candidate_codes = {}
        for day, classes in t['schedule'].items():
            for c in classes:
                r = c.get('room', '').strip().upper()
                slot = c.get('slot', '')
                k = (r, day, slot)
                if k in room_slots:
                    for r_cls in room_slots[k]:
                        m_end = re.search(r'-([A-Za-z0-9]+)$', r_cls)
                        if m_end and is_valid_teacher_code(m_end.group(1)):
                            code = m_end.group(1).upper()
                            candidate_codes[code] = candidate_codes.get(code, 0) + 1
                        m2_mid = re.search(r'-([A-Za-z0-9]+)-[A-Za-z0-9]+$', r_cls)
                        if m2_mid and is_valid_teacher_code(m2_mid.group(1)):
                            code2 = m2_mid.group(1).upper()
                            candidate_codes[code2] = candidate_codes.get(code2, 0) + 1
        room_code = max(candidate_codes.items(), key=lambda x: x[1])[0] if candidate_codes else ''

        # Combine dual codes where teachers have both official guest code and initials/timetable code
        if name == 'Abhilash':
            final_code = 'HG4 / AH'
            room_code = f"AH {room_code}".strip()
        elif assigned_code and room_code and assigned_code != room_code and not assigned_code.endswith(room_code) and not room_code.endswith(assigned_code):
            final_code = f"{assigned_code} / {room_code}"
        elif assigned_code:
            final_code = assigned_code
        elif room_code:
            final_code = room_code
        elif is_valid_teacher_code(t.get('short_code', '')):
            final_code = t.get('short_code', '')
        else:
            final_code = ''

        t['short_code'] = final_code
        t['ref_code'] = f"{final_code} {assigned_code} {room_code}".strip()

    def merge_day_classes(classes_list):
        by_slot = {}
        for c in classes_list:
            slot = c.get('slot', '')
            if slot not in by_slot:
                by_slot[slot] = []
            by_slot[slot].append(c)

        result = []
        for slot, slot_classes in by_slot.items():
            if len(slot_classes) == 1:
                result.append(slot_classes[0])
                continue

            # Group classes in this slot that belong to the same session
            merged_groups = []
            for c in slot_classes:
                matched_group = None
                c_subj = (c.get('subject') or '').strip().upper()
                c_type = (c.get('type') or '').strip()
                c_room = (c.get('room') or '').strip().upper()

                for g in merged_groups:
                    g_subj = (g[0].get('subject') or '').strip().upper()
                    g_type = (g[0].get('type') or '').strip()
                    g_rooms = [(item.get('room') or '').strip().upper() for item in g if (item.get('room') or '').strip()]

                    subj_match = (c_subj and g_subj and c_subj == g_subj)
                    type_match = (c_type == g_type) or (not c_type) or (not g_type)
                    room_compatible = (not c_room) or (not g_rooms) or (c_room in g_rooms)

                    if subj_match and type_match and room_compatible:
                        matched_group = g
                        break

                if matched_group is not None:
                    matched_group.append(c)
                else:
                    merged_groups.append([c])

            for g in merged_groups:
                if len(g) == 1:
                    result.append(g[0])
                    continue

                base = dict(g[0])

                valid_rooms = [item.get('room') for item in g if item.get('room')]
                if valid_rooms:
                    base['room'] = valid_rooms[0]

                courses = []
                for item in g:
                    crs = item.get('course')
                    if crs and crs not in courses:
                        courses.append(crs)
                base['courses_list'] = courses
                if len(courses) > 1:
                    base['course'] = ' / '.join(courses)

                semesters = []
                for item in g:
                    sem = item.get('semester')
                    if sem and sem not in semesters:
                        semesters.append(sem)
                base['semesters_list'] = semesters
                if len(semesters) > 1:
                    base['semester'] = ' / '.join(semesters)

                sections = []
                for item in g:
                    sec = item.get('section')
                    if sec and sec not in sections:
                        sections.append(sec)
                base['sections_list'] = sections
                if len(sections) > 1:
                    clean_secs = [re.sub(r'^Sec\s*', '', s) for s in sections]
                    base['section'] = f"Sec {', '.join(clean_secs)}"
                elif sections:
                    base['section'] = sections[0]

                batches = []
                raw_batches = []
                for item in g:
                    b = item.get('batch')
                    rb = item.get('raw_batch')
                    if b and b not in batches:
                        batches.append(b)
                    if rb and rb not in raw_batches:
                        raw_batches.append(rb)

                base['batches_list'] = batches
                base['raw_batches_list'] = raw_batches

                if raw_batches:
                    base['raw_batch'] = ', '.join(raw_batches)
                if batches:
                    base['batch'] = ', '.join(batches)

                subj_name = base.get('subject_name') or base.get('subject')
                subj = base.get('subject')
                parts = []
                if subj_name and subj_name != subj:
                    parts.append(f"{subj_name} ({subj})")
                elif subj:
                    parts.append(subj)
                if base.get('course'):
                    parts.append(base['course'])
                if base.get('semester'):
                    parts.append(base['semester'])
                if base.get('section'):
                    parts.append(base['section'])

                # Consistently sort and format batches
                source_batches = batches if batches else raw_batches
                if source_batches:
                    def get_batch_num(val):
                        m = re.search(r'\d+', val)
                        return int(m.group(0)) if m else 999

                    sorted_b = sorted(list(dict.fromkeys(source_batches)), key=get_batch_num)
                    formatted_b_items = []
                    for b_val in sorted_b:
                        p_m = re.match(r'^([A-Za-z])(?:P)?(\d+)$', b_val)
                        if p_m:
                            sec_l, b_num = p_m.group(1).upper(), p_m.group(2)
                            formatted_b_items.append(f"{sec_l}{b_num} / {sec_l}P{b_num}")
                        else:
                            formatted_b_items.append(b_val)
                    parts.append(f"({', '.join(formatted_b_items)})")

                base['formatted_display'] = ' · '.join(parts)
                result.append(base)

        return result

    # 2. Split concatenated classes, parse subjects, section, batch for every class, and merge same-session clusters
    total_classes = 0
    for t in teachers_data['teachers']:
        all_t_subjects = set()
        new_schedule = {}

        for day, classes in t['schedule'].items():
            parsed_day_classes = []
            for c in classes:
                raw = c.get('raw', '')
                slot = c.get('slot', '')

                parts = re.split(r'(?=(?:LAB|L|T)-(?:BCH|BAHE|BAH|MCOM|M\.COM|MA-ECO|JOINT)-)', raw)
                parts = [p.strip() for p in parts if p.strip()]
                if not parts:
                    parts = [raw]

                for p in parts:
                    parsed = parse_single_class(p, slot)
                    if parsed:
                        parsed_day_classes.append(parsed)

            merged_classes = merge_day_classes(parsed_day_classes)
            new_schedule[day] = merged_classes
            total_classes += len(merged_classes)

            for m in merged_classes:
                if m['subject']:
                    all_t_subjects.add(m['subject'])
                if m.get('subject_name') and m['subject_name'] != m['subject']:
                    all_t_subjects.add(m['subject_name'])

        t['schedule'] = new_schedule
        t['subjects'] = sorted(list(all_t_subjects))

    # Save to web_app/teachers_data.json and web_app/teachers_data.js
    with open('web_app/teachers_data.json', 'w', encoding='utf-8') as f:
        json.dump(teachers_data, f, indent=2, ensure_ascii=False)

    with open('web_app/teachers_data.js', 'w', encoding='utf-8') as f:
        f.write('window.SRCC_TEACHERS_DATA = ' + json.dumps(teachers_data, indent=2, ensure_ascii=False) + ';\n')

    # Also sync preview_web_app if it exists
    if os.path.exists('preview_web_app'):
        try:
            with open('preview_web_app/teachers_data.json', 'w', encoding='utf-8') as f:
                json.dump(teachers_data, f, indent=2, ensure_ascii=False)
            with open('preview_web_app/teachers_data.js', 'w', encoding='utf-8') as f:
                f.write('window.SRCC_TEACHERS_DATA = ' + json.dumps(teachers_data, indent=2, ensure_ascii=False) + ';\n')
        except Exception:
            pass

    print(f"Enrichment complete! Updated {len(teachers_data['teachers'])} teachers with {total_classes} classes.")

if __name__ == '__main__':
    enrich()
