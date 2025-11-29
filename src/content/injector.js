// src/content/injector.js
// Injector that inlines CSS and injects the panel + panel.js + a page-context delegated badge click listener.

(function(){
  try {
    if (document.getElementById('safedm-panel-root')) {
      // still inject the delegated listener if not present
      if (!document.getElementById('safedm-badge-delegator')) {
        injectBadgeDelegator();
      }
      return;
    }

    // --- INLINE CSS ---
    const cssText = `:root{ --bg-black:#0B0B0B; --hot-pink:#FF2D95; --soft-pink:#FF8DC4; --white:#FFFFFF; --panel-width:320px; }
.safedm-panel{ width:var(--panel-width); background:var(--bg-black); color:var(--white); border:2px solid var(--hot-pink); border-radius:10px; padding:10px; z-index:2147483647; box-shadow:0 8px 40px rgba(0,0,0,0.6); font-family:Inter, Arial, Helvetica, sans-serif; }
.safedm-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.safedm-title{ color:var(--hot-pink); font-weight:700; font-size:14px; }
.safedm-close{ background:transparent; border:none; color:#ccc; font-size:16px; cursor:pointer; }
.safedm-reason{ margin:6px 0; color:#ddd; font-size:13px; }
.safedm-score{ margin-bottom:8px; color:#bbb; font-size:12px; }
.safedm-actions{ margin:8px 0; display:flex; gap:8px; }
.safedm-btn{ background:var(--hot-pink); color:var(--white); border:none; padding:8px 10px; border-radius:8px; cursor:pointer; font-weight:600; }
.safedm-quick-title{ font-size:13px; color:#ddd; margin-top:8px; margin-bottom:6px; }
.safedm-quick-list{ display:flex; gap:6px; flex-wrap:wrap; }
.safedm-quick-item{ background:var(--soft-pink); color:#0B0B0B; border:none; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
.safedm-footer{ margin-top:10px; font-size:11px; color:#999; }`;

    // inject inline style
    try {
      const style = document.createElement('style');
      style.setAttribute('data-safedm-inline-style', 'true');
      style.textContent = cssText;
      (document.head || document.documentElement).appendChild(style);
    } catch (e){ console.error('SafeDM: failed to inject inline CSS', e); }

    // create panel root
    const container = document.createElement('div');
    container.id = 'safedm-panel-root';
    container.style.all = 'initial';
    container.innerHTML = `
      <div id="safedm-panel" class="safedm-panel" style="display:none">
        <div class="safedm-header">
          <div class="safedm-title">Potentially unsafe message</div>
          <button id="safedm-close" class="safedm-close">✕</button>
        </div>
        <div class="safedm-body">
          <div id="safedm-reason" class="safedm-reason">Detected: <span id="safedm-reason-text"></span></div>
          <div id="safedm-score" class="safedm-score"></div>
          <div class="safedm-actions">
            <button id="safedm-block" class="safedm-btn">Block</button>
            <button id="safedm-report" class="safedm-btn">Report</button>
            <button id="safedm-copy" class="safedm-btn">Copy Reply</button>
          </div>
          <div class="safedm-quick">
            <div class="safedm-quick-title">Quick replies</div>
            <div class="safedm-quick-list">
              <button class="safedm-quick-item" data-reply="Please stop contacting me. I am not interested.">Firm</button>
              <button class="safedm-quick-item" data-reply="Thanks, but I don't share personal contact details.">Polite</button>
              <button class="safedm-quick-item" data-reply="This message makes me uncomfortable. Please stop.">Safety</button>
            </div>
          </div>
          <div class="safedm-footer"><small>Runs locally — no message text is sent anywhere.</small></div>
        </div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(container);

    // inject panel.js script into page context
    try {
      const panelJsUrl = chrome.runtime.getURL('src/ui/panel.js');
      if (!document.querySelector('script[data-safedm-panel]')) {
        const s = document.createElement('script');
        s.src = panelJsUrl;
        s.async = true;
        s.setAttribute('data-safedm-panel', 'true');
        (document.documentElement || document.head).appendChild(s);
        s.onload = () => { try { s.remove(); } catch(e){}; console.log('SafeDM: panel.js injected'); };
      }
    } catch (e){ console.error('SafeDM: failed to inject panel.js', e); }

    // inject detector.js in page context
    try {
      const detUrl = chrome.runtime.getURL('src/detector.js');
      if (!document.querySelector('script[data-safedm-detector]')) {
        const sd = document.createElement('script');
        sd.src = detUrl;
        sd.async = true;
        sd.setAttribute('data-safedm-detector', 'true');
        (document.documentElement || document.head).appendChild(sd);
        sd.onload = () => { try { sd.remove(); } catch(e){}; console.log('SafeDM: detector injected'); };
      }
    } catch (e){ console.error('SafeDM: failed to inject detector.js', e); }

    // also inject delegated badge click handler into page context
    injectBadgeDelegator();

    console.log('SafeDM: panel injected (inline-CSS injector)');
  } catch (e) {
    console.error('SafeDM injector error', e);
  }

  // helper: inject a tiny script that delegates clicks on .safedm-badge to postMessage
  function injectBadgeDelegator(){
    try {
      if (document.getElementById('safedm-badge-delegator')) return;
      const delegatorSrc = `
        (function(){
          if (window.__safedm_delegator_installed) return;
          window.__safedm_delegator_installed = true;
          document.addEventListener('click', function(e){
            try {
              let t = e.target;
              // walk up to find if a parent has the class too
              while(t && t !== document.documentElement){
                if (t.classList && t.classList.contains('safedm-badge')){
                  // build detail info (try to attach nearest message text)
                  const msgEl = t.closest('div.room-message-text, div.room-message-text.truncated') || t.closest('div');
                  const text = msgEl ? (msgEl.innerText||'').replace(/\\s+/g,' ').trim() : '';
                  const rect = t.getBoundingClientRect();
                  window.postMessage({ type:'safedm_show_panel', detail:{ score:6, severity:'medium', flags:[{match:'detected',weight:3}], text, rect } }, '*');
                  e.stopPropagation(); e.preventDefault();
                  return;
                }
                t = t.parentNode;
              }
            } catch(_){}
          }, true);
        })();
      `;
      const script = document.createElement('script');
      script.id = 'safedm-badge-delegator';
      script.textContent = delegatorSrc;
      (document.documentElement || document.head).appendChild(script);
      // keep it in DOM so it's visible in Elements panel if we need to debug
      console.log('SafeDM: badge delegator injected into page context');
    } catch(e){ console.error('SafeDM: failed to inject badge delegator', e); }
  }
})();
