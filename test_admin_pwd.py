import asyncio
import os
from playwright.async_api import async_playwright

HTML_PATH = os.path.abspath("web_app/admin.html").replace("\\", "/")
FILE_URL = f"file:///{HTML_PATH}"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("[*] Navigating to admin.html...")
        await page.goto(FILE_URL, wait_until="load")
        await asyncio.sleep(1)

        # 1. Login as admin with srcc2026
        print("[1] Login as admin with srcc2026...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)

        dash = await page.is_visible("#adminDashboardView")
        print(f"    Dashboard visible: {dash}")

        # 2. Change password of admin
        print("[2] Submitting change password for admin (Current: srcc2026, New: MyNewPass999!, Confirm: MyNewPass999!)...")
        await page.fill("#pwdCurrent", "srcc2026")
        await page.fill("#pwdNew", "MyNewPass999!")
        await page.fill("#pwdConfirm", "MyNewPass999!")
        await page.click("#btnSubmitChangePwd")
        await asyncio.sleep(1)

        users_stored = await page.evaluate("() => localStorage.getItem('srcc_admin_users_list_v1')")
        print(f"    Users in localStorage: {users_stored}")

        # 3. Logout
        print("[3] Logging out...")
        await page.click("#btnAdminLogout")
        await asyncio.sleep(1)

        # 4. Try OLD password srcc2026
        print("[4] Testing OLD password (srcc2026)...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        old_dash = await page.is_visible("#adminDashboardView")
        print(f"    OLD password login - Dashboard visible: {old_dash} (SHOULD BE FALSE!)")

        if old_dash:
            print("    [BUG CONFIRMED] Old password STILL works after change!")
            await page.click("#btnAdminLogout")
            await asyncio.sleep(1)

        # 5. Try NEW password MyNewPass999!
        print("[5] Testing NEW password (MyNewPass999!)...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "MyNewPass999!")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1)
        new_dash = await page.is_visible("#adminDashboardView")
        print(f"    NEW password login - Dashboard visible: {new_dash} (SHOULD BE TRUE!)")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
