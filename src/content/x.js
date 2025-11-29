// SafeDM - X/Twitter DM content script (mature version)
// Purpose: Find DM message nodes on X/Twitter, analyze them locally, and attach SafeDM badges.

console.log("%cSafeDM: X/Twitter scanner active", "color:#FF2D95; font-weight:700;");

importDetector();

function importDetector() {
  if (!window.SafeDMDetector) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('src/detector.js');
    s.onload = () => console.log('SafeDM detector injected');
    document.documentElement.appendChild(s);
  }
}

/* --------------------------------------------------------------------------
   Config: likely DM message selectors on X
   X's DOM is volatile — we choose broad but targeted selectors and rely on
   dedupe + content length checks to avoid false positives.
-------------------------------------------------------------------------- */
const MESSAGE_SELECTORS = [
  '[data-testid="messageEntry"]',        // possible DM message entry
  'div[role="log"] div[dir="auto"]',     // fallback DM text nodes
  '[data-testid="DMDrawer"] [role="listitem"]'
];

/* --------------------------------------------------------------------------
   State
-------------------------------------------------------------------------- */
const processed = new WeakSet();

/* --------------------------------------------------------------------------
   MutationObserver
-------------------------------------------------------------------------- */
const observer = new MutationObserver((mut) => {
  for (const m of mut) {
    m.addedNodes.forEach(node => {
      if (node.nodeType === 1) scanNode(node);
    });
  }
});
observer.observe(document.body, { childList: true, subtree: true });

/* --------------------------------------------------------------------------
   scanNode: find messages under root
-------------------------------------------------------------------------- */
function scanNode(root) {
  if (!root.querySelectorAll) return;

  // build NodeList
  const q = MESSAGE_SELECTORS.join(',');
  const found = root.matches && root.matches(q) ? [root] : Array.from(root.querySelectorAll(q));

  found.forEach(el => {
    if (!el || processed.has(el)) return;
    const text = extractMessageText(el);
    if (!text || text.length < 5) return;

    processed.add(el);
    analyzeAndBadge(el, text);
  });
}

/* --------------------------------------------------------------------------
   extractMessageText: conservative extraction to avoid noise
-------------------------------------------------------------------------- */
function extractMessageText(el) {
  try {
    // prefer aria-label or data-testid text content when available
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria && aria.length > 10) return aria.trim();

    // gather text nodes while skipping buttons/avatars
    const clones = el.cloneNode(true);
    // remove interactive elements
    clones.querySelectorAll('a, button, svg, img').forEach(n => n.remove());
    let t = clones.innerText || '';
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  } catch (e) {
    return '';
  }
}

/* --------------------------------------------------------------------------
   analyzeAndBadge
-------------------------------------------------------------------------- */
function analyzeAndBadge(el, text) {
  if (!window.SafeDMDetector) return setTimeout(() => analyzeAndBadge(el, text), 60);

  try {
    const result = SafeDMDetector.analyze(text);
    if (result.severity === 'benign') return;

    // create badge
    const badge = document.createElement('span');
    badge.className = 'safedm-badge safedm-' + result.severity;
    badge.textContent = severityIcon(result.severity);
    badge.style.cssText = 'margin-left:6px;cursor:pointer;vertical-align:middle;';

    // insertion strategy: append to last child container or to parent
    let insertTarget = el;
    // try to find a natural text container inside
    const textContainers = el.querySelectorAll('div, span, p');
    if (textContainers && textContainers.length) {
      insertTarget = textContainers[textContainers.length - 1];
    }

    // ensure we don't break layout: append badge as inline element
    try { insertTarget.appendChild(badge); } catch(e) { el.appendChild(badge); }

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

/* --------------------------------------------------------------------------
   severityIcon helper
-------------------------------------------------------------------------- */
function severityIcon(sev) {
  switch (sev) {
    case 'low': return '●';
    case 'medium': return '▲';
    case 'high': return '⛔';
    default: return '⚠';
  }
}
