#!/usr/bin/env python3
"""
SRCC Automated Faculty Leave Synchronizer
Fetches live faculty absences from studentassistsrcc.app with Cloudflare & Stealth protection,
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


def init_session_state_from_env():
    """Load persistent session credentials from GitHub Secret / Environment Variable if provided."""
    env_state = os.environ.get("PLAYWRIGHT_STATE")
    if env_state and env_state.strip():
        try:
            parsed = json.loads(env_state)
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(parsed, f, indent=2)
            print("[Security] Loaded authenticated session state from PLAYWRIGHT_STATE env variable.")
        except Exception as e:
            print(f"[Warning] Could not parse PLAYWRIGHT_STATE JSON: {e}")


def load_known_teachers():
    """Load teachers database for enriching leave entries."""
    if not os.path.exists(TEACHERS_JSON):
        return {}
    try:
        with open(TEACHERS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
            teachers = data.get("teachers", [])
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
        print(f"[Warning] Could not load teachers_data.json: {e}")
        return {}


async def sync_leaves(headless=True):
    from playwright.async_api import async_playwright
    print("=" * 60)
    print(f"SRCC LIVE FACULTY LEAVES SYNCHRONIZER")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (Headless: {headless})")
    print("=" * 60)

    init_session_state_from_env()
    known_teachers = load_known_teachers()

    # Import playwright stealth if available
    stealth_handler = None
    try:
        from playwright_stealth import Stealth
        stealth_handler = Stealth()
        print("[Security] Playwright Stealth bot-evasion module initialized.")
    except ImportError:
        print("[Notice] playwright-stealth not installed, using built-in evasions.")

    bootstrap_data = None
    raw_absences = []
    live_teachers_map = {}

    async with async_playwright() as p:
        launch_kwargs = {
            "headless": headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        }

        # Try launching real Chrome if available, fallback to bundled chromium
        browser = None
        try:
            browser = await p.chromium.launch(channel="chrome", **launch_kwargs)
        except Exception:
            browser = await p.chromium.launch(**launch_kwargs)

        context_kwargs = {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "viewport": {"width": 1280, "height": 800}
        }

        has_state = os.path.exists(STATE_FILE)
        if has_state:
            print(f"[Session] Loading saved session tokens from {STATE_FILE}...")
            context = await browser.new_context(storage_state=STATE_FILE, **context_kwargs)
        else:
            context = await browser.new_context(**context_kwargs)

        page = await context.new_page()

        # Apply stealth evasions
        if stealth_handler:
            try:
                await stealth_handler.apply_stealth_async(page)
            except Exception as se:
                print(f"[Notice] Stealth apply note: {se}")

        await page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        print("[Network] Navigating to studentassistsrcc.app...", flush=True)
        try:
            await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded", timeout=35000)
        except Exception as e:
            print(f"[Network] Navigation note: {e}, continuing...")

        await asyncio.sleep(2)

        # 1. Quick check: Is existing session already authenticated?
        print("[Auth] Checking existing session authentication status...", flush=True)
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
        except Exception as be:
            print(f"[Auth] Bootstrap check note: {be}")

        is_already_authed = bool(bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"))

        if is_already_authed:
            print("[Auth] Saved session is ACTIVE & VALID! Cloudflare Turnstile bypassed 100%.", flush=True)
        else:
            print("[Auth] Active session not found. Checking login form...", flush=True)
            try:
                roll_input = page.locator("input[type='text'], input[placeholder*='Roll' i]")
                if await roll_input.count() > 0 and await roll_input.first.is_visible():
                    print("  [1/4] Entering student login credentials...", flush=True)
                    await roll_input.first.fill(STUDENT_ROLL)

                    pwd_input = page.locator("input[type='password']")
                    if await pwd_input.count() > 0:
                        await pwd_input.first.fill(STUDENT_PASS)

                    print("  [2/4] Handling Cloudflare Turnstile protection...", flush=True)
                    # Attempt Turnstile interactive frame click if present
                    try:
                        for frame in page.frames:
                            if "challenges.cloudflare.com" in frame.url:
                                cb = frame.locator('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage, body')
                                if await cb.count() > 0:
                                    await cb.first.click(timeout=3000)
                                    break
                    except Exception:
                        pass

                    # Wait for turnstile token
                    max_wait_secs = 20 if not headless else 8
                    for _ in range(max_wait_secs * 2):
                        await asyncio.sleep(0.5)
                        t_val = await page.evaluate("() => (document.querySelector('input[name=\"cf-turnstile-response\"]') || {}).value || ''")
                        if t_val:
                            print(f"  [Security] Cloudflare Turnstile verified ({len(t_val)} chars)!", flush=True)
                            break
                    else:
                        print("  [Notice] Turnstile challenge not solved automatically in headless mode.", flush=True)

                    submit_btn = page.locator("button[type='submit'], button:has-text('Login')")
                    if await submit_btn.count() > 0:
                        print("  [3/4] Submitting login request...", flush=True)
                        await submit_btn.first.click()

                    print("  [4/4] Verifying dashboard...", flush=True)
                    try:
                        await page.wait_for_selector(
                            "button[aria-label='Menu'], button:has(svg.lucide-menu), text='On Leave', text='FACULTY ON LEAVE'",
                            timeout=10000
                        )
                        print("  [Success] Dashboard detected! Login successful.", flush=True)
                    except Exception:
                        pass

                    await asyncio.sleep(2)

                    # Re-test bootstrap after login attempt
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
                    except Exception:
                        pass

                    if bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"):
                        try:
                            await context.storage_state(path=STATE_FILE)
                            print(f"  [Storage] Persistent session saved to {STATE_FILE}!", flush=True)
                        except Exception as se:
                            print(f"  [Storage] Could not write storage state: {se}")
            except Exception as e:
                print(f"[Auth Error] {e}")

        # Parse absences from bootstrap response
        if bootstrap_data and isinstance(bootstrap_data, dict):
            if bootstrap_data.get("authenticated"):
                raw_absences = bootstrap_data.get("absences", [])
                live_teachers_map = bootstrap_data.get("teachers", {})
                if isinstance(live_teachers_map, list):
                    live_teachers_map = {str(t.get("id", "")): t for t in live_teachers_map}
                print(f"[Data] Found {len(raw_absences)} reported faculty absences from official API.")
            else:
                print(f"[Security Notice] Official API unauthenticated. Response: {bootstrap_data}")

        # Fallback: Navigate to /leave in DOM if bootstrap didn't return absences
        if not raw_absences and bootstrap_data and bootstrap_data.get("authenticated"):
            print("[Fallback] Scraping Leave page DOM directly...")
            try:
                await page.goto("https://www.studentassistsrcc.app/leave", wait_until="domcontentloaded", timeout=15000)
                await asyncio.sleep(2)
                rows = page.locator("table tbody tr")
                row_count = await rows.count()
                for i in range(row_count):
                    text = await rows.nth(i).inner_text()
                    if "No faculty absences" in text:
                        continue
                    cols = text.split("\t")
                    if len(cols) >= 2:
                        raw_absences.append({
                            "teacher_name": cols[1].strip() if len(cols) > 1 else cols[0].strip(),
                            "start_date": datetime.now().strftime("%Y-%m-%d"),
                            "end_date": datetime.now().strftime("%Y-%m-%d"),
                            "reason": "Official Duty / Leave"
                        })
            except Exception as fe:
                print(f"[Fallback Note] {fe}")

        await browser.close()

    # Process leaves
    processed_leaves = []
    today_iso = datetime.now().strftime("%Y-%m-%d")
    is_authenticated = bool(bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"))

    if not is_authenticated and not raw_absences:
        print("\n[Safe Mode] Unauthenticated run. Preserving verified faculty leaves database.")
        if os.path.exists(LEAVES_JSON):
            try:
                with open(LEAVES_JSON, "r", encoding="utf-8") as f:
                    prev_payload = json.load(f)
                    processed_leaves = prev_payload.get("leaves", [])
                    print(f"Preserved {len(processed_leaves)} existing verified leaves.")
            except Exception as err:
                print(f"Could not read previous leaves: {err}")
    else:
        for item in raw_absences:
            t_id = str(item.get("teacher_id", ""))
            live_info = live_teachers_map.get(t_id, {}) if isinstance(live_teachers_map, dict) else {}
            name = item.get("teacher_name") or live_info.get("name") or ""

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

    # Check for modifications
    leaves_changed = True
    if os.path.exists(LEAVES_JSON):
        try:
            with open(LEAVES_JSON, "r", encoding="utf-8") as f:
                old_payload = json.load(f)
                old_leaves = old_payload.get("leaves", [])

                def make_sig(leaf):
                    return (
                        str(leaf.get('teacher_id', '')),
                        str(leaf.get('teacher_name', '')),
                        str(leaf.get('start_date', '')),
                        str(leaf.get('end_date', '')),
                        str(leaf.get('reason', ''))
                    )

                old_sigs = sorted([make_sig(x) for x in old_leaves])
                new_sigs = sorted([make_sig(x) for x in processed_leaves])

                if old_sigs == new_sigs:
                    leaves_changed = False
        except Exception:
            leaves_changed = True

    if not leaves_changed:
        print(f"\n[OK] ZERO CHANGES in faculty leaves ({len(processed_leaves)} on leave).")
        print("Skipping file rewrites to conserve build minutes and prevent redundant Git commits.")
        return None

    # Write updated files
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

    js_content = f"""// SRCC Official Faculty Leaves Data
// Auto-synced from studentassistsrcc.app
// Last Updated: {now_str}
window.SRCC_FACULTY_LEAVES = {json.dumps(payload, indent=2, ensure_ascii=False)};
"""
    with open(LEAVES_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"Successfully saved {len(processed_leaves)} leaves to web_app.")
    print(f"Faculty Leave Sync Complete! Total leaves: {len(processed_leaves)}")
    return payload


if __name__ == "__main__":
    is_interactive = "--interactive" in sys.argv or "--login" in sys.argv or "--no-headless" in sys.argv
    asyncio.run(sync_leaves(headless=not is_interactive))
