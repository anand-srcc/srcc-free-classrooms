import re

with open(r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\51\content.md', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

links = re.findall(r'href=[\'"]([^\'"]+)[\'"][^>]*>(.*?)</a>', text, re.IGNORECASE)
print(f'Total links: {len(links)}')
found = set()
for href, title in links:
    t_clean = re.sub(r'<[^>]+>', '', title).strip()
    full = f"{t_clean} -> {href}"
    if any(k in href.lower() or k in t_clean.lower() for k in ['eco', 'aec', 'sec', 'vac', 'commerce', 'ability', 'skill', 'value']):
        if full not in found:
            found.add(full)
            print(full)
