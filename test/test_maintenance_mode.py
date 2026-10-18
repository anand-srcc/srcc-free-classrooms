import asyncio
import os
import sys
from playwright.async_api import async_playwright

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

HTML_PATH = os.path.abspath("web_app/index.html").replace("\\", "/")
FILE_URL = f"file:///{HTML_PATH}"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("[TEST 1] Visiting student website as normal visitor...")
        await page.goto(FILE_URL, wait_until="load")
        await asyncio.sleep(1)

        # 1. Verify Maintenance Overlay is visible
        is_overlay_visible = await page.is_visible("#srccMaintenanceOverlay")
        print(f"  -> Maintenance Overlay Visible: {is_overlay_visible}")
        assert is_overlay_visible, "Overlay should be visible for normal visitor!"

        # Verify page header/features are hidden by the overlay / CSS
        header_hidden = await page.evaluate("() => getComputedStyle(document.querySelector('.app-header')).display === 'none'")
        print(f"  -> App Header hidden from visitor: {header_hidden}")

        # 2. Click "Administrator Access"
        print("[TEST 2] Clicking 'Administrator Access' button...")
        await page.click("#btnOpenAdminBypass")
        await asyncio.sleep(0.5)

        modal_visible = await page.is_visible("#srccAdminBypassModal")
        print(f"  -> Admin Bypass Modal Visible: {modal_visible}")
        assert modal_visible, "Admin Bypass Modal should be open!"

        # 3. Test wrong password
        print("[TEST 3] Testing WRONG password 'wrongpassword123'...")
        await page.fill("#srccBypassPassword", "wrongpassword123")
        await page.click("#btnSubmitBypass")
        await asyncio.sleep(0.5)

        err_msg = await page.inner_text("#srccBypassMsg")
        print(f"  -> Error message displayed: '{err_msg}'")
        assert "Incorrect" in err_msg, "Should show incorrect password message!"
        still_overlay = await page.is_visible("#srccMaintenanceOverlay")
        assert still_overlay, "Site must remain locked after wrong password!"

        # 4. Test CORRECT password srcc2026
        print("[TEST 4] Testing CORRECT admin password 'srcc2026'...")
        await page.fill("#srccBypassPassword", "srcc2026")
        await page.click("#btnSubmitBypass")
        await asyncio.sleep(1.5)

        overlay_after = await page.is_visible("#srccMaintenanceOverlay")
        print(f"  -> Maintenance Overlay Visible after unlock: {overlay_after}")
        assert not overlay_after, "Maintenance Overlay should be removed after correct password!"

        # 5. Verify website is unlocked and Admin Preview Bar is active
        admin_bar_visible = await page.is_visible("#srccAdminActiveBar")
        print(f"  -> Admin Preview Top Bar Visible: {admin_bar_visible}")
        assert admin_bar_visible, "Admin Preview Bar should be visible for unlocked admin!"

        header_now_visible = await page.evaluate("() => getComputedStyle(document.querySelector('.app-header')).display !== 'none'")
        print(f"  -> App Header now visible: {header_now_visible}")
        assert header_now_visible, "App Header should be visible now!"

        # 6. Test Re-lock button
        print("[TEST 5] Testing 'Re-lock Site' button...")
        await page.click("#btnRelockSite")
        await asyncio.sleep(1.5)

        relocked_overlay = await page.is_visible("#srccMaintenanceOverlay")
        print(f"  -> Re-locked Maintenance Overlay Visible: {relocked_overlay}")
        assert relocked_overlay, "Should be back under maintenance after clicking Re-lock!"

        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Maintenance Mode & Admin Unlock work perfectly!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
