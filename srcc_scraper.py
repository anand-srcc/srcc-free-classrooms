"""
SRCC Timetable Scraper & Free Classroom Excel Generator for GD
Scrapes all rooms from https://srcccollegetimetable.in/ and generates an Excel workbook
with separate tabs for:
- Classrooms (R1-R37)
- Tutorial Rooms (T1-T54)
- Principal Bungalow (PB) [PB2, PB3, PB4]
- Computer Labs (CL) [CL1, CL2, CL3, CLIB]
- Sports Complex (SCR) [SCR1, SCR2, SCR3, SCR4]
- Library & Other Facilities [Library First Floor, Seminar Room, Principal Office, Playground]
- Instant Free Room Finder (Auto-Filter Search Tab)
- Overview & Guide
"""

import os
import shutil
import urllib.request
import urllib.parse
from html.parser import HTMLParser
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_URL = 'https://srcccollegetimetable.in/'
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

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
    print("Fetching room dropdown options from SRCC...")
    req = urllib.request.Request(BASE_URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')

    m = re.search(r'<select name="roomno"[^>]*>([\s\S]*?)</select>', html)
    if not m:
        raise Exception("Could not find 'roomno' dropdown on page!")

    options = re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m.group(1))
    rooms = []
    for val, text in options:
        val = val.strip()
        if not val:
            continue
        clean_text = ' '.join(text.replace('&nbsp;', ' ').split())
        rooms.append((val, clean_text))
    print(f"Discovered {len(rooms)} rooms.")
    return rooms


def fetch_room_timetable(room_code, room_label, max_retries=3):
    data = urllib.parse.urlencode({
        'classId': '',
        'semester': '',
        'class_section': '',
        'teacher': '',
        'roomno': room_code,
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
                'code': room_code,
                'label': room_label,
                'rows': parser.rows,
                'success': True
            }
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"Failed to fetch room {room_code} after {max_retries} attempts: {e}")
                return {
                    'code': room_code,
                    'label': room_label,
                    'rows': [],
                    'success': False,
                    'error': str(e)
                }
            time.sleep(1.0 * (attempt + 1))


def get_room_friendly_title(room_code):
    if room_code.startswith('PB'):
        return f"ROOM NO: {room_code} (Principal Bungalow)"
    elif room_code.startswith('CL'):
        return f"ROOM NO: {room_code} (Computer Lab)"
    elif room_code.startswith('SCR'):
        return f"ROOM NO: {room_code} (Sports Complex)"
    elif room_code == 'Library FF':
        return "ROOM: Library FF (Library First Floor)"
    elif room_code.startswith('R'):
        return f"ROOM NO: {room_code} (Classroom)"
    elif room_code.startswith('T'):
        return f"ROOM NO: {room_code} (Tutorial Room)"
    return f"ROOM: {room_code}"


def categorize_rooms(room_list):
    r_rooms = []
    t_rooms = []
    pb_rooms = []
    cl_rooms = []
    scr_rooms = []
    other_rooms = []

    for code, label in room_list:
        if re.match(r'^R\d+$', code):
            r_rooms.append((code, label))
        elif re.match(r'^T\d+$', code):
            t_rooms.append((code, label))
        elif code.startswith('PB'):
            pb_rooms.append((code, label))
        elif code.startswith('CL'):
            cl_rooms.append((code, label))
        elif code.startswith('SCR'):
            scr_rooms.append((code, label))
        else:
            other_rooms.append((code, label))

    # Natural sorting
    r_rooms.sort(key=lambda x: int(x[0][1:]))
    t_rooms.sort(key=lambda x: int(x[0][1:]))
    pb_rooms.sort(key=lambda x: int(re.search(r'\d+', x[0]).group(0)) if re.search(r'\d+', x[0]) else 0)
    cl_rooms.sort(key=lambda x: x[0])
    scr_rooms.sort(key=lambda x: int(re.search(r'\d+', x[0]).group(0)) if re.search(r'\d+', x[0]) else 0)
    other_rooms.sort(key=lambda x: x[0])

    return {
        'Classrooms (R1-R37)': r_rooms,
        'Tutorial Rooms (T1-T54)': t_rooms,
        'Principal Bungalow (PB)': pb_rooms,
        'Computer Labs (CL)': cl_rooms,
        'Sports Complex (SCR)': scr_rooms,
        'Library & Other Facilities': other_rooms
    }


def parse_schedule(rows):
    if not rows or len(rows) < 2:
        return None

    raw_headers = rows[0]
    time_headers = [h.strip() for h in raw_headers[1:]]

    days_data = []

    for row in rows[1:]:
        if not row:
            continue
        day_name = row[0].strip()
        if not day_name:
            continue

        cells = row[1:]
        free_slots = []
        occupied_slots = []
        lunch_is_free = True

        for idx, header in enumerate(time_headers):
            val = cells[idx].strip() if idx < len(cells) else ''
            is_lunch = ('1:30' in header and '2:00' in header)

            if is_lunch:
                if val:
                    lunch_is_free = False
                    occupied_slots.append((header, val))
            else:
                if not val:
                    free_slots.append(header)
                else:
                    occupied_slots.append((header, val))

        days_data.append({
            'day': day_name,
            'free_slots': free_slots,
            'free_hours': len(free_slots),
            'lunch_is_free': lunch_is_free,
            'occupied_slots': occupied_slots,
            'all_cells': cells
        })

    return {
        'time_headers': time_headers,
        'days': days_data
    }


def apply_styles(ws):
    ws.views.sheetView[0].showGridLines = True


def build_excel(room_data_dict, category_map, output_path):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)

    # Typography & Styles
    font_family = "Segoe UI"
    f_title = Font(name=font_family, size=14, bold=True, color="FFFFFF")
    f_subtitle = Font(name=font_family, size=10, italic=True, color="DCE6F1")
    f_room_header = Font(name=font_family, size=12, bold=True, color="FFFFFF")
    f_room_meta = Font(name=font_family, size=10, bold=False, color="EDF2F7")
    f_table_header = Font(name=font_family, size=10, bold=True, color="1B365D")
    f_day = Font(name=font_family, size=10, bold=True, color="2D3748")
    f_free_hours = Font(name=font_family, size=10, bold=True, color="155724")
    f_free_timings = Font(name=font_family, size=9, bold=True, color="1E3A8A")
    f_lunch = Font(name=font_family, size=9, bold=False, color="856404")
    f_occupied = Font(name=font_family, size=8, color="4A5568")
    f_regular = Font(name=font_family, size=9, color="2D3748")

    fill_navy = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    fill_subnavy = PatternFill(start_color="2B4C7E", end_color="2B4C7E", fill_type="solid")
    fill_card_header = PatternFill(start_color="2C5282", end_color="2C5282", fill_type="solid")
    fill_card_meta = PatternFill(start_color="3182CE", end_color="3182CE", fill_type="solid")
    fill_th = PatternFill(start_color="EDF2F7", end_color="EDF2F7", fill_type="solid")
    fill_day = PatternFill(start_color="F7FAFC", end_color="F7FAFC", fill_type="solid")
    fill_free_highlight = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")
    fill_free_badge = PatternFill(start_color="D4EDDA", end_color="D4EDDA", fill_type="solid")
    fill_zebra = PatternFill(start_color="FAFAFA", end_color="FAFAFA", fill_type="solid")

    thin_border_side = Side(style='thin', color="CBD5E0")
    border_cell = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    border_header = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=Side(style='medium', color="A0AEC0"))

    align_center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    align_left = Alignment(horizontal="left", vertical="center", wrap_text=True)
    align_free_timings = Alignment(horizontal="left", vertical="top", wrap_text=True)

    all_free_slots_finder = []

    # 1. Build Guide / Readme Tab
    ws_readme = wb.create_sheet(title="Overview & Guide", index=0)
    apply_styles(ws_readme)
    ws_readme.column_dimensions['A'].width = 6
    ws_readme.column_dimensions['B'].width = 30
    ws_readme.column_dimensions['C'].width = 75

    ws_readme.merge_cells("B2:C2")
    ws_readme["B2"].value = "SRCC ROOM-WISE FREE CLASSROOMS FOR GROUP DISCUSSION (GD)"
    ws_readme["B2"].font = f_title
    ws_readme["B2"].fill = fill_navy
    ws_readme["B2"].alignment = align_center
    ws_readme.row_dimensions[2].height = 34

    ws_readme.merge_cells("B3:C3")
    ws_readme["B3"].value = "Shri Ram College of Commerce (University of Delhi) | Live Portal: srcccollegetimetable.in"
    ws_readme["B3"].font = f_subtitle
    ws_readme["B3"].fill = fill_subnavy
    ws_readme["B3"].alignment = align_center
    ws_readme.row_dimensions[3].height = 22

    guide_sections = [
        ("College Nomenclature Key", "• PB = Principal Bungalow (PB2, PB3, PB4)\n"
                                     "• CL = Computer Lab (CL1, CL2, CL3, CLIB)\n"
                                     "• SCR = Sports Complex (SCR1, SCR2, SCR3, SCR4)\n"
                                     "• Library FF = Library First Floor\n"
                                     "• R = Main Classrooms (R1 to R37)\n"
                                     "• T = Tutorial Rooms (T1 to T54)"),
        ("Workbook Tabs", "This workbook is organized into specialized tabs as requested:\n"
                          "1. Instant_Free_Room_Finder: Searchable & filterable table of all 3,000+ free slots across all rooms.\n"
                          "2. Classrooms (R1-R37): Room No headers with Day-wise free periods for main lecture halls.\n"
                          "3. Tutorial Rooms (T1-T54): Room No headers with Day-wise free periods for all tutorial rooms.\n"
                          "4. Principal Bungalow (PB): Free schedules for PB2, PB3, and PB4.\n"
                          "5. Computer Labs (CL): Free schedules for CL1, CL2, CL3, and CLIB.\n"
                          "6. Sports Complex (SCR): Free schedules for SCR1, SCR2, SCR3, and SCR4.\n"
                          "7. Library & Other Facilities: Library First Floor, Seminar Room, Principal Office, Playground."),
        ("Official Period Timings", "1. 08:30 AM to 09:30 AM\n"
                                   "2. 09:30 AM to 10:30 AM\n"
                                   "3. 10:30 AM to 11:30 AM\n"
                                   "4. 11:30 AM to 12:30 PM\n"
                                   "5. 12:30 PM to 01:30 PM\n"
                                   "-  01:30 PM to 02:00 PM (College Lunch Recess - universally free of scheduled classes)\n"
                                   "6. 02:00 PM to 03:00 PM\n"
                                   "7. 03:00 PM to 04:00 PM\n"
                                   "8. 04:00 PM to 05:00 PM\n"
                                   "9. 05:00 PM to 06:00 PM"),
        ("How to Use for GD", "• Open 'Instant_Free_Room_Finder' to filter by Day (e.g. Wednesday) and Time Slot to instantly find empty rooms.\n"
                              "• Open individual room tabs ('Classrooms', 'Tutorial Rooms', 'Principal Bungalow', etc.) to see all free slots for a specific room.\n"
                              "• Lunch Recess (1:30 PM - 2:00 PM) is an ideal 30-minute window when all rooms are empty for quick discussions.\n"
                              "• Green highlighted slots represent 100% vacant room time.")
    ]

    r_guide = 5
    for title, desc in guide_sections:
        ws_readme.cell(row=r_guide, column=2, value=title).font = Font(name=font_family, size=11, bold=True, color="1B365D")
        ws_readme.cell(row=r_guide, column=2).fill = fill_th
        ws_readme.cell(row=r_guide, column=2).alignment = Alignment(horizontal="left", vertical="top", indent=1)
        ws_readme.cell(row=r_guide, column=2).border = border_cell

        c_desc = ws_readme.cell(row=r_guide, column=3, value=desc)
        c_desc.font = Font(name=font_family, size=9, color="2D3748")
        c_desc.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        c_desc.border = border_cell
        ws_readme.row_dimensions[r_guide].height = max(50, len(desc.split('\n')) * 19)
        r_guide += 1

    # 2. Build Category Tabs
    for tab_name, rooms in category_map.items():
        ws = wb.create_sheet(title=tab_name)
        apply_styles(ws)

        # Tab banner
        ws.merge_cells("A1:E1")
        title_cell = ws["A1"]
        title_cell.value = f"SRCC FREE CLASSROOMS FOR GROUP DISCUSSION (GD) - {tab_name.upper()}"
        title_cell.font = f_title
        title_cell.fill = fill_navy
        title_cell.alignment = align_center
        ws.row_dimensions[1].height = 32

        ws.merge_cells("A2:E2")
        sub_cell = ws["A2"]
        sub_cell.value = "Source: srcccollegetimetable.in | Free periods indicate vacant classroom slots available for GD/Meetings"
        sub_cell.font = f_subtitle
        sub_cell.fill = fill_subnavy
        sub_cell.alignment = align_center
        ws.row_dimensions[2].height = 20

        current_row = 4

        for room_code, room_label in rooms:
            room_info = room_data_dict.get(room_code)
            if not room_info or not room_info['success']:
                continue

            parsed = parse_schedule(room_info['rows'])
            if not parsed:
                continue

            cap_match = re.search(r'\(([^)]+)\)', room_label)
            capacity = cap_match.group(1) if cap_match else "N/A"
            friendly_room_title = get_room_friendly_title(room_code)

            # Room Header Card (Row 1 of block)
            ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=2)
            c1 = ws.cell(row=current_row, column=1)
            c1.value = friendly_room_title
            c1.font = f_room_header
            c1.fill = fill_card_header
            c1.alignment = Alignment(horizontal="left", vertical="center", indent=1)

            ws.cell(row=current_row, column=2).fill = fill_card_header

            ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=5)
            c2 = ws.cell(row=current_row, column=3)
            c2.value = f"Capacity: {capacity} | Full Name: {room_label} | Category: {tab_name}"
            c2.font = f_room_meta
            c2.fill = fill_card_meta
            c2.alignment = Alignment(horizontal="right", vertical="center", indent=1)
            for c_idx in [4, 5]:
                ws.cell(row=current_row, column=c_idx).fill = fill_card_meta

            ws.row_dimensions[current_row].height = 25
            current_row += 1

            # Column headers for this room's table
            headers = [
                ("Day", 14),
                ("Total Free Slots", 18),
                ("Free Period Timings (Available for GD)", 46),
                ("Lunch Recess (1:30 - 2:00 PM)", 26),
                ("Occupied Periods Summary (Classes)", 46)
            ]

            for col_idx, (h_title, _) in enumerate(headers, 1):
                h_cell = ws.cell(row=current_row, column=col_idx)
                h_cell.value = h_title
                h_cell.font = f_table_header
                h_cell.fill = fill_th
                h_cell.alignment = align_center
                h_cell.border = border_header

            ws.row_dimensions[current_row].height = 22
            current_row += 1

            # Populate Days (Monday - Saturday)
            for day_idx, d in enumerate(parsed['days']):
                day_name = d['day']
                free_slots = d['free_slots']
                free_count = d['free_hours']
                lunch_free = d['lunch_is_free']
                occupied = d['occupied_slots']

                # Format free timings list using clean hyphen
                if free_count == 9:
                    free_text = "[ALL DAY FREE] 8:30 AM - 6:00 PM (9 Hours Available)"
                elif free_count == 0:
                    free_text = "No free periods (Full Day Booked)"
                else:
                    free_text = "\n".join([f"- {s}" for s in free_slots])

                # Feed into finder sheet
                for fs in free_slots:
                    all_free_slots_finder.append({
                        'room': room_code,
                        'friendly_name': friendly_room_title.replace('ROOM NO: ', '').replace('ROOM: ', ''),
                        'capacity': capacity,
                        'category': tab_name,
                        'day': day_name,
                        'slot': fs,
                        'duration': '1 Hour',
                        'type': 'Regular Period'
                    })
                if lunch_free:
                    all_free_slots_finder.append({
                        'room': room_code,
                        'friendly_name': friendly_room_title.replace('ROOM NO: ', '').replace('ROOM: ', ''),
                        'capacity': capacity,
                        'category': tab_name,
                        'day': day_name,
                        'slot': '1:30 PM to 2:00 PM',
                        'duration': '30 Mins',
                        'type': 'Lunch Recess'
                    })

                lunch_text = "FREE (College Lunch Recess)" if lunch_free else "Occupied"

                # Format occupied summary
                if occupied:
                    occ_items = []
                    for s_time, s_class in occupied:
                        short_class = re.sub(r'<[^>]+>', ' ', s_class)
                        short_class = ' '.join(short_class.replace('&nbsp;', ' ').split())
                        if len(short_class) > 35:
                            short_class = short_class[:35] + '...'
                        occ_items.append(f"{s_time.split(' to ')[0]}: {short_class}")
                    occ_text = "; ".join(occ_items)
                else:
                    occ_text = "None (Room Completely Vacant)"

                row_fill = fill_free_highlight if free_count >= 5 else (fill_zebra if day_idx % 2 == 1 else PatternFill(fill_type=None))

                c_day = ws.cell(row=current_row, column=1, value=day_name)
                c_day.font = f_day
                c_day.alignment = align_center
                c_day.fill = fill_day
                c_day.border = border_cell

                c_slots = ws.cell(row=current_row, column=2, value=f"{free_count} Slots ({free_count} Hours)" if free_count > 0 else "0 Slots")
                c_slots.font = f_free_hours if free_count > 0 else f_regular
                c_slots.alignment = align_center
                c_slots.fill = fill_free_badge if free_count >= 4 else row_fill
                c_slots.border = border_cell

                c_timings = ws.cell(row=current_row, column=3, value=free_text)
                c_timings.font = f_free_timings
                c_timings.alignment = align_free_timings
                c_timings.fill = row_fill
                c_timings.border = border_cell

                c_lunch = ws.cell(row=current_row, column=4, value=lunch_text)
                c_lunch.font = f_lunch if lunch_free else f_regular
                c_lunch.alignment = align_center
                c_lunch.fill = row_fill
                c_lunch.border = border_cell

                c_occ = ws.cell(row=current_row, column=5, value=occ_text)
                c_occ.font = f_occupied
                c_occ.alignment = align_left
                c_occ.fill = row_fill
                c_occ.border = border_cell

                num_lines = max(1, len(free_slots))
                ws.row_dimensions[current_row].height = max(24, num_lines * 17)

                current_row += 1

            ws.row_dimensions[current_row].height = 14
            current_row += 1

        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 20
        ws.column_dimensions['C'].width = 46
        ws.column_dimensions['D'].width = 28
        ws.column_dimensions['E'].width = 52

    # 3. Build Master "Instant Free Room Finder" Tab (placed right after Overview)
    ws_finder = wb.create_sheet(title="Instant_Free_Room_Finder", index=1)
    apply_styles(ws_finder)

    ws_finder.merge_cells("A1:G1")
    f_head = ws_finder["A1"]
    f_head.value = "SRCC INSTANT FREE CLASSROOM FINDER FOR GD"
    f_head.font = f_title
    f_head.fill = fill_navy
    f_head.alignment = align_center
    ws_finder.row_dimensions[1].height = 32

    ws_finder.merge_cells("A2:G2")
    f_sub = ws_finder["A2"]
    f_sub.value = "Tip: Click the Filter Dropdowns (▼) on 'Day' and 'Free Time Slot' to instantly find all vacant rooms at any given time!"
    f_sub.font = f_subtitle
    f_sub.fill = fill_subnavy
    f_sub.alignment = align_center
    ws_finder.row_dimensions[2].height = 20

    finder_headers = [
        ("Room No", 14),
        ("Room Details", 28),
        ("Room Category", 26),
        ("Day", 14),
        ("Free Time Slot", 25),
        ("Duration", 14),
        ("Slot Type", 18)
    ]

    for c_idx, (col_name, col_width) in enumerate(finder_headers, 1):
        cell = ws_finder.cell(row=4, column=c_idx, value=col_name)
        cell.font = f_table_header
        cell.fill = fill_th
        cell.alignment = align_center
        cell.border = border_header
        ws_finder.column_dimensions[get_column_letter(c_idx)].width = col_width

    ws_finder.row_dimensions[4].height = 24

    def get_room_sort_key(item):
        code = item['room']
        num_m = re.search(r'\d+', code)
        num = int(num_m.group(0)) if num_m else 0
        if re.match(r'^R\d+$', code): cat_order = 1
        elif code.startswith('PB'): cat_order = 2
        elif re.match(r'^T\d+$', code): cat_order = 3
        elif code.startswith('SCR'): cat_order = 4
        elif code.startswith('CL'): cat_order = 5
        else: cat_order = 6
        day_order = {'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6}.get(item['day'], 9)
        return (cat_order, num, code, day_order, item['slot'])

    all_free_slots_finder.sort(key=get_room_sort_key)

    for row_idx, slot_item in enumerate(all_free_slots_finder, start=5):
        c_room = ws_finder.cell(row=row_idx, column=1, value=slot_item['room'])
        c_room.font = Font(name=font_family, size=10, bold=True, color="1B365D")
        c_room.alignment = align_center
        c_room.border = border_cell

        c_name = ws_finder.cell(row=row_idx, column=2, value=slot_item['friendly_name'])
        c_name.font = f_regular
        c_name.alignment = align_left
        c_name.border = border_cell

        c_cat = ws_finder.cell(row=row_idx, column=3, value=slot_item['category'])
        c_cat.font = f_regular
        c_cat.alignment = align_left
        c_cat.border = border_cell

        c_day = ws_finder.cell(row=row_idx, column=4, value=slot_item['day'])
        c_day.font = f_day
        c_day.alignment = align_center
        c_day.border = border_cell

        c_slot = ws_finder.cell(row=row_idx, column=5, value=slot_item['slot'])
        c_slot.font = Font(name=font_family, size=9, bold=True, color="1E3A8A")
        c_slot.alignment = align_center
        c_slot.border = border_cell
        if '1:30' in slot_item['slot']:
            c_slot.fill = fill_free_highlight
        else:
            c_slot.fill = fill_free_badge

        c_dur = ws_finder.cell(row=row_idx, column=6, value=slot_item['duration'])
        c_dur.font = f_regular
        c_dur.alignment = align_center
        c_dur.border = border_cell

        c_type = ws_finder.cell(row=row_idx, column=7, value=slot_item['type'])
        c_type.font = f_regular
        c_type.alignment = align_center
        c_type.border = border_cell

        ws_finder.row_dimensions[row_idx].height = 20

    ws_finder.auto_filter.ref = f"A4:G{len(all_free_slots_finder) + 4}"

    wb.save(output_path)
    print(f"Excel file successfully generated at: {output_path}")


def main():
    room_list = fetch_room_list()
    category_map = categorize_rooms(room_list)

    print(f"\nCategorized rooms:")
    for cat, rms in category_map.items():
        print(f"  {cat}: {len(rms)} rooms")

    print(f"\nScraping timetables for all {len(room_list)} rooms using ThreadPoolExecutor...")
    results = {}
    total = len(room_list)
    completed = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_room = {
            executor.submit(fetch_room_timetable, code, label): code
            for code, label in room_list
        }
        for future in as_completed(future_to_room):
            res = future.result()
            results[res['code']] = res
            completed += 1
            if completed % 15 == 0 or completed == total:
                print(f"  Progress: {completed}/{total} rooms scraped ({completed*100//total}%)")

    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(base_dir, "SRCC_Free_Classrooms_Timetable.xlsx")
    print("\nGenerating formatted Excel workbook with separate tabs...")
    build_excel(results, category_map, output_path)
    
    # Also copy to web_app and preview_web_app if present
    for sub in ['web_app', 'preview_web_app']:
        sub_path = os.path.join(base_dir, sub)
        if os.path.exists(sub_path):
            import shutil
            shutil.copyfile(output_path, os.path.join(sub_path, "SRCC_Free_Classrooms_Timetable.xlsx"))
    print("ALL DONE!")


if __name__ == '__main__':
    main()
