import re

path = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\af9d59b3-2736-4e2d-ab5a-d8d5d301961c\.system_generated\steps\1042\content.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# search for URLs containing json or leave
matches = re.findall(r'/[^\"]+\.json', content)
print(set(matches))
