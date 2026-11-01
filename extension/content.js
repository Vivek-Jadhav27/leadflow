/**
 * LeadFlow In-Page Content Script — content.js (v5)
 * Adds floating "+ Add to LeadFlow" button on LinkedIn profiles
 * Extraction comes from extractor.js (window.__lfExtract), shared with popup.js
 */

(function () {
  'use strict';

  const isProfile = () => /^\/in\//.test(window.location.pathname);

  // ── Floating Button Widget ───────────────────────────────────────────────
  function initWidget() {
    if (!isProfile() || document.getElementById('lf-floating-btn')) return;

    const btn = document.createElement('div');
    btn.id = 'lf-floating-btn';
    btn.innerHTML = '<span class="lf-icon">LF</span><span id="lf-btn-label">+ Add to LeadFlow</span>';
    document.body.appendChild(btn);

    const toast = document.createElement('div');
    toast.id = 'lf-toast';
    document.body.appendChild(toast);

    function showToast(html, isError) {
      toast.innerHTML = html;
      toast.style.borderLeftColor = isError ? '#dc2626' : '#ff7a59';
      toast.classList.add('lf-show');
      setTimeout(() => toast.classList.remove('lf-show'), 5000);
    }

    btn.addEventListener('click', async () => {
      const lbl = document.getElementById('lf-btn-label');
      lbl.innerText = 'Extracting…';

      const data = window.__lfExtract();
      let api = 'https://leadflow-nine-zeta.vercel.app';
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const c = await chrome.storage.local.get('apiEndpoint');
          if (c.apiEndpoint) api = c.apiEndpoint;
        }
      } catch (_) {}

      const payload = {
        firstName:   data.firstName,
        lastName:    data.lastName,
        jobTitle:    data.jobTitle,
        company:     data.company,
        linkedinUrl: data.linkedinUrl,
        source:      'linkedin_extension',
        status:      'NEW'
      };

      try {
        lbl.innerText = 'Syncing…';
        const r = await fetch(`${api}/api/leads`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        lbl.innerText = '✓ In LeadFlow';
        btn.style.background = '#16a34a';
        showToast(`✓ <strong>${data.firstName} ${data.lastName}</strong> (${data.company || data.jobTitle}) added to CRM. <a href="${api}/leads" target="_blank" style="color:#ff7a59;font-weight:700;">View Leads →</a>`);
        setTimeout(() => { lbl.innerText = '+ Add to LeadFlow'; btn.style.background = '#ff7a59'; }, 3000);

      } catch (err) {
        btn.style.background = '#dc2626';
        lbl.innerText = 'Failed';
        showToast(`LeadFlow not reachable at ${api}. Make sure dev server is running.`, true);
        setTimeout(() => { lbl.innerText = '+ Add to LeadFlow'; btn.style.background = '#ff7a59'; }, 3000);
      }
    });
  }

  // Inject Styles
  const style = document.createElement('style');
  style.textContent = `
    #lf-floating-btn {
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      display: flex; align-items: center; gap: 7px;
      background: #ff7a59; color: #fff;
      padding: 9px 15px; border-radius: 999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; font-weight: 700;
      box-shadow: 0 4px 14px rgba(255,122,89,.4);
      cursor: pointer; border: 2px solid #fff;
      transition: all .2s ease; user-select: none;
    }
    #lf-floating-btn:hover { background: #e56342; transform: translateY(-2px); }
    .lf-icon {
      width: 18px; height: 18px; background: #fff; color: #ff7a59;
      border-radius: 4px; display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 900;
    }
    #lf-toast {
      position: fixed; bottom: 70px; right: 20px; z-index: 999999;
      background: #1e293b; color: #fff;
      padding: 10px 16px; border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px; border-left: 4px solid #ff7a59;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
      opacity: 0; transform: translateY(8px);
      transition: opacity .25s ease, transform .25s ease;
      pointer-events: none; max-width: 320px;
    }
    #lf-toast.lf-show { opacity: 1; transform: translateY(0); pointer-events: auto; }
  `;
  document.head.appendChild(style);

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }

  // Observer for LinkedIn SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;
    const btn = document.getElementById('lf-floating-btn');
    if (isProfile()) {
      if (!btn) initWidget();
    } else if (btn) {
      btn.remove();
      const t = document.getElementById('lf-toast');
      if (t) t.remove();
    }
  }).observe(document, { subtree: true, childList: true });
})();