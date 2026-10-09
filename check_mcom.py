import json
from collections import Counter

with open('web_app/teachers_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

mcom = []
for t in d.get('teachers', []):
    for day, slots in t.get('schedule', {}).items():
        for s in slots:
            raw = s.get('raw', '')
            c = s.get('course', '')
            if 'MCOM' in raw.upper() or 'M.COM' in c.upper():
                mcom.append({
                    'teacher': t.get('clean_name'),
                    'day': day,
                    'slot': s.get('slot'),
                    'subject': s.get('subject'),
                    'subject_name': s.get('subject_name'),
                    'room': s.get('room'),
                    'semester': s.get('semester'),
                    'section': s.get('section'),
                    'batch': s.get('batch'),
                    'raw': raw
                })

print(f"Total M.Com entries in teachers timetable: {len(mcom)}")

sem_counter = Counter(x['semester'] for x in mcom)
print("\nSemesters distribution:")
for sem, count in sem_counter.items():
    print(f"  - {sem}: {count} classes")

sub_counter = Counter(f"{x['subject']} ({x['subject_name']})" for x in mcom)
print(f"\nUnique subjects: {len(sub_counter)}")
for sub, count in sub_counter.most_common():
    print(f"  - {sub}: {count} classes")

room_counter = Counter(x['room'] for x in mcom)
print(f"\nRooms where M.Com classes take place:")
for rm, count in room_counter.most_common():
    print(f"  - Room {rm}: {count} classes")

teacher_counter = Counter(x['teacher'] for x in mcom)
print(f"\nFaculty teaching M.Com ({len(teacher_counter)} teachers):")
for tch, count in teacher_counter.most_common(10):
    print(f"  - {tch}: {count} classes")
