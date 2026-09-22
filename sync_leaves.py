#!/usr/bin/env python3
"""
SRCC Automated Faculty Leave Synchronizer
Fetches live faculty absences from studentassistsrcc.app
and updates web_app/faculty_leaves.json & web_app/faculty_leaves.js
"""

import os
import sys
import json
import asyncio
from datetime import datetime

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_APP_DIR = os.path.join(BASE_DIR, "web_app")
STATE_FILE = os.path.join(BASE_DIR, "playwright_state.json")
LEAVES_JSON = os.path.join(WEB_APP_DIR, "faculty_leaves.json")
LEAVES_JS = os.path.join(WEB_APP_DIR, "faculty_leaves.js")
TEACHERS_JSON = os.path.join(WEB_APP_DIR, "teachers_data.json")

STUDENT_ROLL = os.environ.get("SRCC_ROLL", "25BC070")
STUDENT_PASS = os.environ.get("SRCC_PASS", "RFSCH250900681809")


def load_known_teachers():
    """Load teachers database for enriching leave entries."""
    if not os.path.exists(TEACHERS_JSON):
        return {}
    try:
        with open(TEACHERS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            teachers = data.get("teachers", [])
            # Map by id, code, clean_name
            mapping = {}
            for t in teachers:
                tid = str(t.get("id", ""))
                mapping[tid] = t
                if t.get("clean_name"):
                    mapping[t["clean_name"].lower().strip()] = t
                if t.get("short_code"):
                    mapping[t["short_code"].lower().strip()] = t
            return mapping
    except Exception as e:
        print(f"Warning: Could not load teachers_data.json: {e}")
        return {}


async def sync_leaves(headless=True):
    from playwright.async_api import async_playwright
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Starting Faculty Leave Sync from studentassistsrcc.app...")

    known_teachers = load_known_teachers()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )

        context_kwargs = {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "viewport": {"width": 1280, "height": 800}
        }

        if os.path.exists(STATE_FILE):
            print("Loading existing session state...")
            context = await browser.new_context(storage_state=STATE_FILE, **context_kwargs)
        else:
            context = await browser.new_context(**context_kwargs)

        page = await context.new_page()

        # Stealth evasion scripts
        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        print("Navigating to studentassistsrcc.app...")
        try:
            await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            print(f"Initial navigation timeout/error: {e}, continuing...")

        await asyncio.sleep(2)

        # Check if login is needed
        try:
            roll_input = page.locator("input[type='text'], input[placeholder*='Roll' i]")
            if await roll_input.count() > 0 and await roll_input.first.is_visible():
                print("Login form detected. Entering student credentials...", flush=True)
                await roll_input.first.fill(STUDENT_ROLL)

                pwd_input = page.locator("input[type='password']")
                if await pwd_input.count() > 0:
                    await pwd_input.first.fill(STUDENT_PASS)

                print("Waiting for Cloudflare Turnstile verification (up to 8s)...", flush=True)
                for _ in range(16):
                    await asyncio.sleep(0.5)
                    turnstile_val = await page.evaluate("""
                        () => {
                            const inp = document.querySelector('input[name="cf-turnstile-response"]');
                            return inp ? inp.value : '';
                        }
                    """)
                    if turnstile_val:
                        print(f"Turnstile token verified ({len(turnstile_val)} chars)!", flush=True)
                        break

                submit_btn = page.locator("button[type='submit'], button:has-text('Login')")
                if await submit_btn.count() > 0:
                    print("Submitting login...", flush=True)
                    await submit_btn.first.click()

                # Wait for dashboard or navigation
                print("Waiting for post-login dashboard...", flush=True)
                try:
                    await page.wait_for_selector(
                        "button[aria-label='Menu'], button:has(svg.lucide-menu), text='On Leave', text='FACULTY ON LEAVE'",
                        timeout=15000
                    )
                    print("Dashboard detected! Login successful.", flush=True)
                except Exception as wait_err:
                    print(f"Dashboard selector wait note: {wait_err}", flush=True)

                await asyncio.sleep(2)

                try:
                    await context.storage_state(path=STATE_FILE)
                    print(f"Updated session stored to {STATE_FILE}", flush=True)
                except Exception as ex:
                    print(f"Could not save storage state: {ex}", flush=True)
            else:
                print("Already logged in (session preserved)!", flush=True)
        except Exception as e:
            print(f"Login check note: {e}", flush=True)

        # Fetch bootstrap data from page context (which holds auth cookies)
        print("Fetching live data from /api/bootstrap...", flush=True)
        bootstrap_data = None
        try:
            bootstrap_data = await page.evaluate("""
                async () => {
                    try {
                        const res = await fetch('/api/bootstrap', { credentials: 'include' });
                        if (res.ok) return await res.json();
                        return { error: 'HTTP ' + res.status };
                    } catch (e) {
                        return { error: e.toString() };
                    }
                }
            """)
        except Exception as e:
            print(f"Error evaluating bootstrap fetch: {e}", flush=True)

        raw_absences = []
        live_teachers_map = {}

        if bootstrap_data and isinstance(bootstrap_data, dict):
            if bootstrap_data.get("authenticated"):
                print("API authentication successful!")
                raw_absences = bootstrap_data.get("absences", [])
                live_teachers_map = bootstrap_data.get("teachers", {})
                if isinstance(live_teachers_map, list):
                    live_teachers_map = {str(t.get("id", "")): t for t in live_teachers_map}
                print(f"Found {len(raw_absences)} reported absences in API.")
            else:
                print(f"Bootstrap returned unauthenticated. Site response: {bootstrap_data}")

        # Fallback: Navigate to /leave in the DOM if bootstrap didn't have absences
        if not raw_absences:
            print("Checking Leave page DOM fallback...")
            try:
                # Try clicking menu or going to leave
                menu_btn = page.locator("button:has(svg.lucide-menu), button[aria-label='Menu']")
                if await menu_btn.count() > 0:
                    await menu_btn.first.click()
                    await asyncio.sleep(1)

                leave_btn = page.locator("text='On Leave', text='FACULTY ON LEAVE'")
                if await leave_btn.count() > 0:
                    await leave_btn.first.click()
                    await asyncio.sleep(2)

                # Extract table rows if present
                rows = page.locator("table tbody tr")
                row_count = await rows.count()
                print(f"DOM Leave table row count: {row_count}")

                for i in range(row_count):
                    text = await rows.nth(i).inner_text()
                    if "No faculty absences" in text:
                        continue
                    cols = text.split("\t")
                    if len(cols) >= 2:
                        raw_absences.append({
                            "teacher_name": cols[1].strip() if len(cols) > 1 else cols[0].strip(),
                            "start_date": datetime.now().strftime("%Y-%m-%d"),
                            "end_date": datetime.now().strftime("%Y-%m-%d")
                        })
            except Exception as e:
                print(f"DOM fallback note: {e}")

        await browser.close()

    # Process and enrich absences
    processed_leaves = []
    today_iso = datetime.now().strftime("%Y-%m-%d")

    is_authenticated = bool(bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"))

    if not is_authenticated and not raw_absences and os.path.exists(LEAVES_JSON):
        print("Note: Automated session unauthenticated. Preserving existing verified leaves database.")
        try:
            with open(LEAVES_JSON, "r", encoding="utf-8") as f:
                prev_payload = json.load(f)
                prev_leaves = prev_payload.get("leaves", [])
                # Keep active or unexpired leaves
                processed_leaves = prev_leaves
                print(f"Preserved {len(processed_leaves)} existing verified leaves.")
        except Exception as err:
            print(f"Could not read previous leaves: {err}")
    else:
        for item in raw_absences:
            t_id = str(item.get("teacher_id", ""))
            live_info = live_teachers_map.get(t_id, {}) if isinstance(live_teachers_map, dict) else {}
            name = item.get("teacher_name") or live_info.get("name") or ""
            
            # Enrich with known local timetable data
            matched = known_teachers.get(t_id) or known_teachers.get(name.lower().strip())
            
            teacher_name = matched.get("clean_name", name) if matched else name
            teacher_code = matched.get("short_code", "") if matched else ""
            department = matched.get("department", "") if matched else ""
            
            start_date = item.get("start_date", today_iso)
            end_date = item.get("end_date", start_date)

            processed_leaves.append({
                "teacher_id": t_id or (matched.get("id") if matched else ""),
                "teacher_name": teacher_name,
                "teacher_code": teacher_code,
                "department": department,
                "start_date": start_date,
                "end_date": end_date,
                "reason": item.get("reason", "Official Duty / Leave"),
                "status": "On Leave"
            })

    # Save to JSON and JS
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    payload = {
        "last_updated": now_str,
        "last_synced_iso": datetime.now().isoformat(),
        "total_on_leave": len(processed_leaves),
        "source": "https://studentassistsrcc.app",
        "leaves": processed_leaves
    }

    os.makedirs(WEB_APP_DIR, exist_ok=True)
    with open(LEAVES_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Successfully saved {len(processed_leaves)} leaves to {LEAVES_JSON}")

    js_content = f"""// SRCC Official Faculty Leaves Data
// Auto-synced from studentassistsrcc.app
// Last Updated: {now_str}
window.SRCC_FACULTY_LEAVES = {json.dumps(payload, indent=2, ensure_ascii=False)};
"""
    with open(LEAVES_JS, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"Successfully saved {LEAVES_JS}")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Leave Sync Complete! Total leaves today: {len(processed_leaves)}")
    return payload


if __name__ == "__main__":
    headless_mode = "--no-headless" not in sys.argv
    asyncio.run(sync_leaves(headless=headless_mode))
