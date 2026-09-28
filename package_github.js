const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('.');
const destDir = 'C:\\Users\\anand_fua08yg\\Downloads\\github_upload_srcc';

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (['.venv', 'venv', '__pycache__', 'preview_web_app', 'node_modules', '.git'].includes(entry.name)) {
        continue;
      }
      copyRecursiveSync(srcPath, destPath);
    } else {
      copyRecursiveSyncFile(srcPath, destPath, entry.name);
    }
  }
}

function copyRecursiveSyncFile(srcFile, destFile, name) {
  if (name === 'playwright_state.json' || name === 'check_syntax.py' || name.endsWith('.tmp')) {
    return;
  }
  fs.copyFileSync(srcFile, destFile);
}

// Clean and prepare
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

// Copy web_app
copyRecursiveSync(path.join(srcDir, 'web_app'), path.join(destDir, 'web_app'));

// Copy .github
copyRecursiveSync(path.join(srcDir, '.github'), path.join(destDir, '.github'));

// Copy root essentials
const rootFiles = [
  'index.html',
  'srcc_crest_official.png',
  'centenary_official.png',
  'sync_leaves.py',
  'auto_sync_timetable.py',
  'export_data_json.py',
  'scrape_teachers.py',
  'enrich_teachers.py',
  'srcc_scraper.py',
  'categorize_rooms.py',
  'check_empty_rooms.py',
  'check_5_rooms.py',
  'inspect_timetable.py',
  'requirements.txt',
  'netlify.toml',
  '.gitignore',
  'update_timetable.bat',
  'update_leaves.bat',
  'login_session.bat',
  'push_to_github.bat',
  'github_login_and_push.bat',
  'package_netlify.js',
  'SRCC_Free_Classrooms_Timetable.xlsx'
];

for (const file of rootFiles) {
  const p = path.join(srcDir, file);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(destDir, file));
  }
}

const { execSync } = require('child_process');
const zipPath = 'C:\\Users\\anand_fua08yg\\Downloads\\srcc_github_repo_latest.zip';
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  execSync(`powershell -Command "Compress-Archive -Path '${destDir}\\*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  console.log('🎉 Also created ZIP archive for 1-click GitHub upload at: ' + zipPath);
} catch (e) {
  console.error('Note on zip creation:', e.message);
}

console.log('✅ github_upload_srcc folder successfully prepared at: ' + destDir);
console.log('Contents:');
console.log(fs.readdirSync(destDir));

