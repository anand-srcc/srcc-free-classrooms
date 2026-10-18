import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

HTML_PATH = os.path.abspath("web_app/admin.html").replace("\\", "/")
FILE_URL = f"file:///{HTML_PATH}"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("[ADMIN TEST 1] Opening Admin Portal...")
        await page.goto(FILE_URL, wait_until="load")
        await asyncio.sleep(1)

        # 1. Login with srcc2026
        print("[ADMIN TEST 2] Logging in as admin...")
        await page.fill("#adminUsername", "admin")
        await page.fill("#adminPasscode", "srcc2026")
        await page.click("#btnAuthSubmit")
        await asyncio.sleep(1.5)

        dash_visible = await page.is_visible("#adminDashboardView")
        print(f"  -> Admin Dashboard Visible: {dash_visible}")
        assert dash_visible, "Dashboard should be visible after login!"

        # 2. Switch to Settings tab
        print("[ADMIN TEST 3] Switching to Settings tab...")
        await page.click("button[data-tab='settings']")
        await asyncio.sleep(0.5)

        card_visible = await page.is_visible("#adminMaintenanceSectionCard")
        print(f"  -> Maintenance Mode Card Visible: {card_visible}")
        assert card_visible, "Maintenance section card must be present!"

        badge_text = await page.inner_text("#adminMaintenanceStatusBadge")
        print(f"  -> Maintenance Badge Text: '{badge_text}'")

        # 3. Test Turning Maintenance OFF (Go Live)
        print("[ADMIN TEST 4] Clicking 'Go Live (Turn OFF)'...")
        await page.click("#btnToggleMaintenanceOff")
        await asyncio.sleep(0.5)

        badge_after_off = await page.inner_text("#adminMaintenanceStatusBadge")
        print(f"  -> Badge after turning OFF: '{badge_after_off}'")
        assert "LIVE" in badge_after_off, "Badge should reflect LIVE status!"

        # 4. Test Turning Maintenance ON (Lock Site)
        print("[ADMIN TEST 5] Clicking 'Lock Site (Turn ON)'...")
        await page.click("#btnToggleMaintenanceOn")
        await asyncio.sleep(0.5)

        badge_after_on = await page.inner_text("#adminMaintenanceStatusBadge")
        print(f"  -> Badge after turning ON: '{badge_after_on}'")
        assert "MAINTENANCE ACTIVE" in badge_after_on, "Badge should reflect MAINTENANCE status!"

        # 5. Test Saving custom message
        print("[ADMIN TEST 6] Updating custom announcement text...")
        await page.fill("#adminMaintenanceTitleInput", "SRCC Semester Upgrades")
        await page.fill("#adminMaintenanceMsgInput", "Timetable server sync in progress. Back shortly!")
        await page.click("#btnSaveMaintenanceMsg")
        await asyncio.sleep(0.5)

        stored_t = await page.evaluate("() => localStorage.getItem('srcc_maintenance_title')")
        print(f"  -> Saved in localStorage: '{stored_t}'")
        assert stored_t == "SRCC Semester Upgrades", "Title must be stored in localStorage!"

        print("\n🎉 ALL ADMIN MAINTENANCE DASHBOARD TESTS PASSED SUCCESSFULLY!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
