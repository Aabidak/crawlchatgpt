// scripts/history.js
// History feature: loads saved crawls from Firestore for the current user,
// displays them in #historyList, allows viewing a crawl (restore), copying links, and deletion.
//
// This file expects your firebase-config.js to export named `auth` and `db`
// and that Firestore v10 modular SDK is available via imports below.
//
// It exposes window.loadHistory() so other modules (app.js, crawler.js) can call it.

import { auth, db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const historyListEl = document.getElementById('historyList');

function formatTimestamp(ts) {
  try {
    if (!ts) return '-';
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    return new Date(ts).toLocaleString();
  } catch (e) {
    return String(ts);
  }
}

async function renderHistoryEntries(docs) {
  if (!historyListEl) return;
  historyListEl.innerHTML = '';
  if (!docs || docs.length === 0) {
    historyListEl.textContent = 'No saved crawls.';
    return;
  }

  docs.forEach(docSnap => {
    const data = docSnap.data();
    const id = docSnap.id;
    const item = document.createElement('div');
    item.className = 'history-item';
    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.alignItems = 'center';

    const left = document.createElement('div');
    left.innerHTML = `<div style="font-weight:700; color:var(--neon-green)">${data.seed || '—'}</div>
                      <div class="meta">${formatTimestamp(data.timestamp)}</div>`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';

    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-small';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => {
      const urls = (data.urls && Array.isArray(data.urls)) ? data.urls : [];
      if (typeof window.renderCrawlResults === 'function') {
        window.renderCrawlResults(urls, window.__resultsViewMode || 'tree');
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        if (urls[0]) window.open(urls[0], '_blank');
      }
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-small';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      const urls = (data.urls && Array.isArray(data.urls)) ? data.urls.join('\n') : '';
      try {
        await navigator.clipboard.writeText(urls);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
      } catch (e) {
        alert('Copy failed: ' + e);
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-small';
    delBtn.style.background = 'transparent';
    delBtn.style.border = '1px solid rgba(255,80,100,0.08)';
    delBtn.style.color = '#ff6b92';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this history entry?')) return;
      try {
        await deleteDoc(doc(db, 'crawls', id));
        await loadHistory();
      } catch (e) {
        console.error('Failed to delete', e);
        alert('Delete failed: ' + e.message);
      }
    });

    right.appendChild(viewBtn);
    right.appendChild(copyBtn);
    right.appendChild(delBtn);

    title.appendChild(left);
    title.appendChild(right);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${Array.isArray(data.urls) ? data.urls.length : 0} links`;

    item.appendChild(title);
    item.appendChild(meta);
    historyListEl.appendChild(item);
  });
}

export async function loadHistory(limit = 50) {
  if (!historyListEl) return;
  historyListEl.innerHTML = 'Loading...';
  const user = auth && auth.currentUser ? auth.currentUser : null;
  if (!user) {
    historyListEl.textContent = 'Sign in to see history.';
    return;
  }

  try {
    const crawlsRef = collection(db, 'crawls');
    const q = query(crawlsRef, where('userId', '==', user.uid), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    await renderHistoryEntries(snapshot.docs);
  } catch (e) {
    console.error('Failed to load history', e);
    historyListEl.textContent = 'Failed to load history.';
  }
}

window.loadHistory = loadHistory;

if (auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      loadHistory().catch(()=>{});
    } else {
      if (historyListEl) historyListEl.textContent = 'Sign in to see history.';
    }
  });
}
