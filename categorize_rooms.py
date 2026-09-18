import urllib.request, re

url = 'https://srcccollegetimetable.in/'
html = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})).read().decode('utf-8', errors='ignore')
m = re.search(r'<select name="roomno"[^>]*>([\s\S]*?)</select>', html)
options = re.findall(r'<option\s+value="([^"]*)">([^<]*)</option>', m.group(1))

r_rooms = []
t_rooms = []
pb_rooms = []
other_rooms = []

for val, text in options:
    val = val.strip()
    if not val: continue
    clean_text = ' '.join(text.replace('&nbsp;', ' ').split())
    if re.match(r'^R\d+$', val):
        r_rooms.append((val, clean_text))
    elif re.match(r'^T\d+$', val):
        t_rooms.append((val, clean_text))
    elif val.startswith('PB'):
        pb_rooms.append((val, clean_text))
    else:
        other_rooms.append((val, clean_text))

r_rooms.sort(key=lambda x: int(x[0][1:]))
t_rooms.sort(key=lambda x: int(x[0][1:]))
pb_rooms.sort(key=lambda x: int(re.search(r'\d+', x[0]).group(0)) if re.search(r'\d+', x[0]) else 0)

print(f"R Classrooms ({len(r_rooms)}): {[r[0] for r in r_rooms]}")
print(f"T Tutorial Rooms ({len(t_rooms)}): {[t[0] for t in t_rooms]}")
print(f"PB Practical Blocks ({len(pb_rooms)}): {[pb[0] for pb in pb_rooms]}")
print(f"Other Rooms ({len(other_rooms)}): {[o[0] for o in other_rooms]}")
