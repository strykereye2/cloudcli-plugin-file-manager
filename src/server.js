import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createReadStream, statSync } from 'node:fs';

// ── Config ────────────────────────────────────────────────────────────
// Allowed root directories — configurable via FILE_MANAGER_ROOTS env var.
// Comma-separated list of absolute paths. Defaults to the user home + /tmp.

const DEFAULT_ROOTS = [
  process.env.HOME || '/home',
  '/tmp',
];

const ALLOWED_ROOTS = process.env.FILE_MANAGER_ROOTS
  ? process.env.FILE_MANAGER_ROOTS.split(',').map(r => r.trim()).filter(Boolean)
  : DEFAULT_ROOTS;

const DEFAULT_PATH = process.env.FILE_MANAGER_DEFAULT_PATH
  || ALLOWED_ROOTS[0]
  || '/tmp';

const HIDDEN_PATTERNS = ['.git/objects', '.git/pack', 'node_modules/.cache'];
const MAX_PREVIEW_BYTES = 256 * 1024; // 256 KB text preview limit

const TEXT_EXTS = new Set([
  '.js','.jsx','.ts','.tsx','.mjs','.cjs','.vue','.svelte','.astro',
  '.css','.scss','.sass','.less',
  '.html','.htm','.xml','.svg',
  '.json','.yaml','.yml','.toml','.ini','.env',
  '.md','.mdx','.txt','.rst','.log','.csv',
  '.py','.rb','.go','.rs','.java','.c','.cpp','.h','.hpp','.cs',
  '.sh','.bash','.zsh','.fish','.bat','.ps1',
  '.sql','.graphql','.gql',
  '.dockerfile','.conf','.cfg','.properties',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.venv', 'venv',
  '.cache', '.next', '.nuxt', 'coverage', '.turbo',
]);

// ── Security ──────────────────────────────────────────────────────────

function isAllowedPath(p) {
  const resolved = path.resolve(p);
  return ALLOWED_ROOTS.some(root => resolved === root || resolved.startsWith(root + '/'));
}

function isHidden(p) {
  return HIDDEN_PATTERNS.some(pat => p.includes(pat));
}

// ── Helpers ───────────────────────────────────────────────────────────

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTS.has(ext)) return true;
  const base = path.basename(filePath).toLowerCase();
  return ['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile',
          '.gitignore', '.dockerignore', '.env', '.env.example',
          'license', 'readme', 'changelog'].includes(base);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.xml': 'application/xml', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.pdf': 'application/pdf', '.zip': 'application/zip', '.gz': 'application/gzip',
    '.tar': 'application/x-tar', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  };
  return map[ext] || (isTextFile(filePath) ? 'text/plain' : 'application/octet-stream');
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function parseUrl(url) {
  const [pathname, qs] = (url || '').split('?');
  const params = {};
  if (qs) {
    for (const pair of qs.split('&')) {
      const [k, ...rest] = pair.split('=');
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(rest.join('=') || '');
      } catch { /* skip malformed param */ }
    }
  }
  return { pathname, params };
}

// ── Route: list directory ─────────────────────────────────────────────

function handleList(dirPath, res) {
  if (!isAllowedPath(dirPath)) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Path not allowed' }));
    return;
  }

  const resolved = path.resolve(dirPath);
  let stat;
  try { stat = statSync(resolved); } catch {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Path not found' }));
    return;
  }

  if (!stat.isDirectory()) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Not a directory' }));
    return;
  }

  const entries = [];
  try {
    for (const name of fs.readdirSync(resolved)) {
      const fullPath = path.join(resolved, name);
      if (isHidden(fullPath)) continue;

      try {
        const s = fs.lstatSync(fullPath);
        const isDir = s.isDirectory();
        const isLink = s.isSymbolicLink();

        // Skip known heavy dirs in listing
        if (isDir && SKIP_DIRS.has(name)) {
          entries.push({
            name, type: 'directory', size: 0, sizeHuman: '-',
            modified: s.mtime.toISOString(), skipped: true,
          });
          continue;
        }

        entries.push({
          name,
          type: isDir ? 'directory' : 'file',
          size: isDir ? 0 : s.size,
          sizeHuman: isDir ? '-' : formatSize(s.size),
          modified: s.mtime.toISOString(),
          isText: isDir ? false : isTextFile(fullPath),
          isLink,
        });
      } catch { /* permission denied — skip */ }
    }
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Failed to list directory' }));
    return;
  }

  // Sort: directories first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ path: resolved, entries }));
}

// ── Route: file info / preview ────────────────────────────────────────

function handleInfo(filePath, res) {
  if (!isAllowedPath(filePath)) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Path not allowed' }));
    return;
  }

  const resolved = path.resolve(filePath);
  let stat;
  try { stat = statSync(resolved); } catch {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'File not found' }));
    return;
  }

  const info = {
    path: resolved,
    name: path.basename(resolved),
    size: stat.size,
    sizeHuman: formatSize(stat.size),
    modified: stat.mtime.toISOString(),
    isText: isTextFile(resolved),
    mime: getMimeType(resolved),
  };

  // Include text preview if small enough
  if (info.isText && stat.size <= MAX_PREVIEW_BYTES) {
    try {
      info.preview = fs.readFileSync(resolved, 'utf8');
    } catch { info.preview = null; }
  }

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(info));
}

// ── Route: download file ──────────────────────────────────────────────

function handleDownload(filePath, res) {
  if (!isAllowedPath(filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const resolved = path.resolve(filePath);
  let stat;
  try { stat = statSync(resolved); } catch {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  if (stat.isDirectory()) {
    res.writeHead(400);
    res.end('Cannot download a directory');
    return;
  }

  const mime = getMimeType(resolved);
  const filename = path.basename(resolved);

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
    'Content-Length': stat.size,
  });

  const stream = createReadStream(resolved);
  stream.pipe(res);
  stream.on('error', () => {
    if (!res.writableEnded) res.end();
  });
}

// ── Route: search files ───────────────────────────────────────────────

function handleSearch(rootPath, query, res) {
  if (!isAllowedPath(rootPath)) {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Path not allowed' }));
    return;
  }

  const resolved = path.resolve(rootPath);
  const results = [];
  const lowerQuery = query.toLowerCase();
  const maxResults = 100;
  const maxDepth = 6;

  function walk(dir, depth) {
    if (depth > maxDepth || results.length >= maxResults) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (results.length >= maxResults) break;
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          results.push({ path: full, name: entry.name, type: 'directory' });
        }
        walk(full, depth + 1);
      } else {
        if (entry.name.toLowerCase().includes(lowerQuery)) {
          try {
            const s = statSync(full);
            results.push({
              path: full, name: entry.name, type: 'file',
              size: s.size, sizeHuman: formatSize(s.size),
            });
          } catch { }
        }
      }
    }
  }

  walk(resolved, 0);

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ root: resolved, query, results }));
}

// ── HTTP server ───────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const { pathname, params } = parseUrl(req.url);

  // GET /list?path=/workspace
  if (req.method === 'GET' && pathname === '/list') {
    handleList(params.path || DEFAULT_PATH, res);
    return;
  }

  // GET /info?path=/workspace/file.txt
  if (req.method === 'GET' && pathname === '/info') {
    if (!params.path) { res.writeHead(400); res.end(JSON.stringify({ error: 'path required' })); return; }
    handleInfo(params.path, res);
    return;
  }

  // GET /download?path=/workspace/file.txt
  if (req.method === 'GET' && pathname === '/download') {
    if (!params.path) { res.writeHead(400); res.end('path required'); return; }
    handleDownload(params.path, res);
    return;
  }

  // GET /search?root=/workspace&q=docker
  if (req.method === 'GET' && pathname === '/search') {
    if (!params.q) { res.writeHead(400); res.end(JSON.stringify({ error: 'q required' })); return; }
    handleSearch(params.root || DEFAULT_PATH, params.q, res);
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr !== 'string') {
    console.log(JSON.stringify({ ready: true, port: addr.port }));
  }
});
