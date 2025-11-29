// src/content/reddit.js - final, robust version for Reddit chat
// Targets: div.room-message-text.truncated (as found on the page)
// - dedupes with WeakSet
// - waits for detector to be available
// - positions panel using badge bounding rect
// - minimal, non-invasive DOM changes

console.log("%cSafeDM: reddit scanner final loaded", "color:#FF2D95; font-weight:700;");

(function(){
  // Ensure detector is available in page context (inject if necessary)
  if (!window.SafeDMDetector) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/detector.js');
    s.async = true;
    document.documentElement.appendChild(s);
    s.onload = () => console.log('SafeDM detector injected by reddit.js');
  }

  const SELECTOR = 'div.room-message-text.truncated';
  const processed = new WeakSet();

  // Helper: create badge element
  function makeBadge(severity){
    const el = document.createElement('span');
    el.className = 'safedm-badge safedm-' + (severity || 'medium');
    el.textContent = (severity === 'high' ? '⛔' : severity === 'medium' ? '▲' : '●');
    // small consistent styling so it looks good inline
    el.style.cssText = 'margin-left:8px;cursor:pointer;vertical-align:middle;background:#FF2D95;color:#fff;border-radius:12px;padding:4px 8px;font-weight:700;font-size:12px;';
    return el;
  }

  // attach badge & click handler to an element
  function attachBadgeTo(el, analysis){
    try {
      if (!el || (el.querySelector && el.querySelector('.safedm-badge'))) return;
      const badge = makeBadge(analysis.severity);
      // try to append at end of element without breaking layout
      try { el.appendChild(badge); } catch(e) { if (el.parentElement) el.parentElement.appendChild(badge); }
      badge.addEventListener('click', (ev) => {
        const rect = badge.getBoundingClientRect();
        window.postMessage({
          type: 'safedm_show_panel',
          detail: {
            score: analysis.score || 6,
            severity: analysis.severity || 'medium',
            flags: analysis.flags || [{ match: 'detected', weight: 3 }],
            text: analysis.text || (el.innerText || '').trim(),
            rect
          }
        }, '*');
        ev.stopPropagation();
      });
    } catch (e) {
      console.error('SafeDM attachBadge error', e);
    }
  }

  // analyze text and attach badge if needed
  function analyzeEl(el){
    if (!el || processed.has(el)) return;
    const text = (el.innerText || '').replace(/\s+/g,' ').trim();
    if (!text || text.length < 4) return;
    // wait for detector to exist in window
    if (!window.SafeDMDetector) return setTimeout(() => analyzeEl(el), 80);
    try {
      const res = window.SafeDMDetector.analyze(text);
      if (res && res.severity && res.severity !== 'benign') {
        res.text = text;
        attachBadgeTo(el, res);
      }
    } catch (e) {
      console.error('SafeDM analyze error', e);
    } finally {
      processed.add(el);
    }
  }

  // scan a root node for matching selectors
  function scanRoot(root){
    if (!root || !root.querySelectorAll) return;
    // if root itself matches, handle it
    if (root.matches && root.matches(SELECTOR)) {
      analyzeEl(root);
      return;
    }
    const nodes = root.querySelectorAll(SELECTOR);
    for (let i=0;i<nodes.length;i++){
      try { analyzeEl(nodes[i]); } catch(e) {}
    }
  }

  // MutationObserver to detect new messages dynamically
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (!m.addedNodes) continue;
      for (const node of m.addedNodes) {
        try {
          if (node.nodeType !== 1) continue;
          scanRoot(node);
        } catch(e){}
      }
    }
  });

  // start observing body
  observer.observe(document.body, { childList: true, subtree: true });

  // initial scan (in case messages already present)
  try {
    document.querySelectorAll(SELECTOR).forEach(el => analyzeEl(el));
  } catch(e){}

  console.log('SafeDM: reddit scanner watching for', SELECTOR);
})();
