import http.server
import socketserver
import threading
import subprocess
import os
import time

PORT = 8990
Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"[OK] Test HTTP server active on port {PORT}")

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

ASSETS_DIR = os.path.abspath('manual_assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

# Create a test harness HTML from web_app/index.html
with open('web_app/index.html', 'r', encoding='utf-8') as f:
    orig_html = f.read()

harness_script = """
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;

    if (action === 'landing') {
      window.scrollTo(0, 0);
    } else if (action === 'freenow') {
      const btn = document.getElementById('btnFreeNow');
      if (btn) btn.click();
      window.scrollTo(0, 0);
    } else if (action === 'category_pb') {
      const pill = document.querySelector('.cat-pill[data-cat="PB"]');
      if (pill) pill.click();
      window.scrollTo(0, 0);
    } else if (action === 'room_modal') {
      if (typeof window.openScheduleModal === 'function') {
        window.openScheduleModal('R35', 'Wednesday');
      }
    } else if (action === 'calendar_reminder') {
      const calModal = document.getElementById('calendarReminderModal');
      if (calModal) {
        calModal.style.display = 'flex';
        document.getElementById('calReminderRoomName').textContent = 'Room R35 (Sports Complex / SCR)';
        document.getElementById('calReminderSlotTime').textContent = 'Wednesday · 11:30 AM – 12:30 PM';
      }
    } else if (action === 'faculty') {
      const tab = document.getElementById('tabModeFaculty');
      if (tab) tab.click();
      window.scrollTo(0, 0);
    } else if (action === 'faculty_email') {
      const emailModal = document.getElementById('facultyEmailModal');
      if (emailModal) {
        emailModal.style.display = 'flex';
        const nameEl = document.getElementById('facultyEmailModalName');
        const deptEl = document.getElementById('facultyEmailModalDept');
        const codeEl = document.getElementById('facultyEmailModalCode');
        const addrEl = document.getElementById('facultyEmailModalAddress');
        const avatarEl = document.getElementById('facultyEmailModalAvatar');
        if (nameEl) nameEl.textContent = 'MR. HARISH KUMAR';
        if (deptEl) deptEl.textContent = 'Commerce';
        if (codeEl) codeEl.textContent = 'CG16';
        if (addrEl) addrEl.textContent = 'harish.kumar@srcc.du.ac.in';
        if (avatarEl) avatarEl.textContent = 'HK';
      }
    } else if (action === 'teacher_modal') {
      if (typeof window.openTeacherModal === 'function') {
        window.openTeacherModal('cg16');
      }
    } else if (action === 'leaves') {
      const leaveModal = document.getElementById('leaveManagerModal');
      if (leaveModal) {
        leaveModal.style.display = 'flex';
      }
    } else if (action === 'timetable') {
      const tab = document.getElementById('tabModeTimetable');
      if (tab) tab.click();
      window.scrollTo(0, 0);
    } else if (action === 'wifi') {
      const btn = document.getElementById('btnOpenWifiModal');
      if (btn) btn.click();
    } else if (action === 'pwa') {
      const modal = document.getElementById('pwaInstallModal');
      if (modal) modal.style.display = 'flex';
    } else if (action === 'report') {
      const btn = document.getElementById('btnReportIssue');
      if (btn) btn.click();
    }
  }, 1200);
});
</script>
"""

harness_path = os.path.abspath('web_app/manual_harness.html')
with open(harness_path, 'w', encoding='utf-8') as f:
    f.write(orig_html.replace('</body>', harness_script + '</body>'))

tasks = [
    ('fig1_landing_page.png', 'landing', 412, 860, 2500),
    ('fig2_pwa_install.png', 'pwa', 412, 750, 2500),
    ('fig3_category_pb.png', 'category_pb', 412, 850, 2500),
    ('fig4_free_now.png', 'freenow', 412, 850, 2500),
    ('fig5_room_modal.png', 'room_modal', 412, 850, 3000),
    ('fig6_calendar_reminder.png', 'calendar_reminder', 412, 750, 2500),
    ('fig7_faculty_directory.png', 'faculty', 412, 850, 2800),
    ('fig8_faculty_email.png', 'faculty_email', 412, 750, 3000),
    ('fig9_teacher_modal.png', 'teacher_modal', 412, 850, 3000),
    ('fig10_leaves_modal.png', 'leaves', 412, 800, 2800),
    ('fig11_student_timetable.png', 'timetable', 412, 850, 2800),
    ('fig12_wifi_directory.png', 'wifi', 412, 850, 2800),
    ('fig13_report_issue.png', 'report', 412, 750, 2500)
]

print(f"Generating {len(tasks)} manual figures...")
for filename, action, width, height, budget in tasks:
    out_file = os.path.join(ASSETS_DIR, filename)
    url = f"http://127.0.0.1:{PORT}/web_app/manual_harness.html?action={action}"
    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        f"--virtual-time-budget={budget}",
        f"--window-size={width},{height}",
        f"--screenshot={out_file}",
        url
    ]
    subprocess.run(cmd, capture_output=True, text=True)
    size = os.path.getsize(out_file) if os.path.exists(out_file) else 0
    print(f"  [Figure] {filename} -> {size} bytes")

# Also capture widget.html
widget_file = os.path.join(ASSETS_DIR, 'fig14_widget_preview.png')
widget_url = f"http://127.0.0.1:{PORT}/web_app/widget.html"
cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--virtual-time-budget=2000",
    "--window-size=412,750",
    f"--screenshot={widget_file}",
    widget_url
]
subprocess.run(cmd, capture_output=True, text=True)
print(f"  [Figure] fig14_widget_preview.png -> {os.path.getsize(widget_file)} bytes")

# Cleanup
if os.path.exists(harness_path):
    os.remove(harness_path)
httpd.shutdown()
print("[DONE] All figures generated successfully!")
