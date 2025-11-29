// SafeDM - Instagram Web DM content script (mature version)
// Purpose: Find DM message nodes in Instagram web UI, analyze them locally, and attach SafeDM badges.

console.log("%cSafeDM: Instagram scanner active", "color:#FF2D95; font-weight:700;");

injectDetector();

function injectDetector() {
  if (!window.SafeDMDetector) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/detector.js');
    s.onload = () => console.log('SafeDM detector injected');
    document.documentElement.appendChild(s);
  }
}

/* --------------------------------------------------------------------------
   Likely selectors for Instagram DM messages:
   - Message threads are often inside dialogs or sections with role=dialog
   - Individual message bubbles are often divs or li elements containing text
-------------------------------------------------------------------------- */
const MESSAGE_SELECTORS = [
  'div[role="dialog"] [role="listitem"]',  // messages inside DM dialog
  'article div[role="button"]',            // fallback message-like nodes
  '[data-testid="message-text"]',          // possible attribute if present
  '.msg'                                   // fallback class
];

const processed = new WeakSet();

const observer = new MutationObserver((mut) => {
  for (const m of mut) {
    m.addedNodes.forEach(node => {
      if (node.nodeType === 1) scanNode(node);
    });
  }
});
observer.observe(document.body, { childList: true, subtree: true });

function scanNode(root) {
  if (!root || !root.querySelectorAll) return;

  const q = MESSAGE_SELECTORS.join(',');
  const found = root.matches && root.matches(q) ? [root] : Array.from(root.querySelectorAll(q));

  found.forEach(el => {
    if (!el || processed.has(el)) return;
    const text = extractMessageText(el);
    if (!text || text.length < 4) return;

    processed.add(el);
    analyzeAndBadge(el, text);
  });
}

function extractMessageText(el) {
  try {
    // prefer data attributes or aria labels if present
    const dataTest = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('aria-label'));
    if (dataTest && dataTest.length > 10) return dataTest.trim();

    // clone and strip interactive content
    const clone = el.cloneNode(true);
    clone.querySelectorAll('svg, img, button, a, input').forEach(n => n.remove());
    let t = clone.innerText || '';
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  } catch (e) {
    return '';
  }
}

function analyzeAndBadge(el, text) {
  if (!window.SafeDMDetector) return setTimeout(() => analyzeAndBadge(el, text), 60);

  try {
    const result = SafeDMDetector.analyze(text);
    if (result.severity === 'benign') return;

    // badge element
    const badge = document.createElement('span');
    badge.className = 'safedm-badge safedm-' + result.severity;
    badge.textContent = severityIcon(result.severity);
    badge.style.cssText = 'margin-left:6px;cursor:pointer;vertical-align:middle;';

    // try to find a safe insertion point: last text container in the message bubble
    let insertTarget = el;
    const textContainers = el.querySelectorAll('div, span, p');
    if (textContainers && textContainers.length) {
      insertTarget = textContainers[textContainers.length - 1];
    }

    // append badge without breaking flow
    try { insertTarget.appendChild(badge); } catch (e) { el.appendChild(badge); }

    badge.addEventListener('click', (ev) => {
      const rect = badge.getBoundingClientRect();
      window.postMessage({
        type: 'safedm_show_panel',
        detail: {
          score: result.score,
          severity: result.severity,
          flags: result.flags,
          text,
          rect
        }
      }, '*');
      ev.stopPropagation();
    });

  } catch (err) {
    console.error('SafeDM analyze error', err);
  }
}

function severityIcon(sev) {
  switch (sev) {
    case 'low': return '●';
    case 'medium': return '▲';
    case 'high': return '⛔';
    default: return '⚠';
  }
}
