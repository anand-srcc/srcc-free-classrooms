import http.server
import socketserver
import threading
import os
import time
from playwright.sync_api import sync_playwright

PORT = 8996
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
ASSETS_DIR = os.path.join(ROOT_DIR, "manual_assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # quiet

httpd = socketserver.TCPServer(('127.0.0.1', PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"[OK] HTTP Server running on http://127.0.0.1:{PORT}")

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
    
    # 1. Standard Mobile Viewport (430x920, 2x scale factor for crisp retina screenshots)
    context = browser.new_context(
        viewport={'width': 430, 'height': 920},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True
    )
    
    page = context.new_page()
    page.goto(f"http://127.0.0.1:{PORT}/web_app/index.html")
    page.wait_for_selector("#roomsGrid .room-card", timeout=12000)
    
    # Dismiss banner or hide prompt so clean view
    page.evaluate("""() => {
        const b = document.getElementById('leaveNotificationPromptBanner');
        if (b) b.style.display = 'none';
        const off = document.getElementById('offlineIndicatorBanner');
        if (off) off.style.display = 'none';
    }""")
    
    print("[1/19] Capturing fig1_landing_page.png...")
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig1_landing_page.png"))
    
    print("[2/19] Capturing fig2_pwa_install.png...")
    page.evaluate("""() => {
        const m = document.getElementById('pwaInstallModal');
        if (m) {
            m.style.display = 'flex';
            m.style.alignItems = 'center';
            m.style.justifyContent = 'center';
        }
    }""")
    page.wait_for_timeout(400)
    # Take screenshot of the install modal card itself
    pwa_card = page.locator('#pwaInstallModal .install-modal')
    if pwa_card.count() > 0:
        pwa_card.screenshot(path=os.path.join(ASSETS_DIR, "fig2_pwa_install.png"))
    else:
        page.screenshot(path=os.path.join(ASSETS_DIR, "fig2_pwa_install.png"))
    page.evaluate("() => { document.getElementById('pwaInstallModal').style.display = 'none'; }")

    print("[3/19] Capturing fig3_category_pb.png (Classroom Cards)...")
    # Click PB pill or scroll down to show actual room cards
    page.evaluate("""() => {
        const pill = document.querySelector('.cat-pill[data-cat=\"PB\"]');
        if (pill) pill.click();
        window.scrollTo(0, 260);
    }""")
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig3_category_pb.png"))

    print("[4/19] Capturing fig4_free_now.png...")
    page.evaluate("""() => {
        window.scrollTo(0, 0);
        const btn = document.getElementById('btnFreeNow');
        if (btn) btn.click();
    }""")
    page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig4_free_now.png"))
    # Turn Free Now off
    page.evaluate("""() => {
        const btn = document.getElementById('btnFreeNow');
        if (btn && btn.getAttribute('aria-checked') === 'true') btn.click();
        const allPill = document.querySelector('.cat-pill[data-cat=\"ALL\"]');
        if (allPill) allPill.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_timeout(400)

    print("[5/19] Capturing fig5_room_modal.png...")
    page.evaluate("""() => {
        if (typeof window.openScheduleModal === 'function') {
            window.openScheduleModal('R35', 'Wednesday');
        }
    }""")
    page.wait_for_selector("#scheduleModal .modal-card", timeout=5000)
    page.wait_for_timeout(600)
    room_modal_card = page.locator('#scheduleModal .modal-card')
    room_modal_card.screenshot(path=os.path.join(ASSETS_DIR, "fig5_room_modal.png"))
    page.evaluate("() => { document.getElementById('scheduleModal').style.display = 'none'; }")

    print("[6/19] Capturing fig6_calendar_reminder.png...")
    page.evaluate("""() => {
        const cal = document.getElementById('calendarReminderModal');
        if (cal) {
            cal.style.display = 'flex';
            cal.style.alignItems = 'center';
            cal.style.justifyContent = 'center';
            document.getElementById('calReminderRoomName').textContent = 'Room R35 (Canteen Building)';
            document.getElementById('calReminderSlotTime').textContent = 'Wednesday · 11:30 AM – 12:30 PM';
        }
    }""")
    page.wait_for_timeout(400)
    cal_card = page.locator('#calendarReminderModal .modal-card')
    cal_card.screenshot(path=os.path.join(ASSETS_DIR, "fig6_calendar_reminder.png"))
    page.evaluate("() => { document.getElementById('calendarReminderModal').style.display = 'none'; }")

    print("[7/19] Capturing fig7_faculty_directory.png...")
    page.evaluate("""() => {
        const tab = document.getElementById('tabModeFaculty');
        if (tab) tab.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#facultyGrid .faculty-card", timeout=6000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig7_faculty_directory.png"))

    print("[8/19] Capturing fig8_faculty_email.png...")
    page.evaluate("""() => {
        const emailModal = document.getElementById('facultyEmailModal');
        if (emailModal) {
            emailModal.style.display = 'flex';
            emailModal.style.alignItems = 'center';
            emailModal.style.justifyContent = 'center';
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
    email_card = page.locator('#facultyEmailModal .faculty-email-modal-card')
    email_card.screenshot(path=os.path.join(ASSETS_DIR, "fig8_faculty_email.png"))
    page.evaluate("() => { document.getElementById('facultyEmailModal').style.display = 'none'; }")

    print("[9/19] Capturing fig9_teacher_modal.png...")
    page.evaluate("""() => {
        if (typeof window.openTeacherModal === 'function') {
            window.openTeacherModal('cg16');
        }
    }""")
    page.wait_for_selector("#teacherModal .modal-card", timeout=5000)
    page.wait_for_timeout(600)
    teacher_card = page.locator('#teacherModal .modal-card')
    teacher_card.screenshot(path=os.path.join(ASSETS_DIR, "fig9_teacher_modal.png"))
    page.evaluate("() => { document.getElementById('teacherModal').style.display = 'none'; }")

    print("[10/19] Capturing fig10_leaves_modal.png...")
    page.evaluate("""() => {
        const lModal = document.getElementById('leaveManagerModal');
        if (lModal) {
            lModal.style.display = 'flex';
            lModal.style.alignItems = 'center';
            lModal.style.justifyContent = 'center';
            if (typeof window.renderLeavesModalList === 'function') {
                window.renderLeavesModalList();
            }
        }
    }""")
    page.wait_for_timeout(500)
    leaves_card = page.locator('#leaveManagerModal .modal-card')
    leaves_card.screenshot(path=os.path.join(ASSETS_DIR, "fig10_leaves_modal.png"))
    page.evaluate("() => { document.getElementById('leaveManagerModal').style.display = 'none'; }")

    print("[11/19] Capturing fig11_student_timetable.png...")
    page.evaluate("""() => {
        const tab = document.getElementById('tabModeTimetable');
        if (tab) tab.click();
        window.scrollTo(0, 0);
    }""")
    page.wait_for_selector("#ttMainScheduleGrid", timeout=5000)
    page.wait_for_timeout(600)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig11_student_timetable.png"))

    print("[12/19] Capturing fig12_college_notices.png (NEW)...")
    # Click 3-line menu or switch directly to notices
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

    print("[13/19] Capturing fig13_notice_attachment.png (NEW)...")
    page.evaluate("""() => {
        const modal = document.getElementById('studentAttachmentModal');
        const titleEl = document.getElementById('studentAttachmentModalTitle');
        const bodyEl = document.getElementById('studentAttachmentModalBody');
        if (modal && bodyEl) {
            modal.style.display = 'flex';
            modal.classList.add('active');
            if (titleEl) titleEl.textContent = 'Notice: Semester End Examinations Datesheet Nov-Dec 2026';
            bodyEl.innerHTML = `
                <div style=\"padding: 16px; text-align: center;\">
                    <div style=\"background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 20px;\">
                        <div style=\"font-size: 2.2rem; margin-bottom: 8px;\">📄</div>
                        <h4 style=\"margin: 0 0 6px 0; color: #1e3a8a;\">Official SRCC Examination Notice</h4>
                        <p style=\"font-size: 0.85rem; color: #475569; margin: 0 0 12px 0;\">Verified University of Delhi Circular • Ref: SRCC/PO/2026/894</p>
                        <a href=\"#\" style=\"display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; background: #0284c7; color: #fff; font-weight: 700; border-radius: 8px; text-decoration: none;\">📥 Download Attached PDF</a>
                    </div>
                </div>
            `;
        }
    }""")
    page.wait_for_timeout(400)
    att_card = page.locator('#studentAttachmentModal .attachment-modal-card')
    att_card.screenshot(path=os.path.join(ASSETS_DIR, "fig13_notice_attachment.png"))
    page.evaluate("() => { document.getElementById('studentAttachmentModal').style.display = 'none'; }")

    print("[14/19] Capturing fig14_exam_codes.png (NEW)...")
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
    page.wait_for_timeout(700)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig14_exam_codes.png"))

    print("[15/19] Capturing fig15_campus_drawer.png (NEW)...")
    page.evaluate("""() => {
        const overlay = document.getElementById('campusDrawerOverlay');
        const drawer = document.getElementById('campusDrawer');
        if (overlay && drawer) {
            overlay.style.display = 'block';
            drawer.style.transform = 'translateX(0)';
            drawer.style.opacity = '1';
        }
    }""")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig15_campus_drawer.png"))
    page.evaluate("() => { document.getElementById('campusDrawerOverlay').style.display = 'none'; }")

    print("[16/19] Capturing fig16_class_notifications.png (NEW)...")
    page.evaluate("""() => {
        const modal = document.getElementById('classNotifModal');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
        }
    }""")
    page.wait_for_timeout(400)
    class_notif_card = page.locator('#classNotifModal .modal-card')
    class_notif_card.screenshot(path=os.path.join(ASSETS_DIR, "fig16_class_notifications.png"))
    page.evaluate("() => { document.getElementById('classNotifModal').style.display = 'none'; }")

    print("[17/19] Capturing fig17_share_modal.png (NEW)...")
    page.evaluate("""() => {
        const modal = document.getElementById('shareModal');
        const prev = document.getElementById('sharePreviewText');
        if (modal) {
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            if (prev) {
                prev.innerHTML = `<strong>🏛️ Room R35 (Sports Complex / SCR) is FREE!</strong><br>📅 Wednesday · Period 4 (11:30 AM – 12:30 PM)<br>🎯 Suitable for Group Discussion (GD) & Self-Study.<br>🔗 Live check: srcc-free-classrooms.netlify.app`;
            }
        }
    }""")
    page.wait_for_timeout(400)
    share_card = page.locator('#shareModal .modal-card')
    share_card.screenshot(path=os.path.join(ASSETS_DIR, "fig17_share_modal.png"))
    page.evaluate("() => { document.getElementById('shareModal').style.display = 'none'; }")

    print("[18/19] Capturing fig18_report_issue.png...")
    page.evaluate("""() => {
        const rModal = document.getElementById('reportIssueModal');
        if (rModal) {
            rModal.style.display = 'flex';
            rModal.style.alignItems = 'center';
            rModal.style.justifyContent = 'center';
        }
    }""")
    page.wait_for_timeout(400)
    report_card = page.locator('#reportIssueModal .modal-card')
    report_card.screenshot(path=os.path.join(ASSETS_DIR, "fig18_report_issue.png"))
    page.evaluate("() => { document.getElementById('reportIssueModal').style.display = 'none'; }")

    print("[19/19] Capturing fig19_widget_preview.png...")
    page.goto(f"http://127.0.0.1:{PORT}/web_app/widget.html")
    page.wait_for_timeout(900)
    page.screenshot(path=os.path.join(ASSETS_DIR, "fig19_widget_preview.png"))

    browser.close()

httpd.shutdown()
print("[COMPLETE] All 19 high-resolution manual assets generated successfully!")
