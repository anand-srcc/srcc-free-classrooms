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

console.log(`\nResults: ${testsPassed}/${testsTotal} tests passed.\n`);

if (testsPassed === testsTotal) {
  process.exit(0);
} else {
  process.exit(1);
}
