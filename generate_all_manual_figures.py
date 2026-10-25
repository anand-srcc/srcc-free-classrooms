import http.server
import socketserver
import threading
import os
import time
from playwright.sync_api import sync_playwright

PORT = 8999
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
ASSETS_DIR = os.path.join(ROOT_DIR, "manual_assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(('127.0.0.1', PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"[OK] HTTP Server running on http://127.0.0.1:{PORT}")

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
    
    # Standard modern mobile screen (iPhone 14/15 Pro: 430 x 932, 2x retina)
    context = browser.new_context(
        viewport={'width': 430, 'height': 932},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True
    )
    
    page = context.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/web_app/index.html")
    page.wait_for_selector("#roomsGrid .room-card", timeout=15000)
    
    # Clean UI state helper
    def clean_ui():
        page.evaluate("""() => {
            const b = document.getElementById('leaveNotificationPromptBanner');
            if (b) b.style.display = 'none';
            const off = document.getElementById('offlineIndicatorBanner');
            if (off) off.style.display = 'none';
        }""")
    
    clean_ui()

    print("[1/19] fig1_landing_page.png...")
    page.evaluate("window.scrollTo(0, 0);")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig1_landing_page.png"))

    print("[2/19] fig2_pwa_install.png...")
    page.evaluate("""() => {
        const m = document.getElementById('pwaInstallModal');
        if (m) m.style.display = 'flex';
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig2_pwa_install.png"))
    page.evaluate("() => { document.getElementById('pwaInstallModal').style.display = 'none'; }")

    print("[3/19] fig3_category_pb.png (Classroom Cards)...")
    page.evaluate("""() => {
        const pill = document.querySelector('.cat-pill[data-cat=\"PB\"]');
        if (pill) pill.click();
        window.scrollTo(0, 280);
    }""")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig3_category_pb.png"))

    print("[4/19] fig4_free_now.png...")
    page.evaluate("""() => {
        window.scrollTo(0, 0);
        const btn = document.getElementById('btnFreeNow');
        if (btn) btn.click();
    }""")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig4_free_now.png"))
    # Turn off free now & reset to ALL
    page.evaluate("""() => {
        const btn = document.getElementById('btnFreeNow');
        if (btn && btn.getAttribute('aria-checked') === 'true') btn.click();
        const allPill = document.querySelector('.cat-pill[data-cat=\"ALL\"]');
        if (allPill) allPill.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_timeout(400)

    print("[5/19] fig5_room_modal.png...")
    page.evaluate("""() => {
        if (typeof window.openScheduleModal === 'function') {
            window.openScheduleModal('PB3', 'Wednesday');
        }
    }""")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig5_room_modal.png"))
    page.evaluate("() => { document.getElementById('scheduleModal').style.display = 'none'; }")

    print("[6/19] fig6_calendar_reminder.png...")
    page.evaluate("""() => {
        const cal = document.getElementById('calendarReminderModal');
        if (cal) {
            cal.style.display = 'flex';
            document.getElementById('calReminderRoomName').textContent = 'Room PB3 (Principal Bungalow)';
            document.getElementById('calReminderSlotTime').textContent = 'Wednesday · 11:30 AM – 12:30 PM';
        }
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig6_calendar_reminder.png"))
    page.evaluate("() => { document.getElementById('calendarReminderModal').style.display = 'none'; }")

    print("[7/19] fig7_faculty_directory.png...")
    page.evaluate("""() => {
        const tab = document.getElementById('tabModeFaculty');
        if (tab) tab.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#facultyGrid .faculty-card", timeout=8000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig7_faculty_directory.png"))

    print("[8/19] fig8_faculty_email.png...")
    page.evaluate("""() => {
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
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig8_faculty_email.png"))
    page.evaluate("() => { document.getElementById('facultyEmailModal').style.display = 'none'; }")

    print("[9/19] fig9_teacher_modal.png...")
    page.evaluate("""() => {
        if (typeof window.openTeacherModal === 'function') {
            window.openTeacherModal('cg16');
        }
    }""")
    page.wait_for_selector("#teacherModal", timeout=5000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig9_teacher_modal.png"))
    page.evaluate("() => { document.getElementById('teacherModal').style.display = 'none'; }")

    print("[10/19] fig10_leaves_modal.png...")
    page.evaluate("""() => {
        const lModal = document.getElementById('leaveManagerModal');
        if (lModal) {
            lModal.style.display = 'flex';
            if (typeof window.renderLeavesModalList === 'function') {
                window.renderLeavesModalList();
            }
        }
    }""")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig10_leaves_modal.png"))
    page.evaluate("() => { document.getElementById('leaveManagerModal').style.display = 'none'; }")

    print("[11/19] fig11_student_timetable.png...")
    page.evaluate("""() => {
        const tab = document.getElementById('tabModeTimetable');
        if (tab) tab.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#ttMainScheduleGrid", timeout=6000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig11_student_timetable.png"))

    print("[12/19] fig12_college_notices.png...")
    page.evaluate("""() => {
        if (typeof window.switchAppMode === 'function') {
            window.switchAppMode('notices');
        } else {
            const b = document.getElementById('bnavNotices');
            if (b) b.click();
        }
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#noticesGrid .notice-item-card, #noticesGrid", timeout=6000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig12_college_notices.png"))

    print("[13/19] fig13_notice_attachment.png...")
    page.evaluate("""() => {
        const modal = document.getElementById('studentAttachmentModal');
        const titleEl = document.getElementById('studentAttachmentModalTitle');
        const bodyEl = document.getElementById('studentAttachmentModalBody');
        if (modal && bodyEl) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            if (titleEl) titleEl.textContent = 'Notice: End-Term Examination Datesheet Nov-Dec 2026';
            bodyEl.innerHTML = `
                <div style=\"padding: 18px 14px; text-align: center;\">
                    <div style=\"background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 14px; padding: 22px 16px; box-shadow: 0 4px 16px rgba(14, 165, 233, 0.1);\">
                        <div style=\"font-size: 2.6rem; margin-bottom: 8px;\">📄</div>
                        <h4 style=\"margin: 0 0 6px 0; font-size: 1.05rem; color: #1e3a8a;\">Official SRCC Examination Circular</h4>
                        <p style=\"font-size: 0.82rem; color: #475569; margin: 0 0 16px 0; line-height: 1.4;\">Verified University of Delhi Circular • Ref: SRCC/PO/2026/894<br>Category: <strong>EXAMINATION</strong> • Issued: <strong>19 Oct 2026</strong></p>
                        <a href=\"#\" style=\"display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 20px; background: #0284c7; color: #fff; font-weight: 700; font-size: 0.88rem; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.25);\">
                            <span>📥</span> <span>Open Attached PDF Document (srcc.edu)</span>
                        </a>
                    </div>
                </div>
            `;
        }
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig13_notice_attachment.png"))
    page.evaluate("() => { document.getElementById('studentAttachmentModal').style.display = 'none'; }")

    print("[14/19] fig14_exam_codes.png...")
    page.evaluate("""() => {
        if (typeof window.switchAppMode === 'function') {
            window.switchAppMode('exam_codes');
        } else {
            const b = document.getElementById('bnavExamCodes');
            if (b) b.click();
        }
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#examCodesGrid", timeout=6000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig14_exam_codes.png"))

    print("[15/19] fig15_campus_drawer.png...")
    page.evaluate("""() => {
        window._openCampusDrawer();
    }""")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig15_campus_drawer.png"))
    page.evaluate("() => { window._closeCampusDrawer(); }")

    print("[16/19] fig16_class_notifications.png...")
    page.evaluate("""() => {
        const modal = document.getElementById('classNotifModal');
        if (modal) modal.style.display = 'flex';
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig16_class_notifications.png"))
    page.evaluate("() => { document.getElementById('classNotifModal').style.display = 'none'; }")

    print("[17/19] fig17_share_modal.png...")
    page.evaluate("""() => {
        const modal = document.getElementById('shareModal');
        const prev = document.getElementById('sharePreviewText');
        if (modal) {
            modal.style.display = 'flex';
            if (prev) {
                prev.innerHTML = `<strong>🏛️ Room PB3 (Principal Bungalow) is FREE!</strong><br>📅 Wednesday · Period 4 (11:30 AM – 12:30 PM)<br>🎯 Ideal for Group Discussion (GD), Case Study Prep & Peer Study.<br>🔗 Live check: srcc-free-classrooms.netlify.app`;
            }
        }
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig17_share_modal.png"))
    page.evaluate("() => { document.getElementById('shareModal').style.display = 'none'; }")

    print("[18/19] fig18_report_issue.png...")
    page.evaluate("""() => {
        const rModal = document.getElementById('reportIssueModal');
        if (rModal) rModal.style.display = 'flex';
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig18_report_issue.png"))
    page.evaluate("() => { document.getElementById('reportIssueModal').style.display = 'none'; }")

    print("[19/19] fig19_widget_preview.png...")
    page.goto(f"http://127.0.0.1:{PORT}/web_app/widget.html")
    page.wait_for_timeout(800)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig19_widget_preview.png"))

    browser.close()

httpd.shutdown()
print("[SUCCESS] All 19 figures generated with perfect alignment and high resolution!")
