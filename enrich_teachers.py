"""
Enrich SRCC Teachers Data with:
1. Genuine Teacher Short Codes (HHK for Harish Kumar, AYJ for Abhay Jain, etc.)
2. Remove cg16 / hg4 from public short_code (keep in ref_code)
3. Extract Subjects (CLAW, BLAW, FMI, IF, ITLP, etc.) for each class and teacher profile
4. Extract Section & Batch for each class
5. Format clean display string for schedules
"""

import json
import re

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

    def is_valid_teacher_code(code):
        if not code:
            return False
        c = code.upper().strip()
        if c in EXCLUDE_CODES:
            return False
        if re.match(r'^(SEC|VAC|NP|BATCH|LAB|TUT)\d*$', c, re.I):
            return False
        if re.match(r'^[A-Z]\d+$', c):
            return False
        if re.match(r'^(CG|HG)\d+$', c, re.I):
            return False
        if re.match(r'^\d+$', c):
            return False
        if len(c) < 2 or len(c) > 6:
            return False
        return True

    # 1. Map teacher short codes
    for t in teachers_data['teachers']:
        ref_id = t.get('short_code', '')
        t['ref_code'] = ref_id  # Store original for reference (e.g. cg16)

        existing_code = ref_id if is_valid_teacher_code(ref_id) else ''
        candidate_codes = {}

        for day, classes in t['schedule'].items():
            for c in classes:
                r = c.get('room', '').strip().upper()
                slot = c.get('slot', '')
                k = (r, day, slot)
                if k in room_slots:
                    for r_cls in room_slots[k]:
                        m = re.search(r'-([A-Za-z0-9]+)$', r_cls)
                        if m and is_valid_teacher_code(m.group(1)):
                            code = m.group(1).upper()
                            candidate_codes[code] = candidate_codes.get(code, 0) + 1
                        m2 = re.search(r'-([A-Za-z0-9]+)-[A-Za-z0-9]+$', r_cls)
                        if m2 and is_valid_teacher_code(m2.group(1)):
                            code2 = m2.group(1).upper()
                            candidate_codes[code2] = candidate_codes.get(code2, 0) + 1

        if existing_code:
            t['short_code'] = existing_code
        elif candidate_codes:
            t['short_code'] = max(candidate_codes.items(), key=lambda x: x[1])[0]
        else:
            t['short_code'] = ''  # Never show cg16 as short_code

    # 2. Extract and format subjects, section, batch for every class
    for t in teachers_data['teachers']:
        all_t_subjects = set()
        for day, classes in t['schedule'].items():
            for c in classes:
                raw = c.get('raw', '')
                clean = re.sub(r'<[-=]+>', '', raw).strip()

                # Extract subject
                subj = ''
                m = re.search(r'SEM\s*[IVX]+[A-Za-z\.\s]*-([A-Za-z0-9\.\(\)\/\s\+&]{2,15})-(?:R\d+|T\d+|PB\d+|SCR\d+|CL\d+|SEMINAR|LIBRARY|PLAYGROUND)', clean, re.I)
                if m:
                    subj = m.group(1).strip()
                else:
                    m2 = re.search(r'-([A-Za-z0-9\.\(\)\/\s\+&]{2,15})-(?:R\d+|T\d+|PB\d+|SCR\d+|CL\d+)', clean, re.I)
                    if m2:
                        subj = m2.group(1).strip()
                    elif c.get('subject'):
                        subj = c['subject']

                # Filter false subject extractions
                if subj in ('Commerce', 'Economics', 'Mathematics', 'English', 'Hindi', 'EVS', 'Phy.Ed', 'SEM'):
                    subj = ''
                if re.match(r'^(NP|VAC|J|A|B|C|D|E|F|G|H|I|K|L|M|N)\d+$', subj, re.I):
                    subj = ''

                c['subject'] = subj
                if subj:
                    all_t_subjects.add(subj)

                # Section
                sec_m = re.search(r'-([A-Z])-SEM', clean, re.I)
                c['section'] = f"Sec {sec_m.group(1).upper()}" if sec_m else ''

                # Batch (e.g. J2, NP3, VAC1)
                batch_m = re.search(r'-(NP\d+|VAC\d+|[A-Z]\d+)$', clean, re.I)
                batch_val = batch_m.group(1).upper() if batch_m else ''
                # If batch is just the room code (like R4 or T38), it is not a batch!
                if batch_val == c.get('room', '').upper() or re.match(r'^(R\d+|T\d+|PB\d+|SCR\d+|CL\d+)$', batch_val, re.I):
                    batch_val = ''
                c['batch'] = batch_val

                # Formatted display string
                parts = []
                if c['subject']:
                    parts.append(c['subject'])
                if c['course']:
                    parts.append(c['course'])
                if c['semester']:
                    parts.append(c['semester'])
                if c['section']:
                    parts.append(c['section'])
                if c['batch']:
                    parts.append(f"({c['batch']})")
                c['formatted_display'] = ' · '.join(parts)

        t['subjects'] = sorted(list(all_t_subjects))

    # Save to teachers_data.json and teachers_data.js
    with open('web_app/teachers_data.json', 'w', encoding='utf-8') as f:
        json.dump(teachers_data, f, indent=2, ensure_ascii=False)

    with open('web_app/teachers_data.js', 'w', encoding='utf-8') as f:
        f.write('window.SRCC_TEACHERS_DATA = ' + json.dumps(teachers_data, indent=2, ensure_ascii=False) + ';\n')

    print(f"Enrichment complete! Updated {len(teachers_data['teachers'])} teachers.")

if __name__ == '__main__':
    enrich()
