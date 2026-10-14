import json
import os
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, 'web_app')
ANDROID_DIR = os.path.join(BASE_DIR, 'android_widget', 'app', 'src', 'main', 'assets', 'web_app')

academic_periods = [
    "8:30 AM to 9:30 AM", "9:30 AM to 10:30 AM", "10:30 AM to 11:30 AM",
    "11:30 AM to 12:30 PM", "12:30 PM to 1:30 PM", "2:00 PM to 3:00 PM",
    "3:00 PM to 4:00 PM", "4:00 PM to 5:00 PM", "5:00 PM to 6:00 PM"
]
days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

DEFAULT_VACANT_ROOMS = ['R36', 'CL3', 'SCR2', 'SCR3', 'Seminar Room', 'Principal Office']
DEFAULT_VACANT_UPPER = set(r.upper() for r in DEFAULT_VACANT_ROOMS)

print("=" * 60)
print("EXECUTING DEFAULT VACANT ROOM CLEANUP & RECONCILIATION")
print("=" * 60)

# 1. Update srcc_data.json
srcc_json_path = os.path.join(WEB_APP_DIR, 'srcc_data.json')
with open(srcc_json_path, 'r', encoding='utf-8') as f:
    srcc = json.load(f)

for r in srcc.get('rooms', []):
    code = (r.get('code') or '').strip()
    if code.upper() in DEFAULT_VACANT_UPPER:
        r['has_classes'] = False
        for d in days:
            r['schedule'][d] = {
                'free_slots': list(academic_periods),
                'free_hours': len(academic_periods),
                'lunch_recess_free': True,
                'occupied_slots': []
            }
        print(f"[srcc_data] Enforced 100% daily vacant on Room: {code}")

with open(srcc_json_path, 'w', encoding='utf-8') as f:
    json.dump(srcc, f, indent=2, ensure_ascii=False)

# Update data.js
data_js_path = os.path.join(WEB_APP_DIR, 'data.js')
with open(data_js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_TIMETABLE_DATA = ')
    json.dump(srcc, f, ensure_ascii=False)
    f.write(';\n')
print("[data.js] Successfully synchronized window.SRCC_TIMETABLE_DATA")

# 2. Update teachers_data.json & teachers_data.js
teachers_json_path = os.path.join(WEB_APP_DIR, 'teachers_data.json')
with open(teachers_json_path, 'r', encoding='utf-8') as f:
    tdata = json.load(f)

removed_teacher_classes = 0
for t in tdata.get('teachers', []):
    for d in days:
        curr_slots = t.get('schedule', {}).get(d, [])
        filtered_slots = []
        for s in curr_slots:
            rm = (s.get('room') or '').strip().upper()
            if rm in DEFAULT_VACANT_UPPER:
                print(f"[teachers_data] Removing class for {t.get('name')} in {s.get('room')} on {d} {s.get('slot')}: {s.get('raw')}")
                removed_teacher_classes += 1
            else:
                filtered_slots.append(s)
        t['schedule'][d] = filtered_slots
    t['total_teaching_periods'] = sum(len(v) for v in t['schedule'].values())

print(f"[teachers_data] Total classes removed from teachers: {removed_teacher_classes}")

with open(teachers_json_path, 'w', encoding='utf-8') as f:
    json.dump(tdata, f, indent=2, ensure_ascii=False)

teachers_js_path = os.path.join(WEB_APP_DIR, 'teachers_data.js')
with open(teachers_js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_TEACHERS_DATA = ')
    json.dump(tdata, f, ensure_ascii=False)
    f.write(';\n')
print("[teachers_data.js] Successfully synchronized window.SRCC_TEACHERS_DATA")

# 3. Update classes_data.json & classes_data.js
classes_json_path = os.path.join(WEB_APP_DIR, 'classes_data.json')
with open(classes_json_path, 'r', encoding='utf-8') as f:
    cdata = json.load(f)

removed_course_classes = 0
courses = cdata.get('courses', {})
for cname, sems in courses.items():
    if isinstance(sems, dict):
        for sname, secs in sems.items():
            if isinstance(secs, list):
                new_list = []
                for item in secs:
                    rm = (item.get('room') or '').strip().upper()
                    if rm in DEFAULT_VACANT_UPPER:
                        print(f"[classes_data] Removing class in {item.get('room')}: {item.get('raw')}")
                        removed_course_classes += 1
                    else:
                        new_list.append(item)
                sems[sname] = new_list
            elif isinstance(secs, dict):
                for sec_name, items in secs.items():
                    if isinstance(items, list):
                        new_list = []
                        for item in items:
                            rm = (item.get('room') or '').strip().upper()
                            if rm in DEFAULT_VACANT_UPPER:
                                print(f"[classes_data] Removing class in {item.get('room')}: {item.get('raw')}")
                                removed_course_classes += 1
                            else:
                                new_list.append(item)
                        secs[sec_name] = new_list

# Update metadata count
total_classes = 0
for cname, sems in courses.items():
    if isinstance(sems, dict):
        for sname, secs in sems.items():
            if isinstance(secs, list):
                total_classes += len(secs)
            elif isinstance(secs, dict):
                for sec_name, items in secs.items():
                    if isinstance(items, list):
                        total_classes += len(items)

cdata['metadata']['total_classes_recorded'] = total_classes
print(f"[classes_data] Total classes removed: {removed_course_classes}. New total recorded: {total_classes}")

with open(classes_json_path, 'w', encoding='utf-8') as f:
    json.dump(cdata, f, indent=2, ensure_ascii=False)

classes_js_path = os.path.join(WEB_APP_DIR, 'classes_data.js')
with open(classes_js_path, 'w', encoding='utf-8') as f:
    f.write('window.SRCC_CLASSES_DATA = ')
    json.dump(cdata, f, ensure_ascii=False)
    f.write(';\n')
print("[classes_data.js] Successfully synchronized window.SRCC_CLASSES_DATA")

# 4. Mirror all updated files to Android Widget assets
if os.path.exists(ANDROID_DIR):
    for fname in ['srcc_data.json', 'data.js', 'teachers_data.json', 'teachers_data.js', 'classes_data.json', 'classes_data.js']:
        src = os.path.join(WEB_APP_DIR, fname)
        dst = os.path.join(ANDROID_DIR, fname)
        shutil.copy2(src, dst)
    print("[Android Assets] Mirrored all updated JSON & JS files to Android widget assets.")

print("\n" + "=" * 60)
print("RECONCILIATION COMPLETED SUCCESSFULLY!")
print("=" * 60)
