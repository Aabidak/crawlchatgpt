// scripts/treeview.js
// Builds a collapsible tree view from an array of URL strings.
// Usage: import { buildUrlTree } from './treeview.js'; buildUrlTree(urlsArray, 'treeView');

export function buildUrlTree(urls = [], containerId = 'treeView') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('Tree container not found:', containerId);
    return;
  }

  container.innerHTML = '';

  // Normalize and split into segments: [host, path segments..., query]
  function urlToSegments(raw) {
    try {
      const u = new URL(raw);
      const path = u.pathname.replace(/^\//, '');
      const segments = path ? path.split('/').filter(Boolean) : [];
      if (u.search) segments.push(u.search);
      return [u.hostname, ...segments];
    } catch (e) {
      // fallback for non-parseable strings
      return [raw];
    }
  }

  // Build a trie-like nested object
  const root = {};
  urls.forEach(u => {
    const segs = urlToSegments(u);
    let node = root;
    segs.forEach((seg, idx) => {
      if (!node[seg]) node[seg] = { __children: {}, __leafUrls: [] };
      if (idx === segs.length - 1) node[seg].__leafUrls.push(u);
      node = node[seg].__children;
    });
  });

  // Render recursively
  function renderNode(obj, parentUl) {
    Object.keys(obj).forEach(key => {
      if (key === '__children' || key === '__leafUrls') return;
      const item = obj[key];

      const li = document.createElement('li');
      li.className = 'tree-node';

      const label = document.createElement('div');
      label.className = 'tree-label';
      label.tabIndex = 0;

      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle';
      const hasChildren = Object.keys(item.__children || {}).length > 0;
      const hasLeaves = (item.__leafUrls || []).length > 0;
      toggle.textContent = (hasChildren || hasLeaves) ? '▸' : '•';
      toggle.style.marginRight = '8px';
      toggle.style.cursor = hasChildren || hasLeaves ? 'pointer' : 'default';

      const text = document.createElement('span');
      text.className = 'tree-text';
      text.textContent = key;

      label.appendChild(toggle);
      label.appendChild(text);
      li.appendChild(label);

      // Leaves (full URLs)
      const leavesUl = document.createElement('ul');
      leavesUl.className = 'tree-leaf-list';
      leavesUl.style.display = 'none';
      leavesUl.style.listStyle = 'none';
      leavesUl.style.paddingLeft = '6px';
      if (hasLeaves) {
        item.__leafUrls.forEach(full => {
          const urlLi = document.createElement('li');
          urlLi.className = 'tree-leaf';
          const a = document.createElement('a');
          a.className = 'result-link';
          a.href = full;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = decodeURI(full);
          urlLi.appendChild(a);
          leavesUl.appendChild(urlLi);
        });
      }

      // Children subtree
      const childrenUl = document.createElement('ul');
      childrenUl.className = 'tree-children';
      childrenUl.style.display = 'none';
      childrenUl.style.listStyle = 'none';
      childrenUl.style.paddingLeft = '6px';

      // Toggle expand/collapse
      function toggleExpand() {
        const opening = childrenUl.style.display === 'none' && leavesUl.style.display === 'none';
        if (opening) {
          toggle.textContent = '▾';
          if (hasLeaves) leavesUl.style.display = '';
          if (hasChildren) childrenUl.style.display = '';
        } else {
          toggle.textContent = '▸';
          if (hasLeaves) leavesUl.style.display = 'none';
          if (hasChildren) childrenUl.style.display = 'none';
        }
      }

      label.addEventListener('click', () => {
        if (hasChildren || hasLeaves) toggleExpand();
      });
      label.addEventListener('keypress', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (hasChildren || hasLeaves)) toggleExpand();
      });

      if (hasLeaves) li.appendChild(leavesUl);
      li.appendChild(childrenUl);

      parentUl.appendChild(li);

      // recurse for children
      renderNode(item.__children, childrenUl);
    });
  }

  const topUl = document.createElement('ul');
  topUl.className = 'tree-root';
  topUl.style.listStyle = 'none';
  topUl.style.paddingLeft = '0';

  renderNode(root, topUl);

  if (!topUl.childElementCount) {
    container.innerHTML = '<div class="status">No links found</div>';
  } else {
    container.appendChild(topUl);
  }
}
