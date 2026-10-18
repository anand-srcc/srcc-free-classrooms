import os
import json
import shutil

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(ROOT_DIR, "web_app")
DOWNLOADS_DIR = r"C:\Users\anand_fua08yg\Downloads\github_upload_srcc\web_app"

DATA_FILES = [
    ("exam_codes_data.json", "exam_codes_data.js", "window.SRCC_EXAM_CODES_DATA = window.EXAM_CODES_DATA = "),
    ("classes_data.json", "classes_data.js", "window.SRCC_CLASSES_DATA = "),
    ("teachers_data.json", "teachers_data.js", "window.SRCC_TEACHERS_DATA = "),
    ("srcc_data.json", "data.js", "window.SRCC_DATA = "),
    ("college_notices.json", "college_notices.js", "window.SRCC_NOTICES_DATA = "),
    ("faculty_leaves.json", "faculty_leaves.js", "window.SRCC_LEAVES_DATA = "),
    ("wifi_data.json", "wifi_data.js", "window.SRCC_WIFI_DATA = "),
    ("campus_map_data.json", None, None),
    ("directory_data.json", None, None),
    ("widget_feed.json", None, None)
]

def main():
    print("=" * 60)
    print("[INFO] VERIFYING & SYNCHRONIZING ALL LOCALHOST DATASETS")
    print("=" * 60)
    
    summary = []

    for json_name, js_name, js_prefix in DATA_FILES:
        json_path = os.path.join(WEB_APP_DIR, json_name)
        if not os.path.exists(json_path):
            print(f"[WARN] Missing: {json_path}")
            continue
        
        file_size = os.path.getsize(json_path)
        item_count = "N/A"
        
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                content = json.load(f)
                if isinstance(content, list):
                    item_count = len(content)
                elif isinstance(content, dict):
                    item_count = len(content.keys())
        except Exception as e:
            item_count = f"Error: {e}"

        # Ensure companion .js is generated and synced if needed
        if js_name and js_prefix:
            js_path = os.path.join(WEB_APP_DIR, js_name)
            # Re-generate from .json to ensure 100% synchronization
            with open(json_path, "r", encoding="utf-8") as f:
                data_obj = json.load(f)
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(js_prefix)
                json.dump(data_obj, f, indent=2, ensure_ascii=False)
                f.write(";\n")
            js_size = os.path.getsize(js_path)
            summary.append((json_name, js_name, item_count, file_size, js_size))
        else:
            summary.append((json_name, "N/A", item_count, file_size, 0))

        # Copy to root if applicable
        root_json = os.path.join(ROOT_DIR, json_name)
        shutil.copy2(json_path, root_json)
        if js_name:
            root_js = os.path.join(ROOT_DIR, js_name)
            shutil.copy2(os.path.join(WEB_APP_DIR, js_name), root_js)

        # Copy to downloads folder if it exists
        if os.path.exists(DOWNLOADS_DIR):
            shutil.copy2(json_path, os.path.join(DOWNLOADS_DIR, json_name))
            if js_name:
                shutil.copy2(os.path.join(WEB_APP_DIR, js_name), os.path.join(DOWNLOADS_DIR, js_name))

    print(f"\n{'JSON File':<25} | {'JS File':<20} | {'Items':<10} | {'JSON Size':<10} | {'JS Size':<10}")
    print("-" * 85)
    for j_name, s_name, count, j_sz, s_sz in summary:
        print(f"{j_name:<25} | {s_name:<20} | {str(count):<10} | {j_sz / 1024:.1f} KB    | {s_sz / 1024:.1f} KB")

    print("\n[SUCCESS] All data files synchronized and saved locally on localhost across web_app, root, and distribution directories!")

if __name__ == "__main__":
    main()
