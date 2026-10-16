import re
import json

import html

def clean_text(s):
    if not s:
        return ""
    # unescape html entities like &amp;, &#39;, etc.
    s = html.unescape(s)
    # remove html tags
    s = re.sub(r'<[^>]+>', ' ', s)
    # decode common entities
    s = s.replace('\ufffd', '-')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def determine_category(course_type, course_no, current_section):
    t_upper = (course_type or "").upper()
    no_upper = (course_no or "").upper()
    sec_upper = (current_section or "").upper()
    
    if "GENERIC" in t_upper or "GE" in no_upper or "GENERIC" in sec_upper:
        return "GE"
    if "ELECTIVE" in t_upper or "DSE" in no_upper or "DSE" in t_upper or "ELECTIVE" in sec_upper:
        return "DSE"
    if "CORE" in t_upper or "DSC" in no_upper or "DSC" in t_upper or "CORE" in sec_upper:
        return "Core"
    if "RESEARCH" in t_upper or "TRACK" in t_upper or "DISSERTATION" in t_upper:
        return "Research/Track"
    return current_section or "Core"


def parse_html_table(html):
    tables = re.findall(r'<table([^>]*)>(.*?)</table>', html, re.DOTALL | re.IGNORECASE)
    if not tables:
        return []
    attrs, content = tables[0]
    rows = re.findall(r'<tr([^>]*)>(.*?)</tr>', content, re.DOTALL | re.IGNORECASE)
    parsed_rows = []
    for r_attrs, r_content in rows:
        cells = []
        for c_match in re.finditer(r'<t[dh][^>]*>(.*?)</t[dh]>', r_content, re.DOTALL | re.IGNORECASE):
            c_html = c_match.group(1).strip()
            link_match = re.search(r'href=["\']([^"\']+)["\']', c_html)
            link = link_match.group(1) if link_match else None
            text = clean_text(c_html)
            cells.append({'text': text, 'link': link, 'raw': c_html})
        parsed_rows.append(cells)
    return parsed_rows

# 1. Parse B.Com (Hons)
with open(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\35\content.md", 'r', encoding='utf-8', errors='ignore') as f:
    comm_html = f.read()

comm_rows = parse_html_table(comm_html)
bcom_records = []
current_section = "Core"

for r in comm_rows:
    texts = [c['text'] for c in r if c['text']]
    if not texts:
        continue
    row_text = " ".join(texts)
    if "List of Discipline Specific Core" in row_text:
        current_section = "Core"
        continue
    elif "List of Discipline Specific Elective" in row_text or "DSE" in row_text and "List" in row_text:
        current_section = "DSE"
        continue
    elif "List of Generic Elective" in row_text or "Generic Electives" in row_text:
        current_section = "GE"
        continue
    elif "Programme Name" in row_text or "Semester" in texts and "UPC" in texts:
        continue
    elif len(texts) == 1 and ("List" in row_text or "Elective" in row_text or "Core" in row_text):
        if "Core" in row_text:
            current_section = "Core"
        elif "Elective" in row_text or "DSE" in row_text:
            current_section = "DSE"
        elif "Generic" in row_text or "GE" in row_text:
            current_section = "GE"
        continue
    
    if len(r) >= 5:
        sem = r[0]['text']
        title = r[1]['text']
        link = r[1]['link'] or (r[4]['link'] if len(r) > 4 else None)
        course_type = r[2]['text'] if len(r) > 2 else current_section
        course_no = r[3]['text'] if len(r) > 3 else ""
        upc = r[4]['text'] if len(r) > 4 else ""
        credits = r[5]['text'] if len(r) > 5 else "4"
        
        th = r[6]['text'] if len(r) > 6 else ""
        tut = r[7]['text'] if len(r) > 7 else ""
        prac = r[8]['text'] if len(r) > 8 else ""
        
        # skip header rows
        if "upc" in upc.lower() or "semester" in sem.lower():
            continue
        # UPC must be numeric or valid code
        if not re.search(r'\d{5,}', upc):
            continue
            
        cat = determine_category(course_type, course_no, current_section)
            
        bcom_records.append({
            "programme": "B.Com. (Hons.)",
            "department": "Department of Commerce",
            "semester": sem,
            "title": title,
            "type": course_type,
            "category": cat,
            "course_no": course_no,
            "upc": upc,
            "credits": credits,
            "theory": th,
            "tutorial": tut,
            "practical": prac,
            "syllabus_url": link or ""
        })


print(f"Parsed {len(bcom_records)} valid B.Com (Hons) records")
print("First BCom:", bcom_records[0])
print("Last BCom:", bcom_records[-1])

# 2. Parse B.A. (Hons) Economics
with open(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\59\content.md", 'r', encoding='utf-8', errors='ignore') as f:
    eco_html = f.read()

eco_rows = parse_html_table(eco_html)
eco_records = []
current_section = "Core"

for r in eco_rows:
    texts = [c['text'] for c in r if c['text']]
    if not texts:
        continue
    row_text = " ".join(texts)
    if "List of Discipline Specific Core" in row_text:
        current_section = "Core"
        continue
    elif "List of Discipline Specific Elective" in row_text or "DSE" in row_text and "List" in row_text:
        current_section = "DSE"
        continue
    elif "List of Generic Elective" in row_text or "Generic Electives" in row_text:
        current_section = "GE"
        continue
    elif "Programme Name" in row_text or ("Semester" in texts and "UPC" in texts):
        continue
    elif len(texts) == 1 and ("List" in row_text or "Elective" in row_text or "Core" in row_text):
        if "Core" in row_text:
            current_section = "Core"
        elif "Elective" in row_text or "DSE" in row_text:
            current_section = "DSE"
        elif "Generic" in row_text or "GE" in row_text:
            current_section = "GE"
        continue
    
    if len(r) >= 5:
        sem = r[0]['text']
        title = r[1]['text']
        link = r[1]['link'] or (r[4]['link'] if len(r) > 4 else None)
        course_type = r[2]['text'] if len(r) > 2 else current_section
        course_no = r[3]['text'] if len(r) > 3 else ""
        upc = r[4]['text'] if len(r) > 4 else ""
        credits = r[5]['text'] if len(r) > 5 else "4"
        th = r[6]['text'] if len(r) > 6 else ""
        tut = r[7]['text'] if len(r) > 7 else ""
        prac = r[8]['text'] if len(r) > 8 else ""
        
        if "upc" in upc.lower() or "semester" in sem.lower():
            continue
        if not re.search(r'\d{5,}', upc):
            continue
            
        cat = determine_category(course_type, course_no, current_section)
            
        eco_records.append({
            "programme": "B.A. (Hons.) Economics",
            "department": "Department of Economics",
            "semester": sem,
            "title": title,
            "type": course_type,
            "category": cat,
            "course_no": course_no,
            "upc": upc,
            "credits": credits,
            "theory": th,
            "tutorial": tut,
            "practical": prac,
            "syllabus_url": link or ""
        })


print(f"Parsed {len(eco_records)} valid B.A. (Hons) Economics records")
print("First Eco:", eco_records[0])
print("Last Eco:", eco_records[-1])

# 3. Parse SEC (Skill Enhancement Courses)
with open(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\61\content.md", 'r', encoding='utf-8', errors='ignore') as f:
    sec_html = f.read()

sec_rows = parse_html_table(sec_html)
sec_records = []
current_theme = "General"

for r in sec_rows:
    texts = [c['text'] for c in r if c['text']]
    if not texts:
        continue
    row_text = " ".join(texts)
    if "List of all the Skill Enhancement Courses" in row_text or ("S. No." in texts and "UPC" in texts):
        continue
    if len(texts) == 1 and ("Theme" in row_text or "Department" in row_text or ":" in row_text or "Chemistry" in row_text or "Commerce" in row_text):
        current_theme = row_text
        continue
    
    if len(r) >= 3:
        c_no = r[0]['text']
        c_title = r[1]['text']
        c_link = r[1]['link'] or r[2]['link']
        upc = r[2]['text']
        
        if "upc" in upc.lower() or "course" in c_title.lower():
            continue
        if not re.search(r'\d{5,}', upc):
            continue
            
        th = r[3]['text'] if len(r) > 3 else "0"
        tut = r[4]['text'] if len(r) > 4 else "0"
        prac = r[5]['text'] if len(r) > 5 else "2"
        try:
            total_cr = str(int(th or 0) + int(tut or 0) + int(prac or 0))
        except:
            total_cr = "2"
            
        sec_records.append({
            "programme": "SEC",
            "department": f"SEC ({current_theme})",
            "semester": "All Semesters (I-VI)",
            "title": c_title,
            "type": "Skill Enhancement Course (SEC)",
            "category": "SEC",
            "theme": current_theme,
            "course_no": f"SEC-{c_no}" if c_no.isdigit() else f"SEC-{len(sec_records)+1}",
            "upc": upc,
            "credits": total_cr,
            "theory": th,
            "tutorial": tut,
            "practical": prac,
            "syllabus_url": c_link or ""
        })

print(f"Parsed {len(sec_records)} valid SEC records")
print("First SEC:", sec_records[0])
print("Last SEC:", sec_records[-1])

# 4. Parse AEC (Ability Enhancement Courses)
with open(r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\65\content.md", 'r', encoding='utf-8', errors='ignore') as f:
    aec_html = f.read()

aec_rows = parse_html_table(aec_html)
aec_records = []
current_dept = "General"

for r in aec_rows:
    texts = [c['text'] for c in r if c['text']]
    if not texts:
        continue
    row_text = " ".join(texts)
    if "List of all the Ability Enhancement Courses" in row_text or ("Semester" in texts and "UPC" in texts):
        continue
    if len(texts) == 1:
        current_dept = row_text
        continue
    
    if len(r) >= 4:
        sem = r[0]['text']
        title = r[1]['text']
        link = r[1]['link'] or (r[3]['link'] if len(r) > 3 else None)
        course_no = r[2]['text'] if len(r) > 2 else ""
        upc = r[3]['text'] if len(r) > 3 else ""
        credits = r[4]['text'] if len(r) > 4 else "2"
        th = r[5]['text'] if len(r) > 5 else "2"
        tut = r[6]['text'] if len(r) > 6 else "0"
        prac = r[7]['text'] if len(r) > 7 else "0"
        
        if "upc" in upc.lower() or "semester" in sem.lower():
            continue
        if not re.search(r'\d{5,}', upc):
            continue
            
        aec_records.append({
            "programme": "AEC",
            "department": f"AEC ({current_dept})",
            "semester": sem,
            "title": title,
            "type": "Ability Enhancement Course (AEC)",
            "category": "AEC",
            "course_no": course_no,
            "upc": upc,
            "credits": credits,
            "theory": th,
            "tutorial": tut,
            "practical": prac,
            "syllabus_url": link or ""
        })

print(f"Parsed {len(aec_records)} valid AEC records")
print("First AEC:", aec_records[0])
print("Last AEC:", aec_records[-1])

# 5. VAC (Value Addition Courses)
vac_catalog = [
    {"title": "Ayurveda and Nutrition", "upc": "6967000001", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "AVURVEDA%20AND%20NUTRITION.pdf"},
    {"title": "Constitutional Values and Fundamental Duties", "upc": "6967000002", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "CONSTITUTIONAL%20VALUES%20AND%20FUNDAMENTAL%20DUTIES.pdf"},
    {"title": "Culture and Communication", "upc": "6967000003", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Culture%20and%20Communication.pdf"},
    {"title": "Digital Empowerment", "upc": "6967000027", "credits": "2", "th": "0", "tut": "0", "prac": "2", "slug": "Digital%20Empowerment.pdf"},
    {"title": "Emotional Intelligence", "upc": "6967000005", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "EMOTIONAL%20INTELLIGENCE.pdf"},
    {"title": "Ethics and Culture", "upc": "6967000006", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "ETIDCS%20AND%20CULTURE.pdf"},
    {"title": "Ethics and Values in Ancient Indian Traditions", "upc": "6967000007", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "ETHICS%20AND%20VALUES%20IN%20ANCIENT%20INDIAN%20TRADITIONS.pdf"},
    {"title": "Financial Literacy", "upc": "6967000008", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "FINANCIAL%20LITERACY.pdf"},
    {"title": "Fit India", "upc": "6967000009", "credits": "2", "th": "0", "tut": "0", "prac": "2", "slug": "FIT%20INDIA.pdf"},
    {"title": "Gandhi and Education", "upc": "6967000010", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "GANDHI%20AND%20EDUCATION.pdf"},
    {"title": "Ecology and Literature", "upc": "6967000011", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "ECOLOGY%20AND%20LITERATURE.pdf"},
    {"title": "Panchkosha: Holistic Development of Personality", "upc": "6967000013", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "PANCHKOSHA%20%20HOLISTIC%20DEVELOPMENT%20OF%20PERSONALITY.pdf"},
    {"title": "Reading Indian Fiction in English", "upc": "6967000014", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "READING%20INDIAN%20FICTION%20IN%20ENGLISH.pdf"},
    {"title": "Science and Society", "upc": "6967000015", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "SCIENCE%20AND%20SOCIETY.pdf"},
    {"title": "Social and Emotional Learning", "upc": "6967000016", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "SOCIAL%20AND%20EMOTIONAL%20LEARNING.pdf"},
    {"title": "Sports for Life", "upc": "6967000017", "credits": "2", "th": "0", "tut": "0", "prac": "2", "slug": "SPORTS%20FOR%20LIFE.pdf"},
    {"title": "Sports - Diversity and Inclusivity", "upc": "6967000032", "credits": "2", "th": "0", "tut": "0", "prac": "2", "slug": "SPORTS%20DIVERSITY%20AND%20INCLUSIVITY.pdf"},
    {"title": "Swachh Bharat", "upc": "6967000018", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "SWACHH%20BHARAT.pdf"},
    {"title": "The Art of Being Happy", "upc": "6967000019", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "THE%20ART%20OF%20BEING%20HAPPY.pdf"},
    {"title": "Vedic Mathematics-I", "upc": "6967000020", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "VEDIC%20MATHEMATICS%20-%20I.pdf"},
    {"title": "Vedic Mathematics-II", "upc": "6967000025", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Vedic%20Mathematics%20-%20II.pdf"},
    {"title": "Vedic Mathematics-III", "upc": "6967000026", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Vedic%20Mathematics%20-%20II%D0%86.pdf"},
    {"title": "Vedic Mathematics-IV", "upc": "6967000034", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Vedic%20Mathematics%20-%20IV.pdf"},
    {"title": "Yoga: Philosophy and Practice", "upc": "6967000021", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Yoga%20%20PHILOSOPHY%20AND%20PRACTICE.pdf"},
    {"title": "Envisaging Viksit Bharat: Perspectives and Challenges", "upc": "6967000033", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Envisaging%20Viksit%20Bharat%20Perspectives%20and%20Challenges.pdf"},
    {"title": "The Gita for Holistic Life", "upc": "6967000029", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "The%20Gita%20for%20Holistic%20Life.pdf"},
    {"title": "Leadership Excellence Through the Gita", "upc": "6967000030", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "Leadership%20Excellence%20Through%20the%20Gita.pdf"},
    {"title": "The Gita for Sustainable Universe", "upc": "6967000031", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "The%20Gita%20for%20Sustainable%20Universe.pdf"},
    {"title": "The Gita: Navigating Life Challenges", "upc": "6967000035", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "The%20Gita%20Navigating%20Life%20Challenges.pdf"},
    {"title": "The Science of Happiness", "upc": "6967000036", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "The%20Science%20of%20Happiness.pdf"},
    {"title": "Tribes of India", "upc": "6967000028", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "TRIBES%20OF%20INDIA.pdf"},
    {"title": "National Cadet Corps-I", "upc": "6967001101", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "NATIONAL%20CADET%20CORPS-I.pdf"},
    {"title": "National Cadet Corps-II", "upc": "6967001201", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "NATIONAL%20CADET%20CORPS%20%E2%80%93%20II.pdf"},
    {"title": "National Cadet Corps-III", "upc": "6967002301", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "NATIONAL%20CADET%20CORPS%20-%20III.pdf"},
    {"title": "National Cadet Corps-IV", "upc": "6967002401", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": "National%20Cadet%20Corps%20-%20IV.pdf"},
    {"title": "Indigenous Sports", "upc": "6967000037", "credits": "2", "th": "0", "tut": "0", "prac": "2", "slug": "INDIGENOUS%20SPORTS.pdf"},
    {"title": "भारतीय भक्ति परम्परा और मानव मूल्य", "upc": "6967000022", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": ""},
    {"title": "साहित्य संस्कृति और सिनेमा", "upc": "6967000023", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": ""},
    {"title": "सृजनात्मक लेखन के आयाम", "upc": "6967000024", "credits": "2", "th": "1", "tut": "0", "prac": "1", "slug": ""}
]

vac_records = []
for idx, v in enumerate(vac_catalog):
    slug = v.get("slug", "")
    pdf_url = f"https://academicaffairs.du.ac.in/syllabus/ug/VAC%20Syllabus/{slug}" if slug else ""
    vac_records.append({
        "programme": "VAC",
        "department": "Value Addition Courses",
        "semester": "All Semesters (I-VI)",
        "title": v["title"],
        "type": "Value Addition Course (VAC)",
        "category": "VAC",
        "course_no": f"VAC-{idx+1}",
        "upc": v["upc"],
        "credits": v["credits"],
        "theory": v["th"],
        "tutorial": v["tut"],
        "practical": v["prac"],
        "syllabus_url": pdf_url
    })

print(f"Parsed {len(vac_records)} VAC records")

all_records = bcom_records + eco_records + sec_records + aec_records + vac_records
print(f"\n==========================================")
print(f"TOTAL CLEAN EXAM CODE / UPC RECORDS: {len(all_records)}")
print(f"  B.Com (Hons): {len(bcom_records)}")
print(f"  B.A. (Hons) Economics: {len(eco_records)}")
print(f"  SEC: {len(sec_records)}")
print(f"  AEC: {len(aec_records)}")
print(f"  VAC: {len(vac_records)}")
print(f"==========================================")

with open(r"web_app\exam_codes_data.json", "w", encoding="utf-8") as f:
    json.dump(all_records, f, indent=2, ensure_ascii=False)

with open(r"web_app\exam_codes_data.js", "w", encoding="utf-8") as f:
    f.write("window.EXAM_CODES_DATA = " + json.dumps(all_records, indent=2, ensure_ascii=False) + ";\n")

print("Saved to web_app/exam_codes_data.json and web_app/exam_codes_data.js successfully!")
