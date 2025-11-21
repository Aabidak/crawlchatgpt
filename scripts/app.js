// scripts/app.js
// App-level UI wiring: logout, user info display, toggle view, download PDF.
// Assumes firebase-config.js exports `auth` and history.js exposes `loadHistory()`.

import { auth } from './firebase-config.js';

const logoutButton = document.getElementById('logoutButton');
const userEmailEl = document.getElementById('userEmail');
const toggleViewBtn = document.getElementById('toggleViewBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const resultsContent = document.getElementById('resultsContent');

window.__resultsViewMode = 'tree';

if (auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged((user) => {
    if (user) {
      userEmailEl.textContent = user.email || user.displayName || user.uid;
      if (typeof window.loadHistory === 'function') {
        try { window.loadHistory(); } catch (e) { console.warn(e); }
      }
    } else {
      userEmailEl.textContent = '—';
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    if (auth && typeof auth.signOut === 'function') {
      try {
        await auth.signOut();
        window.location.href = 'login.html';
      } catch (e) {
        console.error('Logout failed', e);
        alert('Logout failed, check console');
      }
    } else {
      window.location.href = 'login.html';
    }
  });
}

if (toggleViewBtn) {
  toggleViewBtn.addEventListener('click', () => {
    window.__resultsViewMode = window.__resultsViewMode === 'tree' ? 'flat' : 'tree';
    toggleViewBtn.textContent = window.__resultsViewMode === 'tree' ? 'View as Tree' : 'View as Flat';

    const currentLinks = [];
    document.querySelectorAll('.results .result-link').forEach(a => {
      if (a.href) currentLinks.push(a.href);
    });
    if (typeof window.renderCrawlResults === 'function') {
      window.renderCrawlResults(currentLinks, window.__resultsViewMode);
    }
  });
}

if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener('click', async () => {
    if (!resultsContent) { alert('Nothing to export'); return; }

    const clone = resultsContent.cloneNode(true);
    clone.style.background = '#000';
    clone.style.color = '#00ff55';
    clone.style.padding = '20px';
    clone.style.fontFamily = '"Courier New", monospace';
    clone.style.lineHeight = '1.4';
    clone.style.width = '794px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';
    header.innerHTML = `
      <div style="font-weight:700; color:#ff6b92; letter-spacing:2px; font-size:18px;">URL CRAWLER</div>
      <div style="color:#00b84c; font-size:12px;">Exported: ${new Date().toLocaleString()}</div>
    `;
    clone.prepend(header);

    const wrapper = document.createElement('div');
    wrapper.style.background = '#000';
    wrapper.style.padding = '18px';
    wrapper.appendChild(clone);

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `crawler_results_${Date.now()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#000' },
      jsPDF:        { unit: 'pt', format: 'a4', orientation: 'portrait' }
    };

    try {
      downloadPdfBtn.disabled = true;
      downloadPdfBtn.textContent = 'Preparing PDF...';
      await html2pdf().set(opt).from(wrapper).save();
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Failed to generate PDF — see console for details.');
    } finally {
      downloadPdfBtn.disabled = false;
      downloadPdfBtn.textContent = 'Download PDF';
    }
  });
}

if (typeof window.loadHistory === 'function') {
  try { window.loadHistory(); } catch (e) { console.warn('loadHistory failed', e); }
}
