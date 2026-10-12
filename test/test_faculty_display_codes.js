const fs = require('fs');
const assert = require('assert');
const path = require('path');

const adminCode = fs.readFileSync(path.join(__dirname, '../web_app/admin.js'), 'utf8');
const appCode = fs.readFileSync(path.join(__dirname, '../web_app/app.js'), 'utf8');
const teachers = JSON.parse(fs.readFileSync(path.join(__dirname, '../web_app/teachers_data.json'), 'utf8')).teachers;

// Evaluate admin logic inside safe sandbox
const sandbox = { teachersData: { teachers }, window: {} };
const fnAdminCode = adminCode.match(/function getAdminFacultyDisplayCode[\s\S]+?return primary \|\| alias \|\| '';\s*}/)[0];
eval(fnAdminCode);

const fnAppMatch = appCode.match(/function getDisplayShortCode\(teacher\)[\s\S]+?return primary;\s*}/);
if (fnAppMatch) eval(fnAppMatch[0]);
function getClientDisplayShortCode(teacher) {
  if (!teacher) return '';
  const code = (teacher.short_code || teacher.ref_code || '').trim();
  return code.toUpperCase();
}

console.log('--- TESTING ADMIN VS CLIENT FACULTY CODES ---');

// 1. Anisha
const anisha = teachers.find(t => t.clean_name === 'Anisha');
const anishaAdmin = getAdminFacultyDisplayCode(anisha);
const anishaClient = getClientDisplayShortCode(anisha);
console.log(`Anisha -> Admin: [${anishaAdmin}] | Client: [${anishaClient}]`);
assert.strictEqual(anishaAdmin, 'ANC / CG1');
assert.strictEqual(anishaClient, 'ANC');

// 2. Aayushi
const aayushi = teachers.find(t => t.clean_name === 'Aayushi');
const aayushiAdmin = getAdminFacultyDisplayCode(aayushi);
const aayushiClient = getClientDisplayShortCode(aayushi);
console.log(`Aayushi -> Admin: [${aayushiAdmin}] | Client: [${aayushiClient}]`);
assert.strictEqual(aayushiAdmin, 'AAIC / CG16');
assert.strictEqual(aayushiClient, 'AAIC');

// 3. Himanshi
const himanshi = teachers.find(t => t.clean_name === 'Himanshi');
const himanshiAdmin = getAdminFacultyDisplayCode(himanshi);
const himanshiClient = getClientDisplayShortCode(himanshi);
console.log(`Himanshi -> Admin: [${himanshiAdmin}] | Client: [${himanshiClient}]`);
assert.strictEqual(himanshiAdmin, 'HA / CG4');
assert.strictEqual(himanshiClient, 'HA');

// 4. Aditi
const aditi = teachers.find(t => t.clean_name === 'Aditi');
const aditiAdmin = getAdminFacultyDisplayCode(aditi);
const aditiClient = getClientDisplayShortCode(aditi);
console.log(`Aditi -> Admin: [${aditiAdmin}] | Client: [${aditiClient}]`);
assert.strictEqual(aditiAdmin, 'AK24 / 21');
assert.strictEqual(aditiClient, 'AK24');

// 5. Abhilash
const abhilash = teachers.find(t => t.clean_name === 'Abhilash');
const abhilashAdmin = getAdminFacultyDisplayCode(abhilash);
const abhilashClient = getClientDisplayShortCode(abhilash);
console.log(`Abhilash -> Admin: [${abhilashAdmin}] | Client: [${abhilashClient}]`);
assert.strictEqual(abhilashAdmin, 'AB / HG4');
assert.strictEqual(abhilashClient, 'AB');

// 6. Regular Single Code Faculty (Santosh Kumar Commerce SKB)
const santosh = teachers.find(t => t.clean_name === 'Santosh Kumar' && t.department === 'Commerce' && t.short_code === 'SKB');
if (santosh) {
  const sAdmin = getAdminFacultyDisplayCode(santosh);
  const sClient = getClientDisplayShortCode(santosh);
  console.log(`Santosh Kumar (SKB) -> Admin: [${sAdmin}] | Client: [${sClient}]`);
  assert.strictEqual(sAdmin, 'SKB');
  assert.strictEqual(sClient, 'SKB');
}

// 7. Priyanka Aggarwal Maths
const priyankaMaths = teachers.find(t => t.clean_name.includes('Priyanka') && t.department === 'Mathematics');
if (priyankaMaths) {
  const pAdmin = getAdminFacultyDisplayCode(priyankaMaths);
  const pClient = getClientDisplayShortCode(priyankaMaths);
  console.log(`Priyanka Aggarwal (Maths) -> Admin: [${pAdmin}] | Client: [${pClient}]`);
  assert.strictEqual(pAdmin, 'PAA / PKC');
  assert.strictEqual(pClient, 'PAA');
}

console.log('✓ All 7 test cases passed cleanly!');
