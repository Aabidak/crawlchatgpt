// scripts/crawler.js
// Crawling logic + UI bindings + tree rendering + Firestore save.

import { buildUrlTree } from './treeview.js';
import { auth, db } from './firebase-config.js';
import {
  collection,
  addDoc,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- UI elements (IDs must match your HTML) ---
const crawlForm = document.getElementById('crawlForm');
const urlInput = document.getElementById('urlInput');
const sameOriginInput = document.getElementById('sameOriginOnly');
const depthSelect = document.getElementById('crawlDepth');
const resultsEl = document.getElementById('results');
const resultsContentEl = document.getElementById('resultsContent');
const historyListEl = document.getElementById('historyList');
const exportBtn = document.getElementById('exportCsv');
const crawlStatus = document.getElementById('crawlStatus');

const PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://r.jina.ai/http://',
  'https://api.codetabs.com/v1/proxy?quest='
];

function normalizeUrl(raw) {
  if (!raw) return null;
  let val = raw.trim();
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(val)) val = 'https://' + val;
  try {
    const u = new URL(val);
    return u.toString();
  } catch (e) {
    return null;
  }
}

async function fetchWithProxies(url) {
  let lastErr;
  for (let i = 0; i < PROXIES.length; i++) {
    const proxy = PROXIES[i];
    try {
      const full = proxy + encodeURIComponent(url);
      const res = await fetch(full, { method: 'GET' });
      if (!res.ok) throw new Error('Bad status ' + res.status);
      const text = await res.text();
      return text;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 200 * (i + 1)));
    }
  }
  try {
    const r = await fetch(url);
    if (r.ok) return await r.text();
  } catch (e) {}
  throw lastErr || new Error('All proxies failed');
}

function extractLinksFromHtml(baseUrl, htmlText) {
  const links = new Set();
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    doc.querySelectorAll('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      try {
        const abs = new URL(raw, baseUrl).toString();
        links.add(abs);
      } catch (e) {}
    });
    doc.querySelectorAll('form[action]').forEach(f => {
      const raw = f.getAttribute('action');
      try {
        const abs = new URL(raw, baseUrl).toString();
        links.add(abs);
      } catch (e) {}
    });
  } catch (e) {
    console.warn('parse error', e);
  }
  return Array.from(links);
}

async function crawl(startUrl, { depth = 0, sameOriginOnly = true, maxPages = 200 } = {}) {
  const visited = new Set();
  const found = new Set();
  const queue = [{ url: startUrl, level: 0 }];
  const startOrigin = new URL(startUrl).origin;

  while (queue.length && visited.size < maxPages) {
    const { url, level } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      updateStatus(`Fetching ${url} (level ${level})`);
      const html = await fetchWithProxies(url);
      const links = extractLinksFromHtml(url, html);

      links.forEach(l => {
        try {
          if (sameOriginOnly && new URL(l).origin !== startOrigin) return;
          if (!found.has(l)) {
            found.add(l);
            if (level < depth) queue.push({ url: l, level: level + 1 });
          }
        } catch (e) {}
      });
    } catch (e) {
      console.warn('fetch error for', url, e);
    }
  }

  updateStatus(`Crawl finished. ${found.size} links found.`);
  return Array.from(found);
}

function updateStatus(msg) {
  if (crawlStatus) crawlStatus.textContent = msg;
  else console.log('[status]', msg);
}

function renderCrawlResults(urls, viewMode = 'tree') {
  if (!resultsContentEl) return;
  resultsContentEl.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = 'status';
  summary.textContent = `${urls.length} unique link${urls.length !== 1 ? 's' : ''} found`;
  resultsContentEl.appendChild(summary);

  const help = document.createElement('div');
  help.style.margin = '8px 0 12px 0';
  help.style.color = 'rgba(0,255,85,0.7)';
  help.textContent = 'Click nodes to expand. Click links to open in a new tab.';
  resultsContentEl.appendChild(help);

  let treeContainer = document.getElementById('treeView');
  if (!treeContainer) {
    treeContainer = document.createElement('div');
    treeContainer.id = 'treeView';
    treeContainer.className = 'treeview';
    resultsContentEl.appendChild(treeContainer);
  } else {
    treeContainer.innerHTML = '';
  }

  let flatContainer = document.getElementById('flatList');
  if (flatContainer) flatContainer.remove();
  flatContainer = document.createElement('div');
  flatContainer.id = 'flatList';
  flatContainer.style.marginTop = '18px';

  urls.forEach(u => {
    const a = document.createElement('a');
    a.href = u;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = u;
    a.className = 'result-link';
    flatContainer.appendChild(a);
  });

  if (viewMode === 'tree') {
    buildUrlTree(urls, 'treeView');
    flatContainer.style.display = 'none';
    resultsContentEl.appendChild(flatContainer);
  } else {
    treeContainer.innerHTML = '';
    flatContainer.style.display = '';
    resultsContentEl.appendChild(flatContainer);
  }
}

async function saveToHistory(ownerUid, url, urls) {
  if (!db || !ownerUid) return;
  try {
    await addDoc(collection(db, 'crawls'), {
      userId: ownerUid,
      seed: url,
      urls,
      urlCount: urls.length,
      timestamp: Timestamp.now()
    });
  } catch (e) {
    console.warn('Failed to save history', e);
  }
}

if (crawlForm) {
  crawlForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const raw = urlInput ? urlInput.value : '';
    const normalized = normalizeUrl(raw);
    if (!normalized) {
      updateStatus('Please enter a valid URL.');
      return;
    }
    const sameOriginOnly = !!(sameOriginInput && sameOriginInput.checked);
    const depth = depthSelect ? parseInt(depthSelect.value || '0', 10) : 0;

    try {
      updateStatus('Starting crawl...');
      const urls = await crawl(normalized, { depth, sameOriginOnly });

      // render UI (default view tree)
      renderCrawlResults(urls, window.__resultsViewMode || 'tree');

      // attempt to save to history if user is logged in
      const user = auth && auth.currentUser ? auth.currentUser : null;
      if (user) {
        await saveToHistory(user.uid, normalized, urls);
        // refresh history if available
        if (typeof window.loadHistory === 'function') {
          window.loadHistory().catch(()=>{});
        }
      }
    } catch (e) {
      console.error('Crawl failed', e);
      updateStatus('Crawl failed: ' + (e.message || e));
    }
  });
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const links = [];
    document.querySelectorAll('.results .result-link').forEach(a => {
      if (a.href) links.push(a.href);
    });
    if (!links.length) {
      alert('No links to export');
      return;
    }
    const csv = 'url\n' + links.map(l => `"${l.replace(/"/g,'""')}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crawler_links.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

window.renderCrawlResults = renderCrawlResults;
