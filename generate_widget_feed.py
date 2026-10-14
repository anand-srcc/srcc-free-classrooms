#!/usr/bin/env python3
"""
generate_widget_feed.py
Generates the public static feed endpoint `web_app/widget_feed.json` (< 300 KB)
used by the Android Home-Screen Widget and standalone Web Widget PWA.
Contains:
  - Asia/Kolkata timezone metadata & academic periods
  - Active faculty leaves from SRCC sync
  - Compact pre-aggregated weekly schedules by Course | Semester | Section | Batch
"""

import os
import json
import re
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, "web_app")
PREVIEW_DIR = os.path.join(BASE_DIR, "preview_web_app")

ACADEMIC_PERIODS = [
    "8:30 AM to 9:30 AM",
    "9:30 AM to 10:30 AM",
    "10:30 AM to 11:30 AM",
    "11:30 AM to 12:30 PM",
    "12:30 PM to 1:30 PM",
    "2:00 PM to 3:00 PM",
    "3:00 PM to 4:00 PM",
    "4:00 PM to 5:00 PM",
    "5:00 PM to 6:00 PM"
]

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

def load_json_or_js(json_path, js_path, window_var_regex=r'window\.\w+\s*=\s*({[\s\S]*});?'):
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading {json_path}: {e}")
    
    if os.path.exists(js_path):
        try:
            with open(js_path, 'r', encoding='utf-8') as f:
                content = f.read()
            # Match JSON object
            m = re.search(r'=\s*({[\s\S]*});?', content)
            if m:
                raw_json = m.group(1).rstrip(';')
                return json.loads(raw_json)
        except Exception as e:
            print(f"Error parsing {js_path}: {e}")
    return None

def get_room_location_meta(room_code):
    code = str(room_code or '').strip().upper()
    num_match = re.search(r'\d+', code)
    num = int(num_match.group(0)) if num_match else 0

    floor = "Ground Floor"
    wing = "Main Building"
    landmark = "Central Campus"

    if code.startswith('R'):
        if num == 32:
            floor = "1st Floor"
            wing = "New Building (1st Floor)"
            landmark = "Near Room 33 (R-33)"
        elif num == 35:
            floor = "Ground Floor"
            wing = "Canteen Area"
            landmark = "Canteen Building"
        elif num == 36:
            floor = "Ground Floor"
            wing = "Near Canteen"
            landmark = "Ground Floor (Near Canteen)"
        elif 26 <= num <= 28:
            floor = "Ground Floor"
            wing = "New Building (Ground Floor)"
            landmark = "Near Tutorial Rooms"
        elif 1 <= num <= 10:
            floor = "Ground Floor"
            wing = "Main Building (Front Wing)"
            landmark = "Near Principal Office"
        elif 11 <= num <= 25:
            floor = "1st Floor"
            wing = "Main Building (Heritage Wing)"
            landmark = "Heritage Stairs"
        elif 29 <= num <= 31:
            floor = "Ground Floor"
            wing = "New Classroom Wing"
            landmark = "Near Central Lawns"
        elif 33 <= num <= 37:
            floor = "1st Floor"
            wing = "New Classroom Wing"
            landmark = "Near Computer Labs"
    elif code.startswith('T'):
        wing = "Tutorial Block"
        if num >= 37:
            floor = "2nd Floor"
            landmark = "Tutorial Block 2nd Floor Corridor"
        elif num in (17, 18):
            floor = "Ground Floor"
            landmark = "Tutorial Lawns"
        elif num >= 19:
            floor = "1st Floor"
            landmark = "Tutorial Block 1st Floor Corridor"
        else:
            floor = "Ground Floor"
            landmark = "Tutorial Lawns"
    elif code.startswith('PB'):
        floor = "Ground Floor"
        wing = "Principal Bungalow"
        landmark = "Near Gate 1"
    elif code.startswith('SCR'):
        floor = "Ground Floor"
        wing = "Sports Complex"
        landmark = "Sports Ground"
    elif code.startswith('CL'):
        floor = "1st Floor"
        wing = "Computer Labs"
        landmark = "Computer Center"

    return {"floor": floor, "wing": wing, "landmark": landmark}

def normalize_key(course, sem, sec):
    def clean(s):
        s = (s or '').lower().strip()
        s = re.sub(r'[^a-z0-9]', '', s)
        return s
    return f"{clean(course)}_{clean(sem)}_{clean(sec)}"

def generate_feed():
    teachers_json_path = os.path.join(WEB_APP_DIR, "teachers_data.json")
    teachers_js_path = os.path.join(WEB_APP_DIR, "teachers_data.js")
    t_data = load_json_or_js(teachers_json_path, teachers_js_path) or {}

    leaves_json_path = os.path.join(WEB_APP_DIR, "faculty_leaves.json")
    leaves_js_path = os.path.join(WEB_APP_DIR, "faculty_leaves.js")
    l_data = load_json_or_js(leaves_json_path, leaves_js_path) or {}

    now_ist = datetime.now(IST)
    iso_time = now_ist.isoformat()

    teachers_list = t_data.get('teachers', [])
    leaves_list = l_data.get('leaves', [])

    # Index active leaves by teacher_id and teacher_code for instant lookup
    leaves_by_id = {}
    leaves_by_code = {}
    for l in leaves_list:
        tid = str(l.get('teacher_id', ''))
        code = str(l.get('teacher_code', '')).upper()
        if tid:
            leaves_by_id[tid] = l
        if code:
            leaves_by_code[code] = l

    # Build schedules map
    # Key: normalized "course_sem_sec"
    groups = {}
    all_rooms_meta = {}

    for t in teachers_list:
        t_name = t.get('clean_name', t.get('label', ''))
        t_code = t.get('short_code', t.get('ref_code', ''))
        t_id = str(t.get('id', ''))
        sched = t.get('schedule') or {}

        for day in DAYS:
            slots = sched.get(day, []) or []
            for s in slots:
                c = s.get('course', '').strip()
                sem = s.get('semester', '').strip()
                sec = s.get('section', '').strip()
                if not c or not sem:
                    continue

                norm_k = normalize_key(c, sem, sec)
                if norm_k not in groups:
                    groups[norm_k] = {
                        'c': c,
                        'sem': sem,
                        'sec': sec,
                        'sched': {d: [] for d in DAYS}
                    }

                # Check if teacher is currently on leave
                on_leave = (t_id in leaves_by_id) or (t_code.upper() in leaves_by_code)

                r_code = s.get('room', '')
                r_loc = get_room_location_meta(r_code)
                if r_code and r_code not in all_rooms_meta:
                    all_rooms_meta[r_code] = r_loc

                slot_entry = {
                    's': s.get('slot', ''),
                    'sub': s.get('subject', s.get('subject_name', '')),
                    'r': r_code,
                    'rf': r_loc['floor'],
                    'rw': r_loc['wing'],
                    'rl': r_loc['landmark'],
                    't': t_name,
                    'tc': t_code,
                    'tid': t_id,
                    'tp': s.get('type', 'Lecture')
                }
                b_val = s.get('batch', '').strip()
                if b_val:
                    slot_entry['b'] = b_val
                if on_leave:
                    slot_entry['leave'] = True

                groups[norm_k]['sched'][day].append(slot_entry)

    # Sort each day's slots chronologically
    slot_order = {period: i for i, period in enumerate(ACADEMIC_PERIODS)}
    for g_data in groups.values():
        for d in DAYS:
            g_data['sched'][d].sort(key=lambda item: slot_order.get(item['s'], 999))

    feed_payload = {
        "metadata": {
            "college": "Shri Ram College of Commerce (SRCC)",
            "version": "1.0",
            "timezone": "Asia/Kolkata",
            "generated_at": iso_time,
            "academic_periods": ACADEMIC_PERIODS,
            "total_groups": len(groups),
            "total_leaves": len(leaves_list)
        },
        "leaves": leaves_list,
        "rooms_meta": all_rooms_meta,
        "groups": groups
    }

    # Save to web_app/widget_feed.json
    out_path = os.path.join(WEB_APP_DIR, "widget_feed.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(feed_payload, f, separators=(',', ':'))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Generated {out_path} ({size_kb:.2f} KB)")

    # Also save to preview_web_app if directory exists
    if os.path.exists(PREVIEW_DIR):
        prev_out = os.path.join(PREVIEW_DIR, "widget_feed.json")
        with open(prev_out, 'w', encoding='utf-8') as f:
            json.dump(feed_payload, f, separators=(',', ':'))
        print(f"Generated {prev_out}")

    # Also mirror to android_widget assets if directory exists
    android_assets_dir = os.path.join(BASE_DIR, "android_widget", "app", "src", "main", "assets", "web_app")
    if os.path.exists(android_assets_dir):
        android_out = os.path.join(android_assets_dir, "widget_feed.json")
        with open(android_out, 'w', encoding='utf-8') as f:
            json.dump(feed_payload, f, separators=(',', ':'))
        print(f"Generated {android_out}")

    return out_path, size_kb

if __name__ == "__main__":
    generate_feed()
