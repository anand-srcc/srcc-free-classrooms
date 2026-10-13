import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright
from playwright_stealth.stealth import Stealth

STATE_FILE = "playwright_state.json"
DEFAULT_ROLL = "25BC070"
DEFAULT_PASS = ""

async def main():
    student_roll = os.environ.get("SRCC_ROLL", DEFAULT_ROLL)
    student_pass = os.environ.get("SRCC_PASS", DEFAULT_PASS)

    print("=" * 65, flush=True)
    print("SRCC STUDENT ASSIST AUTHENTICATION & DATA EXTRACTOR", flush=True)
    print(f"Target Account: {student_roll}", flush=True)
    print("=" * 65, flush=True)

    async with async_playwright() as p:
        browser = None
        launch_kwargs = {
            "headless": False,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--start-maximized"
            ]
        }
        try:
            browser = await p.chromium.launch(channel="chrome", **launch_kwargs)
        except Exception:
            browser = await p.chromium.launch(**launch_kwargs)

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            no_viewport=True
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        print("[*] Opening https://www.studentassistsrcc.app/ in browser...", flush=True)
        try:
            await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            print(f"[*] Navigation note: {e}", flush=True)

        await asyncio.sleep(2)

        # Check if already authenticated via previous state
        auth_status = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/api/bootstrap', { credentials: 'include' });
                    const j = await r.json();
                    return j.authenticated === true;
                } catch(e) { return false; }
            }
        """)

        if not auth_status:
            print("[*] Filling roll number and password...", flush=True)
            roll_loc = page.locator("input[placeholder*='Roll' i], input[type='text']")
            if await roll_loc.count() > 0:
                await roll_loc.first.fill(student_roll)

            pwd_loc = page.locator("input[type='password']")
            if await pwd_loc.count() > 0:
                await pwd_loc.first.fill(student_pass)

            print("[*] Checking for Cloudflare Turnstile verification...", flush=True)
            print("[*] (If a checkbox appears on the browser window, please click it to verify)", flush=True)

            # Wait loop: wait until Turnstile token appears or user solves it
            for attempt in range(120):
                # Check if user already logged in manually in the browser window
                is_now_auth = await page.evaluate("""
                    async () => {
                        try {
                            const r = await fetch('/api/bootstrap', { credentials: 'include' });
                            const j = await r.json();
                            return j.authenticated === true;
                        } catch(e) { return false; }
                    }
                """)
                if is_now_auth:
                    print("[*] Detected successful login inside browser!", flush=True)
                    break

                token = await page.evaluate("() => document.querySelector('input[name=\"cf-turnstile-response\"]')?.value || ''")
                if token:
                    print(f"[*] Turnstile token ready ({len(token)} chars)!", flush=True)
                    break

                if attempt % 10 == 0 and attempt > 0:
                    print(f"[*] Still waiting for Cloudflare Turnstile verification ({attempt}/120s)...", flush=True)

                # Try auto-clicking frame checkbox if possible
                for frame in page.frames:
                    if "challenges.cloudflare.com" in frame.url:
                        cb = frame.locator('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label, body')
                        if await cb.count() > 0:
                            try:
                                await cb.first.click(timeout=1000)
                            except Exception:
                                pass
                await asyncio.sleep(1)

            btn = page.locator("button[type='submit'], button:has-text('Login')")
            if await btn.count() > 0:
                print("[*] Submitting login...", flush=True)
                await btn.first.click()

            # Poll for authentication success up to 30 seconds
            print("[*] Waiting for dashboard session confirmation...", flush=True)
            for i in range(30):
                await asyncio.sleep(1)
                boot_res = await page.evaluate("""
                    async () => {
                        try {
                            const r = await fetch('/api/bootstrap', { credentials: 'include' });
                            return await r.json();
                        } catch(e) { return {}; }
                    }
                """)
                if boot_res.get("authenticated"):
                    print("[*] LOGIN CONFIRMED! Session is active.", flush=True)
                    break
        else:
            print("[*] Session is already authenticated!", flush=True)

        # Final bootstrap check
        res = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/api/bootstrap', { credentials: 'include' });
                    return await r.json();
                } catch(e) { return { error: e.toString() }; }
            }
        """)

        auth = res.get('authenticated', False)
        print(f"[*] Authenticated Status: {auth}", flush=True)

        if auth:
            await context.storage_state(path=STATE_FILE)
            print(f"[*] Successfully saved persistent cookies to {STATE_FILE}!", flush=True)

            # 1. Save absences
            absences = res.get('absences', [])
            print(f"[*] TOTAL ABSENCES TODAY: {len(absences)}", flush=True)
            with open("scraped_live_absences.json", "w", encoding="utf-8") as f:
                json.dump(absences, f, indent=2)

            # 2. Save rooms
            rooms = res.get('rooms', [])
            print(f"[*] TOTAL ROOMS EXTRACTED: {len(rooms)}", flush=True)
            with open("scraped_rooms.json", "w", encoding="utf-8") as f:
                json.dump(rooms, f, indent=2)

            # 3. Save teachers
            teachers = res.get('teachers', [])
            print(f"[*] TOTAL TEACHERS EXTRACTED: {len(teachers)}", flush=True)
            with open("scraped_teachers.json", "w", encoding="utf-8") as f:
                json.dump(teachers, f, indent=2)

            # 4. Fetch schedule
            print("[*] Fetching personal timetable...", flush=True)
            sched = await page.evaluate("""
                async () => {
                    try {
                        const r = await fetch('/api/student_schedule', { credentials: 'include' });
                        return await r.json();
                    } catch(e) { return {}; }
                }
            """)
            with open("scraped_student_schedule.json", "w", encoding="utf-8") as f:
                json.dump(sched, f, indent=2)
            print("[*] Saved schedule to scraped_student_schedule.json", flush=True)

            # 5. Fetch campus map
            print("[*] Fetching campus navigation graph...", flush=True)
            campus = await page.evaluate("""
                async () => {
                    try {
                        const r = await fetch('/api/campus', { credentials: 'include' });
                        return await r.json();
                    } catch(e) { return {}; }
                }
            """)
            with open("scraped_campus_map.json", "w", encoding="utf-8") as f:
                json.dump(campus, f, indent=2)
            print("[*] Saved campus graph to scraped_campus_map.json", flush=True)

            print("\n" + "=" * 65, flush=True)
            print("EXTRACTION COMPLETE! ALL FILES SAVED SUCCESSFULLY.", flush=True)
            print("=" * 65, flush=True)
        else:
            print("[!] Could not authenticate. Current server response:", flush=True)
            print(res, flush=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
