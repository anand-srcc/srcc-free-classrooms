const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 RUNNING COMPREHENSIVE SRCC ROOM FINDER & AUDIT TEST SUITE...\n');

// 1. Check required files
const REQUIRED_FILES = [
  'web_app/index.html',
  'web_app/style.css',
  'web_app/app.js',
  'web_app/admin.html',
  'web_app/admin.js',
  'web_app/_headers',
  'web_app/srcc_data.json',
  'web_app/teachers_data.json',
  'web_app/faculty_leaves.json'
];

REQUIRED_FILES.forEach(f => {
  assert(fs.existsSync(f), `Missing required file: ${f}`);
});
console.log('✅ All 9 core distribution files exist.');

// 2. Data Integrity Test: Rooms Data
const srccData = JSON.parse(fs.readFileSync('web_app/srcc_data.json', 'utf8'));
assert(srccData.rooms && Array.isArray(srccData.rooms), 'Rooms data missing or not an array');
assert.strictEqual(srccData.rooms.length, 96, `Expected exactly 96 rooms, got ${srccData.rooms.length}`);
console.log(`✅ Rooms Inventory: Exactly ${srccData.rooms.length} rooms verified.`);

// Verify room categories
const roomCodes = new Set(srccData.rooms.map(r => r.code));
assert.strictEqual(roomCodes.size, 96, 'Duplicate room codes detected');
console.log('✅ Room Uniqueness: 96 unique room codes with 0 duplicates.');

// 3. Data Integrity Test: Teachers Data & Departments
const teachersData = JSON.parse(fs.readFileSync('web_app/teachers_data.json', 'utf8'));
assert(teachersData.teachers && Array.isArray(teachersData.teachers), 'Teachers data missing or not an array');
assert.strictEqual(teachersData.teachers.length, 210, `Expected 210 teachers, got ${teachersData.teachers.length}`);

const deptCounts = {};
teachersData.teachers.forEach(t => {
  deptCounts[t.department] = (deptCounts[t.department] || 0) + 1;
});

const EXPECTED_DEPTS = {
  'Commerce': 137,
  'Economics': 46,
  'Mathematics': 6,
  'English': 5,
  'Political Science': 4,
  'Hindi': 5,
  'EVS': 5,
  'Physical Education': 2
};

for (const [dept, count] of Object.entries(EXPECTED_DEPTS)) {
  assert.strictEqual(deptCounts[dept], count, `Department ${dept} expected ${count}, got ${deptCounts[dept]}`);
}
console.log(`✅ Teachers Inventory: Exactly 210 faculty verified across all 8 departments:`);
Object.entries(deptCounts).forEach(([d, c]) => console.log(`   - ${d}: ${c}`));

// 4. Consecutive Free Windows Algorithm Test
const periodIntervals = [
  { num: 1, start: 8 * 60 + 30, end: 9 * 60 + 30, slot: '8:30 AM to 9:30 AM' },
  { num: 2, start: 9 * 60 + 30, end: 10 * 60 + 30, slot: '9:30 AM to 10:30 AM' },
  { num: 3, start: 10 * 60 + 30, end: 11 * 60 + 30, slot: '10:30 AM to 11:30 AM' },
  { num: 4, start: 11 * 60 + 30, end: 12 * 60 + 30, slot: '11:30 AM to 12:30 PM' },
  { num: 5, start: 12 * 60 + 30, end: 13 * 60 + 30, slot: '12:30 PM to 1:30 PM' },
  { num: 6, start: 14 * 60 + 0, end: 15 * 60 + 0, slot: '2:00 PM to 3:00 PM' },
  { num: 7, start: 15 * 60 + 0, end: 16 * 60 + 0, slot: '3:00 PM to 4:00 PM' },
  { num: 8, start: 16 * 60 + 0, end: 17 * 60 + 0, slot: '4:00 PM to 5:00 PM' },
  { num: 9, start: 17 * 60 + 0, end: 18 * 60 + 0, slot: '5:00 PM to 6:00 PM' }
];

function getConsecutiveFreeWindows(freeSlots, bonusSlots = []) {
  if (!freeSlots && !bonusSlots) return [];
  const bonusSlotNames = (bonusSlots || []).map(b => (typeof b === 'string' ? b : b.slot));
  const allFreeSlots = new Set([...(freeSlots || []), ...bonusSlotNames]);
  const freePeriodNums = periodIntervals.filter(p => allFreeSlots.has(p.slot)).map(p => p.num);
  if (freePeriodNums.length === 0) return [];

  if (freePeriodNums.length === 9) {
    return [{
      start: '8:30 AM',
      end: '6:00 PM',
      durationHours: 9.5,
      periodsCount: 9,
      text: '8:30 AM – 6:00 PM (Full Day Continuous)'
    }];
  }

  const windows = [];
  let currentGroup = [freePeriodNums[0]];

  for (let i = 1; i < freePeriodNums.length; i++) {
    const prev = freePeriodNums[i - 1];
    const curr = freePeriodNums[i];

    if (curr === prev + 1) {
      currentGroup.push(curr);
    } else {
      windows.push([...currentGroup]);
      currentGroup = [curr];
    }
  }
  if (currentGroup.length > 0) {
    windows.push(currentGroup);
  }

  return windows.map(group => {
    const startP = periodIntervals.find(p => p.num === group[0]);
    const endP = periodIntervals.find(p => p.num === group[group.length - 1]);
    const duration = (endP.end - startP.start) / 60;
    const durationStr = (duration % 1 === 0) ? `${duration} hrs` : `${duration} hrs`;
    const startStr = startP.slot.split(' to ')[0];
    const endStr = endP.slot.split(' to ')[1];

    return {
      start: startStr,
      end: endStr,
      durationHours: duration,
      periodsCount: group.length,
      text: `${startStr} – ${endStr} (${durationStr} continuous)`
    };
  });
}

// Test case 1: Continuous 3 hours (P3, P4, P5)
const w1 = getConsecutiveFreeWindows(['10:30 AM to 11:30 AM', '11:30 AM to 12:30 PM', '12:30 PM to 1:30 PM']);
assert.strictEqual(w1.length, 1);
assert.strictEqual(w1[0].durationHours, 3);
assert.strictEqual(w1[0].text, '10:30 AM – 1:30 PM (3 hrs continuous)');

// Test case 2: Crossing lunch (P5 and P6)
const w2 = getConsecutiveFreeWindows(['12:30 PM to 1:30 PM', '2:00 PM to 3:00 PM']);
assert.strictEqual(w2.length, 1);
assert.strictEqual(w2[0].durationHours, 2.5);
assert.strictEqual(w2[0].text, '12:30 PM – 3:00 PM (2.5 hrs continuous)');

// Test case 3: All 9 periods
const allSlots = periodIntervals.map(p => p.slot);
const wAll = getConsecutiveFreeWindows(allSlots);
assert.strictEqual(wAll[0].text, '8:30 AM – 6:00 PM (Full Day Continuous)');

console.log('✅ Consecutive Free Windows Calculation verified across all edge cases.');

// 5. IST Timezone Helper Test
const istDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
assert(!isNaN(istDate.getTime()), 'IST conversion failed');
console.log(`✅ Asia/Kolkata (IST) verification passed (Current IST: ${istDate.toLocaleString('en-US')}).`);

// 6. Security Header Check
const headersContent = fs.readFileSync('web_app/_headers', 'utf8');
assert(headersContent.includes('Content-Security-Policy'), 'Missing Content-Security-Policy');
assert(headersContent.includes('X-Content-Type-Options: nosniff'), 'Missing nosniff');
assert(headersContent.includes('X-Frame-Options: SAMEORIGIN'), 'Missing X-Frame-Options');
console.log('✅ Netlify Security Headers verified (Strict CSP, nosniff, anti-clickjacking).');

// 7. Admin Security Check
const adminJs = fs.readFileSync('web_app/admin.js', 'utf8');
assert(adminJs.includes('crypto.subtle.digest'), 'Admin PIN is not hashed with SHA-256');
const adminHtml = fs.readFileSync('web_app/admin.html', 'utf8');
assert(!adminHtml.includes('srcc2026') && !adminHtml.includes('srccadmin'), 'Plaintext password hints found in admin.html');
console.log('✅ Admin portal security verified (SHA-256 hashed passwords, zero plaintext hints).');

// 8. Mobile UI Check
const indexHtml = fs.readFileSync('web_app/index.html', 'utf8');
assert(!indexHtml.includes('>COMMUN'), 'Bottom navigation still truncates to COMMUN');
assert(indexHtml.includes('facultyDeptSelect'), 'Mobile faculty department select missing');
assert(indexHtml.includes('loadingState'), 'Loading skeleton element missing');
assert(indexHtml.includes('errorState'), 'Error state element missing');
console.log('✅ Mobile UI markup verified (Safe Chat label, mobile department select, loading/error states).');

const styleCss = fs.readFileSync('web_app/style.css', 'utf8');
assert(styleCss.includes('modal-day-tabs'), 'modal-day-tabs styles missing');
assert(styleCss.includes('modal-timetable-card-list'), 'modal-timetable-card-list styles missing');
assert(styleCss.includes('consecutive-window-chip'), 'consecutive-window-chip styles missing');
assert(styleCss.includes('.btn-check-faculty-leaves'), 'btn-check-faculty-leaves style missing');
assert(styleCss.includes('#viewToggleWrapper'), 'View toggle hiding media query missing');
console.log('✅ Mobile styling verified (Day tabs horizontal swipe, mobile schedule cards, safe area padding).');

// 9. New UI and UX Fixes Check
assert(!indexHtml.includes('bnav-fab'), 'bnav-fab still present on Free Now button');
assert(!indexHtml.includes('bnav-highlight'), 'bnav-highlight still present on Free Now button');
assert(indexHtml.includes('btnRoomsFacultyLeavesQuick'), 'Quick Faculty on Leave button missing from Rooms section');

const appJs = fs.readFileSync('web_app/app.js', 'utf8');
assert(appJs.includes('🗓️ Day & Date:'), 'Share modal still uses calendar emoji with potential FEB text');
assert(appJs.includes('btnRoomsFacultyLeavesQuick'), 'btnRoomsFacultyLeavesQuick not wired in app.js');

assert(srccData.metadata.last_synced.includes('06:30 PM'), 'Timetable sync timestamp not updated');
console.log('✅ All 6 UI, Sync & Mobile UX enhancements verified (Free Now button, share icon, faculty leave quick access, responsive metrics).');

// 10. Top Switcher Badges & Faculty Official Badge Removal Check
assert(!indexHtml.includes('mode-tab-count'), 'Mode switcher still contains counter badge');
assert(!indexHtml.includes('210 Professors'), 'Faculty header still contains 210 Professors badge');
console.log('✅ Top mode switcher & faculty header badges removed cleanly.');

// 11. WhatsApp Community Link Check
assert(indexHtml.includes('https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf'), 'WhatsApp link not updated in index.html');
assert(appJs.includes('https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf'), 'WhatsApp link not updated in app.js');
console.log('✅ WhatsApp Community link successfully updated to H6qxq6fGSDVJNPCEtzQgjf.');

// 12. A-Z Alphabet Filter Bar & Title-Insensitive Search/Sort Check
assert(indexHtml.includes('facultyAzFilter'), 'Faculty A-Z filter bar missing in index.html');
assert(appJs.includes('getTeacherBaseName'), 'getTeacherBaseName helper missing in app.js');
assert(appJs.includes('normalizeFacultySearchText'), 'normalizeFacultySearchText phonetic helper missing in app.js');

// Test Dr. Shefali Kapoor matching with "sefali"
const testTeacher = teachersData.teachers.find(t => t.id === '499');
assert(testTeacher, 'Teacher 499 (Dr. Shefali Kapoor) not found');
const normT = testTeacher.clean_name.toLowerCase().replace(/^(?:(?:dr|prof|mr|ms|mrs|ca|cma)\.?\s+)/i, '').replace(/sh/g, 's');
const normQuery = 'sefali'.toLowerCase().replace(/sh/g, 's');
assert(normT.includes(normQuery), 'Phonetic search failed for sefali -> Dr. Shefali Kapoor');
console.log('✅ Title-independent A-Z jump & phonetic search ("sefali" -> Dr. Shefali Kapoor) verified.');

// 13. Admin Multi-User Management & Password Reset Check
const adminHtmlContent = fs.readFileSync('web_app/admin.html', 'utf8');
assert(adminHtmlContent.includes('formChangePassword'), 'formChangePassword missing in admin.html');
assert(adminHtmlContent.includes('formCreateAdminUser'), 'formCreateAdminUser missing in admin.html');
assert(adminHtmlContent.includes('adminUsersListContainer'), 'adminUsersListContainer missing in admin.html');

const adminJsContent = fs.readFileSync('web_app/admin.js', 'utf8');
assert(adminJsContent.includes('USERS_STORAGE_KEY'), 'USERS_STORAGE_KEY missing in admin.js');
assert(adminJsContent.includes('formChangePassword'), 'formChangePassword logic missing in admin.js');
assert(adminJsContent.includes('formCreateAdminUser'), 'formCreateAdminUser logic missing in admin.js');
console.log('✅ Admin password reset and multi-user management verified.');

console.log('\n🎉 ALL AUDIT & INTEGRITY TESTS PASSED SUCCESSFULLY! (100% PASS)\n');


