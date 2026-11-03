const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.resolve('web_app');
const previewDir = path.resolve('preview_web_app');
const desktopPath = path.join(process.env.USERPROFILE || 'C:\\Users\\anand', 'OneDrive', 'Desktop');
const zipPath = path.join(desktopPath, 'SRCC_Free_Classroom_Finder_Netlify_Deploy.zip');

console.log('📦 Syncing web_app and generating Netlify deployment zip...');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Copy to preview_web_app
copyRecursiveSync(srcDir, previewDir);
console.log('✅ Copied to preview_web_app/');

// 2. Remove old zip if present
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log('🗑️ Removed old zip archive');
}

// 3. Create new zip using PowerShell .NET ZipFile
console.log('🗜️ Creating zip archive...');
const psCommand = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${srcDir}', '${zipPath}')"`;
execSync(psCommand, { stdio: 'inherit' });

if (fs.existsSync(zipPath)) {
  const stats = fs.statSync(zipPath);
  console.log(`🎉 Successfully generated Netlify deploy zip: ${zipPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.error('❌ Failed to create zip file.');
}
