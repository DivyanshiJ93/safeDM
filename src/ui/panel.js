// src/ui/panel.js
// Listens for window.postMessage events from content scripts and shows the panel.

(function(){
  const panel = () => document.getElementById('safedm-panel');
  const reasonText = () => document.getElementById('safedm-reason-text');
  const scoreEl = () => document.getElementById('safedm-score');

  function show(detail, anchorRect) {
    const p = panel();
    if (!p) return;

    // populate
    reasonText().textContent = detail.flags && detail.flags.length ? detail.flags.map(f => f.match).join(', ') : 'Unknown';
    scoreEl().textContent = 'Score: ' + (detail.score || 0) + ' — ' + (detail.severity || 'benign');
    p.style.display = 'block';

    // position near anchorRect if provided (fallback to bottom-right)
    if (anchorRect && anchorRect.top !== undefined) {
      const top = Math.max(12, anchorRect.top + window.scrollY - 10);
      const left = Math.min(window.innerWidth - 340, anchorRect.left + window.scrollX);
      p.style.position = 'absolute';
      p.style.top = (top) + 'px';
      p.style.left = (left) + 'px';
    } else {
      p.style.position = 'fixed';
      p.style.right = '18px';
      p.style.bottom = '18px';
    }
  }

  function hide() {
    const p = panel(); if (!p) return;
    p.style.display = 'none';
  }

  // button wiring
  document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.matches && ev.target.matches('.safedm-quick-item')) {
      const reply = ev.target.getAttribute('data-reply') || '';
      navigator.clipboard.writeText(reply).then(()=> {
        alert('Reply copied to clipboard');
      });
    }
    if (ev.target && ev.target.id === 'safedm-copy') {
      const defaultReply = 'Please stop contacting me. I am not interested.';
      navigator.clipboard.writeText(defaultReply).then(()=> alert('Reply copied to clipboard'));
    }
    if (ev.target && ev.target.id === 'safedm-close') {
      hide();
    }
    if (ev.target && ev.target.id === 'safedm-block') {
      alert('Block action: please use platform UI to block the user (this is a demo).');
    }
    if (ev.target && ev.target.id === 'safedm-report') {
      alert('Report action: please use platform UI to report the user (this is a demo).');
    }
  });

  // listen for cross-window messages from content scripts
  window.addEventListener('message', (ev) => {
    try {
      const data = ev.data;
      if (!data || data.type !== 'safedm_show_panel') return;
      // data.detail should contain { score, flags, text, rect }
      show(data.detail || {}, data.detail && data.detail.rect);
    } catch (e) {
      console.error(e);
    }
  }, false);

})();
