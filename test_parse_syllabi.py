import re
import json

def parse_table_press(file_path):
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    
    tables = re.findall(r'<table([^>]*)>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    results = []
    for attrs, content in tables:
        rows = re.findall(r'<tr([^>]*)>(.*?)</tr>', content, re.DOTALL | re.IGNORECASE)
        table_data = []
        for r_attrs, r_content in rows:
            # find all td/th with inner html and links
            cells = []
            for c_match in re.finditer(r'<t[dh][^>]*>(.*?)</t[dh]>', r_content, re.DOTALL | re.IGNORECASE):
                c_html = c_match.group(1).strip()
                # extract link if any
                link_match = re.search(r'href=["\']([^"\']+)["\']', c_html)
                link = link_match.group(1) if link_match else None
                text = re.sub(r'<[^>]+>', ' ', c_html).strip()
                text = re.sub(r'\s+', ' ', text)
                cells.append({'text': text, 'link': link})
            table_data.append(cells)
        results.append(table_data)
    return results

print("=== COMMERCE ===")
comm = parse_table_press(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\35\content.md")[0]
for i in range(min(12, len(comm))):
    print(f"R{i}: {[c['text'] for c in comm[i]]}")

print("\n=== ECONOMICS ===")
eco = parse_table_press(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\59\content.md")[0]
for i in range(min(12, len(eco))):
    print(f"R{i}: {[c['text'] for c in eco[i]]}")

print("\n=== SEC ===")
sec = parse_table_press(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\61\content.md")[0]
for i in range(min(10, len(sec))):
    print(f"R{i}: {[c['text'] for c in sec[i]]}")

print("\n=== AEC ===")
aec = parse_table_press(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\65\content.md")[0]
for i in range(min(10, len(aec))):
    print(f"R{i}: {[c['text'] for c in aec[i]]}")
