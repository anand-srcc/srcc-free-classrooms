import urllib.request
import urllib.parse
from html.parser import HTMLParser
import re

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = self.in_tr = self.in_cell = False
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
                self.in_tr = True; self.current_row = []
            elif tag in ('td', 'th') and self.in_tr:
                self.in_cell = True
                self.current_colspan = int(attrs_dict.get('colspan', 1))
                self.current_cell_text = []

    def handle_endtag(self, tag):
        if self.in_table:
            if tag in ('td', 'th') and self.in_cell:
                text = ' '.join(''.join(self.current_cell_text).replace('&nbsp;', ' ').split())
                for _ in range(self.current_colspan): self.current_row.append(text)
                self.in_cell = False
            elif tag == 'tr' and self.in_tr:
                if any(self.current_row): self.rows.append(self.current_row)
                self.in_tr = False
            elif tag == 'table': self.in_table = False

    def handle_data(self, data):
        if self.in_cell: self.current_cell_text.append(data)

url = 'https://srcccollegetimetable.in/'
for rm in ['R5', 'R6', 'T35']:
    data = urllib.parse.urlencode({'roomno': rm, 'submit': 'Go'}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded'})
    resp = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
    p = TableParser()
    p.feed(resp)
    print(f"Room {rm}: {len(p.rows)} rows found.")
    if p.rows:
        occupied = sum(1 for r in p.rows[1:] for c in r[1:] if c)
        print(f"  Occupied cells: {occupied}")
