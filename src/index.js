/**
 * File Manager Plugin — CloudCLI UI Tab
 * Browse directories, preview text files, download anything.
 */

// ── Theme ─────────────────────────────────────────────────────────────

function colors(dark) {
  return dark
    ? { bg: '#08080f', surface: '#0e0e1a', border: '#1a1a2c', text: '#e2e0f0',
        muted: '#52507a', accent: '#fbbf24', hover: 'rgba(251,191,36,0.08)',
        preview: '#0b0b17', scrollThumb: '#2a2a3c', badge: 'rgba(251,191,36,0.12)' }
    : { bg: '#fafaf9', surface: '#ffffff', border: '#e8e6f0', text: '#0f0e1a',
        muted: '#9490b0', accent: '#d97706', hover: 'rgba(217,119,6,0.06)',
        preview: '#f5f4f8', scrollThumb: '#d0cee0', badge: 'rgba(217,119,6,0.10)' };
}

const MONO = "'JetBrains Mono','Fira Code',ui-monospace,monospace";

// File type icons (emoji)
const ICONS = {
  directory: '\u{1F4C1}', // folder
  js: '\u{1F7E8}', ts: '\u{1F535}', py: '\u{1F40D}', rs: '\u{1F980}', go: '\u{1F439}',
  json: '\u{1F4CB}', yaml: '\u{2699}', yml: '\u{2699}', toml: '\u{2699}',
  md: '\u{1F4DD}', txt: '\u{1F4C4}', log: '\u{1F4DC}', csv: '\u{1F4CA}',
  html: '\u{1F310}', css: '\u{1F3A8}', svg: '\u{1F5BC}',
  png: '\u{1F5BC}', jpg: '\u{1F5BC}', jpeg: '\u{1F5BC}', gif: '\u{1F5BC}', webp: '\u{1F5BC}',
  pdf: '\u{1F4D5}', zip: '\u{1F4E6}', gz: '\u{1F4E6}', tar: '\u{1F4E6}',
  sh: '\u{1F4DF}', bash: '\u{1F4DF}', env: '\u{1F510}',
  sql: '\u{1F5C3}', dockerfile: '\u{1F433}',
  default: '\u{1F4C4}',
};

function fileIcon(name, type) {
  if (type === 'directory') return ICONS.directory;
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const base = name.toLowerCase();
  if (base === 'dockerfile') return ICONS.dockerfile;
  if (base === '.env' || base === '.env.example') return ICONS.env;
  return ICONS[ext] || ICONS.default;
}

// ── CSS ───────────────────────────────────────────────────────────────

function injectStyles(dark) {
  const id = 'fm-styles';
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const c = colors(dark);
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .fm-wrap { font-family: ${MONO}; color: ${c.text}; background: ${c.bg}; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .fm-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid ${c.border}; flex-shrink: 0; flex-wrap: wrap; }
    .fm-title { font-size: 13px; font-weight: 700; color: ${c.accent}; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
    .fm-breadcrumb { display: flex; align-items: center; gap: 2px; font-size: 12px; flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; }
    .fm-crumb { color: ${c.muted}; cursor: pointer; padding: 2px 4px; border-radius: 3px; flex-shrink: 0; }
    .fm-crumb:hover { color: ${c.accent}; background: ${c.hover}; }
    .fm-crumb-sep { color: ${c.muted}; opacity: .4; flex-shrink: 0; }
    .fm-crumb-current { color: ${c.text}; font-weight: 600; }
    .fm-search { background: ${c.surface}; border: 1px solid ${c.border}; color: ${c.text}; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-family: ${MONO}; width: 180px; }
    .fm-search:focus { outline: none; border-color: ${c.accent}; }
    .fm-search::placeholder { color: ${c.muted}; }
    .fm-btn { background: ${c.surface}; border: 1px solid ${c.border}; color: ${c.muted}; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: ${MONO}; white-space: nowrap; }
    .fm-btn:hover { color: ${c.text}; border-color: ${c.accent}; }
    .fm-content { flex: 1; overflow-y: auto; }
    .fm-content::-webkit-scrollbar { width: 6px; }
    .fm-content::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 3px; }
    .fm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .fm-table th { text-align: left; padding: 6px 12px; color: ${c.muted}; font-weight: 600; border-bottom: 1px solid ${c.border}; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; position: sticky; top: 0; background: ${c.bg}; z-index: 1; }
    .fm-row { cursor: pointer; }
    .fm-row:hover td { background: ${c.hover}; }
    .fm-row td { padding: 5px 12px; border-bottom: 1px solid ${c.border}; vertical-align: middle; }
    .fm-icon { width: 22px; text-align: center; font-size: 14px; }
    .fm-name { font-weight: 500; }
    .fm-name-dir { color: ${c.accent}; font-weight: 600; }
    .fm-name-file { color: ${c.text}; }
    .fm-size { color: ${c.muted}; font-size: 11px; text-align: right; white-space: nowrap; }
    .fm-time { color: ${c.muted}; font-size: 10px; white-space: nowrap; }
    .fm-skipped { opacity: .4; font-style: italic; }
    .fm-dl { background: ${c.badge}; border: 1px solid transparent; color: ${c.accent}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-family: ${MONO}; cursor: pointer; font-weight: 600; }
    .fm-dl:hover { border-color: ${c.accent}; }
    .fm-preview-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.6); z-index: 10; display: flex; align-items: center; justify-content: center; }
    .fm-preview-panel { background: ${c.surface}; border: 1px solid ${c.border}; border-radius: 10px; width: 90%; max-width: 800px; max-height: 85%; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,.4); }
    .fm-preview-header { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid ${c.border}; flex-shrink: 0; }
    .fm-preview-title { flex: 1; font-size: 13px; font-weight: 600; color: ${c.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fm-preview-meta { font-size: 10px; color: ${c.muted}; }
    .fm-preview-close { background: none; border: none; color: ${c.muted}; font-size: 18px; cursor: pointer; padding: 0 4px; }
    .fm-preview-close:hover { color: ${c.text}; }
    .fm-preview-body { flex: 1; overflow: auto; padding: 14px 18px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: ${c.text}; background: ${c.preview}; }
    .fm-preview-body::-webkit-scrollbar { width: 6px; }
    .fm-preview-body::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 3px; }
    .fm-preview-actions { display: flex; gap: 8px; padding: 10px 16px; border-top: 1px solid ${c.border}; justify-content: flex-end; flex-shrink: 0; }
    .fm-empty { text-align: center; padding: 40px; color: ${c.muted}; font-size: 12px; }
    .fm-toast { position: fixed; bottom: 20px; right: 20px; background: ${c.surface}; border: 1px solid ${c.border}; color: ${c.text}; padding: 10px 16px; border-radius: 8px; font-size: 12px; font-family: ${MONO}; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,.3); }
    .fm-link { color: ${c.muted}; font-size: 11px; cursor: pointer; text-decoration: none; }
    .fm-link:hover { color: ${c.accent}; }
  `;
  document.head.appendChild(style);
}

// ── Toast ─────────────────────────────────────────────────────────────

function toast(msg, duration = 3000) {
  const el = document.createElement('div');
  el.className = 'fm-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

// ── Main plugin ───────────────────────────────────────────────────────

export function mount(container, api) {
  let currentPath = api.context?.project?.path || '/workspace';
  let entries = [];
  let loading = false;
  let searchQuery = '';
  let searchResults = null;
  let previewData = null;
  let dark = api.context?.theme === 'dark' || document.documentElement.classList.contains('dark');

  injectStyles(dark);

  api.onContextChange(ctx => {
    dark = ctx.theme === 'dark';
    injectStyles(dark);
    render();
  });

  // Robust fallback: CloudCLI toggles .dark on <html> — observe it directly
  const htmlEl = document.documentElement;
  const themeObserver = new MutationObserver(() => {
    const nowDark = htmlEl.classList.contains('dark');
    if (nowDark !== dark) {
      dark = nowDark;
      injectStyles(dark);
      render();
    }
  });
  themeObserver.observe(htmlEl, { attributes: true, attributeFilter: ['class'] });
  container._fmThemeObserver = themeObserver;

  // ── Data fetching ─────────────────────────────────────────────────

  async function loadDir(dirPath) {
    loading = true;
    searchResults = null;
    searchQuery = '';
    render();
    try {
      const data = await api.rpc('GET', `/list?path=${encodeURIComponent(dirPath)}`);
      currentPath = data.path;
      entries = data.entries;
    } catch (e) {
      toast('Failed to load: ' + e.message);
    }
    loading = false;
    render();
  }

  async function searchFiles(query) {
    if (!query.trim()) { searchResults = null; render(); return; }
    loading = true;
    render();
    try {
      const data = await api.rpc('GET', `/search?root=${encodeURIComponent(currentPath)}&q=${encodeURIComponent(query)}`);
      searchResults = data.results;
    } catch (e) {
      toast('Search failed: ' + e.message);
    }
    loading = false;
    render();
  }

  async function showPreview(filePath) {
    try {
      const info = await api.rpc('GET', `/info?path=${encodeURIComponent(filePath)}`);
      previewData = info;
      render();
    } catch (e) {
      toast('Preview failed: ' + e.message);
    }
  }

  function closePreview() {
    previewData = null;
    render();
  }

  function downloadFile(filePath) {
    // Download via the CloudCLI plugin proxy endpoint
    const pluginName = 'file-manager';
    const tokenCookie = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('token='));
    const token = (tokenCookie ? tokenCookie.split('=').slice(1).join('=') : null)
      || localStorage.getItem('auth_token')
      || '';

    const proxyUrl = `/api/plugins/${pluginName}/rpc/download?path=${encodeURIComponent(filePath)}`;

    fetch(proxyUrl, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      credentials: 'include',
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop() || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast(`Downloaded: ${a.download}`);
      })
      .catch(() => {
        toast('Download failed — try right-click > Save As');
      });
  }

  // ── Breadcrumb ────────────────────────────────────────────────────

  function renderBreadcrumb() {
    const parts = currentPath.split('/').filter(Boolean);
    let html = `<span class="fm-crumb" data-path="/">/</span>`;
    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i];
      const isLast = i === parts.length - 1;
      html += `<span class="fm-crumb-sep">/</span>`;
      html += `<span class="fm-crumb ${isLast ? 'fm-crumb-current' : ''}" data-path="${escHtml(accumulated)}">${escHtml(parts[i])}</span>`;
    }
    return html;
  }

  // ── Render ────────────────────────────────────────────────────────

  function render() {
    const items = searchResults || entries;

    container.innerHTML = `
      <div class="fm-wrap" style="position:relative;">
        <div class="fm-toolbar">
          <span class="fm-title">Files</span>
          <div class="fm-breadcrumb">${renderBreadcrumb()}</div>
          <input class="fm-search" type="text" placeholder="Search files..." value="${escHtml(searchQuery)}" />
          <button class="fm-btn" id="fm-up-btn">\u2191 Up</button>
          <button class="fm-btn" id="fm-refresh-btn">\u21BB Refresh</button>
        </div>
        <div class="fm-content">
          ${loading ? `<div class="fm-empty">Loading\u2026</div>` : items.length === 0
            ? `<div class="fm-empty">${searchResults !== null ? 'No results found' : 'Empty directory'}</div>`
            : `<table class="fm-table">
                <thead><tr>
                  <th style="width:30px"></th>
                  <th>Name</th>
                  <th style="width:80px;text-align:right">Size</th>
                  <th style="width:80px">Modified</th>
                  <th style="width:70px"></th>
                </tr></thead>
                <tbody>
                  ${items.map(e => renderFileRow(e)).join('')}
                </tbody>
              </table>`
          }
        </div>
        ${previewData ? renderPreviewOverlay() : ''}
      </div>
    `;

    // ── Event bindings ──────────────────────────────────────────────

    // Breadcrumb nav
    container.querySelectorAll('.fm-crumb:not(.fm-crumb-current)').forEach(el => {
      el.addEventListener('click', () => loadDir(el.dataset.path));
    });

    // Toolbar buttons
    container.querySelector('#fm-up-btn')?.addEventListener('click', () => {
      const parent = currentPath === '/' ? '/' : currentPath.replace(/\/[^/]+\/?$/, '') || '/';
      loadDir(parent);
    });
    container.querySelector('#fm-refresh-btn')?.addEventListener('click', () => loadDir(currentPath));

    // Search
    const searchInput = container.querySelector('.fm-search');
    let searchTimeout = null;
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearTimeout(searchTimeout);
      if (!searchQuery.trim()) {
        searchResults = null;
        render();
        return;
      }
      searchTimeout = setTimeout(() => searchFiles(searchQuery), 350);
    });

    // Row clicks
    container.querySelectorAll('.fm-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.fm-dl')) return;
        const p = row.dataset.path;
        const type = row.dataset.type;
        if (type === 'directory') {
          loadDir(p);
        } else {
          showPreview(p);
        }
      });
    });

    // Download buttons
    container.querySelectorAll('.fm-dl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadFile(btn.dataset.path);
      });
    });

    // Preview overlay
    container.querySelector('.fm-preview-close')?.addEventListener('click', closePreview);
    container.querySelector('.fm-preview-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('fm-preview-overlay')) closePreview();
    });
    container.querySelector('#fm-preview-dl')?.addEventListener('click', () => {
      if (previewData) downloadFile(previewData.path);
    });
  }

  function renderFileRow(entry) {
    const fullPath = searchResults
      ? entry.path
      : `${currentPath}/${entry.name}`.replace(/\/+/g, '/');
    const icon = fileIcon(entry.name, entry.type);
    const nameClass = entry.type === 'directory' ? 'fm-name-dir' : 'fm-name-file';
    const skippedClass = entry.skipped ? ' fm-skipped' : '';
    const displayName = searchResults
      ? entry.path
      : entry.name;

    return `
      <tr class="fm-row${skippedClass}" data-path="${escHtml(fullPath)}" data-type="${entry.type}">
        <td class="fm-icon">${icon}</td>
        <td class="fm-name ${nameClass}">${escHtml(displayName)}${entry.isLink ? ' \u2192' : ''}</td>
        <td class="fm-size">${entry.sizeHuman || '-'}</td>
        <td class="fm-time">${entry.modified ? timeAgo(entry.modified) : ''}</td>
        <td>${entry.type === 'file' ? `<button class="fm-dl" data-path="${escHtml(fullPath)}">Download</button>` : ''}</td>
      </tr>
    `;
  }

  function renderPreviewOverlay() {
    const d = previewData;
    const hasPreview = d.preview != null;
    return `
      <div class="fm-preview-overlay">
        <div class="fm-preview-panel">
          <div class="fm-preview-header">
            <span class="fm-preview-title">${escHtml(d.name)}</span>
            <span class="fm-preview-meta">${escHtml(d.sizeHuman)} \u2022 ${escHtml(d.mime)}</span>
            <button class="fm-preview-close">\u2715</button>
          </div>
          ${hasPreview
            ? `<div class="fm-preview-body">${escHtml(d.preview)}</div>`
            : `<div class="fm-empty" style="padding:40px;">Binary file \u2014 preview not available.<br>Click Download to save.</div>`
          }
          <div class="fm-preview-actions">
            <button class="fm-btn" id="fm-preview-dl">Download</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Init ──────────────────────────────────────────────────────────

  render();
  loadDir(currentPath);
}

export function unmount(container) {
  container.innerHTML = '';
  const styles = document.getElementById('fm-styles');
  if (styles) styles.remove();
  // Clean up the theme observer if it exists
  if (container._fmThemeObserver) {
    container._fmThemeObserver.disconnect();
    delete container._fmThemeObserver;
  }
}
