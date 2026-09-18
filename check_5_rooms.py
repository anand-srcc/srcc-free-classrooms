import urllib.request, urllib.parse, re

url = 'https://srcccollegetimetable.in/'
for rm in ['CL3', 'R36', 'SCR2', 'SCR3', 'Seminar Room']:
    data = urllib.parse.urlencode({'roomno': rm, 'submit': 'Go'}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded'})
    html = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
    has_table = '<table' in html and 'border="1"' in html
    print(f"Room {rm}: has_table = {has_table}, len = {len(html)}")
    if not has_table:
        # Check if there's any text like 'No Record Found' or similar
        print("  Snippet around table or body:", html[html.find('border="1"')-50:html.find('border="1"')+100] if 'border="1"' in html else "No border=1")
        # search for error or alert
        msg = re.findall(r'<div[^>]*>([\s\S]*?)</div>', html)
        for m in msg[:5]:
            clean = ' '.join(m.split())
            if clean:
                print("  Div:", clean[:80])
