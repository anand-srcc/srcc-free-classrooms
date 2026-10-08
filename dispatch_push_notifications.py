#!/usr/bin/env python3
"""
SRCC Timetable & Free Classrooms - Cloud Web Push Notification Dispatcher
Sends real-time push notifications to registered Android phones and PC browsers
EVEN WHEN CHROME / BROWSER IS FULLY CLOSED (Zomato/Blinkit style).
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
import requests
from pywebpush import webpush, WebPushException

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FIREBASE_DB_BASE = "https://srcc-leaves-default-rtdb.firebaseio.com"
VAPID_PRIVATE_KEY = "qrlpGNpCe_mRfk7xlfB3IlUSVUSFdP9Kasqpp0L_uZM"
VAPID_CLAIMS = {
    "sub": "mailto:anand.kumar.student@srcc.du.ac.in"
}

PERIOD_INTERVALS = [
    {"num": 1, "slot": "8:30 AM to 9:30 AM", "start": 8 * 60 + 30, "end": 9 * 60 + 30},
    {"num": 2, "slot": "9:30 AM to 10:30 AM", "start": 9 * 60 + 30, "end": 10 * 60 + 30},
    {"num": 3, "slot": "10:30 AM to 11:30 AM", "start": 10 * 60 + 30, "end": 11 * 60 + 30},
    {"num": 4, "slot": "11:30 AM to 12:30 PM", "start": 11 * 60 + 30, "end": 12 * 60 + 30},
    {"num": 5, "slot": "12:30 PM to 1:30 PM", "start": 12 * 60 + 30, "end": 13 * 60 + 30},
    {"num": 6, "slot": "2:00 PM to 3:00 PM", "start": 14 * 60 + 0, "end": 15 * 60 + 0},
    {"num": 7, "slot": "3:00 PM to 4:00 PM", "start": 15 * 60 + 0, "end": 16 * 60 + 0},
    {"num": 8, "slot": "4:00 PM to 5:00 PM", "start": 16 * 60 + 0, "end": 17 * 60 + 0},
    {"num": 9, "slot": "5:00 PM to 6:00 PM", "start": 17 * 60 + 0, "end": 18 * 60 + 0},
]

def get_ist_now():
    utc = datetime.now(timezone.utc)
    ist = utc + timedelta(hours=5, minutes=30)
    return ist

def calculate_campus_update():
    ist = get_ist_now()
    today_iso = ist.strftime("%Y-%m-%d")
    day_name = ist.strftime("%A")
    current_minutes = ist.hour * 60 + ist.minute

    # 1. Fetch leaves
    leaves = []
    try:
        r = requests.get(f"{FIREBASE_DB_BASE}/leaves.json", timeout=10)
        if r.ok and r.json():
            data = r.json()
            if isinstance(data, dict) and "leaves" in data:
                leaves = data["leaves"]
            elif isinstance(data, list):
                leaves = data
    except Exception as e:
        print(f"[Warning] Could not fetch leaves from Firebase: {e}")

    if not leaves:
        local_path = os.path.join(os.path.dirname(__file__), "web_app", "faculty_leaves.json")
        if os.path.exists(local_path):
            try:
                with open(local_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    leaves = data.get("leaves", []) if isinstance(data, dict) else data
            except Exception:
                pass

    # Filter active today leaves
    active_leaves = []
    seen = set()
    for l in leaves:
        s = l.get("start_date") or "2000-01-01"
        e = l.get("end_date") or s
        if s <= today_iso <= e:
            teacher_name = (l.get("teacher_name") or "").strip()
            key = l.get("teacher_id") or teacher_name.lower()
            if key and key not in seen:
                seen.add(key)
                active_leaves.append(l)

    # 2. Free rooms right now
    free_rooms_count = 0
    data_path = os.path.join(os.path.dirname(__file__), "web_app", "srcc_data.json")
    if os.path.exists(data_path):
        try:
            with open(data_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                rooms = data.get("rooms", [])

            # Check lunch recess
            if 13 * 60 + 30 <= current_minutes < 14 * 60:
                free_rooms_count = len(rooms)
            else:
                curr_period = None
                for p in PERIOD_INTERVALS:
                    if p["start"] <= current_minutes < p["end"]:
                        curr_period = p
                        break

                if curr_period:
                    for r in rooms:
                        sched = r.get("schedule", {}).get(day_name, {})
                        free_slots = sched.get("free_slots", [])
                        if curr_period["slot"] in free_slots:
                            free_rooms_count += 1
                        else:
                            # check if teacher is on leave
                            classes = r.get("classes", {}).get(day_name, [])
                            cls = next((c for c in classes if c.get("slot") == curr_period["slot"]), None)
                            if cls:
                                t_name = (cls.get("teacher") or "").lower()
                                if any(t_name in (al.get("teacher_name") or "").lower() for al in active_leaves):
                                    free_rooms_count += 1
                else:
                    free_rooms_count = len(rooms)  # After/before college hours
        except Exception as e:
            print(f"[Warning] Error calculating free rooms: {e}")

    # Build title & body
    title = "SRCC Live Campus Update 🔔"
    leave_count = len(active_leaves)

    if leave_count == 1:
        prof_name = active_leaves[0].get("teacher_name", "A Professor")
        leave_text = f"Prof. {prof_name} is on leave today."
    elif leave_count > 1:
        top_names = ", ".join(l.get("teacher_name", "") for l in active_leaves[:2])
        leave_text = f"{leave_count} professors on leave ({top_names})."
    else:
        leave_text = "All faculty scheduled present."

    if 8 * 60 <= current_minutes <= 18 * 60:
        rooms_text = f"{free_rooms_count} classrooms free right now for study/GD!"
    else:
        rooms_text = "Check tomorrow's vacant timetable."

    body = f"{leave_text}\n⚡ {rooms_text}"
    return title, body

def dispatch_all():
    title, body = calculate_campus_update()
    print("=" * 60)
    print(f"DISPATCHING WEB PUSH (Closed-Chrome Background Alert)")
    print(f"Title: {title}")
    print(f"Body:\n{body}")
    print("=" * 60)

    # Fetch subscriptions from Firebase RTDB
    resp = requests.get(f"{FIREBASE_DB_BASE}/push_subscriptions.json", timeout=10)
    if not resp.ok or not resp.json():
        print("[Info] No active Web Push subscriptions found in database.")
        return

    subscriptions_dict = resp.json()
    total = len(subscriptions_dict)
    print(f"[Info] Found {total} device push subscriptions.")

    success = 0
    failed = 0
    expired = []

    payload_json = json.dumps({
        "title": title,
        "body": body,
        "icon": "https://anand-srcc.github.io/srcc-free-classrooms/web_app/srcc_crest.png",
        "badge": "https://anand-srcc.github.io/srcc-free-classrooms/web_app/favicon.png",
        "tag": "srcc-campus-hourly-update",
        "url": "https://anand-srcc.github.io/srcc-free-classrooms/web_app/"
    })

    for sub_id, item in subscriptions_dict.items():
        sub_info = item.get("subscription") or item
        endpoint = sub_info.get("endpoint")
        if not endpoint:
            continue

        try:
            webpush(
                subscription_info=sub_info,
                data=payload_json,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            success += 1
        except WebPushException as ex:
            # 410 Gone or 404 means user uninstalled/cleared Chrome storage
            if ex.response and ex.response.status_code in (404, 410):
                expired.append(sub_id)
            failed += 1
        except Exception as e:
            failed += 1

    print(f"[Result] Successfully dispatched: {success} | Failed: {failed}")

    # Clean up expired subscriptions
    if expired:
        print(f"[Cleanup] Removing {len(expired)} expired/uninstalled subscriptions...")
        for exp_id in expired:
            try:
                requests.delete(f"{FIREBASE_DB_BASE}/push_subscriptions/{exp_id}.json", timeout=5)
            except Exception:
                pass

if __name__ == "__main__":
    dispatch_all()
