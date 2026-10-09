import asyncio
from playwright.async_api import async_playwright
import re

async def run():
    print("Starting Playwright...")
    # Add a user-agent that looks like a real browser to avoid cloudflare blocking if possible
    async with async_playwright() as p:
        # Use headless=False in case cloudflare needs a real browser geometry, or we can try headless=True
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        page = await context.new_page()
        
        print("Navigating to studentassistsrcc.app...")
        await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded")
        
        print("Waiting for login form...")
        # Check if login form is present
        try:
            await page.wait_for_selector("input[placeholder*='Roll']", timeout=10000)
            print("Logging in...")
            await page.fill("input[placeholder*='Roll']", os.environ.get("SRCC_ROLL", ""))
            await page.fill("input[placeholder*='Password']", os.environ.get("SRCC_PASS", ""))
            
            # Click the login button
            await page.click("button:has-text('Log In'), button:has-text('Login')")
            
            print("Waiting for login to complete...")
            # Wait for either menu button or some dashboard element
            await page.wait_for_selector("button:has-text('On Leave'), text='FACULTY ON LEAVE', button[aria-label='Menu'], svg", timeout=15000)
        except Exception as e:
            print("Login form not found or already logged in, or error:", e)

        print("Navigating to Leave section...")
        # Since it's a SPA, the URL for leave might be /leave or we need to click the menu.
        # Let's try to see if there's an 'On Leave' button
        try:
            # Click the menu if there is a hamburger icon (we can just search for the text 'On Leave')
            # If the menu is hidden, clicking 'On Leave' might fail, let's try direct navigation if it exists, or just evaluate JS to find the link.
            on_leave_link = page.locator("text='On Leave'")
            if await on_leave_link.count() > 0:
                await on_leave_link.first.click()
            else:
                print("Could not find 'On Leave' button, trying to click menu...")
                # Hamburger menu often doesn't have text. Let's just go to URL if possible.
                await page.evaluate("document.querySelector('a[href=\"/leave\"]').click()")
        except Exception as e:
            print("Error clicking menu:", e)
            
        print("Waiting for 'FACULTY ON LEAVE' page...")
        try:
            await page.wait_for_selector("text='FACULTY ON LEAVE'", timeout=15000)
            print("Detected Leave page! Scraping data...")
            
            # Extract all text from the page
            page_text = await page.evaluate('document.body.innerText')
            
            print("-" * 40)
            print(page_text[:1000])
            print("-" * 40)
            
            with open("scraped_leaves_raw.txt", "w", encoding="utf-8") as f:
                f.write(page_text)
                
            print("Saved raw text to scraped_leaves_raw.txt")
        except Exception as e:
            print(f"Error extracting leaves: {e}")
            
            # Dump the current HTML to see what's wrong (maybe Cloudflare blocked us)
            html = await page.content()
            with open("error_page.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("Saved error page to error_page.html")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
