// SafeDM - LinkedIn messaging content script (mature version)
// Purpose: Find message nodes in LinkedIn messaging UI, analyze them locally, and attach SafeDM badges.

console.log("%cSafeDM: LinkedIn scanner active", "color:#FF2D95; font-weight:700;");

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
   Likely LinkedIn message selectors
   - LinkedIn message list events often use .msg-s-message-list__event or li.msg-s-message-list__event
-------------------------------------------------------------------------- */
const MESSAGE_SELECTORS = [
  '.msg-s-message-list__event',     // message event wrapper
  '.msg-s-message-group__message',  // grouped messages
  '[data-control-name="message"] .msg-s-message-list__event' // fallback
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
    // Look for message text container
    const textEl = el.querySelector && (el.querySelector('.msg-s-event-listitem__body') || el.querySelector('.msg-s-message-list__event-content') || el.querySelector('.truncate-multiline'));
    if (textEl && textEl.innerText && textEl.innerText.length > 3) {
      return textEl.innerText.replace(/\s+/g,' ').trim();
    }
    // fallback: clone and strip interactive elements
    const clone = el.cloneNode(true);
    clone.querySelectorAll('svg, img, button, a, input').forEach(n => n.remove());
    const t = (clone.innerText || '').replace(/\s+/g,' ').trim();
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

    const badge = document.createElement('span');
    badge.className = 'safedm-badge safedm-' + result.severity;
    badge.textContent = severityIcon(result.severity);
    badge.style.cssText = 'margin-left:6px;cursor:pointer;vertical-align:middle;';

    // choose insertion point sensibly
    let insertTarget = el.querySelector('.msg-s-event-listitem__body') || el;
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

function severityIcon(sev) {
  switch (sev) {
    case 'low': return '●';
    case 'medium': return '▲';
    case 'high': return '⛔';
    default: return '⚠';
  }
}
