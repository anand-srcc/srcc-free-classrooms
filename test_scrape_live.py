import asyncio
import json
from playwright.async_api import async_playwright
from playwright_stealth.stealth import Stealth

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)

        print("[*] Navigating to studentassistsrcc.app...", flush=True)
        await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded", timeout=45000)

        print("[*] Checking page elements...", flush=True)
        roll = page.locator("input[placeholder*='Roll' i], input[type='text']")
        if await roll.count() > 0:
            print("[*] Typing credentials...", flush=True)
            await roll.first.fill("25BC070")
            pwd = page.locator("input[type='password']")
            if await pwd.count() > 0:
                await pwd.first.fill("RFSCH250900681809")
            
            # Wait for turnstile
            print("[*] Waiting for turnstile...", flush=True)
            for _ in range(20):
                await asyncio.sleep(0.5)
                val = await page.evaluate("() => document.querySelector('input[name=\"cf-turnstile-response\"]')?.value || ''")
                if val:
                    print(f"[*] Turnstile token: {val[:30]}...", flush=True)
                    break
            
            btn = page.locator("button[type='submit']")
            if await btn.count() > 0:
                print("[*] Clicking login...", flush=True)
                await btn.first.click()
                await asyncio.sleep(5)

        # Check /api/bootstrap
        print("[*] Evaluating /api/bootstrap...", flush=True)
        data = await page.evaluate("""
            async () => {
                try {
                    const r = await fetch('/api/bootstrap', { credentials: 'include' });
                    return await r.json();
                } catch(e) {
                    return { error: e.toString() };
                }
            }
        """)
        
        print(f"[*] Auth status: {data.get('authenticated')}")
        absences = data.get('absences', [])
        print(f"[*] Total absences in API: {len(absences)}")
        for idx, a in enumerate(absences):
            print(f"  {idx+1}. {a}")

        # Also navigate to /leave and check DOM
        print("[*] Navigating to /leave...", flush=True)
        try:
            await page.goto("https://www.studentassistsrcc.app/leave", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(3)
            text = await page.evaluate("document.body.innerText")

            print("--- LEAVE PAGE TEXT SNIPPET ---")
            print(text[:1500])
            with open("leave_page_text.txt", "w", encoding="utf-8") as f:
                f.write(text)
        except Exception as e:
            print(f"Error navigating to /leave: {e}")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
