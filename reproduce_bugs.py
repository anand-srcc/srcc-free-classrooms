import asyncio
import os
from playwright.async_api import async_playwright

FILE_URL = "https://srccroomfinder.netlify.app/admin.html"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Listen to console messages and errors
        page.on("console", lambda msg: print(f"[BROWSER CONSOLE {msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[BROWSER ERROR]: {err}"))

        print(f"[*] Navigating to {FILE_URL}...")
        await page.goto(FILE_URL, wait_until="load")
        await asyncio.sleep(1)

        # 1. Check if auth screen is displayed
        auth_visible = await page.is_visible("#adminAuthView")
        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"[1] Initial view - Auth screen: {auth_visible}, Dashboard: {dash_visible}")

        # 2. Login as master admin
        print("[2] Logging in as master admin (admin / srcc2026)...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        auth_visible = await page.is_visible("#adminAuthView")
        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"    After login - Auth screen: {auth_visible}, Dashboard: {dash_visible}")

        # Check localStorage users
        users_in_storage = await page.evaluate("() => localStorage.getItem('srcc_admin_users_list_v1')")
        print(f"    localStorage users: {users_in_storage}")

        # 3. Create a new user
        print("\n[3] Creating new user 'testcoord' / 'CoordPass123!'...")
        await page.fill("#newUserUsername", "testcoord")
        await page.fill("#newUserFullName", "Test Coordinator")
        await page.fill("#newUserPassword", "CoordPass123!")
        await page.select_option("#newUserRole", "Leave Coordinator")
        await page.click("#btnSubmitCreateUser")
        await asyncio.sleep(1)

        # Check users after creation
        users_in_storage = await page.evaluate("() => localStorage.getItem('srcc_admin_users_list_v1')")
        print(f"    localStorage users after create: {users_in_storage}")

        # 4. Logout
        print("\n[4] Logging out of admin...")
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)
        auth_visible = await page.is_visible("#adminAuthView")
        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"    After logout - Auth screen: {auth_visible}, Dashboard: {dash_visible}")

        # 5. Try login as newly created user 'testcoord'
        print("\n[5] Attempting login as 'testcoord' / 'CoordPass123!'...")
        await page.fill("#adminUsername", "testcoord")
        await page.fill("#adminPasscode", "CoordPass123!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        auth_visible = await page.is_visible("#adminAuthView")
        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"    Login result for 'testcoord' - Auth screen: {auth_visible}, Dashboard: {dash_visible}")
        if dash_visible:
            print("    --> NEW USER LOGIN: SUCCESS!")
        else:
            print("    --> NEW USER LOGIN: FAILED! (Could not log in)")

        # 6. Test Password Change
        print("\n[6] Testing Password Change...")
        # If logged in as testcoord or log back in as admin
        if not dash_visible:
            print("    Logging back in as admin to test password change...")
            await page.fill("#adminUsername", "admin")
            await page.fill("#adminPasscode", "srcc2026")
            await page.click("#btnAuthSubmit")
            await asyncio.sleep(1)

        # Now change password
        active_user = await page.evaluate("() => sessionStorage.getItem('srcc_admin_active_user_session')")
        print(f"    Active user session before change: {active_user}")
        print("    Submitting change password form (Current: srcc2026, New: NewPass456!, Confirm: NewPass456!)...")
        await page.fill("#pwdCurrent", "srcc2026")
        await page.fill("#pwdNew", "NewPass456!")
        await page.fill("#pwdConfirm", "NewPass456!")
        await page.click("#btnSubmitChangePwd")
        await asyncio.sleep(1)

        # Check users after password change
        users_after_pwd = await page.evaluate("() => localStorage.getItem('srcc_admin_users_list_v1')")
        print(f"    localStorage users after password change: {users_after_pwd}")

        # 7. Logout and re-login with old password (should fail) and new password (should succeed)
        print("\n[7] Logging out to test old vs new password...")
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)

        print("    Trying OLD password (srcc2026)...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        dash_with_old = await page.is_visible("#adminDashboardView")
        print(f"    Login with old password - Dashboard visible: {dash_with_old} (Expected: False)")

        print("    Trying NEW password (NewPass456!)...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "NewPass456!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        dash_with_new = await page.is_visible("#adminDashboardView")
        print(f"    Login with new password - Dashboard visible: {dash_with_new} (Expected: True)")

        # Also test on live site URL if needed
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
