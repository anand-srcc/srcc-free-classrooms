import asyncio
import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from playwright.async_api import async_playwright

import http.server
import socketserver
import threading

PORT = 8765
DIRECTORY = os.path.abspath("web_app")

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

server_thread = threading.Thread(target=start_server, daemon=True)
server_thread.start()

ADMIN_URL = f"http://localhost:{PORT}/admin.html"
INDEX_URL = f"http://localhost:{PORT}/index.html"

async def test_full_lifecycle():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[CONSOLE {msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR]: {err}"))

        print("=================================================================")
        print("PHASE 1: PUBLIC WEBSITE AUDIT & DAILY VERIFIED DATE CHECK")
        print("=================================================================")
        await page.goto(INDEX_URL, wait_until="load")
        await page.wait_for_function("() => parseInt(document.getElementById('statRoomCount')?.textContent || '0') > 0", timeout=10000)

        # Check Daily Verified Date in Header
        header_date = await page.inner_text("#lastUpdatedHeader")
        ribbon_date = await page.inner_text("#statLastSynced")
        footer_date = await page.inner_text("#footerLastSynced")
        print(f"[*] Header Verified Date: '{header_date}'")
        print(f"[*] Ribbon Verified Date: '{ribbon_date}'")
        print(f"[*] Footer Verified Date: '{footer_date}'")
        assert "Today" in header_date, f"Expected 'Today' in header date, got {header_date}"
        assert "Today" in ribbon_date, f"Expected 'Today' in ribbon date, got {ribbon_date}"

        # Check Classrooms
        room_count = await page.inner_text("#statRoomCount")
        print(f"[*] Total Classrooms displayed: {room_count}")
        assert int(room_count) > 0, "No rooms displayed!"

        # Check Faculty Locator & Departments (English, Political Science)
        print("[*] Switching to Faculty Locator...")
        await page.click("#tabModeFaculty")
        await asyncio.sleep(0.5)
        
        # Check Department pills
        await page.click("button[data-dept='English']")
        await asyncio.sleep(0.5)
        eng_faculty = await page.evaluate("() => document.querySelectorAll('#facultyGrid .faculty-card').length")
        print(f"[*] English Faculty count: {eng_faculty}")
        assert eng_faculty > 0, "English faculty filter returned 0!"

        await page.click("button[data-dept='Political Science']")
        await asyncio.sleep(0.5)
        pol_faculty = await page.evaluate("() => document.querySelectorAll('#facultyGrid .faculty-card').length")
        print(f"[*] Political Science Faculty count: {pol_faculty}")
        assert pol_faculty > 0, "Political Science faculty filter returned 0!"

        print("\n=================================================================")
        print("PHASE 2: ADMIN AUTHENTICATION & DEFAULT ADMIN PASSCODE LOGIN")
        print("=================================================================")
        await page.goto(ADMIN_URL, wait_until="load")
        await asyncio.sleep(1)

        # Ensure localStorage has default user
        await page.evaluate("() => localStorage.removeItem('srcc_admin_users_list_v1')")
        await page.reload()
        await asyncio.sleep(0.5)

        # Test login with empty username (should default to admin) + passcode srcc2026
        print("[*] Testing login with EMPTY username + srcc2026 (Optional default Admin)...")
        await page.fill("#adminUsername", "")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"    Dashboard visible: {dash_visible}")
        assert dash_visible, "Default admin login failed when username was left empty!"

        print("\n=================================================================")
        print("PHASE 3: USER CREATION & SUB-ADMIN ROLE TEST (TEST A)")
        print("=================================================================")
        print("[*] Creating sub-admin user 'coord2' with password 'CoordPass789!'...")
        await page.fill("#newUserUsername", "coord2")
        await page.fill("#newUserFullName", "Priya Sharma (Coord)")
        await page.fill("#newUserPassword", "CoordPass789!")
        await page.select_option("#newUserRole", "Leave Coordinator")
        await page.click("#btnSubmitCreateUser")
        await asyncio.sleep(1)

        # Check localStorage to ensure user was stored
        users_raw = await page.evaluate("() => localStorage.getItem('srcc_admin_users_list_v1')")
        print(f"    Users stored in localStorage: {users_raw}")
        assert "coord2" in users_raw, "coord2 was not saved in localStorage!"

        # Logout of master admin
        print("[*] Logging out of master admin...")
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)
        assert await page.is_visible("#adminAuthView"), "Auth view not visible after logout!"

        # Attempt login as coord2
        print("[*] Logging in as newly created user 'coord2' / 'CoordPass789!'...")
        await page.fill("#adminUsername", "coord2")
        await page.fill("#adminPasscode", "CoordPass789!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        coord_dash = await page.is_visible("#adminDashboardView")
        print(f"    coord2 login result - Dashboard visible: {coord_dash}")
        assert coord_dash, "Newly created user coord2 FAILED to log in!"

        # Verify active session role
        active_sess = await page.evaluate("() => sessionStorage.getItem('srcc_admin_active_user_session')")
        print(f"    coord2 active session: {active_sess}")
        assert "coord2" in active_sess and "Leave Coordinator" in active_sess

        # Verify coord2 cannot delete users
        can_delete = await page.evaluate("""() => {
            const btns = document.querySelectorAll('.btn-delete-admin-user');
            return btns.length;
        }""")
        print(f"    coord2 can see delete buttons: {can_delete} (Expected: 0)")
        assert can_delete == 0, "Non-super admin was improperly granted delete buttons!"

        print("\n=================================================================")
        print("PHASE 4: PASSWORD CHANGE LIFECYCLE (TEST B)")
        print("=================================================================")
        # Test 1: Change password with WRONG current password
        print("[*] Step 4.1: Attempting password change with WRONG current password...")
        await page.fill("#pwdCurrent", "WrongCurrentPass123!")
        await page.fill("#pwdNew", "CoordNewPass999!")
        await page.fill("#pwdConfirm", "CoordNewPass999!")
        await page.click("#btnSubmitChangePwd")
        await asyncio.sleep(1)

        # Check toast
        toast_text = await page.inner_text("#toastContainer")
        clean_toast = toast_text.encode('ascii', 'replace').decode('ascii')
        print(f"    Toast message: {clean_toast}")
        assert "Current password incorrect" in toast_text, "Failed to reject incorrect current password!"

        # Test 2: Change password with correct current password
        print("[*] Step 4.2: Changing password for coord2 (Current: CoordPass789! -> New: CoordNewPass999!)...")
        await page.fill("#pwdCurrent", "CoordPass789!")
        await page.fill("#pwdNew", "CoordNewPass999!")
        await page.fill("#pwdConfirm", "CoordNewPass999!")
        await page.click("#btnSubmitChangePwd")
        await asyncio.sleep(1)

        toast_success = await page.inner_text("#toastContainer")
        clean_success = toast_success.encode('ascii', 'replace').decode('ascii')
        print(f"    Toast message: {clean_success}")
        assert "Password updated successfully" in toast_success, "Password update success toast not found!"

        # Step 4.3: Logout
        print("[*] Step 4.3: Logging out...")
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)

        # Step 4.4: Attempt login with OLD password (CoordPass789!) -> MUST FAIL
        print("[*] Step 4.4: Attempting login with OLD password 'CoordPass789!'...")
        await page.fill("#adminUsername", "coord2")
        await page.fill("#adminPasscode", "CoordPass789!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        old_login_dash = await page.is_visible("#adminDashboardView")
        print(f"    Old password login result - Dashboard visible: {old_login_dash} (Expected: False)")
        assert not old_login_dash, "CRITICAL ERROR: Old password was accepted after change!"

        # Step 4.5: Attempt login with NEW password (CoordNewPass999!) -> MUST SUCCEED
        print("[*] Step 4.5: Attempting login with NEW password 'CoordNewPass999!'...")
        await page.fill("#adminUsername", "coord2")
        await page.fill("#adminPasscode", "CoordNewPass999!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        new_login_dash = await page.is_visible("#adminDashboardView")
        print(f"    New password login result - Dashboard visible: {new_login_dash} (Expected: True)")
        assert new_login_dash, "CRITICAL ERROR: New password was not accepted!"

        # Step 4.6: Session persistence on reload
        print("[*] Step 4.6: Testing session persistence across page reload...")
        await page.reload()
        await asyncio.sleep(1)
        reload_dash = await page.is_visible("#adminDashboardView")
        print(f"    After reload - Dashboard visible: {reload_dash} (Expected: True)")
        assert reload_dash, "Session lost on reload!"

        print("\n=================================================================")
        print("PHASE 5: MASTER ADMIN PASSWORD CHANGE LIFECYCLE")
        print("=================================================================")
        # Logout coord2
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)

        # Login master admin
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        # Change admin password
        print("[*] Changing master admin password (Current: srcc2026 -> New: SuperSecureAdmin2026!)...")
        await page.fill("#pwdCurrent", "srcc2026")
        await page.fill("#pwdNew", "SuperSecureAdmin2026!")
        await page.fill("#pwdConfirm", "SuperSecureAdmin2026!")
        await page.click("#btnSubmitChangePwd")
        await asyncio.sleep(1)

        # Logout
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)

        # Test OLD admin password srcc2026 -> MUST FAIL
        print("[*] Testing old master admin password 'srcc2026'...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        admin_old_dash = await page.is_visible("#adminDashboardView")
        print(f"    Old admin password login - Dashboard visible: {admin_old_dash} (Expected: False)")
        assert not admin_old_dash, "CRITICAL: Default admin password still works after admin changed password!"

        # Test NEW admin password -> MUST SUCCEED
        print("[*] Testing new master admin password 'SuperSecureAdmin2026!'...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "SuperSecureAdmin2026!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        admin_new_dash = await page.is_visible("#adminDashboardView")
        print(f"    New admin password login - Dashboard visible: {admin_new_dash} (Expected: True)")
        assert admin_new_dash, "New admin password failed to log in!"

        print("\n=================================================================")
        print("PHASE 6: MOBILE RESPONSIVENESS AUDIT (320px to 430px)")
        print("=================================================================")
        viewports = [320, 360, 375, 390, 414, 430]
        for w in viewports:
            await page.set_viewport_size({"width": w, "height": 700})
            await asyncio.sleep(0.3)
            # Check horizontal overflow
            scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
            inner_width = await page.evaluate("() => window.innerWidth")
            print(f"    Viewport {w}px: scrollWidth={scroll_width}, innerWidth={inner_width}")
            assert scroll_width <= inner_width + 1, f"Horizontal overflow detected at {w}px! ({scroll_width} > {inner_width})"

        print("\n=================================================================")
        print("[SUCCESS] ALL AUDIT & LIFECYCLE TESTS PASSED! ZERO FAILURES.")
        print("=================================================================")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(test_full_lifecycle())
