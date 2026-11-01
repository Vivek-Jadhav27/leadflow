/**
 * LeadFlow In-Page Content Script — content.js (v6)
 * Adds floating "+ Add to LeadFlow" button on LinkedIn profiles with authentication check.
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
      lbl.innerText = 'Checking auth…';

      // 1. Verify authentication
      let store = {};
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          store = await chrome.storage.local.get(['apiEndpoint', 'lf_token', 'lf_user']);
        }
      } catch (_) {}

      const token = store.lf_token;
      const user = store.lf_user;
      let api = store.apiEndpoint || 'http://localhost:3000';

      if (!token || !user) {
        lbl.innerText = 'Login required';
        btn.style.background = '#e66343';
        showToast(
          '🔒 <strong>Login Required:</strong> Please click the LeadFlow extension icon in your toolbar to sign in before saving leads.',
          true
        );
        setTimeout(() => {
          lbl.innerText = '+ Add to LeadFlow';
          btn.style.background = '#ff7a59';
        }, 3500);
        return;
      }

      lbl.innerText = 'Extracting…';
      const data = window.__lfExtract();

      const payload = {
        firstName:   data.firstName,
        lastName:    data.lastName,
        jobTitle:    data.jobTitle,
        company:     data.company,
        linkedinUrl: data.linkedinUrl,
        source:      'linkedin_extension',
        status:      'NEW',
        capturedBy:  user.email || '',
        workspaceId: user.workspaceId || '',
      };

      try {
        lbl.innerText = 'Syncing…';
        const r = await fetch(`${api}/api/leads`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-workspace-id': user.workspaceId || '',
          },
          body: JSON.stringify(payload),
        });

        if (r.status === 401) {
          lbl.innerText = 'Session expired';
          btn.style.background = '#dc2626';
          showToast('🔒 Session expired. Please open the LeadFlow extension popup to log in again.', true);
          setTimeout(() => {
            lbl.innerText = '+ Add to LeadFlow';
            btn.style.background = '#ff7a59';
          }, 3500);
          return;
        }

        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${r.status}`);
        }

        lbl.innerText = '✓ In LeadFlow';
        btn.style.background = '#16a34a';
        showToast(`✓ <strong>${data.firstName} ${data.lastName}</strong> (${data.company || data.jobTitle}) added to CRM. <a href="${api}/leads" target="_blank" style="color:#ff7a59;font-weight:700;">View Leads →</a>`);
        setTimeout(() => { lbl.innerText = '+ Add to LeadFlow'; btn.style.background = '#ff7a59'; }, 3000);

      } catch (err) {
        btn.style.background = '#dc2626';
        lbl.innerText = 'Failed';
        showToast(`Could not save lead: ${err.message || 'Check connection at ' + api}`, true);
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
      padding: 11px 16px; border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px; line-height: 1.4;
      max-width: 340px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
      border-left: 4px solid #ff7a59;
      display: none; opacity: 0;
      transition: opacity .2s ease;
    }
    #lf-toast.lf-show { display: block; opacity: 1; }
  `;
  document.head.appendChild(style);

  // Monitor SPA URL Changes (LinkedIn uses PJAX/History API)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const oldBtn = document.getElementById('lf-floating-btn');
      if (oldBtn && !isProfile()) oldBtn.remove();
      if (isProfile()) initWidget();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (isProfile()) initWidget();
})();
