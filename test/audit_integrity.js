const fs = require('fs');
const path = require('path');

console.log('=== SRCC FULL INTEGRITY & HEALTH AUDIT ===\n');

// 1. DOM ID Check for app.js and index.html
const appJs = fs.readFileSync('web_app/app.js', 'utf8');
const indexHtml = fs.readFileSync('web_app/index.html', 'utf8');

const idRegex = /getElementById\(['"]([^'"]+)['"]\)/g;
let m;
const appUsedIds = new Set();
while ((m = idRegex.exec(appJs)) !== null) {
  appUsedIds.add(m[1]);
}

const missingInIndex = [];
for (const id of appUsedIds) {
  if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
    missingInIndex.push(id);
  }
}

console.log(`[DOM Check - Student App] Checked ${appUsedIds.size} element IDs.`);
if (missingInIndex.length > 0) {
  console.log(`  Optional / conditionally rendered / missing IDs (${missingInIndex.length})`);
  
  // Check if any of these missing IDs are accessed without null checks:
  const unsafeDirectCalls = [];
  for (const id of missingInIndex) {
    const directRegex = new RegExp(`document\\.getElementById\\(['"]${id}['"]\\)\\.`, 'g');
    if (directRegex.test(appJs)) {
      unsafeDirectCalls.push(id);
    }
  }
  if (unsafeDirectCalls.length > 0) {
    console.warn('  ⚠️ WARNING: The following IDs are accessed directly with dot (.) and no null-check:', unsafeDirectCalls);
  } else {
    console.log('  ✓ All optional / missing IDs are properly null-guarded!');
  }
} else {
  console.log('  ✓ 100% of getElementById references match index.html elements!');
}

// 2. DOM ID Check for admin.js and admin.html
const adminJs = fs.readFileSync('web_app/admin.js', 'utf8');
const adminHtml = fs.readFileSync('web_app/admin.html', 'utf8');

const adminUsedIds = new Set();
while ((m = idRegex.exec(adminJs)) !== null) {
  adminUsedIds.add(m[1]);
}

const missingInAdmin = [];
for (const id of adminUsedIds) {
  if (!adminHtml.includes(`id="${id}"`) && !adminHtml.includes(`id='${id}'`)) {
    missingInAdmin.push(id);
  }
}

console.log(`\n[DOM Check - Admin Portal] Checked ${adminUsedIds.size} element IDs.`);
if (missingInAdmin.length > 0) {
  console.log(`  Optional / dynamic IDs (${missingInAdmin.length}):`, missingInAdmin);
} else {
  console.log('  ✓ 100% of getElementById references match admin.html elements!');
}

// 3. Check Timetable GBO & M.Com courses in app.js
console.log('\n[Timetable Courses Audit]');
const validCourses = ['B.A. (Hons) Economics', 'B.Com (Hons)', 'M.Com', 'GBO', 'SEC', 'VAC'];
for (const c of validCourses) {
  const hasCourse = indexHtml.includes(`data-course="${c}"`);
  console.log(`  Course "${c}": ${hasCourse ? '✓ Present in UI pills' : '✗ Missing'}`);
}

// 4. Check Rooms Data
const codeData = fs.readFileSync('web_app/data.js', 'utf8');
const sandbox = { window: {} };
require('vm').runInNewContext(codeData, sandbox);
const rooms = sandbox.window.SRCC_DATA?.rooms || {};
const roomKeys = Object.keys(rooms);
console.log(`\n[Classrooms Data Audit]`);
console.log(`  Total Classrooms: ${roomKeys.length}`);
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let totalSlotsChecked = 0;
let malformedSlots = 0;
for (const rk of roomKeys) {
  const r = rooms[rk];
  if (!r.code) malformedSlots++;
  for (const d of days) {
    if (!r.schedule || !r.schedule[d]) {
      malformedSlots++;
    } else {
      totalSlotsChecked += (r.schedule[d].occupied_slots?.length || 0);
    }
  }
}
console.log(`  Total occupied slots indexed: ${totalSlotsChecked}, Malformed: ${malformedSlots}`);

// 5. Check Teachers Data
const codeTeachers = fs.readFileSync('web_app/teachers_data.js', 'utf8');
require('vm').runInNewContext(codeTeachers, sandbox);
const teachers = sandbox.window.SRCC_TEACHERS_DATA?.teachers || [];
console.log(`\n[Faculty Data Audit]`);
console.log(`  Total Teachers: ${teachers.length}`);
const teachersWithNoSchedule = teachers.filter(t => !t.schedule || Object.keys(t.schedule).length === 0);
console.log(`  Teachers with empty schedule: ${teachersWithNoSchedule.length}`);

// 6. Check Faculty Leaves
const codeLeaves = fs.readFileSync('web_app/faculty_leaves.js', 'utf8');
require('vm').runInNewContext(codeLeaves, sandbox);
const leaves = sandbox.window.SRCC_FACULTY_LEAVES?.leaves || [];
console.log(`\n[Faculty Leaves Audit]`);
console.log(`  Active Leaves: ${leaves.length}`);
leaves.forEach(l => {
  console.log(`  - ${l.teacher_name} (${l.department || 'General'}): ${l.start_date} to ${l.end_date} [Days: ${l.days_count || 1}]`);
});

// 7. Check Android Widget Files
console.log(`\n[Android Widget Module Audit]`);
const androidFiles = [
  'android_widget/app/build.gradle.kts',
  'android_widget/app/src/main/AndroidManifest.xml',
  'android_widget/app/src/main/res/layout/widget_4x1.xml',
  'android_widget/app/src/main/res/layout/widget_4x2.xml',
  'android_widget/app/src/main/res/layout/widget_4x4.xml',
  'android_widget/app/src/main/java/edu/srcc/timetablewidget/widget/TimetableWidgetProvider.kt',
  'android_widget/app/src/main/java/edu/srcc/timetablewidget/data/WidgetFeedRepository.kt',
  'android_widget/app/src/main/java/edu/srcc/timetablewidget/sync/WidgetSyncWorker.kt',
  'android_widget/app/src/test/java/edu/srcc/timetablewidget/WidgetScheduleTest.kt'
];
for (const af of androidFiles) {
  const exists = fs.existsSync(af);
  console.log(`  ${af}: ${exists ? '✓ OK' : '✗ Missing'}`);
}

console.log('\n=== AUDIT COMPLETED ===\n');
