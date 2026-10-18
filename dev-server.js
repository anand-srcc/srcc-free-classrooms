const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DEFAULT_PORT = 3000;
const ROOT_DIR = path.resolve(__dirname);
const WEB_APP_DIR = path.join(ROOT_DIR, 'web_app');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8'
};

function resolveFilePath(reqPath) {
  const decodedPath = decodeURIComponent(reqPath);
  const cleanPath = decodedPath.replace(/\0/g, ''); // strip null bytes

  // If path explicitly targets /web_app/...
  if (cleanPath.startsWith('/web_app/')) {
    const rel = cleanPath.slice('/web_app/'.length);
    const candidate = path.join(WEB_APP_DIR, rel);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  // Check in web_app first (main app folder)
  const webAppCandidate = path.join(WEB_APP_DIR, cleanPath);
  if (fs.existsSync(webAppCandidate)) {
    if (fs.statSync(webAppCandidate).isFile()) {
      return webAppCandidate;
    }
    const indexInDir = path.join(webAppCandidate, 'index.html');
    if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
      return indexInDir;
    }
  }

  // Check in project root
  const rootCandidate = path.join(ROOT_DIR, cleanPath);
  if (fs.existsSync(rootCandidate)) {
    if (fs.statSync(rootCandidate).isFile()) {
      return rootCandidate;
    }
    const indexInRoot = path.join(rootCandidate, 'index.html');
    if (fs.existsSync(indexInRoot) && fs.statSync(indexInRoot).isFile()) {
      return indexInRoot;
    }
  }

  // Single Page App fallback for routes without an extension
  if (!path.extname(cleanPath)) {
    const defaultIndex = path.join(WEB_APP_DIR, 'index.html');
    if (fs.existsSync(defaultIndex)) {
      return defaultIndex;
    }
  }

  return null;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: Get datasets status on localhost
  if (req.method === 'GET' && pathname === '/api/status') {
    const dataFiles = [
      'exam_codes_data.json',
      'exam_codes_data.js',
      'classes_data.json',
      'classes_data.js',
      'teachers_data.json',
      'teachers_data.js',
      'srcc_data.json',
      'data.js',
      'college_notices.json',
      'college_notices.js',
      'faculty_leaves.json',
      'faculty_leaves.js',
      'wifi_data.json',
      'wifi_data.js',
      'campus_map_data.json',
      'directory_data.json',
      'widget_feed.json'
    ];
    const statusReport = dataFiles.map(file => {
      const fPath = path.join(WEB_APP_DIR, file);
      const exists = fs.existsSync(fPath);
      let sizeBytes = 0;
      let count = null;
      if (exists) {
        sizeBytes = fs.statSync(fPath).size;
        if (file.endsWith('.json')) {
          try {
            const parsed = JSON.parse(fs.readFileSync(fPath, 'utf8'));
            count = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
          } catch (e) {}
        }
      }
      return { file, exists, sizeBytes, sizeKb: (sizeBytes / 1024).toFixed(1), count };
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, host: 'localhost', datasets: statusReport }, null, 2));
    return;
  }

  // API: Save data to localhost disk
  if (req.method === 'POST' && pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { filename, data } = payload;
        if (!filename || !filename.match(/^[a-zA-Z0-9_\-\.]+\.(json|js)$/)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Invalid filename' }));
          return;
        }

        const targetWebApp = path.join(WEB_APP_DIR, filename);
        const targetRoot = path.join(ROOT_DIR, filename);

        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        fs.writeFileSync(targetWebApp, content, 'utf8');
        fs.writeFileSync(targetRoot, content, 'utf8');

        console.log(`[SAVE] Successfully saved ${filename} to localhost disk (${content.length} bytes)`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: `Saved ${filename} to localhost`, bytes: content.length }));
      } catch (err) {
        console.error('[SAVE] Error saving data:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Security check: prohibit directory traversal out of root
  const resolved = resolveFilePath(pathname);

  if (!resolved) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`404 Not Found: ${pathname}`);
    console.log(`[404] ${req.method} ${pathname}`);
    return;
  }

  // Ensure file is inside ROOT_DIR
  if (!resolved.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(resolved, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`500 Internal Server Error`);
      console.error(`[500] Error reading ${resolved}:`, err.message);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(content);
    console.log(`[200] ${req.method} ${pathname} -> ${path.relative(ROOT_DIR, resolved)}`);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log('='.repeat(55));
    console.log('🚀 SRCC Free Classroom Finder Dev Server Running!');
    console.log(`📡 Local:   http://localhost:${port}/`);
    console.log(`📁 Serving: ${WEB_APP_DIR}`);
    console.log('💡 Press Ctrl+C to stop');
    console.log('='.repeat(55));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
