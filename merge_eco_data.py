import json
import re

def clean_str(val):
    if val is None:
        return ""
    return str(val).strip()

def normalize_title(title):
    return re.sub(r'[^a-zA-Z0-9]', '', title).lower()

def main():
    with open("web_app/exam_codes_data.json", "r", encoding="utf-8") as f:
        existing_data = json.load(f)
    
    with open("scratch/user_extracted_eco_hons.json", "r", encoding="utf-8") as f:
        eco_raw = json.load(f)

    print(f"Loaded existing records: {len(existing_data)}")
    print(f"Loaded user extracted rows: {len(eco_raw)}")

    # Index existing data by UPC and normalized title
    upc_map = {}
    title_map = {}
    for i, item in enumerate(existing_data):
        u = clean_str(item.get("upc"))
        if u and u.lower() != "tba":
            upc_map[u] = i
        t = normalize_title(item.get("title", ""))
        if t:
            title_map[t] = i

    current_section = ""
    added_count = 0
    updated_count = 0

    for row in eco_raw:
        # Detect header rows or section separators
        first_col_key = [k for k in row.keys() if "Programme Name" in k or "PROGRAMME NAME" in k]
        first_col_val = clean_str(row.get(first_col_key[0])) if first_col_key else ""
        
        # Check if this row is a section marker or header
        if "List of Discipline Specific Core" in first_col_val:
            current_section = "DSC"
            continue
        elif "List of Discipline Specific Elective" in first_col_val:
            current_section = "DSE"
            continue
        elif "List of Generic Elective" in first_col_val:
            current_section = "GE"
            continue
        elif "Academic Track" in first_col_val:
            current_section = "Track"
            continue
        
        # Check if header row
        col_2 = clean_str(row.get("col_2"))
        if col_2 in ["Name of the Course", "Tutorial", ""]:
            # Check if this is an academic track row with col_2 having the track name
            if not ("Track" in col_2 or "Research" in col_2 or "Entrepreneurship" in col_2):
                continue
        
        # Extract fields
        sem = first_col_val.replace("Semester-", "").replace("Semester", "").strip()
        title = col_2
        syllabus_url = clean_str(row.get("col_2_url"))
        course_type_raw = clean_str(row.get("col_3"))
        course_no = clean_str(row.get("col_4"))
        upc = clean_str(row.get("detected_upc") or row.get("col_5"))
        credits = clean_str(row.get("col_6"))
        theory = clean_str(row.get("col_7"))
        tutorial = clean_str(row.get("col_8"))
        practical = clean_str(row.get("col_9"))

        # If UPC has multiple (e.g. "2274001203 / 2274000013"), take the primary or detected
        if "/" in upc:
            upc = upc.split("/")[0].strip()

        # Determine Category & Type
        if "Discipline Specific Core" in course_type_raw or "DSC" in course_no or current_section == "DSC":
            category = "Core"
            c_type = "Core"
        elif "Discipline Specific Elective" in course_type_raw or "DSE" in course_no or current_section == "DSE":
            category = "DSE"
            c_type = "Discipline Specific Elective"
        elif "Generic Elective" in course_type_raw or "GE" in course_no or current_section == "GE":
            category = "GE"
            c_type = "Generic Elective"
        elif "Academic Track" in course_type_raw or current_section == "Track":
            category = "Research/Track"
            c_type = "Academic Track"
        else:
            category = "Core"
            c_type = course_type_raw or "Core"

        # Check if offered at SRCC: All B.A. (Hons.) Economics DSC and common DSE/GEs offered
        is_srcc = True

        entry = {
            "programme": "B.A. (Hons.) Economics",
            "department": "Department of Economics",
            "semester": sem,
            "title": title,
            "type": c_type,
            "category": category,
            "course_no": course_no,
            "upc": upc,
            "credits": credits,
            "theory": theory,
            "tutorial": tutorial,
            "practical": practical,
            "syllabus_url": syllabus_url,
            "is_srcc_offered": is_srcc
        }

        # Check if already in existing_data
        match_idx = None
        if upc and upc.lower() != "tba" and upc in upc_map:
            match_idx = upc_map[upc]
        else:
            norm_t = normalize_title(title)
            if norm_t in title_map:
                match_idx = title_map[norm_t]

        if match_idx is not None:
            # Update existing record with verified official DU details
            existing_data[match_idx].update({k: v for k, v in entry.items() if v})
            updated_count += 1
        else:
            # Append new record
            existing_data.append(entry)
            new_idx = len(existing_data) - 1
            if upc and upc.lower() != "tba":
                upc_map[upc] = new_idx
            title_map[normalize_title(title)] = new_idx
            added_count += 1

    print(f"Merge Complete! Added: {added_count}, Updated: {updated_count}, Total now: {len(existing_data)}")

    # Write back to web_app/exam_codes_data.json
    with open("web_app/exam_codes_data.json", "w", encoding="utf-8") as f:
        json.dump(existing_data, f, indent=2, ensure_ascii=False)

    # Write to web_app/exam_codes_data.js
    with open("web_app/exam_codes_data.js", "w", encoding="utf-8") as f:
        f.write("window.SRCC_EXAM_CODES_DATA = window.EXAM_CODES_DATA = ")
        json.dump(existing_data, f, indent=2, ensure_ascii=False)
        f.write(";\n")

if __name__ == "__main__":
    main()
