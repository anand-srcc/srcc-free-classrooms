import os
import pypdf

OUTPUT_DIR = os.path.abspath('SRCC_Printable_Timetables')
BOOKLET_DIR = os.path.join(OUTPUT_DIR, 'Combined_Booklets')
os.makedirs(BOOKLET_DIR, exist_ok=True)

# Helper to merge a list of filepaths
def merge_pdfs(out_filename, file_paths):
    writer = pypdf.PdfWriter()
    added = 0
    for p in file_paths:
        if os.path.exists(p) and os.path.getsize(p) > 1000:
            try:
                writer.append(p)
                added += 1
            except Exception as e:
                print(f"Error appending {p}: {e}")
    if added > 0:
        out_path = os.path.join(BOOKLET_DIR, out_filename)
        with open(out_path, 'wb') as f:
            writer.write(f)
        writer.close()
        size_kb = os.path.getsize(out_path) // 1024
        print(f"Created Booklet: {out_filename} ({added} timetables, {size_kb} KB)")
        return out_path
    return None

bcom_sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
eco_sections = ['A', 'B', 'C', 'D']

# 1. B.Com Sem 1 Booklet
bcom_sem1 = [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_1', f'BCom_Sem1_Sec_{s}.pdf') for s in bcom_sections]
merge_pdfs('BCom_Sem1_All_Sections.pdf', bcom_sem1)

# 2. B.Com Sem 2 Booklet
bcom_sem2 = [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_2', f'BCom_Sem2_Sec_{s}.pdf') for s in bcom_sections]
merge_pdfs('BCom_Sem2_All_Sections.pdf', bcom_sem2)

# 3. B.Com Sem 3 Booklet
bcom_sem3 = [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_3', f'BCom_Sem3_Sec_{s}.pdf') for s in bcom_sections]
merge_pdfs('BCom_Sem3_All_Sections.pdf', bcom_sem3)

# 4. B.Com Sem 5 Booklet
bcom_sem5 = [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_5', f'BCom_Sem5_Sec_{s}.pdf') for s in bcom_sections]
merge_pdfs('BCom_Sem5_All_Sections.pdf', bcom_sem5)

# 5. B.Com Sem 7 Booklet
bcom_sem7 = [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_7', f'BCom_Sem7_Sec_{s}.pdf') for s in bcom_sections]
merge_pdfs('BCom_Sem7_All_Sections.pdf', bcom_sem7)

# 6. B.A. Eco Sem 1 Booklet
eco_sem1 = [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_1', f'BA_Eco_Sem1_Sec_{s}.pdf') for s in eco_sections]
merge_pdfs('BA_Eco_Sem1_All_Sections.pdf', eco_sem1)

# 7. B.A. Eco Sem 2 Booklet
eco_sem2 = [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_2', f'BA_Eco_Sem2_Sec_{s}.pdf') for s in eco_sections]
merge_pdfs('BA_Eco_Sem2_All_Sections.pdf', eco_sem2)

# 8. B.A. Eco Sem 3 Booklet
eco_sem3 = [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_3', f'BA_Eco_Sem3_Sec_{s}.pdf') for s in eco_sections]
merge_pdfs('BA_Eco_Sem3_All_Sections.pdf', eco_sem3)

# 9. B.A. Eco Sem 5 Booklet
eco_sem5 = [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_5', f'BA_Eco_Sem5_Sec_{s}.pdf') for s in eco_sections]
merge_pdfs('BA_Eco_Sem5_All_Sections.pdf', eco_sem5)

# 10. B.A. Eco Sem 7 Booklet
eco_sem7 = [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_7', f'BA_Eco_Sem7_Sec_{s}.pdf') for s in eco_sections]
merge_pdfs('BA_Eco_Sem7_All_Sections.pdf', eco_sem7)

# 11. SEC / VAC Joint Booklet
sec_vac = [os.path.join(OUTPUT_DIR, 'SEC_VAC_Joint', f'SEC_VAC_Joint_Sem{s}.pdf') for s in [1, 3, 5]]
merge_pdfs('SEC_VAC_All_Semesters.pdf', sec_vac)

# 12. Master Active Timetables Booklet (All Active Odd Semesters: Sem 1, 3, 5, 7)
active_all = (
    bcom_sem1 + bcom_sem3 + bcom_sem5 + [os.path.join(OUTPUT_DIR, 'BCom_Hons', 'Semester_7', 'BCom_Sem7_Sec_A.pdf')] +
    eco_sem1 + eco_sem3 + eco_sem5 + [os.path.join(OUTPUT_DIR, 'BA_Economics', 'Semester_7', 'BA_Eco_Sem7_Sec_A.pdf')] +
    sec_vac
)
merge_pdfs('SRCC_Complete_Active_Timetables_Booklet.pdf', active_all)

# Clean up _temp_html if exists
temp_html = os.path.join(OUTPUT_DIR, '_temp_html')
if os.path.exists(temp_html):
    for f in os.listdir(temp_html):
        try:
            os.remove(os.path.join(temp_html, f))
        except Exception:
            pass
    try:
        os.rmdir(temp_html)
    except Exception:
        pass

print("\nAll Combined Booklets generated successfully!")
