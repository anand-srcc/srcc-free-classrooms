import re

with open(r'web_app\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

matches = re.findall(r'id=["\']([^"\']*notice[^"\']*)["\']', text, re.IGNORECASE)
print('Notice IDs in index.html:', set(matches))

sections = re.findall(r'<div[^>]*id=["\']([^"\']+)["\'][^>]*class=["\'][^"\']*app-view-section[^"\']*["\']', text, re.IGNORECASE)
print('App view sections in index.html:', sections)

# Also let's find all modals or view sections
all_sections = re.findall(r'<(?:div|section)[^>]*id=["\']([^"\']+)["\']', text, re.IGNORECASE)
print('Key IDs in index.html:', [s for s in all_sections if any(k in s.lower() for k in ['view', 'section', 'modal', 'drawer', 'panel'])])
