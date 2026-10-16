import os
import re
from html.parser import HTMLParser

file_path = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\35\content.md'
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Let's inspect TablePress tables or other tables with regex / parser
table_matches = re.findall(r'<table([^>]*)>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
print(f"Total tables found: {len(table_matches)}")

for i, (attrs, content) in enumerate(table_matches):
    rows = re.findall(r'<tr([^>]*)>(.*?)</tr>', content, re.DOTALL | re.IGNORECASE)
    print(f"\n--- Table {i} ({attrs.strip()}) Rows: {len(rows)} ---")
    for r_idx, (r_attrs, r_content) in enumerate(rows[:5]):
        cols = [re.sub(r'<[^>]+>', '', c).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r_content, re.DOTALL | re.IGNORECASE)]
        print(f"  Row {r_idx}: {cols}")

