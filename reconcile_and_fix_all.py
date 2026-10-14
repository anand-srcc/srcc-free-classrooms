import json
import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, 'web_app')
ANDROID_WEB_APP_DIR = os.path.join(BASE_DIR, 'android_widget', 'app', 'src', 'main', 'assets', 'web_app')

# 1. Load classes_data
classes_json_path = os.path.join(WEB_APP_DIR, 'classes_data.json')
with open(classes_json_path, 'r', encoding='utf-8') as f:
    cdata = json.load(f)

# Fix Sec G Wednesday slot shifts
fixed_sec_g_count = 0
sec_g = cdata.get('courses', {}).get('B.Com (Hons)', {}).get('Sem I', {}).get('Sec G', [])
for c in sec_g:
    if c.get('day') == 'Wednesday':
        raw = c.get('raw', '')
        if 'FA-R1-HNT' in raw and c.get('slot') == '9:30 AM to 10:30 AM':
            c['slot'] = '10:30 AM to 11:30 AM'
            fixed_sec_g_count += 1
        elif 'BLAW-T8-AAG-G1' in raw and c.get('slot') == '10:30 AM to 11:30 AM':
            c['slot'] = '11:30 AM to 12:30 PM'
            fixed_sec_g_count += 1
        elif 'PME-I-R5-PB27' in raw and c.get('slot') == '11:30 AM to 12:30 PM':
            c['slot'] = '12:30 PM to 1:30 PM'
            fixed_sec_g_count += 1

print(f"Fixed {fixed_sec_g_count} shifted slots in B.Com Sem I Sec G Wednesday timetable.")

# 2. Load teachers_data
teachers_json_path = os.path.join(WEB_APP_DIR, 'teachers_data.json')
with open(teachers_json_path, 'r', encoding='utf-8') as f:
    tdata = json.load(f)

phantom_removed = 0
slot_adjusted = 0

for t in tdata.get('teachers', []):
    tcode = t.get('short_code', '').strip().upper()
    tid = str(t.get('id', ''))
    
    for day, slots in list(t.get('schedule', {}).items()):
        new_slots = []
        for s in slots:
            raw = s.get('raw', '')
            r = (s.get('room') or '').strip().upper()
            slot = s.get('slot')
            
            # Case 1: HNT Wednesday duplicate at 9:30 in R1
            if tcode == 'HNT' and day == 'Wednesday' and slot == '9:30 AM to 10:30 AM' and r == 'R1':
                phantom_removed += 1
                continue
            
            # Case 2: Cross-contamination where teacher was assigned classes belonging to another teacher
            if tcode == 'ANC' and any(x in raw for x in ['-ASA-', '-NC-', '-TAC-']):
                phantom_removed += 1
                continue
            if tcode == 'SKC' and '-SHK-' in raw:
                phantom_removed += 1
                continue
            if tcode == 'PAA' and '-PKC-' in raw:
                phantom_removed += 1
                continue
            if tcode == 'HA' and '-HC-' in raw:
                phantom_removed += 1
                continue
            if tcode == 'NC' and '-NBC-' in raw:
                phantom_removed += 1
                continue
            if tcode == 'JDP' and r == 'CL2' and day == 'Monday' and slot == '9:30 AM to 10:30 AM':
                phantom_removed += 1
                continue
            if tcode == 'SJJ' and r == 'CL1' and day == 'Monday' and slot == '9:30 AM to 10:30 AM':
                phantom_removed += 1
                continue
            
            # Case 3: PB27 slot shift in R5 on Wednesday
            if tcode == 'PB27' and r == 'R5' and day == 'Wednesday' and slot == '11:30 AM to 12:30 PM':
                s['slot'] = '12:30 PM to 1:30 PM'
                slot_adjusted += 1

            new_slots.append(s)
        t['schedule'][day] = new_slots
    
    t['total_teaching_periods'] = sum(len(v) for v in t['schedule'].values())

print(f"Removed {phantom_removed} phantom/conflicting classes and adjusted {slot_adjusted} slots in teachers_data.")

# 3. Save classes_data.json and classes_data.js
with open(classes_json_path, 'w', encoding='utf-8') as f:
    json.dump(cdata, f, indent=2, ensure_ascii=False)

classes_js_path = os.path.join(WEB_APP_DIR, 'classes_data.js')
with open(classes_js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_CLASSES_DATA = ')
    json.dump(cdata, f, indent=2, ensure_ascii=False)
    f.write(';\n')

# 4. Save teachers_data.json and teachers_data.js
with open(teachers_json_path, 'w', encoding='utf-8') as f:
    json.dump(tdata, f, indent=2, ensure_ascii=False)

teachers_js_path = os.path.join(WEB_APP_DIR, 'teachers_data.js')
with open(teachers_js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_TEACHERS_DATA = ')
    json.dump(tdata, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print("Saved updated classes_data and teachers_data in web_app.")

# 5. Mirror to Android assets
if os.path.exists(ANDROID_WEB_APP_DIR):
    shutil.copy2(classes_json_path, os.path.join(ANDROID_WEB_APP_DIR, 'classes_data.json'))
    shutil.copy2(classes_js_path, os.path.join(ANDROID_WEB_APP_DIR, 'classes_data.js'))
    shutil.copy2(teachers_json_path, os.path.join(ANDROID_WEB_APP_DIR, 'teachers_data.json'))
    shutil.copy2(teachers_js_path, os.path.join(ANDROID_WEB_APP_DIR, 'teachers_data.js'))
    print("Successfully mirrored updated data files to android_widget assets.")
