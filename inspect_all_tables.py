import re
import json

files = {
    "Commerce": r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\35\content.md",
    "Economics": r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\59\content.md",
    "SEC": r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\61\content.md",
    "VAC": r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\63\content.md",
    "AEC": r"C:\Users\anand_fua08yg\.gemini\antigravity-ide\brain\2f48afdf-7774-4cea-8570-03ad1c987d30\.system_generated\steps\65\content.md"
}

vac_path = files["VAC"]
with open(vac_path, 'r', encoding='utf-8', errors='ignore') as f:
    vac_text = f.read()

print("\n--- Inspecting VAC ---")
import re
lines = [l.strip() for l in vac_text.split('\n') if l.strip()]
print(f"Total non-empty lines in VAC: {len(lines)}")
# Find occurrences of UPC or Course in VAC
for idx, l in enumerate(lines):
    if any(k in l.lower() for k in ['upc', 'value addition', 'vac', 'course', 'credit']):
        if len(l) < 200:
            print(f"L{idx}: {l}")
        if idx > 300:
            break

