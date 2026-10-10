# SRCC Daily Timetable Android Widget 📱

Native Android Home-Screen Widget companion for the **Shri Ram College of Commerce (SRCC)** Timetable System.

Allows students to set their course, semester, section, and batch once, and wake up every day with their daily lectures and active faculty leaves pinned directly on their phone home screen.

---

## 🌟 Features & Widget Sizes

| Widget Size | View Type | Key Information |
| :--- | :--- | :--- |
| **4x1 Pill** | Next Class Pill | Current period / countdown, subject, room number, faculty leave warning badge. |
| **4x2 Card** | Today\'s Schedule | Date header, chronological list of today\'s lectures with start times, room badges, and leave alerts. |
| **4x4 Dashboard** | Full Campus Hub | SRCC Navy & Centenary branding, full day timetable, active faculty leaves summary, manual sync button. |

---

## 🏗️ Architecture & Technology Stack

- **Target SDK**: Android 14+ (API 34), Min SDK: Android 8.0 (API 26).
- **Language**: 100% Kotlin with Coroutines.
- **Background Sync**: `androidx.work:work-runtime-ktx` (WorkManager) running periodic sync every 30 minutes with network constraints and automatic midnight rollover for the `Asia/Kolkata` timezone.
- **Data Source**: Fetches public static endpoint `https://srccroomfinder.netlify.app/widget_feed.json` (< 250 KB) generated from college sync pipelines.
- **Offline First**: Cached locally in internal storage with ETag and timestamp verification.
- **Profile Storage**: SharedPreferences / DataStore preferences, with 1-tap base64 import from the web app QR code.

---

## 🛠️ How to Build & Install

### Prerequisites
- JDK 17 or higher
- Android Studio Hedgehog or newer (or Android SDK Command-line Tools)

### Build Debug APK via Terminal
```bash
cd android_widget
./gradlew assembleDebug
```
On Windows:
```cmd
cd android_widget
gradlew.bat assembleDebug
```

The compiled APK will be located at:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 🚀 Setting Up on Your Android Device

1. Install the APK on your device:
   ```bash
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
2. Open the **SRCC Timetable** app.
3. Choose your Course (e.g. *B.Com (Hons)*), Semester (*Sem I*), Section (*Sec A*), and Batch (*ALL*). Alternatively, tap the camera icon in the Web Timetable to generate a setup QR code and paste your profile link.
4. Go to your Android Home Screen, long-press empty space, choose **Widgets**, select **SRCC Timetable**, and drag the **4x1**, **4x2**, or **4x4** widget to your screen.
