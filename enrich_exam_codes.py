import json
import re

# Load existing 431 exam code records
with open(r'web_app\exam_codes_data.json', 'r', encoding='utf-8') as f:
    records = json.load(f)

# Knowledge base of specific SRCC papers, prerequisites, eligibility, and Drive links
srcc_enrichments = {
    # DSE Commerce
    "Organisational Behaviour": {
        "drive_link": "https://drive.google.com/file/d/1F_3NsFORfJa2ysC8W5cN8jvOYt9nyY-b/view",
        "srcc_offered": True,
        "course_no": "DSE 3.1",
        "semester": "III",
        "category": "DSE",
        "department": "Department of Commerce"
    },
    "Financial Markets and Institutions": {
        "drive_link": "https://drive.google.com/file/d/1F_3NsFORfJa2ysC8W5cN8jvOYt9nyY-b/view",
        "srcc_offered": True,
        "course_no": "DSE 3.2",
        "semester": "III",
        "category": "DSE",
        "department": "Department of Commerce"
    },
    "Brand Management": {
        "drive_link": "https://drive.google.com/file/d/1F_3NsFORfJa2ysC8W5cN8jvOYt9nyY-b/view",
        "srcc_offered": True,
        "course_no": "DSE 3.3",
        "semester": "III",
        "category": "DSE",
        "department": "Department of Commerce"
    },
    "Financial Reporting Analysis and Valuation": {
        "drive_link": "https://drive.google.com/file/d/1F_3NsFORfJa2ysC8W5cN8jvOYt9nyY-b/view",
        "srcc_offered": True,
        "course_no": "DSE 3.4",
        "semester": "III",
        "category": "DSE",
        "prerequisite_note": "Required prerequisite for Analysis of Financial Statements in Sem IV",
        "department": "Department of Commerce"
    },
    "Analysis of Financial Statements": {
        "prerequisite": "Financial Reporting Analysis and Valuation (in Sem III)",
        "prerequisite_note": "Must have studied Financial Reporting Analysis & Valuation in Sem III"
    },

    # GEs
    "Principles of Microeconomics-II": {
        "drive_link": "https://drive.google.com/file/d/1rjxr7xEOqXPMph4JcMQkQ_Jnq0_LA2jY/view",
        "code": "ECON027",
        "eligibility": "Class XII with Mathematics",
        "prerequisite": "Principles of Microeconomics-I",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Theory of Public Finance": {
        "drive_link": "https://drive.google.com/file/d/1rjxr7xEOqXPMph4JcMQkQ_Jnq0_LA2jY/view",
        "code": "ECON061",
        "prerequisite": "Principles of Microeconomics-I",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Money and Banking": {
        "drive_link": "https://drive.google.com/file/d/1rjxr7xEOqXPMph4JcMQkQ_Jnq0_LA2jY/view",
        "code": "ECON062",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Digitalisation and Development": {
        "drive_link": "https://drive.google.com/file/d/1rjxr7xEOqXPMph4JcMQkQ_Jnq0_LA2jY/view",
        "code": "ECON063",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Basic Development Economics": {
        "drive_link": "https://drive.google.com/file/d/1ZRxmI3bInurOjqPa5ZwGTg7ojCvuS-Xx/view",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Essentials of Economics": {
        "drive_link": "https://drive.google.com/file/d/1C7WrtNU7HW9jKyF_bzcWWv_nzUSNIdCI/view",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Principles of Microeconomics-I": {
        "drive_link": "https://drive.google.com/file/d/1QSVHCKYQ0L2v9Bdltc9aGXZG4lbxYyHF/view",
        "department": "Department of Economics",
        "category": "GE"
    },
    "Differential Equations": {
        "drive_link": "https://drive.google.com/file/d/1_y9dweCHbj4QMQDZWV4r12Wpqi7G4QDh/view",
        "code": "GE-3(i)",
        "eligibility": "Class XII with Mathematics",
        "department": "Department of Mathematics",
        "category": "GE"
    },
    "Theory of Equations and Symmetries": {
        "drive_link": "https://drive.google.com/file/d/14-wOaGyPCUrD8LahIY7nZTRXiISB0dPt/view",
        "eligibility": "Passed Class XII with Mathematics",
        "department": "Department of Mathematics",
        "category": "GE"
    },
    "Database Management Systems": {
        "drive_link": "https://drive.google.com/file/d/17Yxs6d2lmIVqk3YS1E6qwSUnvp5aE9fr/view",
        "department": "Department of Computer Science",
        "category": "GE"
    },
    "Programming using Python": {
        "drive_link": "https://drive.google.com/file/d/1XOBMcQcjZrj16k_NCFAAgNgN7dYaG-Md/view",
        "department": "Department of Computer Science",
        "category": "GE"
    },
    "English Language through Literature": {
        "drive_link": "https://drive.google.com/file/d/1qXwR3XZtNxBOMVGMVNDZgElCR4PctYU6/view",
        "department": "Department of English",
        "category": "GE"
    },
    "Genre Fiction": {
        "drive_link": "https://drive.google.com/file/d/1qXwR3XZtNxBOMVGMVNDZgElCR4PctYU6/view",
        "department": "Department of English",
        "category": "GE"
    },
    "Digital Communications-I": {
        "drive_link": "https://drive.google.com/file/d/1s_7SL3rQIm13alMdPm7QyKGcY4Qat_vr/view",
        "department": "Department of English",
        "category": "GE"
    },
    "Literature and Human Rights": {
        "drive_link": "https://drive.google.com/file/d/1E8iuG69NYYmzCAoXGPFPuHh7ji58eqKo/view",
        "department": "Department of English",
        "category": "GE"
    },
    "Understanding International Relations": {
        "drive_link": "https://drive.google.com/file/d/1FAraHEfUQHCd-OuD21I7p1QGPjZoKEif/view",
        "code": "GE 4",
        "department": "Department of Political Science",
        "category": "GE"
    },
    "Nationalism in India": {
        "drive_link": "https://drive.google.com/file/d/1_L-T3-c72eqxJKgnLIN9wmNwJW0_iY3N/view",
        "department": "Department of Political Science",
        "category": "GE"
    },
    "Olympic Education": {
        "drive_link": "https://drive.google.com/file/d/1ggGgMTwFSD3OQlujtS7NNbp3m5D17A_4/view",
        "department": "Department of Physical Education and Sports",
        "category": "GE"
    },
    "Fitness & Wellness": {
        "drive_link": "https://drive.google.com/file/d/1rFJ-9AgNptisegeawCWXXesidMGqaqhx/view",
        "department": "Department of Physical Education and Sports",
        "category": "GE"
    },
    "मीडिया लेखन": {
        "drive_link": "https://drive.google.com/file/d/1OAcI9WnyL1lrY79wwIrIgI_0dCvyxoc-/view",
        "department": "Department of Hindi",
        "category": "GE"
    },
    "हिंदी का वैश्विक स्वरूप": {
        "department": "Department of Hindi",
        "category": "GE"
    },

    # SEC Papers
    "Business Intelligence and Data Visualisation": {
        "drive_link": "https://drive.google.com/file/d/1-z8Ql2_l9t68yZWiRou-KlC8r67l7DZi/view",
        "department": "Department of Commerce",
        "category": "SEC",
        "repeat_rule": "Cannot choose the same SEC taken in Year I"
    },
    "Digital Marketing": {
        "drive_link": "https://drive.google.com/file/d/1Vq9V8uRS_6G08NR5zkULGqsbVdn7q6fb/view",
        "department": "Department of Commerce",
        "category": "SEC",
        "repeat_rule": "Cannot choose the same SEC taken in Year I"
    },
    "Essentials of Python": {
        "drive_link": "https://drive.google.com/file/d/1uM5sh1PGy_ENr5uACjP8VZQw4pm9J9IG/view",
        "department": "Department of Commerce",
        "category": "SEC"
    },
    "Innovation and Entrepreneurship": {
        "drive_link": "https://drive.google.com/file/d/13_qjfHSHeiJT6WgePx4OCSU-x_v73q3d/view",
        "department": "Department of Commerce",
        "category": "SEC"
    },
    "Personal Financial Planning": {
        "drive_link": "https://drive.google.com/file/d/1K8yERax9x_wTURJaiqbpa7M8mLUlRwMD/view",
        "department": "Department of Commerce",
        "category": "SEC"
    },
    "Social Media Marketing": {
        "drive_link": "https://drive.google.com/file/d/1nAlRvROy9Uv5reZrY0ipMsBhywzSXe9L/view",
        "prerequisite": "Digital Marketing",
        "department": "Department of Commerce",
        "category": "SEC"
    },
    "Sustainable Ecotourism and Entrepreneurship": {
        "drive_link": "https://drive.google.com/file/d/1C_8Urc50MiT3raogp8HfP7_D1eRZSQAX/view",
        "department": "Department of Commerce",
        "category": "SEC"
    },
    "Advanced Spreadsheet": {
        "drive_link": "https://drive.google.com/file/d/1KvtvvX91lex0UWmTjzKUYyxcQ4nLl379/view",
        "department": "Department of Economics",
        "category": "SEC"
    },
    "IT Skills and Data Analysis-I": {
        "drive_link": "https://drive.google.com/file/d/1WPE1uCvqm5f0iVmLE1CteVWVa88_rQ19/view",
        "department": "Department of Economics",
        "category": "SEC"
    },
    "IT Skills and Data Analysis-II": {
        "drive_link": "https://drive.google.com/file/d/11tqOkVvANopBP1UeqbJPmSkcck1G6sH7/view",
        "prerequisite": "IT Skills and Data Analysis-I",
        "department": "Department of Economics",
        "category": "SEC"
    },
    "Statistics with R": {
        "drive_link": "https://drive.google.com/file/d/1Kis0kZu4u-5yL_Rim3Q19odChwI8FTtO/view",
        "prerequisite": "Basic Course in Statistics",
        "department": "Department of Economics",
        "category": "SEC"
    },
    "Basic IT Tools": {
        "drive_link": "https://drive.google.com/file/d/1S3HOy4PSwkFvbIyW2tk5uYHW3XWBG2r_/view",
        "department": "Department of Economics",
        "category": "SEC"
    },
    "Programming Using Python": {
        "drive_link": "https://drive.google.com/file/d/1qiEINQrglmO8ixOXQxw-NAJ68IsVB1s9/view",
        "department": "Department of Computer Science",
        "category": "SEC"
    },
    "Analytics/Computing with Python": {
        "drive_link": "https://drive.google.com/file/d/1Q7HhfisYKce5j1SUPXc5xTxKIruMNYO6/view",
        "prerequisite": "Basic Course on Python",
        "department": "Department of Computer Science",
        "category": "SEC"
    },
    "Creative Writing": {
        "drive_link": "https://drive.google.com/file/d/1g3bzebaBOrBc74Jb3qzQla1Wb70e8OOa/view",
        "department": "Department of English",
        "category": "SEC"
    },
    "Communication in Professional Life": {
        "drive_link": "https://drive.google.com/file/d/1w9g37DkWEA_xOg_R2jwdRbrzIlvtwAcE/view",
        "department": "Department of English",
        "category": "SEC"
    },
    "Negotiation and Leadership": {
        "drive_link": "https://drive.google.com/file/d/1qloUgnWn1Wz7JmEvk8OLEeiqYfIiFXdo/view",
        "department": "Department of Political Science",
        "category": "SEC"
    },
    "Political Communication and Leadership": {
        "drive_link": "https://drive.google.com/file/d/1MKt-RaFwYFvXXCFSzRJZym9dDVK0scD8/view",
        "department": "Department of Political Science",
        "category": "SEC"
    },
    "Latex Typesetting for beginners": {
        "drive_link": "https://drive.google.com/file/d/1IJ6_ARz477gPYHk9-tiIDjxUmljDMTcG/view",
        "department": "Department of Mathematics",
        "category": "SEC"
    },
    "रचनात्मक लेखन": {
        "drive_link": "https://drive.google.com/file/d/1R1fvBi3L8Vpjsj4tJDsrWK926k99ewM5/view",
        "department": "Department of Hindi",
        "category": "SEC"
    },
    "Viewing and Capturing Diversity in Nature": {
        "drive_link": "https://drive.google.com/file/d/1o-QvzscIyeevAmrco7dBSqaZ7AiU9Ovn/view",
        "department": "Environmental Science / Life Sciences",
        "category": "SEC"
    },

    # VAC Papers
    "Digital Empowerment": {
        "drive_link": "https://drive.google.com/file/d/1EV7BzUokclR3-wBKXEFoIMULaWFGbHvq/view",
        "department": "Department of Commerce",
        "category": "VAC",
        "repeat_rule": "Cannot choose the same VAC taken in Year I"
    },
    "Emotional Intelligence": {
        "drive_link": "https://drive.google.com/file/d/1TyfJwrlM1DBqT9jNYkQkzot3LQc0Cjn6/view",
        "department": "Department of Commerce",
        "category": "VAC"
    },
    "Ethics and Culture": {
        "drive_link": "https://drive.google.com/file/d/1ZH4hd8XYuAmzRhTYHVU5fYwh26pBYN5A/view",
        "department": "Department of Commerce",
        "category": "VAC"
    },
    "The Art of Being Happy": {
        "drive_link": "https://drive.google.com/file/d/1EZDTZa3W3hv45PpWRYmEDU3dsL3a-pQJ/view",
        "department": "Department of Commerce",
        "category": "VAC"
    },
    "The Gita: Navigating Life Challenges": {
        "drive_link": "https://drive.google.com/file/d/1EtitME_vgTmO5SmBv9gXOWAkZe6WV6rg/view",
        "department": "Department of Commerce",
        "category": "VAC"
    },
    "Social and Emotional Learning": {
        "drive_link": "https://drive.google.com/file/d/1E7JUY77EBbBDUARMtZfFM97tQqWs4K-V/view",
        "department": "Department of Commerce",
        "category": "VAC"
    },
    "The Science of Happiness": {
        "drive_link": "https://drive.google.com/file/d/1VotAeuLOAxmSzN-jnvGudA9mCuANXUo5/view",
        "department": "Department of Commerce / Psychology",
        "category": "VAC"
    },
    "Vedic Mathematics-I": {
        "drive_link": "https://drive.google.com/file/d/1O1SPffXtMpux7b4jMb5Mbkxn17TPpmKV/view",
        "department": "Department of Mathematics",
        "category": "VAC"
    },
    "Vedic Mathematics-II": {
        "drive_link": "https://drive.google.com/file/d/1vV-AvmI7YMiESryxbm85hrGY9lHJ1NNA/view",
        "prerequisite": "Vedic Mathematics-I",
        "department": "Department of Mathematics",
        "category": "VAC"
    },
    "Vedic Mathematics-III": {
        "drive_link": "https://drive.google.com/file/d/13hBYuUzWon02L4kZIFfILmNlV-zH5iJ3/view",
        "prerequisite": "Vedic Mathematics-II",
        "department": "Department of Mathematics",
        "category": "VAC"
    },
    "Reading Indian Fiction in English": {
        "drive_link": "https://drive.google.com/file/d/1e0w_BkR_4Sp5DUHY21IdpFioaeRSvixS/view",
        "department": "Department of English",
        "category": "VAC"
    },
    "साहित्य, संस्कृति और सिनेमा": {
        "drive_link": "https://drive.google.com/file/d/1o3BguK1Bh6lhvsrWZnEmFqBgIhFMWwL1/view",
        "department": "Department of Hindi",
        "category": "VAC"
    },
    "Constitutional Values and Fundamental Duties": {
        "drive_link": "https://drive.google.com/file/d/1jTVsBgf_vnwoDbD9uPcTyN0UBjjXk-Cx/view",
        "department": "Department of Political Science",
        "category": "VAC"
    },
    "Leadership Excellence through Gita": {
        "drive_link": "https://drive.google.com/file/d/1BpCD4Wf67KcX-F2S1djaj2HTEA1ptj5W/view",
        "department": "Department of Political Science",
        "category": "VAC"
    }
}

import html

# Normalize string helper supporting Unicode (Hindi/Devanagari and English), unescaping HTML and standardizing '&'/ 'and'
def norm(s):
    s = html.unescape(s or '')
    s = re.sub(r'\b(and|amp)\b', '&', s, flags=re.IGNORECASE)
    s = s.replace('&', '')
    s = re.sub(r'[\'’"`]', '', s)
    return re.sub(r'[^\w]', '', s, flags=re.UNICODE).lower()

matched_count = 0
for r in records:
    title_norm = norm(r['title'])
    for k, info in srcc_enrichments.items():
        k_norm = norm(k)
        if not k_norm or len(k_norm) < 3:
            continue
        
        # Exact normalized match
        is_match = (k_norm == title_norm)

        if is_match:
            matched_count += 1
            if "drive_link" in info and not r.get("drive_syllabus_url"):
                r["drive_syllabus_url"] = info["drive_link"]
            if "prerequisite" in info:
                r["prerequisite"] = info["prerequisite"]
            if "prerequisite_note" in info:
                r["prerequisite_note"] = info["prerequisite_note"]
            if "eligibility" in info:
                r["eligibility"] = info["eligibility"]
            if "repeat_rule" in info:
                r["repeat_rule"] = info["repeat_rule"]
            if "srcc_offered" in info:
                r["srcc_offered"] = True
            if "department" in info:
                r["srcc_dept"] = info["department"]
            break

# Also add any standalone GEs or courses that might not be in the DU 431 set
# (e.g. Non-Commerce GEs like Differential Equations, DBMS, Understanding International Relations, etc.)
existing_titles = {norm(r['title']) for r in records}
new_ge_added = 0

for k, info in srcc_enrichments.items():
    if info.get("category") == "GE" and norm(k) not in existing_titles:
        # Create a GE record
        new_record = {
            "programme": "GE (Elective)",
            "department": info.get("department", "Generic Electives"),
            "semester": "III/IV (or I/II)",
            "title": k,
            "type": "Generic Elective (GE)",
            "category": "GE",
            "course_no": info.get("code", "GE"),
            "upc": f"GE-{info.get('code', 'DU')}",
            "credits": "4",
            "theory": "3",
            "tutorial": "1",
            "practical": "0",
            "syllabus_url": info.get("drive_link", ""),
            "drive_syllabus_url": info.get("drive_link", ""),
            "eligibility": info.get("eligibility", ""),
            "prerequisite": info.get("prerequisite", ""),
            "srcc_offered": True
        }
        records.append(new_record)
        existing_titles.add(norm(k))
        new_ge_added += 1

print(f"Matched {matched_count} existing records with SRCC Drive links and Prerequisites.")
print(f"Added {new_ge_added} additional non-commerce GE electives.")
print(f"Total active records: {len(records)}")

# Reference notes collection for the app
ugcf_guidelines = {
    "structure_doc": "https://drive.google.com/file/d/12XxFs_aTdaqjrlipfDu9IDailBX4DNKN/view",
    "bcom_programme_url": "https://www.commerce.du.ac.in/programmes/ugcf-b-com-programme",
    "notes": [
        {
            "id": "note1",
            "title": "Note 1: What DU's UGCF is",
            "desc": "Foundational architecture of DU Undergraduate Curriculum Framework 2022",
            "link": "https://drive.google.com/file/d/1u5cfVEwvX2h6MkSTEX2N3Q8l_R9w11IS/view"
        },
        {
            "id": "note2",
            "title": "Note 2: Idea of Minor/Major Discipline in a Degree",
            "desc": "How credits accumulate towards Single Major, Double Major, or Minor degree specializations",
            "link": "https://drive.google.com/file/d/1CMKr1dcnNTpNT1bM79biL-eWf1D-XIqH/view"
        },
        {
            "id": "note3",
            "title": "Note 3: How to Read the Syllabus Document",
            "desc": "Understanding Learning Objectives (LOCF), Unit Distributions, and Reference Readings",
            "link": "https://drive.google.com/file/d/1Y1qDm_NodHe_O2s39GLO_bXTMHicKF8M/view"
        },
        {
            "id": "note4",
            "title": "Note 4: About AEC (Ability Enhancement Courses)",
            "desc": "Language & Environmental Science (EVS) guidelines across semesters",
            "link": "https://drive.google.com/file/d/1MpxJecMANfyQuA_CjYcIpl-RPe8_eVqc/view"
        },
        {
            "id": "note5",
            "title": "Note 5: A Primer on Fourth Year",
            "desc": "B.Com. (Hons. with Research / Academic Track) eligibility and project requirements",
            "link": "https://drive.google.com/file/d/1nLgQVWMVkzw-E-XbgwdsH9qrH7at90w9/view"
        },
        {
            "id": "sec_note",
            "title": "Official Guidelines on SEC Papers",
            "desc": "Structure, eligibility and mandatory non-repeat rule (must take different SEC than Year I)",
            "link": "https://drive.google.com/file/d/13Lsmj8Ru68Xoo5BTg76at0W40imO-aPM/view"
        },
        {
            "id": "vac_note",
            "title": "Official Guidelines on VAC Courses",
            "desc": "Rules, credit distributions and mandatory non-repeat rule (must take different VAC than Year I)",
            "link": "https://drive.google.com/file/d/1ZdzS1sNwdQiR4soFPoKGjILc4jItBGmE/view"
        }
    ],
    "folder_links": {
        "ge_folder": "https://drive.google.com/drive/folders/1hZrFNYa3AW46Wi9F1uBbVBq5LmpARhwE?usp=drive_link",
        "sec_folder": "https://drive.google.com/file/d/1zCqufOgL8-kxLef7QvOe_KL3UOOKUFvx/view?usp=drive_link",
        "vac_folder": "https://drive.google.com/file/d/1hqcbTBZJJmPjKqU8pIwaQ3yadhQueJkQ/view?usp=drive_link",
        "dsc_folder": "https://drive.google.com/drive/folders/1UP9rwfVykYBTVVSEJ4s8w9F_EIqwwqIz?usp=drive_link"
    }
}

# Write enriched data to json and js
with open(r'web_app\exam_codes_data.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, indent=2, ensure_ascii=False)

with open(r'web_app\exam_codes_data.js', 'w', encoding='utf-8') as f:
    f.write("window.EXAM_CODES_DATA = " + json.dumps(records, indent=2, ensure_ascii=False) + ";\n")
    f.write("window.UGCF_GUIDELINES = " + json.dumps(ugcf_guidelines, indent=2, ensure_ascii=False) + ";\n")

print("Saved enriched data to web_app/exam_codes_data.json and web_app/exam_codes_data.js!")
