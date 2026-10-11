/**
 * Comprehensive Automated Test Suite
 * Tests:
 * 1. Admin Print Notice Sheets integrity & strict public isolation
 * 2. Natural room sorting logic
 * 3. Widget feed structure, schema & file size (< 300 KB)
 * 4. Android widget project scaffolding
 * 5. JavaScript code syntax checks
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('\n=== RUNNING SRCC TIMETABLE TEST SUITE ===\n');

// 1. Strict Isolation of Print Notices
runTest('Print Notices feature is strictly isolated from student-facing files', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../web_app/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../web_app/app.js'), 'utf8');
  const swJs = fs.readFileSync(path.join(__dirname, '../web_app/sw.js'), 'utf8');

  assert(!indexHtml.includes('tabContentPrint'), 'index.html must not contain tabContentPrint');
  assert(!indexHtml.includes('printSheetMatrix'), 'index.html must not contain printSheetMatrix');
  assert(!appJs.includes('renderPrintSheets'), 'app.js must not contain renderPrintSheets');
  assert(!swJs.includes('printSheet'), 'sw.js must not cache print sheets');
});

// 2. Admin Print Notice Sheets Verification
runTest('Admin Portal includes physical notice board print sheets & headers', () => {
  const adminHtml = fs.readFileSync(path.join(__dirname, '../web_app/admin.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../web_app/admin.js'), 'utf8');

  assert(adminHtml.includes('id="tabContentPrint"'), 'admin.html must contain tabContentPrint');
  assert(adminHtml.includes('id="printSheetMatrix"'), 'admin.html must contain printSheetMatrix');
  assert(adminHtml.includes('id="printSheetLeaves"'), 'admin.html must contain printSheetLeaves');
  assert(adminHtml.includes('श्री राम कॉलेज ऑफ़ कॉमर्स'), 'admin.html must have Hindi college name');
  assert(adminHtml.includes('SHRI RAM COLLEGE OF COMMERCE'), 'admin.html must have English college name');
  assert(adminHtml.includes('Maurice Nagar'), 'admin.html must have campus address');
  assert(adminJs.includes('renderPrintSheets'), 'admin.js must implement renderPrintSheets');
  assert(adminJs.includes('naturalSortRooms'), 'admin.js must implement naturalSortRooms');
});

// 3. Natural Room Sorting Verification
runTest('Natural sorting correctly places R2 before R10 and T2 before T11', () => {
  function naturalSort(arr) {
    return [...arr].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  const unsortedRooms = ['R10', 'R2', 'R1', 'PB10', 'PB2', 'T11', 'T2', 'CL8', 'CL2', 'SCR3', 'SCR1'];
  const sorted = naturalSort(unsortedRooms);

  // R2 should come before R10
  assert(sorted.indexOf('R2') < sorted.indexOf('R10'), 'R2 must precede R10');
  // T2 should come before T11
  assert(sorted.indexOf('T2') < sorted.indexOf('T11'), 'T2 must precede T11');
  // CL2 should come before CL8
  assert(sorted.indexOf('CL2') < sorted.indexOf('CL8'), 'CL2 must precede CL8');
  // PB2 should come before PB10
  assert(sorted.indexOf('PB2') < sorted.indexOf('PB10'), 'PB2 must precede PB10');
});

// 4. Widget Feed Verification (< 300 KB)
runTest('Widget Feed exists, is valid JSON, and is under 300 KB', () => {
  const feedPath = path.join(__dirname, '../web_app/widget_feed.json');
  assert(fs.existsSync(feedPath), 'widget_feed.json must exist');

  const stats = fs.statSync(feedPath);
  const sizeKb = stats.size / 1024;
  assert(sizeKb < 300, `widget_feed.json size (${sizeKb.toFixed(2)} KB) must be < 300 KB`);

  const feedData = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  assert(feedData.metadata, 'feed must contain metadata');
  assert.strictEqual(feedData.metadata.timezone, 'Asia/Kolkata', 'timezone must be Asia/Kolkata');
  assert(Array.isArray(feedData.leaves), 'feed must contain leaves array');
  assert(typeof feedData.groups === 'object', 'feed must contain groups map');
});

// 5. Standalone Web Widget & Android Scaffolding
runTest('Standalone Web Widget PWA and Android project are scaffolded', () => {
  const widgetHtmlPath = path.join(__dirname, '../web_app/widget.html');
  assert(fs.existsSync(widgetHtmlPath), 'widget.html must exist');

  const androidBuildPath = path.join(__dirname, '../android_widget/app/build.gradle.kts');
  assert(fs.existsSync(androidBuildPath), 'android_widget/app/build.gradle.kts must exist');

  const androidManifestPath = path.join(__dirname, '../android_widget/app/src/main/AndroidManifest.xml');
  assert(fs.existsSync(androidManifestPath), 'AndroidManifest.xml must exist');

  const manifestContent = fs.readFileSync(androidManifestPath, 'utf8');
  assert(manifestContent.includes('TimetableWidget4x1Provider'), 'Manifest must declare 4x1 widget');
  assert(manifestContent.includes('TimetableWidget4x2Provider'), 'Manifest must declare 4x2 widget');
  assert(manifestContent.includes('TimetableWidget4x4Provider'), 'Manifest must declare 4x4 widget');
});

// 6. JavaScript Syntax Checks
runTest('JavaScript core files pass syntax compilation without errors', () => {
  execSync('node -c web_app/app.js', { stdio: 'pipe' });
  execSync('node -c web_app/admin.js', { stdio: 'pipe' });
});

// 7. Security: HTML Escaper Single Quote Protection
runTest('escapeHtml function protects against single quote attribute breakout', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '../web_app/app.js'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../web_app/admin.js'), 'utf8');
  assert(appJs.includes(".replace(/'/g, '&#39;')"), 'app.js escapeHtml must escape single quotes');
  assert(adminJs.includes(".replace(/'/g, '&#39;')"), 'admin.js escapeHtml must escape single quotes');
});

// 8. Security: Serverless Push Dispatch Authorization & URL Whitelist
runTest('push_dispatch.js enforces secret authorization & validates notification URLs', () => {
  const fnCode = fs.readFileSync(path.join(__dirname, '../netlify/functions/push_dispatch.js'), 'utf8');
  assert(fnCode.includes('ADMIN_DISPATCH_SECRET') || fnCode.includes('VAPID_PRIVATE_KEY'), 'Must check secret authorization');
  assert(fnCode.includes('targetUrl.startsWith'), 'Must validate notification destination URL');
});

// 9. Offline Service Worker Asset Completeness
runTest('Service Worker pre-caches classes_data.js and synchronizes cache version', () => {
  const swCode = fs.readFileSync(path.join(__dirname, '../web_app/sw.js'), 'utf8');
  assert(swCode.includes("'./classes_data.js?v=57'"), 'sw.js must cache classes_data.js?v=57');
  assert(swCode.includes("'./classes_data.json'"), 'sw.js must cache classes_data.json');
  assert(swCode.includes('srcc-classroom-v57'), 'sw.js must be bumped to v57');
});

// 10. Data Integrity: Zero Conflict Free Room Invariant
runTest('Free classroom invariant holds: Zero conflict between free and occupied slots', () => {
  const srccData = JSON.parse(fs.readFileSync(path.join(__dirname, '../web_app/srcc_data.json'), 'utf8'));
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const room of srccData.rooms) {
    for (const d of days) {
      const sched = room.schedule[d];
      if (!sched) continue;
      const freeSet = new Set(sched.free_slots || []);
      const occSet = new Set((sched.occupied_slots || []).map(o => o.slot));
      for (const slot of freeSet) {
        assert(!occSet.has(slot), `Room ${room.code} on ${d} has slot ${slot} marked both free and occupied`);
      }
    }
  }
});

console.log(`\nResults: ${testsPassed}/${testsTotal} tests passed.\n`);

if (testsPassed === testsTotal) {
  process.exit(0);
} else {
  process.exit(1);
}
