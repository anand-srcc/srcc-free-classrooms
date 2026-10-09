#!/usr/bin/env python3
"""
SRCC Automated Faculty Leave Synchronizer
Fetches live faculty absences from studentassistsrcc.app (with Cloudflare & Stealth protection)
and seamlessly syncs with Firebase Cloud Database (srcc-leaves-default-rtdb.firebaseio.com).
Updates web_app/faculty_leaves.json & web_app/faculty_leaves.js for automatic GitHub Actions deployment.
"""

import os
import sys
import json
import asyncio
import urllib.request
import urllib.parse
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

STUDENT_ROLL = os.environ.get("SRCC_ROLL", "")
STUDENT_PASS = os.environ.get("SRCC_PASS", "")
FIREBASE_LEAVES_URL = "https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json"


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
        print(f"[Warning] Could not load known teachers: {e}")
        return {}


def fetch_leaves_from_firebase():
    """Fetch verified leaves from Firebase Cloud Realtime Database."""
    try:
        req = urllib.request.Request(FIREBASE_LEAVES_URL, headers={"User-Agent": "SRCC-Leaves-Sync/2.0"})
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data and isinstance(data, dict):
                return data.get("leaves", [])
            elif isinstance(data, list):
                return data
    except Exception as e:
        print(f"[Firebase Fetch Note] Could not connect to Cloud DB: {e}")
    return []


def push_leaves_to_firebase(leaves_list):
    """Sync newly scraped leaves from studentassistsrcc.app to Firebase Realtime Database."""
    try:
        payload = {
            "last_updated": datetime.now().strftime("%d %b %Y"),
            "leaves": leaves_list
        }
        data_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(FIREBASE_LEAVES_URL, data=data_bytes, headers={"Content-Type": "application/json"}, method="PUT")
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status in (200, 204):
                print("[Firebase] Successfully synchronized live leaves to Firebase Cloud Database!")
    except Exception as e:
        print(f"[Firebase Push Note] {e}")


async def sync_leaves(headless=True):
    print("=" * 60)
    print("SRCC LIVE FACULTY LEAVES SYNCHRONIZER")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} (Headless: {headless})")
    print("=" * 60)

    init_session_state_from_env()
    known_teachers = load_known_teachers()

    bootstrap_data = None
    raw_absences = []
    live_teachers_map = {}
    is_authenticated = False

    # 1. Attempt Playwright Scrape of studentassistsrcc.app
    try:
        from playwright.async_api import async_playwright
        stealth_handler = None
        try:
            from playwright_stealth import Stealth
            stealth_handler = Stealth()
            print("[Security] Playwright Stealth bot-evasion module initialized.")
        except ImportError:
            print("[Notice] playwright-stealth not installed, using built-in evasions.")

        async with async_playwright() as p:
            launch_kwargs = {
                "headless": headless,
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-setuid-sandbox",
                    "--window-size=1280,800"
                ]
            }

            browser = None
            try:
                browser = await p.chromium.launch(channel="chrome", **launch_kwargs)
            except Exception:
                browser = await p.chromium.launch(**launch_kwargs)

            context_kwargs = {
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                "viewport": {"width": 1280, "height": 800},
                "has_touch": True,
                "is_mobile": False,
                "locale": "en-US",
                "timezone_id": "Asia/Kolkata"
            }

            has_state = os.path.exists(STATE_FILE)
            if has_state:
                print(f"[Session] Loading saved session tokens from {STATE_FILE}...")
                context = await browser.new_context(storage_state=STATE_FILE, **context_kwargs)
            else:
                context = await browser.new_context(**context_kwargs)

            page = await context.new_page()

            if stealth_handler:
                try:
                    await stealth_handler.apply_stealth_async(page)
                except Exception as se:
                    print(f"[Notice] Stealth apply note: {se}")

            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                window.chrome = { runtime: {} };
            """)

            print("[Network] Navigating to studentassistsrcc.app...", flush=True)
            try:
                await page.goto("https://www.studentassistsrcc.app/", wait_until="domcontentloaded", timeout=35000)
            except Exception as e:
                print(f"[Network] Navigation note: {e}, continuing...")

            await asyncio.sleep(2)

            # Quick check: Is existing session already authenticated?
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

            is_authenticated = bool(bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"))

            if is_authenticated:
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
                        # Attempt natural mouse movement to Cloudflare iframe
                        try:
                            for frame in page.frames:
                                if "challenges.cloudflare.com" in frame.url:
                                    cb = frame.locator('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage, body')
                                    if await cb.count() > 0:
                                        await cb.first.click(timeout=3000)
                                        break
                        except Exception:
                            pass

                        # Wait for turnstile token (up to 20 seconds)
                        max_wait_secs = 20
                        for _ in range(max_wait_secs * 2):
                            await asyncio.sleep(0.5)
                            t_val = await page.evaluate("() => (document.querySelector('input[name=\"cf-turnstile-response\"]') || {}).value || ''")
                            if t_val:
                                print(f"  [Security] Cloudflare Turnstile token received ({len(t_val)} chars)!", flush=True)
                                break
                        else:
                            print("  [Notice] Turnstile challenge not solved automatically.", flush=True)

                        submit_btn = page.locator("button[type='submit'], button:has-text('Login')")
                        if await submit_btn.count() > 0:
                            print("  [3/4] Submitting login request...", flush=True)
                            await submit_btn.first.click()

                        print("  [4/4] Verifying dashboard...", flush=True)
                        try:
                            await page.wait_for_selector(
                                "button[aria-label='Menu'], button:has(svg.lucide-menu), text='On Leave', text='FACULTY ON LEAVE'",
                                timeout=8000
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

                        is_authenticated = bool(bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"))
                        if is_authenticated:
                            try:
                                await context.storage_state(path=STATE_FILE)
                                print(f"  [Storage] Persistent session saved to {STATE_FILE}!", flush=True)
                            except Exception as se:
                                print(f"  [Storage] Could not write storage state: {se}")
                except Exception as e:
                    print(f"[Auth Error] {e}")

            # Parse absences from bootstrap response
            if bootstrap_data and isinstance(bootstrap_data, dict) and bootstrap_data.get("authenticated"):
                raw_absences = bootstrap_data.get("absences", [])
                live_teachers_map = bootstrap_data.get("teachers", {})
                if isinstance(live_teachers_map, list):
                    live_teachers_map = {str(t.get("id", "")): t for t in live_teachers_map}
                print(f"[Data] Found {len(raw_absences)} reported faculty absences from official studentassistsrcc API.")

            await browser.close()
    except ImportError:
        print("[Notice] Playwright not installed in local environment. Proceeding directly with Cloud DB Sync.")
    except Exception as pe:
        print(f"[Playwright Note] Browser execution error: {pe}. Proceeding with Cloud DB Sync.")

    # 2. Cloud Database Fallback & Sync
    today_iso = datetime.now().strftime("%Y-%m-%d")

    # If studentassistsrcc.app didn't yield absences (e.g. Turnstile or blocked), sync from Firebase Realtime DB
    if not raw_absences:
        print("\n[Cloud Fallback] Fetching latest active verified leaves from Firebase Cloud DB...")
        fb_leaves = fetch_leaves_from_firebase()
        if fb_leaves:
            for item in fb_leaves:
                end_d = item.get("end_date") or item.get("start_date") or ""
                # Filter out expired leaves from previous days
                if end_d and end_d < today_iso:
                    continue
                raw_absences.append(item)
            print(f"[Cloud Fallback] Loaded {len(raw_absences)} active faculty leaves from Cloud Database.")
        else:
            print("[Cloud Fallback] No active leaves currently registered in Cloud Database.")

    # 3. Process, Enrich & Deduplicate Leaves
    processed_leaves = []
    seen_sigs = set()

    for item in raw_absences:
        t_id = str(item.get("teacher_id", ""))
        live_info = live_teachers_map.get(t_id, {}) if isinstance(live_teachers_map, dict) else {}
        name = item.get("teacher_name") or live_info.get("name") or ""

        matched = known_teachers.get(t_id) or known_teachers.get(name.lower().strip())
        teacher_name = matched.get("clean_name", name) if matched else name
        teacher_code = matched.get("short_code", "") if matched else item.get("teacher_code", "")
        department = matched.get("department", "") if matched else item.get("department", "")

        start_date = item.get("start_date", today_iso)
        end_date = item.get("end_date", start_date)

        # Do not include leaves that already expired
        if end_date and end_date < today_iso:
            continue

        # Deduplicate
        dedup_key = (teacher_name.lower().strip(), start_date, end_date)
        if dedup_key in seen_sigs:
            continue
        seen_sigs.add(dedup_key)

        processed_leaves.append({
            "teacher_id": t_id or (matched.get("id") if matched else ""),
            "teacher_name": teacher_name,
            "teacher_code": teacher_code,
            "department": department,
            "start_date": start_date,
            "end_date": end_date,
            "reason": item.get("reason", "Faculty Leave"),
            "status": "On Leave"
        })

    # If leaves were freshly scraped from studentassistsrcc, mirror them to Firebase
    if is_authenticated and processed_leaves:
        push_leaves_to_firebase(processed_leaves)

    # 4. Check for Modifications vs Current web_app/faculty_leaves.json
    leaves_changed = True
    if os.path.exists(LEAVES_JSON):
        try:
            with open(LEAVES_JSON, "r", encoding="utf-8") as f:
                old_payload = json.load(f)
                old_leaves = old_payload.get("leaves", [])

                def make_sig(leaf):
                    return (
                        str(leaf.get('teacher_name', '')),
                        str(leaf.get('start_date', '')),
                        str(leaf.get('end_date', ''))
                    )

                old_sigs = sorted([make_sig(x) for x in old_leaves if x.get('end_date', '') >= today_iso])
                new_sigs = sorted([make_sig(x) for x in processed_leaves])

                if old_sigs == new_sigs and len(old_leaves) == len(processed_leaves):
                    leaves_changed = False
        except Exception:
            leaves_changed = True

    if not leaves_changed:
        print(f"\n[OK] ZERO CHANGES in faculty leaves ({len(processed_leaves)} on leave).")
        print("Skipping file rewrites to conserve build minutes and prevent redundant Git commits.")
        return None

    # 5. Write Updated Files
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    payload = {
        "last_updated": now_str,
        "last_synced_iso": datetime.now().isoformat(),
        "total_on_leave": len(processed_leaves),
        "source": "https://studentassistsrcc.app / Firebase Cloud DB",
        "leaves": processed_leaves
    }

    os.makedirs(WEB_APP_DIR, exist_ok=True)
    with open(LEAVES_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    js_content = f"""// SRCC Official Faculty Leaves Data
// Auto-synced from studentassistsrcc.app & Firebase Cloud DB
// Last Updated: {now_str}
window.SRCC_FACULTY_LEAVES = {json.dumps(payload, indent=2, ensure_ascii=False)};
"""
    with open(LEAVES_JS, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"\n[SUCCESS] Saved {len(processed_leaves)} active leaves to web_app/faculty_leaves.json and faculty_leaves.js!")
    return payload


if __name__ == "__main__":
    is_interactive = "--interactive" in sys.argv or "--login" in sys.argv or "--no-headless" in sys.argv or "--headed" in sys.argv
    asyncio.run(sync_leaves(headless=not is_interactive))
