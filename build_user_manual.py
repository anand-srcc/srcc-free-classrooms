import os
import subprocess
import base64

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
ASSETS_DIR = os.path.join(ROOT_DIR, "manual_assets")
WEB_APP_DIR = os.path.join(ROOT_DIR, "web_app")

def to_base64_img(filepath):
    if not os.path.exists(filepath):
        print(f"Warning: image not found at {filepath}")
        return ""
    ext = os.path.splitext(filepath)[1].lower().replace('.', '')
    mime = "image/png" if ext == "png" else "image/jpeg"
    with open(filepath, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"

# Logos
logo_100years = to_base64_img(os.path.join(WEB_APP_DIR, "assets", "srcc_100years.png"))
if not logo_100years:
    logo_100years = to_base64_img(os.path.join(ROOT_DIR, "centenary_official.png"))

logo_crest = to_base64_img(os.path.join(WEB_APP_DIR, "assets", "srcc_crest.png"))
if not logo_crest:
    logo_crest = to_base64_img(os.path.join(ROOT_DIR, "srcc_crest_official.png"))

# Figures 1 to 19
fig1 = to_base64_img(os.path.join(ASSETS_DIR, "fig1_landing_page.png"))
fig2 = to_base64_img(os.path.join(ASSETS_DIR, "fig2_pwa_install.png"))
fig3 = to_base64_img(os.path.join(ASSETS_DIR, "fig3_category_pb.png"))
fig4 = to_base64_img(os.path.join(ASSETS_DIR, "fig4_free_now.png"))
fig5 = to_base64_img(os.path.join(ASSETS_DIR, "fig5_room_modal.png"))
fig6 = to_base64_img(os.path.join(ASSETS_DIR, "fig6_calendar_reminder.png"))
fig7 = to_base64_img(os.path.join(ASSETS_DIR, "fig7_faculty_directory.png"))
fig8 = to_base64_img(os.path.join(ASSETS_DIR, "fig8_faculty_email.png"))
fig9 = to_base64_img(os.path.join(ASSETS_DIR, "fig9_teacher_modal.png"))
fig10 = to_base64_img(os.path.join(ASSETS_DIR, "fig10_leaves_modal.png"))
fig11 = to_base64_img(os.path.join(ASSETS_DIR, "fig11_student_timetable.png"))
fig12 = to_base64_img(os.path.join(ASSETS_DIR, "fig12_college_notices.png"))
fig13 = to_base64_img(os.path.join(ASSETS_DIR, "fig13_notice_attachment.png"))
fig14 = to_base64_img(os.path.join(ASSETS_DIR, "fig14_exam_codes.png"))
fig15 = to_base64_img(os.path.join(ASSETS_DIR, "fig15_campus_drawer.png"))
fig16 = to_base64_img(os.path.join(ASSETS_DIR, "fig16_class_notifications.png"))
fig17 = to_base64_img(os.path.join(ASSETS_DIR, "fig17_share_modal.png"))
fig18 = to_base64_img(os.path.join(ASSETS_DIR, "fig18_report_issue.png"))
fig19 = to_base64_img(os.path.join(ASSETS_DIR, "fig19_widget_preview.png"))

TOTAL_PAGES = 15

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SRCC Free Classroom Finder & Student Academic Portal - User Manual</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');

@page {{
    size: A4 portrait;
    margin: 15mm 18mm 16mm 18mm;
    @top-center {{ content: ""; }}
    @bottom-center {{ content: ""; }}
}}

* {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
}}

html, body {{
    margin: 0;
    padding: 0;
    font-family: 'Lora', 'Georgia', 'Times New Roman', serif;
    color: #1a1a1a;
    background: #ffffff;
    font-size: 9.7pt;
    line-height: 1.44;
}}

.page {{
    width: 100%;
    height: 260mm;
    max-height: 260mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 1.5mm;
    overflow: hidden;
    box-sizing: border-box;
}}

.page:last-child {{
    page-break-after: avoid;
    break-after: avoid;
}}

/* Top running header on pages 2-15 */
.running-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 7.6pt;
    color: #4b5563;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
    border-bottom: 0.5px solid #cbd5e1;
}}

.running-header .left {{ font-weight: 600; color: #0f2b5c; }}
.running-header .center {{ font-weight: 500; }}
.running-header .right {{ font-weight: 600; color: #2563eb; }}

/* Page footer */
.page-footer {{
    text-align: center;
    font-family: 'Lora', serif;
    font-size: 8.4pt;
    color: #64748b;
    padding-top: 2mm;
    border-top: 0.5px solid #e2e8f0;
    margin-top: auto;
}}

/* Headings */
h1, h2, h3, h4 {{
    font-family: 'Lora', 'Georgia', serif;
    color: #111827;
    margin: 0 0 1.8mm 0;
    font-weight: 700;
}}

.section-title {{
    font-size: 12.2pt;
    font-weight: 700;
    color: #0f2b5c;
    margin-top: 1.2mm;
    margin-bottom: 1.8mm;
    letter-spacing: -0.2px;
}}

.subsection-title {{
    font-size: 10.2pt;
    font-weight: 700;
    color: #1e3a8a;
    margin-top: 1.8mm;
    margin-bottom: 1.3mm;
}}

p {{
    margin: 0 0 1.8mm 0;
    text-align: justify;
    text-justify: inter-word;
    font-size: 9.6pt;
    line-height: 1.42;
}}

ul, ol {{
    margin: 0 0 1.8mm 0;
    padding-left: 5mm;
    font-size: 9.2pt;
    line-height: 1.38;
}}

li {{
    margin-bottom: 0.8mm;
}}

a {{
    color: #1e40af;
    text-decoration: underline;
}}

/* Figure container */
.figure-container {{
    text-align: center;
    margin: 1.5mm auto 2mm auto;
}}

.figure-box {{
    display: inline-block;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    background: #ffffff;
}}

.figure-img-single {{
    display: block;
    width: 250px;
    height: auto;
    max-height: 98mm;
    object-fit: contain;
    margin: 0 auto;
}}

.figure-caption {{
    font-family: 'Lora', serif;
    font-size: 8.5pt;
    font-weight: 600;
    color: #1e293b;
    margin-top: 1.5mm;
    text-align: center;
}}

/* Two Figures Side-by-Side */
.figures-row {{
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 6mm;
    margin: 1.5mm auto 1.5mm auto;
}}

.figure-col {{
    flex: 1;
    text-align: center;
    max-width: 210px;
}}

.figure-img-dual {{
    display: block;
    width: 100%;
    height: auto;
    max-height: 85mm;
    object-fit: contain;
}}

/* Highlights & Badges */
.highlight-box {{
    background: #f8fafc;
    border-left: 3.5px solid #1e40af;
    padding: 2.2mm 3.2mm;
    margin: 1.8mm 0 2.4mm 0;
    border-radius: 0 6px 6px 0;
    font-size: 9.2pt;
    line-height: 1.38;
}}

.badge-pill {{
    display: inline-block;
    background: #dbeafe;
    color: #1e40af;
    font-family: 'Inter', sans-serif;
    font-size: 7.8pt;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
}}

/* ================= PAGE 1 COVER SPECIFIC ================= */
.cover-header {{
    display: flex;
    justify-content: space-between;
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    color: #4b5563;
    padding-bottom: 2mm;
}}

.cover-body {{
    text-align: center;
    padding-top: 6mm;
}}

.cover-crest-wrap {{
    margin-bottom: 5mm;
}}

.cover-crest-img {{
    width: 120px;
    height: auto;
}}

.cover-institution {{
    font-family: 'Cinzel', 'Times New Roman', serif;
    font-size: 19.5pt;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 0.8px;
    margin-bottom: 2mm;
}}

.cover-accreditation {{
    font-family: 'Lora', serif;
    font-size: 10.8pt;
    color: #334155;
    margin-bottom: 1.2mm;
}}

.cover-iso {{
    font-family: 'Lora', serif;
    font-size: 9.2pt;
    color: #475569;
    margin-bottom: 5mm;
}}

.cover-divider {{
    width: 100%;
    height: 1.2px;
    background: #0f2b5c;
    margin: 0 auto 6mm auto;
}}

.cover-doc-title {{
    font-family: 'Lora', serif;
    font-size: 23pt;
    font-weight: 700;
    color: #0f2b5c;
    letter-spacing: 0.5px;
    margin-bottom: 2mm;
    text-transform: uppercase;
}}

.cover-doc-subtitle {{
    font-family: 'Lora', serif;
    font-size: 11pt;
    font-style: italic;
    color: #334155;
    margin-bottom: 5mm;
    padding: 0 10mm;
}}

.cover-edition {{
    font-family: 'Lora', serif;
    font-size: 10.2pt;
    font-style: italic;
    color: #475569;
    margin-bottom: 1mm;
}}

.cover-manual-type {{
    font-family: 'Lora', serif;
    font-size: 11pt;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: #1e293b;
    margin-bottom: 1mm;
}}

.cover-version {{
    font-family: 'Lora', serif;
    font-size: 10.2pt;
    color: #334155;
    margin-bottom: 1mm;
}}

.cover-month-year {{
    font-family: 'Lora', serif;
    font-size: 10.2pt;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #1e293b;
    margin-bottom: 4mm;
}}

.cover-url {{
    font-family: 'JetBrains Mono', monospace;
    font-size: 10pt;
    font-weight: 700;
    color: #1d4ed8;
    margin-bottom: 6mm;
}}

.cover-authors-box {{
    text-align: left;
    margin: 0 auto 4mm 5mm;
    font-size: 9.5pt;
    line-height: 1.45;
}}

.cover-developed-box {{
    text-align: left;
    margin: 0 auto 3.5mm 5mm;
    font-size: 9.5pt;
    line-height: 1.4;
}}

.cover-feedback-box {{
    text-align: center;
    font-size: 9.2pt;
    color: #334155;
    margin-top: 3.5mm;
}}

/* ================= PAGE 2 TOC SPECIFIC ================= */
.toc-section-title {{
    font-size: 11pt;
    font-weight: 700;
    color: #0f2b5c;
    margin-bottom: 1.5mm;
}}

.toc-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.1pt;
    margin-bottom: 2mm;
}}

.toc-table td {{
    padding: 0.45mm 0;
    vertical-align: bottom;
}}

.toc-name {{
    white-space: nowrap;
    padding-right: 2mm;
}}

.toc-dots {{
    width: 100%;
    border-bottom: 1px dotted #9ca3af;
    position: relative;
    top: -3px;
}}

.toc-page {{
    white-space: nowrap;
    text-align: right;
    padding-left: 2mm;
    font-weight: 600;
    color: #1e3a8a;
}}
</style>
</head>
<body>

<!-- ==========================================================================
     PAGE 1: COVER PAGE
     ========================================================================== -->
<div class="page" id="page-1">
  <div class="cover-header">
    <span>SRCC Free Classroom Finder</span>
    <span>Student Manual &amp; Academic Guide</span>
    <span>Version 2.0</span>
  </div>

  <div class="cover-body">
    <div class="cover-crest-wrap">
      <img src="{logo_100years}" class="cover-crest-img" alt="SRCC Centenary Logo" />
    </div>

    <div class="cover-doc-title">SRCC FREE CLASSROOM FINDER</div>
    <div class="cover-doc-subtitle">A student academic navigation portal for vacant classrooms, daily batch schedules, faculty directories, official college notices, DU exam codes, and timetable notifications.</div>

    <div class="cover-divider"></div>

    <div class="cover-manual-type">USER MANUAL FOR STUDENTS</div>
    <div class="cover-version">Comprehensive Student Edition · Academic Year 2026–2027</div>
    <div class="cover-month-year">OCTOBER 2026</div>

    <div class="cover-url" style="margin-bottom: 5mm;">
      <a href="https://anand-srcc.github.io/srcc-free-classrooms/web_app/" style="color: #1d4ed8; text-decoration: none; font-weight: 700; font-size: 10.5pt;">https://anand-srcc.github.io/srcc-free-classrooms/web_app/</a>
    </div>

    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 4.5mm 6mm; text-align: left; margin: 0 auto; max-width: 155mm; line-height: 1.5;">
      <div style="font-size: 10.2pt; font-weight: 700; color: #0f2b5c; margin-bottom: 1.5mm;">Project Lead &amp; Developer:</div>
      <div style="font-size: 9.6pt; color: #1e293b;">
        <strong>Anand Kumar</strong> · Student, B.Com. (Hons.), Roll No. <strong>25BC070</strong><br>
        Shri Ram College of Commerce, University of Delhi<br>
        <span style="font-size: 9.2pt; color: #0284c7;">🔗 LinkedIn: <a href="https://www.linkedin.com/in/anandkumar563/" style="color: #0284c7; text-decoration: none; font-weight: 600;">linkedin.com/in/anandkumar563</a></span>
      </div>
    </div>

    <div class="cover-feedback-box" style="margin-top: 5mm;">
      Student Community Network &amp; Helpdesk: <a href="https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf" style="color: #16a34a; font-weight: 700; text-decoration: none;">SRCC Free Classrooms WhatsApp Group</a>
    </div>
  </div>

  <div class="page-footer">Page 1 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 2: TABLE OF CONTENTS & LIST OF FIGURES
     ========================================================================== -->
<div class="page" id="page-2">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="toc-section-title">Sections:</div>
    <table class="toc-table">
      <tr><td class="toc-name">1. About SRCC Free Classroom Finder &amp; Architecture</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">2. Access and Progressive Web App (PWA) Setup</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">3. PWA Installation on Android &amp; iOS Devices</td><td><div class="toc-dots"></div></td><td class="toc-page">4</td></tr>
      <tr><td class="toc-name">4. Navigation Drawer &amp; Campus Student Portal Menu</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">5. Classroom Vacancy Locator &amp; Wing Filtering</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">6. "Free Right Now" Real-Time Quick-Toggle &amp; Lunch Recess</td><td><div class="toc-dots"></div></td><td class="toc-page">6</td></tr>
      <tr><td class="toc-name">7. Room Occupancy Timeline Modal (9-Period Breakdown)</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">8. Group Study Coordination &amp; Calendar Reminders</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">9. Faculty Locator &amp; Teacher Directory (210 Faculty)</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">10. Faculty Contact Details &amp; Verified DU Email Copy</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">11. Faculty Weekly Timetable &amp; Profile Share</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">12. Recorded Faculty Leaves &amp; Bonus Free Rooms</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">13. Student Academic Timetable Explorer</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">14. 10-Minute Class Alerts (Students &amp; Faculty)</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">15. SRCC Notices &amp; Deadlines Hub</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">16. Notice Attachment &amp; PDF Circular Viewer</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">17. Official DU Examination Codes &amp; Course UPC Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">12</td></tr>
      <tr><td class="toc-name">18. Social Media Direct Share Modal</td><td><div class="toc-dots"></div></td><td class="toc-page">13</td></tr>
      <tr><td class="toc-name">19. Android Interactive Home Screen Widgets &amp; APK</td><td><div class="toc-dots"></div></td><td class="toc-page">13</td></tr>
      <tr><td class="toc-name">20. Offline Support, Keyboard Shortcuts &amp; In-App Issue Reporting</td><td><div class="toc-dots"></div></td><td class="toc-page">14</td></tr>
      <tr><td class="toc-name">Disclaimer</td><td><div class="toc-dots"></div></td><td class="toc-page">15</td></tr>
      <tr><td class="toc-name">Feedback &amp; Community Support</td><td><div class="toc-dots"></div></td><td class="toc-page">15</td></tr>
    </table>

    <div class="toc-section-title" style="margin-top: 2.5mm;">Figures:</div>
    <table class="toc-table">
      <tr><td class="toc-name">1. Portal Landing Page &amp; Top Branding on Mobile Web</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">2. PWA Installation &amp; Add to Home Screen Prompt</td><td><div class="toc-dots"></div></td><td class="toc-page">4</td></tr>
      <tr><td class="toc-name">3. Campus Navigation Drawer ("SRCC Student Portal")</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">4. Classroom Category Filtering &amp; Vacant Room Cards</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">5. "Free Right Now" Real-Time Quick-Toggle Active</td><td><div class="toc-dots"></div></td><td class="toc-page">6</td></tr>
      <tr><td class="toc-name">6. Room Occupancy Timeline Modal (9-Period Breakdown)</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">7. Group Study Reminder &amp; WhatsApp GD Invite Generator</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">8. Faculty Locator &amp; Department Search Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">9. Faculty Contact Details &amp; Verified DU Email Copy Chip</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">10. Faculty Weekly Timetable Modal &amp; Room Jump</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">11. Recorded Faculty Leaves &amp; Bonus Free Rooms Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">12. Student Academic Timetable Schedule Explorer</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">13. 10-Minute Class &amp; Faculty Alerts Configuration</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">14. SRCC Official Notices Hub</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">15. In-App Notice Attachment &amp; PDF Circular Viewer</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">16. Official DU Examination Codes &amp; UPC Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">12</td></tr>
      <tr><td class="toc-name">17. Social Media Direct Share Modal</td><td><div class="toc-dots"></div></td><td class="toc-page">13</td></tr>
      <tr><td class="toc-name">18. Standalone Schedule Widget &amp; Android Home Screen Setup</td><td><div class="toc-dots"></div></td><td class="toc-page">13</td></tr>
      <tr><td class="toc-name">19. In-App Issue Reporting &amp; Timetable Discrepancy Modal</td><td><div class="toc-dots"></div></td><td class="toc-page">14</td></tr>
    </table>
  </div>

  <div class="page-footer">Page 2 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 3: ABOUT & ACCESS
     ========================================================================== -->
<div class="page" id="page-3">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">1. About SRCC Free Classroom Finder &amp; Architecture</div>
    <p>
      The <strong>SRCC Free Classroom Finder &amp; Student Academic Portal</strong> is a high-performance web platform built to solve daily academic coordination challenges at Shri Ram College of Commerce: finding available classrooms for <strong>Group Discussions (GD)</strong>, case study competitions, tutorial revisions, society meetings, and self-study.
    </p>
    <p>
      Covering all <strong>96 instructional rooms</strong> across the campus (including Main Building lecture halls, Tutorial wings, Principal Bungalow, Sports Complex, and Computer Labs) and tracking <strong>210 faculty schedules</strong> across 9 daily periods, the platform synthesizes complex scheduling information into an intuitive, real-time portal. Timetable data is synchronized directly from the official college timetable portal (<a href="https://srcccollegetimetable.in/">srcccollegetimetable.in</a>), guaranteeing verified accuracy.
    </p>
    <p>
      The platform operates with zero required logins, instant loading, complete offline capability, and progressive web app (PWA) installation for Android and iOS smartphones.
    </p>

    <div class="section-title">2. Access and Progressive Web App (PWA) Setup</div>
    <p>
      The portal can be accessed directly from any modern web browser on desktop, tablet, or smartphone devices:
    </p>
    <p style="text-align: center; margin: 1.5mm 0 2.5mm 0;">
      <strong>Website URL:</strong> <a href="https://anand-srcc.github.io/srcc-free-classrooms/web_app/">https://anand-srcc.github.io/srcc-free-classrooms/web_app/</a>
    </p>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig1}" class="figure-img-single" alt="Figure 1: Portal Landing Page on Mobile Web" />
      </div>
      <div class="figure-caption">Figure 1: Portal Landing Page &amp; Top Branding on Mobile Web</div>
    </div>
  </div>

  <div class="page-footer">Page 3 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 4: INSTALLATION (PWA, ANDROID APK & IOS)
     ========================================================================== -->
<div class="page" id="page-4">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">3. PWA Installation on Android &amp; iOS Devices</div>
    <p>
      Installing the application directly to your mobile home screen provides an app-like fullscreen experience, instant offline caching, and faster load times without requiring an app store account.
    </p>

    <p><strong>For Android Devices (Google Chrome / Brave / Edge):</strong></p>
    <ol>
      <li>Open the website in your browser: <a href="https://anand-srcc.github.io/srcc-free-classrooms/web_app/">https://anand-srcc.github.io/srcc-free-classrooms/web_app/</a>.</li>
      <li>Tap the <strong>"Install SRCC Rooms"</strong> prompt banner that appears at the bottom of the screen, or tap the three dots (<strong>⋮</strong>) in the top-right corner of your browser.</li>
      <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
      <li>Tap <strong>Install</strong> to confirm. The official centenary icon will appear on your device launcher.</li>
    </ol>

    <p><strong>For iOS Devices (Apple Safari):</strong></p>
    <ol>
      <li>Open the portal URL in <strong>Safari</strong>.</li>
      <li>Tap the <strong>Share</strong> button (box with an upward arrow) at the bottom toolbar.</li>
      <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
      <li>Tap <strong>Add</strong> in the top-right corner. The app icon will be pinned to your home screen.</li>
    </ol>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig2}" class="figure-img-single" alt="Figure 2: PWA Installation Prompt" />
      </div>
      <div class="figure-caption">Figure 2: PWA Installation &amp; Add to Home Screen Prompt</div>
    </div>
  </div>

  <div class="page-footer">Page 4 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 5: CAMPUS DRAWER & CLASSROOM VACANCY LOCATOR
     ========================================================================== -->
<div class="page" id="page-5">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">4. Navigation Drawer &amp; Campus Student Portal Menu</div>
    <p>
      Tapping the responsive menu button (three vertical dots on desktop, hamburger bars on mobile) opens the slide-out <strong>Campus Navigation Drawer</strong>. It acts as the central academic hub, connecting students directly to <strong>SRCC Notices</strong>, <strong>DU Exam Codes</strong>, and <strong>10-Min Class Alerts</strong> (supporting both Students and Faculty).
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig15}" class="figure-img-dual" alt="Figure 3: Campus Navigation Drawer" />
        </div>
        <div class="figure-caption">Figure 3: Campus Drawer Menu</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig3}" class="figure-img-dual" alt="Figure 4: Classroom Category Filtering" />
        </div>
        <div class="figure-caption">Figure 4: Room Cards Overview</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">5. Classroom Vacancy Locator &amp; Wing Filtering</div>
    <p>
      The <strong>Classrooms</strong> tab scans all 96 college rooms across the campus. Students can filter rooms by architectural wing using Category Pills: <strong>All Rooms (96)</strong>, <strong>Principal Bungalow (PB)</strong>, <strong>Tutorial Rooms (T)</strong>, <strong>Sports Complex (SCR)</strong>, <strong>Classrooms (R)</strong>, and <strong>Computer Labs (CL)</strong>. The <strong>Day Picker</strong> allows instant switching between Monday and Saturday.
    </p>
  </div>

  <div class="page-footer">Page 5 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 6: FREE RIGHT NOW & LUNCH RECESS
     ========================================================================== -->
<div class="page" id="page-6">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">6. "Free Right Now" Real-Time Quick-Toggle &amp; Lunch Recess</div>
    <p>
      Located directly in the header strip, the <strong>⚡ Free Right Now</strong> switch automatically detects the current college period based on device clock time. Flipping the toggle to <strong>ON</strong> instantly filters out all occupied rooms, presenting only rooms that are vacant right at this moment.
    </p>
    <ul>
      <li><strong>Clock-Synchronized Detection:</strong> Seamlessly transitions between Periods 1 through 9.</li>
      <li><strong>Immediate Availability:</strong> Room cards indicate how long the room remains empty (e.g., <em>"Vacant until 1:30 PM"</em>).</li>
      <li><strong>One-Tap Reset:</strong> Switching off restores the complete 9-period daily schedule overview.</li>
    </ul>

    <div class="highlight-box">
      <strong>☕ Universal Lunch Recess (1:30 PM – 2:00 PM):</strong> During recess, the platform dynamically displays an amber notification banner confirming that all 96 classrooms and tutorial rooms are universally available for group discussion and lunch.
    </div>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig4}" class="figure-img-single" alt="Figure 5: Free Right Now Quick-Toggle Active" />
      </div>
      <div class="figure-caption">Figure 5: "Free Right Now" Real-Time Quick-Toggle Active</div>
    </div>
  </div>

  <div class="page-footer">Page 6 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 7: ROOM MODAL & CALENDAR REMINDERS
     ========================================================================== -->
<div class="page" id="page-7">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">7. Room Occupancy Timeline Modal (9-Period Breakdown)</div>
    <p>
      Tapping any room card opens the <strong>Room Occupancy Timeline Modal</strong>, presenting a complete chronological table of all 9 periods for that room. Occupied slots display the subject, course semester, section, and scheduled professor (with 1-tap link to their profile). Vacant slots are highlighted in bold green (<strong>Empty / Free for GD</strong>).
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig5}" class="figure-img-dual" alt="Figure 6: Room Occupancy Timeline Modal" />
        </div>
        <div class="figure-caption">Figure 6: Room Schedule Timeline</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig6}" class="figure-img-dual" alt="Figure 7: Group Study Reminder" />
        </div>
        <div class="figure-caption">Figure 7: Calendar Alert Modal</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">8. Group Study Coordination &amp; Calendar Reminders</div>
    <p>
      Tapping the calendar icon next to any free period opens the <strong>Group Study Reminder Modal</strong>. It provides a direct <strong>Google Calendar link</strong> (with preconfigured 15-minute advance alert), an <strong>Apple / Outlook <code>.ics</code> file</strong>, and a 1-tap formatted <strong>WhatsApp GD Invite</strong> generator.
    </p>
  </div>

  <div class="page-footer">Page 7 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 8: FACULTY LOCATOR & CONTACT DETAILS
     ========================================================================== -->
<div class="page" id="page-8">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">9. Faculty Locator &amp; Teacher Directory (210 Faculty)</div>
    <p>
      Switching to the <strong>Faculty tab</strong> opens the directory of all 210 faculty members across Commerce, Economics, Mathematics, Computer Science, Political Science, EVS, Hindi, English, and Physical Education. Students can filter by department, search by name or teacher code, or use the <strong>Live Status Filter</strong> (<em>Teaching Right Now</em>, <em>Available Now</em>, or <em>On Leave Today</em>).
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig7}" class="figure-img-dual" alt="Figure 8: Faculty Directory" />
        </div>
        <div class="figure-caption">Figure 8: Faculty Directory Search</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig8}" class="figure-img-dual" alt="Figure 9: Faculty Contact Details" />
        </div>
        <div class="figure-caption">Figure 9: Faculty Verified Email Modal</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">10. Faculty Contact Details &amp; Verified DU Email Copy</div>
    <p>
      Tapping the email button on any teacher card opens the dedicated <strong>Faculty Contact Modal</strong>. It presents the professor's official verified University of Delhi email (<code>@srcc.du.ac.in</code>), teacher code, and department. The <strong>"📋 Copy Email"</strong> chip copies the address with an instant confirmation toast, preventing typos and avoiding accidental external mail app launches.
    </p>
  </div>

  <div class="page-footer">Page 8 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 9: TEACHER TIMETABLE & FACULTY LEAVES
     ========================================================================== -->
<div class="page" id="page-9">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">11. Faculty Weekly Timetable &amp; Profile Share</div>
    <p>
      Tapping a teacher card opens their complete <strong>Weekly Timetable Modal</strong>. Students can review scheduled lectures, tutorial batches, and assigned room numbers from Monday to Saturday. Tapping any room number jumps directly to that room's vacancy card. The <strong>"📤 Share Faculty Profile"</strong> button creates a WhatsApp sharing link.
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig9}" class="figure-img-dual" alt="Figure 10: Faculty Weekly Timetable" />
        </div>
        <div class="figure-caption">Figure 10: Teacher Timetable Modal</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig10}" class="figure-img-dual" alt="Figure 11: Faculty Leaves Directory" />
        </div>
        <div class="figure-caption">Figure 11: Recorded Leaves Modal</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">12. Recorded Faculty Leaves &amp; Bonus Free Rooms</div>
    <p>
      When faculty members are on leave, their assigned classrooms sit empty. The <strong>Faculty Leaves module</strong> connects official absence notices directly with the Classroom Finder. Rooms scheduled under absent professors are dynamically unlocked as <strong>"Bonus Vacant Rooms"</strong> for self-study. The <strong>"💬 Share All List"</strong> button generates a clean summary for CRs and batch groups.
    </p>
  </div>

  <div class="page-footer">Page 9 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 10: STUDENT TIMETABLE & CLASS NOTIFICATIONS
     ========================================================================== -->
<div class="page" id="page-10">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">13. Student Academic Timetable Explorer</div>
    <p>
      The <strong>Timetable tab</strong> provides complete schedules across all programs: <strong>B.Com (Hons)</strong> (Sections A to N), <strong>B.A. (Hons) Economics</strong> (Sections A to D), and interdisciplinary <strong>SEC / VAC</strong> courses across Semesters I, III, V, and VII. Selecting your course, section, and batch renders daily lectures, teachers, and rooms in sequence.
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig11}" class="figure-img-dual" alt="Figure 12: Student Academic Timetable" />
        </div>
        <div class="figure-caption">Figure 12: Student Timetable Cards</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig16}" class="figure-img-dual" alt="Figure 13: Class Notification Modal" />
        </div>
        <div class="figure-caption">Figure 13: Class Alert Settings</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">14. 10-Minute Class Alerts for Students &amp; Faculty</div>
    <p>
      Accessed via the campus drawer or timetable view, the <strong>10-Minute Class Alerts</strong> modal allows both students and faculty members to configure automated reminders. Students receive notifications 10 minutes before their section's lectures with room numbers and faculty leave alerts. Faculty members can select their name and receive automated reminders 10 to 15 minutes before every scheduled lecture with their room number, course, semester, and section.
    </p>
  </div>

  <div class="page-footer">Page 10 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 11: COLLEGE NOTICES & ATTACHMENT VIEWER
     ========================================================================== -->
<div class="page" id="page-11">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">15. Official College Notices &amp; Circulars Hub</div>
    <p>
      The <strong>Notices tab</strong> provides a centralized stream of <strong>430+ public college circulars</strong> synchronized from <code>srcc.edu/announcements</code>. It includes real-time category filtering (<strong>📋 All Notices</strong> vs <strong>⏳ Active Deadlines</strong>), keyword search (Admit Card, Attendance, Orientation, ECA, Scholarship, Datesheet), and direct links to official documents.
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig12}" class="figure-img-dual" alt="Figure 14: College Notices Hub" />
        </div>
        <div class="figure-caption">Figure 14: College Notices Hub</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig13}" class="figure-img-dual" alt="Figure 15: Notice Attachment Viewer" />
        </div>
        <div class="figure-caption">Figure 15: In-App Circular Viewer</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">16. Notice Attachment &amp; PDF Circular Viewer</div>
    <p>
      Tapping any notice card opens the dedicated <strong>In-App Attachment Viewer</strong>. Students can review official circular text, administrative reference numbers, and download attached PDF documents or images directly without navigating through complex administrative menus.
    </p>
  </div>

  <div class="page-footer">Page 11 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 12: DU EXAM CODES & UPC DIRECTORY
     ========================================================================== -->
<div class="page" id="page-12">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">17. Official DU Examination Codes &amp; Course UPC Directory</div>
    <p>
      The <strong>DU Codes tab</strong> features an authoritative directory of <strong>450+ examination papers and Unique Paper Codes (UPC)</strong> structured under the University of Delhi <strong>NEP / UGCF 2022 framework</strong>. Sourced directly from official university records, this tool eliminates errors when filling out exam portal registration forms.
    </p>
    <ul>
      <li><strong>Semester Chips:</strong> Instant filtering across Semesters I through VIII.</li>
      <li><strong>Programme Selectors:</strong> Quick-filter by <em>SRCC Offered</em>, <em>B.Com. (Hons.)</em>, <em>B.A. (Hons.) Economics</em>, <em>SEC</em>, <em>VAC</em>, <em>AEC</em>, <em>GE</em>, <em>DSC</em>, and <em>DSE</em> courses.</li>
      <li><strong>Course Type Dropdown:</strong> Differentiates between Core, Generic Electives, Skill Enhancement, and Research tracks.</li>
      <li><strong>Direct Syllabi &amp; PDF Links:</strong> 1-tap access to DU Major/Minor degree rules, Commerce UGCF syllabi, and direct download of the Master UPC Directory PDF.</li>
    </ul>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig14}" class="figure-img-single" style="max-height: 98mm;" alt="Figure 16: DU Exam Codes Directory" />
      </div>
      <div class="figure-caption">Figure 16: Official DU Examination Codes &amp; Course UPC Directory</div>
    </div>
  </div>

  <div class="page-footer">Page 12 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 13: SOCIAL SHARE & WIDGETS
     ========================================================================== -->
<div class="page" id="page-13">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">18. Social Media Direct Share Modal</div>
    <p>
      When coordinating group discussions, students can share real-time room vacancy and GD invites directly via the <strong>Social Share Modal</strong>. Featuring official SVG brand buttons for <strong>WhatsApp</strong>, <strong>Gmail</strong>, <strong>X (Twitter)</strong>, <strong>Telegram</strong>, <strong>LinkedIn</strong>, <strong>Instagram</strong>, and <strong>Facebook</strong>, it also includes a 1-tap <strong>Copy Formatted Text</strong> button.
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig17}" class="figure-img-dual" alt="Figure 17: Social Media Share Modal" />
        </div>
        <div class="figure-caption">Figure 17: Social Share Modal</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig19}" class="figure-img-dual" alt="Figure 18: Standalone Widget Preview" />
        </div>
        <div class="figure-caption">Figure 18: Standalone Widget</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 2mm;">19. Android Interactive Home Screen Widgets &amp; APK</div>
    <p>
      Students desiring glanceable home screen access can utilize the <strong>Standalone Web Widget (<code>widget.html</code>)</strong> or the native Android APK package. Preconfigured widget sizes include the <strong>4x1 Next Class Pill</strong> (upcoming class, room, and teacher) and the <strong>4x2 Daily Timeline</strong> (scrollable daily lecture agenda).
    </p>
  </div>

  <div class="page-footer">Page 13 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 14: OFFLINE SUPPORT, SHORTCUTS & ISSUE REPORTING
     ========================================================================== -->
<div class="page" id="page-14">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">20. Offline Support, Keyboard Shortcuts &amp; In-App Issue Reporting</div>
    <p>
      The platform incorporates a Service Worker caching engine, ensuring the full timetable, room schedules, faculty lists, and exam codes remain functional even when cellular networks fail inside heritage blocks or basement labs. An offline pulse banner appears automatically when network connectivity is interrupted.
    </p>
    <ul>
      <li><strong>Keyboard Shortcuts (Desktop):</strong> Press <strong><code>/</code></strong> to immediately focus search bars; press <strong><code>Esc</code></strong> to close any active modal dialog.</li>
      <li><strong>View Mode Toggles:</strong> Switch between <strong>Grid Card View</strong> and <strong>Compact Table View</strong> across Classrooms, Faculty, Notices, and Exam Codes.</li>
      <li><strong>In-App Issue Reporting:</strong> The header <strong>⚠️ Report</strong> button enables students to flag timetable discrepancies, room swaps, or report present faculty marked absent for prompt verification.</li>
    </ul>

    <div class="highlight-box">
      <strong>📶 Campus Wi-Fi Status Notice:</strong> Campus Wi-Fi password directory display has been temporarily paused pending formal administrative authorization. Students can rely on complete offline caching and widget feeds in the interim.
    </div>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig18}" class="figure-img-single" style="max-height: 98mm;" alt="Figure 19: In-App Issue Reporting Modal" />
      </div>
      <div class="figure-caption">Figure 19: In-App Issue Reporting &amp; Timetable Discrepancy Modal</div>
    </div>
  </div>

  <div class="page-footer">Page 14 of {TOTAL_PAGES}</div>
</div>


<!-- ==========================================================================
     PAGE 15: DISCLAIMER & COMMUNITY SUPPORT
     ========================================================================== -->
<div class="page" id="page-15">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 2.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">Disclaimer</div>
    <p>
      The SRCC Free Classroom Finder &amp; Student Academic Portal is an independent student academic facilitation initiative developed to streamline classroom discovery, timetable navigation, and peer coordination. Class schedules and faculty assignments are sourced directly from the official Shri Ram College of Commerce timetable portal (<a href="https://srcccollegetimetable.in/">srcccollegetimetable.in</a>).
    </p>
    <p>
      This platform does not supersede official college notifications, room requisition circulars, or administrative orders issued by the Principal's Office or the Timetable Committee (TTC). Classroom vacancy indicated by the application reflects unscheduled instructional hours; official administrative bookings, departmental tests, and sanctioned events take precedence at all times.
    </p>

    <div class="section-title" style="margin-top: 5mm;">Feedback &amp; Community Support</div>
    <p>
      For technical queries, feature suggestions, or timetable feedback, reach out through the following channels:
    </p>
    <ul style="line-height: 1.7; margin-top: 2mm;">
      <li><strong>Live Web Portal:</strong> <a href="https://anand-srcc.github.io/srcc-free-classrooms/web_app/">https://anand-srcc.github.io/srcc-free-classrooms/web_app/</a></li>
      <li><strong>Developer Profile (LinkedIn):</strong> <a href="https://www.linkedin.com/in/anandkumar563/">Anand Kumar (25BC070)</a></li>
      <li><strong>Official WhatsApp Community:</strong> <a href="https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf">SRCC Free Classrooms Student Network</a></li>
      <li><strong>In-App Issue Reporter:</strong> Tap the <em>⚠️ Report</em> button in the website header.</li>
    </ul>

    <div style="margin-top: 10mm; padding: 4mm 6mm; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px;">
      <div style="font-size: 10pt; font-weight: 700; color: #0f2b5c; margin-bottom: 1.5mm;">Continuous Improvement &amp; Real-Time Data Reconciliation</div>
      <p style="font-size: 9pt; color: #475569; margin: 0; line-height: 1.5;">
        Class schedules and classroom assignments are continuously updated to mirror changes published on the college portal. For suggestions or immediate reporting of schedule updates, students are encouraged to use the in-app reporting tool or connect via the WhatsApp student community.
      </p>
    </div>

    <p style="text-align: center; margin-top: 12mm; font-size: 11pt; color: #64748b;">
      ***
    </p>
  </div>

  <div class="page-footer">Page 15 of {TOTAL_PAGES}</div>
</div>

</body>
</html>
"""

html_path = os.path.join(ROOT_DIR, "SRCC_Free_Classrooms_User_Manual.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"[OK] Master HTML Manual created at: {html_path}")
print(f"File size: {os.path.getsize(html_path):,} bytes")

pdf_path = os.path.join(ROOT_DIR, "SRCC-Free-Classrooms-User-Manual.pdf")
print(f"[...] Compiling PDF via Chrome Headless...")
cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    html_path
]
res = subprocess.run(cmd, capture_output=True, text=True)
if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
    print(f"[SUCCESS] PDF generated at: {pdf_path}")
    print(f"PDF size: {os.path.getsize(pdf_path):,} bytes")
    # Also copy to Downloads folder if possible
    downloads_pdf = os.path.expanduser(r"~\Downloads\SRCC-Free-Classrooms-User-Manual.pdf")
    try:
        import shutil
        shutil.copy2(pdf_path, downloads_pdf)
        print(f"[SUCCESS] Copied manual to Downloads: {downloads_pdf}")
    except Exception as e:
        print(f"[INFO] Could not copy to downloads: {e}")
else:
    print(f"[ERROR] PDF generation failed: {res.stderr}")
