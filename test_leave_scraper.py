import asyncio
import sys
import json
from playwright.async_api import async_playwright

async def run():
    print("Starting Playwright...")
    async with async_playwright() as p:
        # We use a persistent context so your login session is saved between runs!
        context = await p.chromium.launch_persistent_context(
            user_data_dir="./playwright_profile",
            headless=False, # We want you to see the browser so you can log in!
            args=["--disable-blink-features=AutomationControlled"]
        )
        
        page = await context.new_page()
        
        # Go to the official site
        print("Navigating to studentassistsrcc.app...")
        await page.goto("https://www.studentassistsrcc.app/")
        
        print("\n" + "="*60)
        print("👉 ACTION REQUIRED: Please log in to the website in the browser that just opened.")
        print("👉 After logging in, click the three lines (menu) and go to the 'Leave' section.")
        print("👉 The script will automatically detect when you reach the leave section and scrape it.")
        print("="*60 + "\n")
        
        # Wait until the user navigates to the leave page or we find the "Teachers on leave" indicator
        try:
            # We wait for a selector that uniquely identifies the leave page.
            # Earlier we saw "FACULTY ON LEAVE" or "Teachers on leave".
            # We will just wait until the page text contains something related, or wait a long time.
            # A generic way is to just wait for the user to press ENTER in the console.
            
            # Since this is an async script, let's wait for an element that indicates the leave page.
            # According to the JS bundle: e.jsxs("h1",{className:"text-2xl font-black text-srcc-portalNavy mb-1",children:"FACULTY ON LEAVE"})
            print("Waiting for you to open the 'FACULTY ON LEAVE' page...")
            await page.wait_for_selector("text='FACULTY ON LEAVE'", timeout=300000) # Wait up to 5 minutes
            
            print("Detected Leave page! Scraping data...")
            
            # Now we need to extract the teachers.
            # The HTML structure for each teacher might be a list.
            # Let's extract all text from the page to see how it's formatted.
            # Then we can refine it.
            page_text = await page.evaluate('document.body.innerText')
            print("Successfully extracted page text! Here is a snippet:")
            print("-" * 40)
            print(page_text[:1000])
            print("-" * 40)
            
            # Save the raw text to a file so we can analyze it and write a proper parser
            with open("scraped_leaves_raw.txt", "w", encoding="utf-8") as f:
                f.write(page_text)
                
            print("Saved raw text to scraped_leaves_raw.txt. The AI will analyze this to build the parser.")
            
        except Exception as e:
            print(f"Error or timeout: {e}")
        finally:
            print("Closing browser in 5 seconds...")
            await asyncio.sleep(5)
            await context.close()

if __name__ == "__main__":
    asyncio.run(run())
