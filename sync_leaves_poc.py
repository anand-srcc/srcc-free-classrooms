import asyncio
from playwright.async_api import async_playwright
import os
from playwright_stealth.stealth import Stealth

async def run():
    print("Starting Playwright with Stealth...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, args=["--disable-blink-features=AutomationControlled"])
        
        state_file = "playwright_state.json"
        if os.path.exists(state_file):
            context = await browser.new_context(storage_state=state_file)
        else:
            context = await browser.new_context()

        page = await context.new_page()
        await Stealth().apply_stealth_async(page)
        
        print("Navigating to studentassistsrcc.app...")
        await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded")
        
        try:
            await page.wait_for_selector("input[type='text']", timeout=15000)
            
            print("Login form detected. Filling credentials...")
            await page.fill("input[type='text']", "25BC070")
            await page.fill("input[type='password']", "RFSCH250900681809")
            
            print("Credentials filled! Waiting 5 seconds for Turnstile to auto-verify...")
            await asyncio.sleep(5)
            
            print("Clicking login...")
            await page.click("button[type='submit']")
            
            print("Waiting for login to succeed (checking for Menu or On Leave)...")
            await page.wait_for_selector("button[aria-label='Menu'], text='FACULTY ON LEAVE', text='On Leave', svg", timeout=20000)
            
            await context.storage_state(path=state_file)
            print(f"Session saved to {state_file}!")
            
        except Exception as e:
            print("Login form not found (probably already logged in!).")

        print("Navigating to Leave section...")
        try:
            if await page.locator("text='FACULTY ON LEAVE'").count() == 0:
                print("Looking for Menu button...")
                menu_btn = page.locator("button:has(svg.lucide-menu), button[aria-label='Menu']")
                if await menu_btn.count() > 0:
                    await menu_btn.first.click()
                    await page.wait_for_selector("text='On Leave'", timeout=5000)
                
                print("Clicking 'On Leave'...")
                await page.locator("text='On Leave'").first.click()
        except Exception as e:
            print("Trying direct URL fallback...")
            await page.evaluate("document.querySelector('a[href=\"/leave\"]').click()")
            
        print("Waiting for 'FACULTY ON LEAVE' page to load...")
        try:
            await page.wait_for_selector("text='FACULTY ON LEAVE'", timeout=15000)
            print("Detected Leave page! Extracting data...")
            await asyncio.sleep(2)
            
            page_text = await page.evaluate('document.body.innerText')
            
            print("-" * 40)
            print(page_text[:1000])
            print("-" * 40)
            
            with open("scraped_leaves_raw.txt", "w", encoding="utf-8") as f:
                f.write(page_text)
                
            print("Saved raw text to scraped_leaves_raw.txt!")
        except Exception as e:
            print(f"Error extracting leaves: {e}")

        finally:
            print("Closing browser...")
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
