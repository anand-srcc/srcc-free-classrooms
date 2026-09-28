import asyncio
import json
import os
from playwright.async_api import async_playwright
from playwright_stealth.stealth import Stealth

STATE_FILE = "playwright_state.json"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        print("[*] Opening studentassistsrcc.app in browser...", flush=True)
        await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded")
        await asyncio.sleep(2)

        # Check if login form exists
        roll = page.locator("input[placeholder*='Roll' i], input[type='text']")
        if await roll.count() > 0 and await roll.first.is_visible():
            print("[*] Filling student login credentials...", flush=True)
            await roll.first.fill("25BC070")
            pwd = page.locator("input[type='password']")
            if await pwd.count() > 0:
                await pwd.first.fill("RFSCH250900681809")

            print("[*] Looking for Cloudflare Turnstile widget...", flush=True)
            # Try to click Turnstile checkbox if visible in iframe
            try:
                for _ in range(5):
                    cf_frame = page.frame_locator('iframe[src*="challenges.cloudflare.com"]')
                    cb = cf_frame.locator('input[type="checkbox"], #challenge-stage, .ctp-checkbox-label')
                    if await cb.count() > 0 and await cb.first.is_visible():
                        print("[*] Clicking Cloudflare Turnstile checkbox...", flush=True)
                        await cb.first.click()
                        break
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"[*] Note on Turnstile click: {e}", flush=True)

            print("[*] Waiting for Turnstile response token (up to 15s)...", flush=True)
            for i in range(30):
                val = await page.evaluate("() => document.querySelector('input[name=\"cf-turnstile-response\"]')?.value || ''")
                if val:
                    print(f"[*] Turnstile Solved! Token length: {len(val)}", flush=True)
                    break
                await asyncio.sleep(0.5)

            btn = page.locator("button[type='submit'], button:has-text('Login')")
            if await btn.count() > 0:
                print("[*] Clicking Login button...", flush=True)
                await btn.first.click()

            print("[*] Waiting for login completion...", flush=True)
            await asyncio.sleep(5)

        # Now test /api/bootstrap
        print("[*] Fetching /api/bootstrap...", flush=True)
        res = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/api/bootstrap', { credentials: 'include' });
                    return await r.json();
                } catch(e) {
                    return { error: e.toString() };
                }
            }
        """)

        auth = res.get('authenticated', False)
        print(f"[*] Authenticated: {auth}")

        if auth:
            await context.storage_state(path=STATE_FILE)
            print(f"[*] SUCCESS! Saved fresh persistent session to {STATE_FILE}")

            absences = res.get('absences', [])
            print(f"[*] TOTAL ABSENCES TODAY: {len(absences)}")
            teachers_map = res.get('teachers', {})
            if isinstance(teachers_map, list):
                teachers_map = {str(t.get('id', '')): t for t in teachers_map}

            full_leaves = []
            for a in absences:
                tid = str(a.get('teacher_id', ''))
                tinfo = teachers_map.get(tid, {}) if isinstance(teachers_map, dict) else {}
                tname = a.get('teacher_name') or tinfo.get('name') or tid
                print(f"  - Teacher: {tname} (ID: {tid}), Reason: {a.get('reason')}, Dates: {a.get('start_date')} to {a.get('end_date')}")
                full_leaves.append({
                    "teacher_id": tid,
                    "teacher_name": tname,
                    "teacher_code": tinfo.get('short_code', ''),
                    "department": tinfo.get('department', ''),
                    "start_date": a.get('start_date', ''),
                    "end_date": a.get('end_date', ''),
                    "reason": a.get('reason', 'Official Leave'),
                    "status": "On Leave"
                })

            with open("scraped_live_absences.json", "w", encoding="utf-8") as f:
                json.dump(full_leaves, f, indent=2)
            print("[*] Dumped all leaves to scraped_live_absences.json")
        else:
            print("[*] Still not authenticated. Current site response:")
            print(res)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
