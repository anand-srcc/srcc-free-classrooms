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

# Figures
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
fig12 = to_base64_img(os.path.join(ASSETS_DIR, "fig12_wifi_directory.png"))
fig13 = to_base64_img(os.path.join(ASSETS_DIR, "fig13_report_issue.png"))
fig14 = to_base64_img(os.path.join(ASSETS_DIR, "fig14_widget_preview.png"))

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SRCC Free Classroom Finder - User Manual for Students</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&display=swap');

@page {{
    size: A4 portrait;
    margin: 18mm 20mm 20mm 20mm;
    @top-center {{
        content: "";
    }}
    @bottom-center {{
        content: "";
    }}
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
    font-size: 10pt;
    line-height: 1.46;
}}

.page {{
    width: 100%;
    height: 257mm;
    max-height: 257mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 1.5mm;
    overflow: hidden;
}}

.page:last-child {{
    page-break-after: avoid;
    break-after: avoid;
}}

/* Top running header on pages 2-12 */
.running-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 7.8pt;
    color: #4b5563;
    padding-bottom: 2.5mm;
    margin-bottom: 3.5mm;
    border-bottom: 0.5px solid #d1d5db;
}}

.running-header .left {{
    font-weight: 500;
}}

.running-header .center {{
    font-weight: 500;
}}

.running-header .right {{
    font-weight: 500;
}}

/* Page footer */
.page-footer {{
    text-align: center;
    font-family: 'Lora', serif;
    font-size: 8.5pt;
    color: #4b5563;
    padding-top: 2.5mm;
    border-top: 0.5px solid #e5e7eb;
    margin-top: auto;
}}

/* Headings */
h1, h2, h3, h4 {{
    font-family: 'Lora', 'Georgia', serif;
    color: #111827;
    margin: 0 0 2mm 0;
    font-weight: 700;
}}

.section-title {{
    font-size: 12.5pt;
    font-weight: 700;
    color: #0f2b5c;
    margin-top: 1.5mm;
    margin-bottom: 2mm;
    letter-spacing: -0.2px;
}}

.subsection-title {{
    font-size: 10.5pt;
    font-weight: 700;
    color: #1e3a8a;
    margin-top: 2mm;
    margin-bottom: 1.5mm;
}}

p {{
    margin: 0 0 2mm 0;
    text-align: justify;
    text-justify: inter-word;
    font-size: 9.8pt;
    line-height: 1.45;
}}

ul, ol {{
    margin: 0 0 2mm 0;
    padding-left: 5mm;
    font-size: 9.4pt;
    line-height: 1.4;
}}

li {{
    margin-bottom: 1mm;
}}

/* Links */
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
    border-radius: 10px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.07);
    overflow: hidden;
    background: #ffffff;
}}

.figure-img-single {{
    display: block;
    width: 190px;
    height: auto;
    max-height: 98mm;
    object-fit: contain;
}}

.figure-caption {{
    font-family: 'Lora', serif;
    font-size: 8.6pt;
    font-weight: 600;
    color: #1f2937;
    margin-top: 1.5mm;
    text-align: center;
}}

/* Two Figures Side-by-Side */
.figures-row {{
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 7mm;
    margin: 1.5mm auto 1.5mm auto;
}}

.figure-col {{
    flex: 1;
    text-align: center;
    max-width: 200px;
}}

.figure-img-dual {{
    display: block;
    width: 100%;
    height: auto;
    max-height: 86mm;
    object-fit: contain;
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
    padding-top: 8mm;
}}

.cover-crest-wrap {{
    margin-bottom: 6mm;
}}

.cover-crest-img {{
    width: 125px;
    height: auto;
}}

.cover-institution {{
    font-family: 'Cinzel', 'Times New Roman', serif;
    font-size: 20pt;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 0.8px;
    margin-bottom: 2.5mm;
}}

.cover-accreditation {{
    font-family: 'Lora', serif;
    font-size: 11pt;
    color: #334155;
    margin-bottom: 1.5mm;
}}

.cover-iso {{
    font-family: 'Lora', serif;
    font-size: 9.5pt;
    color: #475569;
    margin-bottom: 6mm;
}}

.cover-divider {{
    width: 100%;
    height: 1.2px;
    background: #0f2b5c;
    margin: 0 auto 7mm auto;
}}

.cover-doc-title {{
    font-family: 'Lora', serif;
    font-size: 24pt;
    font-weight: 700;
    color: #0f2b5c;
    letter-spacing: 0.5px;
    margin-bottom: 2mm;
    text-transform: uppercase;
}}

.cover-doc-subtitle {{
    font-family: 'Lora', serif;
    font-size: 11.5pt;
    font-style: italic;
    color: #334155;
    margin-bottom: 6mm;
}}

.cover-edition {{
    font-family: 'Lora', serif;
    font-size: 10.5pt;
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
    font-size: 10.5pt;
    color: #334155;
    margin-bottom: 1mm;
}}

.cover-month-year {{
    font-family: 'Lora', serif;
    font-size: 10.5pt;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: #1e293b;
    margin-bottom: 5mm;
}}

.cover-url {{
    font-family: 'Inter', monospace;
    font-size: 10.5pt;
    color: #1d4ed8;
    margin-bottom: 8mm;
}}

.cover-authors-box {{
    text-align: left;
    margin: 0 auto 5mm 5mm;
    font-size: 9.8pt;
    line-height: 1.5;
}}

.cover-developed-box {{
    text-align: left;
    margin: 0 auto 4mm 5mm;
    font-size: 9.8pt;
    line-height: 1.45;
}}

.cover-feedback-box {{
    text-align: center;
    font-size: 9.5pt;
    color: #334155;
    margin-top: 4mm;
}}

/* ================= PAGE 2 TOC SPECIFIC ================= */
.toc-section-title {{
    font-size: 11.5pt;
    font-weight: 700;
    margin-bottom: 2mm;
}}

.toc-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
    margin-bottom: 2.5mm;
}}

.toc-table td {{
    padding: 0.55mm 0;
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
}}

.highlight-box {{
    background: #f8fafc;
    border-left: 3.5px solid #1e40af;
    padding: 2.5mm 3.5mm;
    margin: 2mm 0 3mm 0;
    border-radius: 0 6px 6px 0;
    font-size: 9.6pt;
}}

.badge-pill {{
    display: inline-block;
    background: #dbeafe;
    color: #1e40af;
    font-family: 'Inter', sans-serif;
    font-size: 8pt;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
}}
</style>
</head>
<body>

<!-- ==========================================================================
     PAGE 1: COVER PAGE
     ========================================================================== -->
<div class="page" id="page-1">
  <div class="cover-header">
    <span>Free Classroom Finder</span>
    <span>User Manual for Students</span>
    <span>Version 1.0</span>
  </div>

  <div class="cover-body">
    <div class="cover-crest-wrap">
      <img src="{logo_100years}" class="cover-crest-img" alt="SRCC 100 Years Centenary Logo" />
    </div>

    <div class="cover-institution">SHRI RAM COLLEGE OF COMMERCE</div>
    <div class="cover-accreditation">A++ Accredited by NAAC</div>
    <div class="cover-iso">ISO 21001:2018 &amp; ISO 9001:2015 Certified</div>

    <div class="cover-divider"></div>

    <div class="cover-doc-title">SRCC FREE CLASSROOM FINDER</div>
    <div class="cover-doc-subtitle">Designed to facilitate students in navigating vacant classrooms, faculty, and academic timetables.</div>

    <div class="cover-edition">Official Student Release</div>
    <div class="cover-manual-type">USER MANUAL FOR STUDENTS</div>
    <div class="cover-version">(Version 1.0)</div>
    <div class="cover-month-year">OCTOBER 2026</div>

    <div class="cover-url">https://srcc-free-classrooms.netlify.app/</div>

    <div class="cover-authors-box">
      <strong>Authors:</strong><br>
      1. <strong>Mr. Anand Kumar</strong>, Student, B.Com.(Hons.), Roll No. <strong>25BC070</strong><br>
      2. <strong>Academic &amp; Digital Initiative Mentorship</strong>, Shri Ram College of Commerce
    </div>

    <div class="cover-developed-box">
      <strong>Website and Application Developed by Mr. Anand Kumar</strong>, Student, B.Com.(Hons.), Roll No. <strong>25BC070</strong> <em>with support, open timetable synchronization, and guidance from SRCC.</em>
    </div>

    <div class="cover-feedback-box">
      Feedback &amp; Inquiries: <a href="https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf" style="color: #16a34a; font-weight: 700; text-decoration: none;">Official SRCC Community &amp; Student Helpdesk</a>
    </div>
  </div>

  <div class="page-footer">Page 1 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 2: TABLE OF CONTENTS & LIST OF FIGURES
     ========================================================================== -->
<div class="page" id="page-2">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="toc-section-title">Sections:</div>
    <table class="toc-table">
      <tr><td class="toc-name">1. About SRCC Free Classroom Finder</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">2. Access and Progressive Web App (PWA) Setup</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">3. Dashboard and Navigation</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">4. Classroom Vacancy Locator (Flagship Feature)</td><td><div class="toc-dots"></div></td><td class="toc-page">6</td></tr>
      <tr><td class="toc-name">5. "Free Right Now" Real-Time Quick-Toggle</td><td><div class="toc-dots"></div></td><td class="toc-page">6</td></tr>
      <tr><td class="toc-name">6. Room Occupancy Timeline &amp; Schedule Breakdown</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">7. Faculty Locator &amp; Teacher Directory (210 Faculty)</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">8. Faculty Contact Details &amp; Verified Email Copy</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">9. Faculty Weekly Timetable &amp; Profile Share</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">10. Recorded Faculty Leaves &amp; Bonus Vacant Rooms</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">11. Student Academic Timetable Explorer</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">12. Campus Wi-Fi Credentials Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">13. Group Study Coordination &amp; Calendar Reminders</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">14. Android Interactive Home Screen Widgets &amp; APK</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">15. Offline Support, Keyboard Shortcuts &amp; Issue Reporting</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
      <tr><td class="toc-name">Disclaimer</td><td><div class="toc-dots"></div></td><td class="toc-page">12</td></tr>
      <tr><td class="toc-name">Feedback &amp; Community</td><td><div class="toc-dots"></div></td><td class="toc-page">12</td></tr>
      <tr><td class="toc-name">Acknowledgments</td><td><div class="toc-dots"></div></td><td class="toc-page">12</td></tr>
    </table>

    <div class="toc-section-title" style="margin-top: 3mm;">Figures:</div>
    <table class="toc-table">
      <tr><td class="toc-name">1. Portal Landing Page on Mobile Web</td><td><div class="toc-dots"></div></td><td class="toc-page">3</td></tr>
      <tr><td class="toc-name">2. PWA Installation &amp; Home Screen Prompt</td><td><div class="toc-dots"></div></td><td class="toc-page">4</td></tr>
      <tr><td class="toc-name">3. Classroom Category Filtering &amp; Wing Badges</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">4. Classroom Vacancy Cards Grid View</td><td><div class="toc-dots"></div></td><td class="toc-page">5</td></tr>
      <tr><td class="toc-name">5. "Free Right Now" Real-Time Quick-Toggle Active</td><td><div class="toc-dots"></div></td><td class="toc-page">6</td></tr>
      <tr><td class="toc-name">6. Room Occupancy Timeline Modal (9-Period Breakdown)</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">7. Faculty Locator &amp; Department Search</td><td><div class="toc-dots"></div></td><td class="toc-page">7</td></tr>
      <tr><td class="toc-name">8. Faculty Contact Details &amp; Verified DU Email Copy Chip</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">9. Faculty Weekly Timetable Modal</td><td><div class="toc-dots"></div></td><td class="toc-page">8</td></tr>
      <tr><td class="toc-name">10. Recorded Faculty Leaves &amp; Bonus Free Rooms Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">11. Student Academic Timetable Explorer</td><td><div class="toc-dots"></div></td><td class="toc-page">9</td></tr>
      <tr><td class="toc-name">12. Campus Wi-Fi Credentials Directory</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">13. Group Study Reminder &amp; WhatsApp GD Invite</td><td><div class="toc-dots"></div></td><td class="toc-page">10</td></tr>
      <tr><td class="toc-name">14. Standalone Widget &amp; Android Home Screen Configuration</td><td><div class="toc-dots"></div></td><td class="toc-page">11</td></tr>
    </table>
  </div>

  <div class="page-footer">Page 2 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 3: ABOUT & ACCESS
     ========================================================================== -->
<div class="page" id="page-3">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">1. About SRCC Free Classroom Finder</div>
    <p>
      The <strong>SRCC Free Classroom Finder</strong> is an open academic navigation platform built to resolve one of the most persistent daily challenges faced by students at Shri Ram College of Commerce: locating available, vacant classrooms for <strong>Group Discussions (GD)</strong>, society rehearsals, case-study competitions, tutorial catch-ups, and peer study sessions.
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
    <p style="text-align: center; margin: 2mm 0 4mm 0;">
      <strong>Website URL:</strong> <a href="https://srcc-free-classrooms.netlify.app/">https://srcc-free-classrooms.netlify.app/</a>
    </p>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig1}" class="figure-img-single" alt="Figure 1: Portal Landing Page on Mobile Web" />
      </div>
      <div class="figure-caption">Figure 1: Portal Landing Page on Mobile Web</div>
    </div>
  </div>

  <div class="page-footer">Page 3 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 4: INSTALLATION (PWA, ANDROID APK & IOS)
     ========================================================================== -->
<div class="page" id="page-4">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="subsection-title">Installing as a Progressive Web App (PWA):</div>
    <p>
      Installing the application directly to your mobile home screen provides an app-like fullscreen experience, instant offline caching, and faster load times without requiring an app store account.
    </p>

    <p><strong>For Android Devices (Google Chrome / Brave / Edge):</strong></p>
    <ol>
      <li>Open the website in your browser: <a href="https://srcc-free-classrooms.netlify.app/">https://srcc-free-classrooms.netlify.app/</a>.</li>
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

    <div class="subsection-title">Official Standalone Android App (APK):</div>
    <p>
      For students desiring native home screen widgets, the precompiled Android APK can be downloaded directly from the portal's Timetable strip via the <strong>"⬇️ App APK"</strong> button or installed via the repository releases.
    </p>

    <div class="figure-container" style="margin-top: 3mm;">
      <div class="figure-box">
        <img src="{fig2}" class="figure-img-single" style="max-height: 98mm;" alt="Figure 2: PWA Installation Prompt" />
      </div>
      <div class="figure-caption">Figure 2: PWA Installation &amp; Home Screen Setup Prompt</div>
    </div>
  </div>

  <div class="page-footer">Page 4 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 5: DASHBOARD & NAVIGATION
     ========================================================================== -->
<div class="page" id="page-5">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">3. Dashboard and Navigation</div>
    <p>
      The user interface is structured for high-speed interaction on mobile screens. The top header features authentic college branding: the official <strong>SRCC Crest</strong> and the <strong>Centenary 100 Years Logo</strong>, alongside a live sync status indicator displaying <em>"College Timetable Synced: Today (Daily Verified)"</em>.
    </p>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig3}" class="figure-img-dual" alt="Figure 3: Category Filtering" />
        </div>
        <div class="figure-caption">Figure 3: Category &amp; Wing Filter</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig1}" class="figure-img-dual" alt="Figure 4: Classroom Vacancy Cards" />
        </div>
        <div class="figure-caption">Figure 4: Room Cards Overview</div>
      </div>
    </div>

    <p style="margin-top: 3mm;">
      The <strong>Top Dual-Mode Switcher</strong> allows seamless 1-tap switching across three primary modules:
    </p>
    <ul>
      <li><strong>🏛️ Classrooms:</strong> Comprehensive vacancy scanner across all 96 college rooms.</li>
      <li><strong>👨‍🏫 Faculty:</strong> Teacher directory, lecture status, timetable, and verified email contact.</li>
      <li><strong>📅 Timetable:</strong> Full student schedule explorer by Course, Semester, Section, and Batch.</li>
    </ul>
    <p>
      Below the mode switcher, the <strong>Day Picker</strong> lets students inspect schedules for any day from <strong>Monday to Saturday</strong>. The <strong>Category Pills</strong> filter rooms by architectural wing: Principal Bungalow (PB), Tutorial Rooms (T), Sports Complex (SCR), Main Building Classrooms (R), and Computer Labs (CL).
    </p>
  </div>

  <div class="page-footer">Page 5 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 6: CLASSROOM VACANCY LOCATOR & FREE RIGHT NOW
     ========================================================================== -->
<div class="page" id="page-6">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">4. Classroom Vacancy Locator (Flagship Feature)</div>
    <p>
      The Classroom Vacancy Locator calculates room status period-by-period for all 9 academic periods of the college day (from Period 1: 8:30 AM to Period 9: 6:00 PM). Each room card displays:
    </p>
    <ul>
      <li><strong>Room Code &amp; Wing:</strong> Floor level, building wing (e.g. Front Wing, Canteen Building, PB Lawn), and seating capacity.</li>
      <li><strong>9-Period Breakdown Pills:</strong> Color-coded micro-pills (P1 to P9) providing an immediate visual scan of busy vs empty slots.</li>
      <li><strong>Active Vacancy Summary:</strong> Explicit tags indicating free periods (e.g. <em>"Free Periods: Period 3, Period 4, Period 6"</em>).</li>
      <li><strong>Bonus Free Slot Indicators:</strong> Highlights classrooms freed up due to officially recorded faculty leaves.</li>
    </ul>

    <div class="highlight-box">
      <strong>☕ Universal Lunch Recess (1:30 PM – 2:00 PM):</strong> During recess, the platform dynamically displays a notification callout confirming that all 96 classrooms and tutorial rooms are open for group discussions and lunch.
    </div>

    <div class="section-title">5. "Free Right Now" Real-Time Quick-Toggle</div>
    <p>
      Located directly in the header strip, the <strong>⚡ Free Right Now</strong> switch automatically detects the current college period based on device clock time. Flipping the toggle to <strong>ON</strong> instantly filters out all occupied rooms, presenting only rooms that are vacant right at this moment.
    </p>

    <div class="figure-container">
      <div class="figure-box">
        <img src="{fig4}" class="figure-img-single" style="max-height: 100mm;" alt="Figure 5: Free Right Now Active" />
      </div>
      <div class="figure-caption">Figure 5: "Free Right Now" Real-Time Quick-Toggle Active</div>
    </div>
  </div>

  <div class="page-footer">Page 6 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 7: ROOM OCCUPANCY MODAL & FACULTY LOCATOR
     ========================================================================== -->
<div class="page" id="page-7">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">6. Room Occupancy Timeline &amp; Schedule Breakdown</div>
    <p>
      Tapping any room card opens the <strong>Room Occupancy Timeline Modal</strong>. It presents a complete chronological table of all 9 periods for that specific room:
    </p>
    <ul>
      <li><strong>Occupied Slots:</strong> Displays the subject name, course semester, section, and the scheduled professor (with 1-tap link to open their faculty timetable).</li>
      <li><strong>Vacant Slots:</strong> Marked with a bold green badge (<strong>Empty / Free for GD</strong>) confirming the room is officially unscheduled.</li>
      <li><strong>Day Tabs:</strong> Switch between Monday to Saturday without leaving the dialog.</li>
      <li><strong>Action Toolbar:</strong> Includes <strong>"📸 Save Day Schedule"</strong> (exports a clean PNG card to photo gallery) and <strong>"📤 Share Room"</strong> (instant WhatsApp vacancy sharing).</li>
    </ul>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig5}" class="figure-img-dual" alt="Figure 6: Room Occupancy Timeline Modal" />
        </div>
        <div class="figure-caption">Figure 6: Room Schedule Timeline</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig7}" class="figure-img-dual" alt="Figure 7: Faculty Directory Search" />
        </div>
        <div class="figure-caption">Figure 7: Faculty Locator Search</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 3mm;">7. Faculty Locator &amp; Teacher Directory (210 Faculty)</div>
    <p>
      Switching to the <strong>Faculty tab</strong> opens the comprehensive directory of all 210 faculty members across Commerce, Economics, Mathematics, English, Political Science, Physical Education, EVS, and Hindi. Students can filter by department or search by professor name or teacher code (e.g., <em>CG16</em>, <em>SVK</em>, <em>MTS</em>).
    </p>
  </div>

  <div class="page-footer">Page 7 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 8: FACULTY CONTACT & WEEKLY TIMETABLE
     ========================================================================== -->
<div class="page" id="page-8">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">8. Faculty Contact Details &amp; Verified Email Copy</div>
    <p>
      Each faculty member card includes an inline email action chip. Tapping the email icon opens the dedicated <strong>Faculty Contact Modal</strong> featuring:
    </p>
    <ul>
      <li>Official verified University of Delhi academic email (<code>@srcc.du.ac.in</code>).</li>
      <li>Teacher code, department badge, and initials avatar.</li>
      <li><strong>"📋 Copy Email"</strong> chip: Copies the official address cleanly to clipboard with a confirmation toast, eliminating raw email typos and avoiding accidental external mail app launches.</li>
      <li><strong>"↗️ Open Mail"</strong> button for drafting messages directly in your email client.</li>
    </ul>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig8}" class="figure-img-dual" alt="Figure 8: Faculty Contact Details" />
        </div>
        <div class="figure-caption">Figure 8: Faculty Email Contact</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig9}" class="figure-img-dual" alt="Figure 9: Faculty Weekly Timetable" />
        </div>
        <div class="figure-caption">Figure 9: Faculty Timetable Modal</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 3mm;">9. Faculty Weekly Timetable &amp; Profile Share</div>
    <p>
      Tapping a teacher's card opens their full <strong>Weekly Timetable Modal</strong>. Students can review the professor's scheduled lectures, tutorial batches, and assigned room numbers from Monday to Saturday. Tapping any room in the teacher's schedule immediately jumps to that room's vacancy card. The <strong>"📤 Share Faculty Profile"</strong> button generates a clean WhatsApp profile link for batch coordination.
    </p>
  </div>

  <div class="page-footer">Page 8 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 9: FACULTY LEAVES & STUDENT TIMETABLE EXPLORER
     ========================================================================== -->
<div class="page" id="page-9">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">10. Recorded Faculty Leaves &amp; Bonus Vacant Rooms</div>
    <p>
      When faculty members are on leave, their assigned classrooms often sit empty and unused. The <strong>Faculty Leaves module</strong> connects official absence notices directly with the Classroom Finder:
    </p>
    <ul>
      <li>Classes scheduled under an absent teacher are dynamically unlocked as <strong>"Bonus Vacant Slots"</strong> for self-study.</li>
      <li>Tapping the <strong>"🏖️ Active Leaves"</strong> header pill opens the Leave Directory, listing absent professors, dates, and affected lecture periods.</li>
      <li>The <strong>"💬 Share All List"</strong> button generates a formatted absence summary for CRs and batch WhatsApp groups.</li>
    </ul>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig10}" class="figure-img-dual" alt="Figure 10: Faculty Leaves Directory" />
        </div>
        <div class="figure-caption">Figure 10: Faculty Leaves Directory</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig11}" class="figure-img-dual" alt="Figure 11: Student Timetable Explorer" />
        </div>
        <div class="figure-caption">Figure 11: Student Timetable Explorer</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 3mm;">11. Student Academic Timetable Explorer</div>
    <p>
      The <strong>Timetable tab</strong> allows students to view complete official class schedules across all programs: <strong>B.Com (Hons)</strong> (Sections A to N), <strong>B.A. (Hons) Economics</strong> (Sections A to D), and interdisciplinary <strong>SEC / VAC</strong> courses across Semesters I, III, V, and VII. Selecting your course, section, and tutorial batch renders all daily lectures, teachers, and rooms in chronological sequence.
    </p>
  </div>

  <div class="page-footer">Page 9 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 10: CAMPUS WI-FI & CALENDAR REMINDERS
     ========================================================================== -->
<div class="page" id="page-10">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">12. Campus Wi-Fi Credentials Directory</div>
    <p>
      To assist students experiencing cellular connectivity dead zones inside basement labs or thick-walled heritage blocks, the header features a dedicated <strong>WiFi Directory</strong>. It stores verified credentials for <strong>24 campus Wi-Fi networks</strong>:
    </p>
    <ul>
      <li>Categorized by frequency band: <strong>⚡ 5G High Speed</strong>, <strong>📶 4G Standard</strong>, <strong>🏛️ Principal Bungalow</strong>, and <strong>🏢 Main Building</strong>.</li>
      <li>Displays exact network SSID, location coverage, and security protocol.</li>
      <li><strong>1-Tap Password Copy:</strong> Instantly copies the network password to clipboard.</li>
      <li><strong>Scan QR Code:</strong> Generates a standard Wi-Fi QR code for automatic camera connection on Android and iOS devices.</li>
    </ul>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig12}" class="figure-img-dual" alt="Figure 12: Campus Wi-Fi Directory" />
        </div>
        <div class="figure-caption">Figure 12: Campus Wi-Fi Directory</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig6}" class="figure-img-dual" alt="Figure 13: Group Study Reminder & Invite" />
        </div>
        <div class="figure-caption">Figure 13: Group Study Reminder</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 3mm;">13. Group Study Coordination &amp; Calendar Reminders</div>
    <p>
      When securing an empty room for a society rehearsal or case discussion, students can tap the calendar bell icon on any vacant period card to open the <strong>Group Study Reminder Modal</strong>. It provides a direct <strong>Google Calendar link</strong> (with a 15-minute advance alert), an <strong>Apple / Outlook <code>.ics</code> file</strong> download, and a formatted <strong>WhatsApp GD Invite</strong> generator.
    </p>
  </div>

  <div class="page-footer">Page 10 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 11: ANDROID WIDGETS, OFFLINE & REPORTING
     ========================================================================== -->
<div class="page" id="page-11">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">14. Android Interactive Home Screen Widgets &amp; APK</div>
    <p>
      The platform includes dedicated companion widget options for home screen access without opening a browser:
    </p>
    <ul>
      <li><strong>Standalone Web Widget (<code>widget.html</code>):</strong> A dedicated lightweight schedule widget that saves your course, section, and batch offline for immediate glanceable schedule access.</li>
      <li><strong>Android Native Home Screen Widgets:</strong> Pre-built Android app package providing three distinct widget formats:
        <ul>
          <li><em>4x1 Next Class Pill:</em> Displays your upcoming lecture, room code, and teacher.</li>
          <li><em>4x2 Daily Timeline:</em> Scrollable list of today's remaining classes.</li>
          <li><em>4x4 Academic Dashboard:</em> Combines room vacancy scanner and personal schedule.</li>
        </ul>
      </li>
    </ul>

    <div class="figures-row">
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig14}" class="figure-img-dual" alt="Figure 14: Standalone Widget Configuration" />
        </div>
        <div class="figure-caption">Figure 14: Widget Setup</div>
      </div>
      <div class="figure-col">
        <div class="figure-box">
          <img src="{fig13}" class="figure-img-dual" alt="Figure 15: Issue Reporting Modal" />
        </div>
        <div class="figure-caption">Figure 15: Issue Reporting Modal</div>
      </div>
    </div>

    <div class="section-title" style="margin-top: 3mm;">15. Offline Support, Keyboard Shortcuts &amp; Issue Reporting</div>
    <p>
      The app incorporates a Service Worker caching engine, ensuring the full timetable and room database function seamlessly in offline mode. Desktop users can press <strong><code>/</code></strong> to focus search inputs and <strong><code>Esc</code></strong> to close any modal. The header <strong>⚠️ Report</strong> button enables students to flag timetable discrepancies or room changes for immediate verification.
    </p>
  </div>

  <div class="page-footer">Page 11 of 12</div>
</div>


<!-- ==========================================================================
     PAGE 12: DISCLAIMER, FEEDBACK & ACKNOWLEDGMENTS
     ========================================================================== -->
<div class="page" id="page-12">
  <div class="running-header">
    <span class="left">Free Classroom Finder</span>
    <span class="center">User Manual for Students</span>
    <span class="right">Version 1.0</span>
  </div>

  <div style="flex: 1;">
    <div class="section-title">Disclaimer</div>
    <p>
      The SRCC Free Classroom Finder is an independent student academic facilitation project designed to simplify classroom discovery, peer study coordination, and timetable navigation. Class schedules and faculty assignments are sourced directly from the official Shri Ram College of Commerce timetable portal (<a href="https://srcccollegetimetable.in/">srcccollegetimetable.in</a>).
    </p>
    <p>
      This platform does not supersede official college notifications, room requisition circulars, or administrative orders issued by the Principal's Office or the Timetable Committee (TTC). Classroom vacancy indicated by the application reflects unscheduled instructional hours; official administrative bookings, departmental tests, and sanctioned events take precedence at all times.
    </p>

    <div class="section-title" style="margin-top: 5mm;">Feedback &amp; Community Support</div>
    <p>
      For technical queries, feature suggestions, or data discrepancy reports regarding the SRCC Free Classroom Finder, please reach out through the following channels:
    </p>
    <ul>
      <li><strong>Official WhatsApp Community:</strong> <a href="https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf">SRCC Free Classrooms Student Network</a></li>
      <li><strong>Developer Profile (LinkedIn):</strong> <a href="https://www.linkedin.com/in/anandkumar563/">Anand Kumar (25BC070)</a></li>
      <li><strong>GitHub Open Repository:</strong> <a href="https://github.com/anand-srcc/srcc-free-classrooms">github.com/anand-srcc/srcc-free-classrooms</a></li>
      <li><strong>In-App Issue Reporter:</strong> Tap the <em>⚠️ Report</em> button in the website header.</li>
    </ul>

    <div class="section-title" style="margin-top: 5mm;">Acknowledgments</div>
    <p>
      The developer would like to express heartfelt gratitude and sincere appreciation to the following individuals and bodies for their encouragement, guidance, and continuous feedback:
    </p>
    <ol>
      <li><strong>Prof. Aruna Jha</strong> (Vice-Principal, Shri Ram College of Commerce)</li>
      <li><strong>Timetable Committee (Commerce &amp; Economics Departments)</strong>, AY 2026–27</li>
      <li><strong>Digital Initiatives &amp; Academic Technology Vertical</strong>, SRCC</li>
      <li><strong>Faculty Members &amp; Mentors</strong> of Shri Ram College of Commerce</li>
      <li><strong>Student Batch Representatives &amp; CRs</strong> of B.Com.(Hons.) and B.A.(Hons.) Economics for rigorous testing and operational suggestions.</li>
    </ol>
    <p style="margin-top: 4mm;">
      <em>Special gratitude to the open-source and modern AI tooling community that empowered rapid development, automated reconciliation, and the realization of this student utility.</em>
    </p>
    <p style="text-align: center; margin-top: 6mm; font-size: 11pt; color: #64748b;">
      ***
    </p>
  </div>

  <div class="page-footer">Page 12 of 12</div>
</div>

</body>
</html>
"""

html_path = os.path.join(ROOT_DIR, "SRCC_Free_Classrooms_User_Manual.html")
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"[OK] Master HTML Manual created at: {html_path}")
print(f"File size: {os.path.getsize(html_path):,} bytes")

# Now compile to PDF via Chrome Headless
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
    # Also copy to Downloads folder if it exists
    downloads_pdf = os.path.expanduser(r"~\Downloads\SRCC-Free-Classrooms-User-Manual.pdf")
    try:
        import shutil
        shutil.copy2(pdf_path, downloads_pdf)
        print(f"[SUCCESS] Copied manual to Downloads: {downloads_pdf}")
    except Exception as e:
        print(f"[INFO] Could not copy to downloads: {e}")
else:
    print(f"[ERROR] PDF generation failed: {res.stderr}")
