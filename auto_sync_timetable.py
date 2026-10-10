"""
SRCC Timetable Automated Sync & Change Monitor
Checks if srcccollegetimetable.in has updated schedules.
If changes are detected:
  1. Updates srcc_data.json & data.js
  2. Regenerates SRCC_Free_Classrooms_Timetable.xlsx
  3. Updates web_app and Downloads package
  4. Triggers Telegram / Webhook / Windows Toast notification
  5. In GitHub Actions: automatically commits and deploys to Netlify!
"""

import os
import sys
import json
import hashlib
import subprocess
import urllib.request
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

# Prevent Windows console charmap UnicodeEncodeError
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def calculate_hash(data_obj):
    """Compute MD5 hash of rooms data dictionary to detect schedule alterations."""
    rooms_str = json.dumps(data_obj.get('rooms', []), sort_keys=True, ensure_ascii=False)
    return hashlib.md5(rooms_str.encode('utf-8')).hexdigest()

def get_current_stored_hash():
    """Read the hash of currently deployed web_app/srcc_data.json."""
    json_path = os.path.join(BASE_DIR, 'web_app', 'srcc_data.json')
    if not os.path.exists(json_path):
        return None
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return calculate_hash(data)
    except Exception:
        return None

def find_changed_rooms(old_data_path, new_rooms):
    """Pinpoint exactly which room numbers had schedule modifications."""
    if not os.path.exists(old_data_path):
        return []
    try:
        with open(old_data_path, 'r', encoding='utf-8') as f:
            old_data = json.load(f)
        old_map = {r['code']: r.get('schedule', {}) for r in old_data.get('rooms', [])}
        new_map = {r['code']: r.get('schedule', {}) for r in new_rooms}
        changed = []
        for code, sched in new_map.items():
            if code not in old_map:
                changed.append(f"{code} (New)")
            elif json.dumps(sched, sort_keys=True) != json.dumps(old_map[code], sort_keys=True):
                changed.append(code)
        return changed
    except Exception:
        return []

def send_telegram_alert(bot_token, chat_id, message):
    """Send alert to Telegram chat or channel."""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = urllib.parse.urlencode({
            'chat_id': chat_id,
            'text': message,
            'parse_mode': 'Markdown'
        }).encode('utf-8')
        req = urllib.request.Request(url, data=payload, headers={'User-Agent': 'SRCC-Bot/1.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"[Warning] Failed to send Telegram alert: {e}")
        return False

def send_email_alert(subject, html_content, to_email=None):
    """Send HTML email alert when timetable changes."""
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    sender_email = os.environ.get("ALERT_SENDER_EMAIL")
    sender_pass = os.environ.get("ALERT_SENDER_PASSWORD")
    receiver_email = to_email or os.environ.get("ALERT_RECEIVER_EMAIL") or sender_email

    if not (sender_email and sender_pass and receiver_email):
        print("  [Notice] Email alert skipped: ALERT_SENDER_EMAIL or ALERT_SENDER_PASSWORD not configured.")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"SRCC Timetable Monitor <{sender_email}>"
        msg["To"] = receiver_email
        msg["Subject"] = subject

        part = MIMEText(html_content, "html", "utf-8")
        msg.attach(part)

        with smtplib.SMTP(smtp_server, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(sender_email, sender_pass)
            server.send_message(msg)
        print(f"  [Success] Timetable change email alert sent to {receiver_email}!")
        return True
    except Exception as e:
        print(f"  [Warning] Failed to send email alert: {e}")
        return False

def show_windows_toast(title, message):
    """Trigger native Windows balloon or toast notification if on Windows."""
    if sys.platform != 'win32':
        return
    try:
        ps_cmd = f"""
        [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null
        $notify = New-Object System.Windows.Forms.NotifyIcon
        $notify.Icon = [System.Drawing.SystemIcons]::Information
        $notify.Visible = $true
        $notify.ShowBalloonTip(5000, '{title}', '{message}', [System.Windows.Forms.ToolTipIcon]::Info)
        Start-Sleep -Seconds 2
        $notify.Dispose()
        """
        subprocess.run(['powershell', '-WindowStyle', 'Hidden', '-Command', ps_cmd], capture_output=True, timeout=10)
    except Exception:
        pass

def main():
    force_update = '--force' in sys.argv
    print("=" * 60)
    print(f"SRCC TIMETABLE LIVE SYNC & CHANGE MONITOR")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # 1. Fetch current live timetable data
    print("\n[1/4] Scraping current live timetable from srcccollegetimetable.in...")
    import export_data_json
    fresh_payload = export_data_json.scrape_all_rooms()
    if not fresh_payload or not fresh_payload.get('rooms'):
        print("[Error] Could not fetch data from SRCC portal. Aborting sync.")
        sys.exit(1)

    new_hash = calculate_hash(fresh_payload)
    old_hash = get_current_stored_hash()

    print(f"  Old Data Hash: {old_hash}")
    print(f"  New Data Hash: {new_hash}")

    is_changed = (new_hash != old_hash)

    if not is_changed and not force_update:
        print("\n[OK] NO ROOM SCHEDULE CHANGES: College rooms timetable is consistent.")
        print("   Skipping file rewrites to conserve Netlify build minutes and prevent false Git commits.")
        if os.environ.get('GITHUB_ACTIONS') == 'true':
            with open(os.environ.get('GITHUB_OUTPUT', 'output.txt'), 'a') as gh_out:
                gh_out.write("changed=false\n")
        print(f"\n[DONE] Timetable verified at {datetime.now().strftime('%d %b %Y, %I:%M %p')}. Zero changes.")
        return

    print("\n[ALERT] TIMETABLE UPDATE DETECTED! Processing updates...")

    # Identify which specific rooms changed
    old_json_file = os.path.join(BASE_DIR, 'web_app', 'srcc_data.json')
    changed_rooms = find_changed_rooms(old_json_file, fresh_payload.get('rooms', []))
    if changed_rooms:
        summary_rooms = ', '.join(changed_rooms[:8]) + (f' (+{len(changed_rooms)-8} more)' if len(changed_rooms) > 8 else '')
        print(f"  Modified Rooms ({len(changed_rooms)}): {summary_rooms}")
    else:
        summary_rooms = "College schedule adjustments"

    # 2. Save fresh JSON & data.js
    print("\n[2/4] Saving updated srcc_data.json and data.js...")
    targets = [
        os.path.join(BASE_DIR, 'web_app'),
        os.path.join(BASE_DIR, 'preview_web_app')
    ]
    for target_dir in targets:
        if os.path.exists(target_dir):
            out_json = os.path.join(target_dir, 'srcc_data.json')
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(fresh_payload, f, indent=2, ensure_ascii=False)

            out_js = os.path.join(target_dir, 'data.js')
            with open(out_js, 'w', encoding='utf-8') as f:
                f.write("window.SRCC_DATA = ")
                json.dump(fresh_payload, f, indent=2, ensure_ascii=False)
                f.write(";\n")

    # 3. Regenerate fresh Excel workbook
    print("\n[3/5] Generating fresh Excel workbook with updated schedules...")
    try:
        import srcc_scraper
        srcc_scraper.main()
    except Exception as e:
        print(f"[Error] Failed to generate Excel workbook: {e}")
        sys.exit(1)

    # 4. Scrape and update faculty & teacher timetables
    print("\n[4/5] Scraping and updating faculty & teacher timetables...")
    try:
        import scrape_teachers
        scrape_teachers.main()
        import enrich_teachers
        enrich_teachers.enrich()
        from generate_widget_feed import generate_feed
        generate_feed()
    except Exception as e:
        print(f"[Warning] Failed to scrape teacher timetables or generate widget feed: {e}")

    # 5. Copy to Downloads & create deployment package (if on Windows)
    print("\n[5/5] Updating local deployment package & Downloads folder...")
    excel_source = os.path.join(BASE_DIR, "SRCC_Free_Classrooms_Timetable.xlsx")
    user_home = os.path.expanduser("~")
    downloads_dir = os.path.join(user_home, "Downloads")
    
    if os.path.exists(downloads_dir):
        import shutil
        dest_excel = os.path.join(downloads_dir, "SRCC_Free_Classrooms_Timetable.xlsx")
        try:
            shutil.copyfile(excel_source, dest_excel)
            print(f"  Updated: {dest_excel}")
            
            web_app_dir = os.path.join(BASE_DIR, "web_app")
            dest_folder = os.path.join(downloads_dir, "srcc_web_app_for_netlify")
            if os.path.exists(dest_folder):
                shutil.rmtree(dest_folder, ignore_errors=True)
            shutil.copytree(web_app_dir, dest_folder)
            print(f"  Updated folder: {dest_folder}")
            
            # Zip archive
            shutil.make_archive(os.path.join(downloads_dir, "srcc_web_app_for_netlify"), 'zip', web_app_dir)
            print(f"  Updated zip: {os.path.join(downloads_dir, 'srcc_web_app_for_netlify.zip')}")
        except Exception as e:
            print(f"  [Notice] Downloads copy skipped: {e}")

    # 5. Send Notifications
    notify_msg = (
        "📢 *SRCC Timetable Changed!*\n\n"
        f"🕒 Time: {datetime.now().strftime('%d %b %Y, %I:%M %p')}\n"
        f"🏛️ Affected Rooms ({len(changed_rooms)}): {summary_rooms}\n\n"
        "✅ Live Web App & Excel spreadsheet have been automatically updated!\n"
        "🔗 Live Site: https://srcc-classroom-finder.netlify.app/"
    )
    
    # Telegram Bot alert (if credentials available in env)
    tg_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    tg_chat = os.environ.get('TELEGRAM_CHAT_ID')
    if tg_token and tg_chat:
        send_telegram_alert(tg_token, tg_chat, notify_msg)
        print("  Telegram notification sent!")

    # Email Alert to Anand Kumar
    now_formatted = datetime.now().strftime('%d %b %Y, %I:%M %p')
    email_subject = "🚨 हाँ आनंद कुमार, SRCC टाइमटेबल चेंज हुआ है!"
    email_html = f"""
    <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 25px; color: #1e293b;">
      <div style="max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #0284c7; margin-top: 0;">📢 हाँ आनंद कुमार, SRCC टाइमटेबल चेंज हुआ है!</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          कॉलेज के ऑफिशियल पोर्टल (<strong>srcccollegetimetable.in</strong>) पर टाइमटेबल में बदलाव डिटेक्ट किया गया है।
        </p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 0 0 8px 0;"><strong>🕒 समय:</strong> {now_formatted}</p>
          <p style="margin: 0 0 8px 0;"><strong>🏛️ प्रभावित कमरे ({len(changed_rooms)}):</strong> {summary_rooms}</p>
          <p style="margin: 0;"><strong>📊 स्थिति:</strong> नया डेटा स्क्रैप कर लिया गया है।</p>
        </div>
        <p style="font-size: 14px; color: #64748b;">
          यह ईमेल ऑटोमेटेड सिस्टम द्वारा भेजी गई है ताकि आपको तुरंत पता चल सके।
        </p>
      </div>
    </div>
    """
    send_email_alert(email_subject, email_html)

    # Windows Toast Notification
    show_windows_toast("SRCC Timetable Updated!", "The college timetable changed. Web app & Excel have been automatically refreshed.")

    # GitHub Actions output
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        with open(os.environ.get('GITHUB_OUTPUT', 'output.txt'), 'a') as gh_out:
            gh_out.write("changed=true\n")

    print("\n" + "=" * 60)
    print("SUCCESS: Timetable sync complete! All files refreshed.")
    print("=" * 60)

if __name__ == '__main__':
    main()
