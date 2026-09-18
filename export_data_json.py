"""
Export all 96 SRCC rooms data into clean JSON for the Web Application.
Includes 100% of rooms, synthesizing empty schedules for rooms with 0 scheduled classes.
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
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

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
                text = ' '.join(raw_text.split())
                for _ in range(self.current_colspan):
                    self.current_row.append(text)
                self.in_cell = False
            elif tag == 'tr' and self.in_tr:
                if any(self.current_row):
                    self.rows.append(self.current_row)
                self.in_tr = False
            elif tag == 'table':
                self.in_table = False

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell_text.append(data)


def fetch_room_list():
    req = urllib.request.Request(BASE_URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    m = re.search(r'<select name="roomno"[^>]*>([\s\S]*?)</select>', html)
    options = re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m.group(1))
    rooms = []
    for val, text in options:
        val = val.strip()
        if not val: continue
        clean_text = ' '.join(text.replace('&nbsp;', ' ').split())
        rooms.append((val, clean_text))
    return rooms


def fetch_room(room_code, room_label, max_retries=3):
    data = urllib.parse.urlencode({'roomno': room_code, 'submit': 'Go'}).encode('utf-8')
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(BASE_URL, data=data, headers={**HEADERS, 'Content-Type': 'application/x-www-form-urlencoded'})
            with urllib.request.urlopen(req, timeout=20) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
            parser = TimetableParser()
            parser.feed(html)
            if parser.rows:
                return room_code, room_label, parser.rows
        except Exception:
            pass
        time.sleep(0.5 * (attempt + 1))
    return room_code, room_label, []


def get_category(code):
    if re.match(r'^R\d+$', code):
        return 'Classrooms (R)'
    elif re.match(r'^T\d+$', code):
        return 'Tutorial Rooms (T)'
    elif code.startswith('PB'):
        return 'Principal Bungalow (PB)'
    elif code.startswith('CL'):
        return 'Computer Labs (CL)'
    elif code.startswith('SCR'):
        return 'Sports Complex (SCR)'
    else:
        return 'Library & Other Facilities'


def get_full_name(code, label):
    cap_match = re.search(r'\(([^)]+)\)', label)
    capacity = cap_match.group(1) if cap_match else "N/A"
    
    if code.startswith('PB'):
        desc = f"Principal Bungalow {code[2:]}"
    elif code.startswith('CL'):
        desc = f"Computer Lab {code[2:]}" if code != 'CLIB' else "Computer Library Lab"
    elif code.startswith('SCR'):
        desc = f"Sports Complex Room {code[3:]}"
    elif code == 'Library FF':
        desc = "Library First Floor"
    elif code.startswith('R'):
        desc = f"Lecture Classroom {code[1:]}"
    elif code.startswith('T'):
        desc = f"Tutorial Room {code[1:]}"
    else:
        desc = code
    return desc, capacity


def parse_schedule(rows):
    if not rows or len(rows) < 2:
        return None
    headers = [h.strip() for h in rows[0][1:]]
    days_dict = {}
    for r in rows[1:]:
        if not r: continue
        day_name = r[0].strip()
        if not day_name: continue
        cells = r[1:]
        
        free_slots = []
        occupied_slots = []
        lunch_free = True

        for idx, h in enumerate(headers):
            val = cells[idx].strip() if idx < len(cells) else ''
            is_lunch = ('1:30' in h and '2:00' in h)
            if is_lunch:
                if val:
                    lunch_free = False
                    occupied_slots.append({'slot': h, 'class': val})
            else:
                if not val:
                    free_slots.append(h)
                else:
                    occupied_slots.append({'slot': h, 'class': val})
        
        days_dict[day_name] = {
            'free_slots': free_slots,
            'free_hours': len(free_slots),
            'lunch_recess_free': lunch_free,
            'occupied_slots': occupied_slots
        }
    return headers, days_dict


def synthesize_empty_schedule():
    """Generates an all-free schedule for rooms with 0 recorded classes on the portal."""
    days_dict = {}
    for d in DAYS:
        days_dict[d] = {
            'free_slots': list(STANDARD_PERIODS),
            'free_hours': len(STANDARD_PERIODS),
            'lunch_recess_free': True,
            'occupied_slots': []
        }
    return days_dict


def scrape_all_rooms():
    rooms = fetch_room_list()
    print(f"Scraping and processing all {len(rooms)} rooms...")
    
    all_rooms_data = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_room, code, label): code for code, label in rooms}
        for future in as_completed(futures):
            code, label, rows = future.result()
            parsed = parse_schedule(rows)
            
            if parsed:
                _, schedule = parsed
                has_classes = True
            else:
                schedule = synthesize_empty_schedule()
                has_classes = False

            category = get_category(code)
            desc, capacity = get_full_name(code, label)

            all_rooms_data.append({
                'code': code,
                'label': label,
                'name': desc,
                'capacity': capacity,
                'category': category,
                'has_classes': has_classes,
                'schedule': schedule
            })

    def sort_key(item):
        c = item['code']
        num = re.search(r'\d+', c)
        n = int(num.group(0)) if num else 0
        prefix = re.sub(r'\d+', '', c)
        order = {'R': 1, 'T': 2, 'PB': 3, 'CL': 4, 'SCR': 5}
        return (order.get(prefix, 99), n, c)

    all_rooms_data.sort(key=sort_key)

    payload = {
        'metadata': {
            'college': 'Shri Ram College of Commerce (SRCC)',
            'portal': 'https://srcccollegetimetable.in/',
            'total_rooms': len(all_rooms_data),
            'last_synced': datetime.now().strftime('%d %b %Y, %I:%M %p'),
            'last_synced_iso': datetime.now().isoformat(),
            'academic_periods': STANDARD_PERIODS,
            'recess_slot': '1:30 PM to 2:00 PM',
            'days': DAYS,
            'categories': [
                'All Rooms',
                'Principal Bungalow (PB)',
                'Tutorial Rooms (T)',
                'Sports Complex (SCR)',
                'Classrooms (R)',
                'Computer Labs (CL)',
                'Library & Other Facilities'
            ]
        },
        'rooms': all_rooms_data
    }
    return payload


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(os.path.join(base_dir, 'web_app'), exist_ok=True)
    
    payload = scrape_all_rooms()

    targets = [
        os.path.join(base_dir, 'web_app'),
        os.path.join(base_dir, 'preview_web_app')
    ]

    for target_dir in targets:
        if os.path.exists(target_dir):
            out_json = os.path.join(target_dir, 'srcc_data.json')
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)

            out_js = os.path.join(target_dir, 'data.js')
            with open(out_js, 'w', encoding='utf-8') as f:
                f.write("window.SRCC_DATA = ")
                json.dump(payload, f, indent=2, ensure_ascii=False)
                f.write(";\n")
            print(f"Exported {len(payload['rooms'])} rooms to: {target_dir}")

if __name__ == '__main__':
    main()
