import re
import json

path = r'C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\af9d59b3-2736-4e2d-ab5a-d8d5d301961c\.system_generated\steps\1042\content.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

urls = set(re.findall(r'https?://[^\s\"\'\\]+', content))
with open('matches.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(urls))

# Also search for 'firebase', 'json', 'api', 'leaves'
keywords = ['firebase', 'json', 'api', 'leaves']
with open('keywords.txt', 'w', encoding='utf-8') as f:
    for k in keywords:
        f.write(f"\n--- {k.upper()} ---\n")
        # find snippet of 50 chars around keyword
        for match in re.finditer(k, content, re.IGNORECASE):
            start = max(0, match.start() - 50)
            end = min(len(content), match.end() + 50)
            f.write(content[start:end] + '\n\n')
