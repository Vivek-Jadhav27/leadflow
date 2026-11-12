/**
 * LeadFlow Chrome Extension — popup.js (v8)
 * Authentication-enforced LinkedIn lead clipper with smart server connection handling.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  // UI Elements
  const pillEl               = $('status-pill');
  const userChipEl           = $('user-chip');
  const userEmailLabel       = $('user-email-label');
  const userRoleLabel        = $('user-role-label');
  const btnLogout            = $('btn-logout');
  const btnSettings          = $('btn-settings');
  const settingsPanel        = $('settings');
  const apiInput             = $('api-input');
  const btnSaveSettings      = $('btn-save-settings');
  const btnSetLocalhost      = $('btn-set-localhost');
  const btnSetProd           = $('btn-set-prod');
  const crmLink              = $('crm-link');
  const footerWorkspaceName  = $('footer-workspace-name');

  // Server Tabs
  const tabServerLocal       = $('tab-server-local');
  const tabServerProd        = $('tab-server-prod');

  // Views
  const viewLogin            = $('view-login');
  const viewEmpty            = $('view-empty');
  const viewLead             = $('view-lead');

  // Login Form Elements
  const formLogin            = $('form-login');
  const loginEmail           = $('login-email');
  const loginPassword        = $('login-password');
  const btnLogin             = $('btn-login');
  const loginAlert           = $('login-alert');
  const currentEndpointLabel = $('current-endpoint-label');
  const btnChangeEndpoint    = $('btn-change-endpoint');

  // Lead Form Elements
  const cardName             = $('card-name');
  const cardSub              = $('card-sub');
  const dupeWarn             = $('dupe-warn');
  const banner               = $('banner');
  const firstNameEl          = $('firstName');
  const lastNameEl           = $('lastName');
  const jobTitleEl           = $('jobTitle');
  const companyEl            = $('company');
  const linkedinUrlEl        = $('linkedinUrl');
  const btnRefresh           = $('btn-refresh');
  const btnAdd               = $('btn-add');
  const leadForm             = $('lead-form');

  // Outreach & Cadence Elements
  const tabModeApproved       = $('tab-mode-approved');
  const tabModeCustom         = $('tab-mode-custom');
  const sectionApprovedSeq    = $('section-approved-seq');
  const sectionCustomSeq      = $('section-custom-seq');
  const seqSelect             = $('seq-select');
  const step1PreviewBox       = $('step1-preview-box');
  const step1NoteText         = $('step1-note-text');
  const btnCopyNote           = $('btn-copy-note');
  const chkConnSentApproved   = $('chk-conn-sent-approved');
  const customConnNote        = $('custom-conn-note');
  const charCountVal          = $('char-count-val');
  const chkFinishCadenceLater = $('chk-finish-cadence-later');
  const customStepsContainer  = $('custom-steps-container');
  const customStep2Delay      = $('custom-step2-delay');
  const customStep2Msg        = $('custom-step2-msg');
  const customStep3Delay      = $('custom-step3-delay');
  const customStep3Msg        = $('custom-step3-msg');

  let activeOutreachMode = 'approved'; // 'approved' | 'custom'
  let cachedSequences = [];

  // Clean / normalize URL
  function cleanUrl(url) {
    if (!url) return 'http://localhost:3000';
    return url.trim().replace(/\/+$/, '');
  }

  // Load persistent storage
  let store = await chrome.storage.local.get(['apiEndpoint', 'savedLeads', 'lf_token', 'lf_user']);
  let apiEndpoint = cleanUrl(store.apiEndpoint || 'http://localhost:3000');
  let lfToken     = store.lf_token || null;
  let lfUser      = store.lf_user || null;

  function updateServerTabsUI() {
    const isLocal = apiEndpoint.includes('localhost') || apiEndpoint.includes('127.0.0.1');
    if (tabServerLocal && tabServerProd) {
      if (isLocal) {
        tabServerLocal.classList.add('active');
        tabServerProd.classList.remove('active');
      } else {
        tabServerProd.classList.add('active');
        tabServerLocal.classList.remove('active');
      }
    }
    apiInput.value = apiEndpoint;
    if (currentEndpointLabel) currentEndpointLabel.innerText = apiEndpoint;
    if (crmLink) crmLink.href = `${apiEndpoint}/leads`;
  }

  updateServerTabsUI();

  // Switch to Localhost
  if (tabServerLocal) {
    tabServerLocal.addEventListener('click', async () => {
      apiEndpoint = 'http://localhost:3000';
      await chrome.storage.local.set({ apiEndpoint });
      updateServerTabsUI();
      if (loginAlert) loginAlert.style.display = 'none';
    });
  }

  // Switch to Vercel Cloud
  if (tabServerProd) {
    tabServerProd.addEventListener('click', async () => {
      apiEndpoint = 'https://leadflow-nine-zeta.vercel.app';
      await chrome.storage.local.set({ apiEndpoint });
      updateServerTabsUI();
      if (loginAlert) loginAlert.style.display = 'none';
    });
  }

  // Settings drawer
  btnSettings.addEventListener('click', () => settingsPanel.classList.toggle('open'));
  if (btnChangeEndpoint) {
    btnChangeEndpoint.addEventListener('click', () => settingsPanel.classList.toggle('open'));
  }

  btnSetLocalhost.addEventListener('click', () => {
    apiInput.value = 'http://localhost:3000';
  });

  btnSetProd.addEventListener('click', () => {
    apiInput.value = 'https://leadflow-nine-zeta.vercel.app';
  });

  btnSaveSettings.addEventListener('click', async () => {
    apiEndpoint = cleanUrl(apiInput.value);
    await chrome.storage.local.set({ apiEndpoint });
    updateServerTabsUI();
    settingsPanel.classList.remove('open');
    if (loginAlert) loginAlert.style.display = 'none';
    renderState();
  });

  // Logout handler
  btnLogout.addEventListener('click', async () => {
    lfToken = null;
    lfUser  = null;
    await chrome.storage.local.remove(['lf_token', 'lf_user']);
    renderState();
  });

  // Login handler
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginAlert.style.display = 'none';
    loginAlert.innerHTML = '';
    btnLogin.disabled = true;
    btnLogin.innerText = 'Signing in…';

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    const targetUrl = cleanUrl(apiEndpoint);

    try {
      const res = await fetch(`${targetUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Authentication failed.`);
      }

      lfToken = data.token;
      lfUser  = data.user;

      await chrome.storage.local.set({
        lf_token: lfToken,
        lf_user: lfUser,
      });

      loginPassword.value = '';
      btnLogin.disabled = false;
      btnLogin.innerText = 'Sign In';

      await renderState();
    } catch (err) {
      console.error('[LeadFlow Extension Login Error]:', err);
      btnLogin.disabled = false;
      btnLogin.innerText = 'Sign In';

      let message = err.message || 'Login failed.';
      if (err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('NetworkError')) {
        const isLocal = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
        if (isLocal) {
          message = `<strong>Server Unreachable (${targetUrl})</strong><div style="font-size:10.5px;color:#7f1d1d;line-height:1.4;margin-top:4px;">Next.js is not running locally.<br>1. Open your terminal in the <code>leadflow</code> folder.<br>2. Run <code>npm run dev</code>.<br>3. Once ready, click Sign In again.</div>`;
        } else {
          message = `<strong>Server Unreachable (${targetUrl})</strong><div style="font-size:10.5px;color:#7f1d1d;line-height:1.4;margin-top:4px;">Cannot connect to remote server. If you are developing locally, click the <b>💻 Localhost (3000)</b> toggle above.</div>`;
        }
      }

      loginAlert.innerHTML = message;
      loginAlert.style.display = 'block';
    }
  });

  // Scrape runner
  async function runScrape(tab) {
    cardName.innerText = 'Extracting details…';
    cardSub.innerText  = '';
    btnRefresh.classList.add('spinning');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['extractor.js'],
      });
      const [exec] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__lfExtract(),
      });

      const d = exec?.result || {};
      console.log('[LeadFlow Extractor Result]', d);

      firstNameEl.value   = d.firstName  || '';
      lastNameEl.value    = d.lastName   || '';
      jobTitleEl.value    = d.jobTitle   || '';
      companyEl.value     = d.company    || '';
      linkedinUrlEl.value = d.linkedinUrl || tab.url;

      const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'LinkedIn Prospect';
      cardName.innerText = fullName;
      cardSub.innerText  = d.jobTitle
        ? `${d.jobTitle}${d.company ? ' · ' + d.company : ''}`
        : 'Details captured — review & save';

      // Duplicate check against local storage
      const saved = (store.savedLeads || []);
      if (saved.some(l => l.linkedinUrl === d.linkedinUrl)) {
        dupeWarn.style.display = 'block';
      } else {
        dupeWarn.style.display = 'none';
      }

      updateStep1Preview();
    } catch (err) {
      console.error('[LeadFlow] Execution error:', err);
      cardName.innerText = 'Manual entry required';
      cardSub.innerText  = 'Could not auto-scrape. Please enter details.';
    } finally {
      btnRefresh.classList.remove('spinning');
    }
  }

  // Master Render / Routing Function
  async function renderState() {
    // Check if user is authenticated
    if (!lfToken || !lfUser) {
      pillEl.innerText = '🔒 Login Required';
      pillEl.className = 'pill warn';
      userChipEl.style.display = 'none';
      btnLogout.style.display  = 'none';

      viewLogin.style.display  = 'block';
      viewEmpty.style.display  = 'none';
      viewLead.style.display   = 'none';
      return;
    }

    // Authenticated state
    userChipEl.style.display = 'inline-flex';
    userEmailLabel.innerText = lfUser.displayName || lfUser.email;
    userRoleLabel.innerText  = lfUser.role === 'admin' ? 'Owner' : 'SDR';
    btnLogout.style.display  = 'inline-block';

    if (footerWorkspaceName) {
      footerWorkspaceName.innerText = lfUser.workspaceName || 'LeadFlow CRM';
    }

    viewLogin.style.display = 'none';

    // Check active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com/in/')) {
      pillEl.innerText = '○ Not on LinkedIn';
      pillEl.className = 'pill off';
      viewEmpty.style.display = 'block';
      viewLead.style.display  = 'none';
      return;
    }

    pillEl.innerText = '● Profile Detected';
    pillEl.className = 'pill on';
    viewEmpty.style.display = 'none';
    viewLead.style.display  = 'block';

    await loadApprovedSequences();
    await runScrape(tab);
  }

  // Fetch approved sequences for dropdown
  async function loadApprovedSequences() {
    if (!lfToken) return;
    try {
      const targetUrl = cleanUrl(apiEndpoint);
      const resp = await fetch(`${targetUrl}/api/sequences`, {
        headers: {
          'Authorization': `Bearer ${lfToken}`,
          'x-workspace-id': lfUser?.workspaceId || '',
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const seqs = data.sequences || [];
        // Filter approved or active sequences
        cachedSequences = seqs.filter(s => s.approvalStatus === 'approved' || s.status === 'active');
      }
    } catch (e) {
      console.warn('[LeadFlow] Could not fetch sequences:', e);
    }

    // Default fallback if no sequences online
    if (!cachedSequences || cachedSequences.length === 0) {
      cachedSequences = [
        {
          id: 'seq_linkedin_default',
          name: 'Standard LinkedIn 4-Step Outbound',
          steps: [
            {
              stepNumber: 1,
              actionType: 'connect',
              title: 'Send Connection Request',
              messageTemplate: 'Hi {{firstName}}, noticed your leadership at {{company}} and would love to connect and share some insights!',
            },
            {
              stepNumber: 2,
              actionType: 'send_message',
              title: 'First Follow-up',
              delayDays: 3,
              messageTemplate: 'Hi {{firstName}}, thanks for connecting! Wanted to share how we help companies like {{company}} optimize outreach.',
            }
          ]
        }
      ];
    }

    if (seqSelect) {
      const currentVal = seqSelect.value;
      seqSelect.innerHTML = '<option value="">-- Choose Sequence --</option>';
      cachedSequences.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name} (${(s.steps || []).length} steps)`;
        seqSelect.appendChild(opt);
      });

      if (currentVal && cachedSequences.some(s => s.id === currentVal)) {
        seqSelect.value = currentVal;
      } else if (cachedSequences.length > 0) {
        seqSelect.value = cachedSequences[0].id;
      }
      updateStep1Preview();
    }
  }

  // Render Step 1 connection note template with live variable replacement
  function updateStep1Preview() {
    if (!seqSelect || !step1PreviewBox || !step1NoteText) return;
    const selectedSeqId = seqSelect.value;
    const seq = cachedSequences.find(s => s.id === selectedSeqId);
    if (!seq || !seq.steps || seq.steps.length === 0) {
      step1PreviewBox.style.display = 'none';
      return;
    }

    const firstStep = seq.steps[0];
    const template = firstStep.messageTemplate || '';
    if (!template.trim()) {
      step1PreviewBox.style.display = 'none';
      return;
    }

    const fName = firstNameEl.value.trim() || 'there';
    const comp  = companyEl.value.trim()   || 'your company';
    const role  = jobTitleEl.value.trim()  || 'your role';

    const rendered = template
      .replace(/\{\{\s*firstName\s*\}\}/gi, fName)
      .replace(/\{\{\s*first_name\s*\}\}/gi, fName)
      .replace(/\{\{\s*company\s*\}\}/gi, comp)
      .replace(/\{\{\s*companyName\s*\}\}/gi, comp)
      .replace(/\{\{\s*jobTitle\s*\}\}/gi, role)
      .replace(/\{\{\s*title\s*\}\}/gi, role);

    step1NoteText.innerText = rendered;
    step1PreviewBox.style.display = 'block';
  }

  // Outreach mode tabs toggling
  if (tabModeApproved && tabModeCustom) {
    tabModeApproved.addEventListener('click', () => {
      activeOutreachMode = 'approved';
      tabModeApproved.classList.add('active');
      tabModeCustom.classList.remove('active');
      if (sectionApprovedSeq) sectionApprovedSeq.style.display = 'block';
      if (sectionCustomSeq)   sectionCustomSeq.style.display = 'none';
    });

    tabModeCustom.addEventListener('click', () => {
      activeOutreachMode = 'custom';
      tabModeCustom.classList.add('active');
      tabModeApproved.classList.remove('active');
      if (sectionCustomSeq)   sectionCustomSeq.style.display = 'block';
      if (sectionApprovedSeq) sectionApprovedSeq.style.display = 'none';
    });
  }

  if (seqSelect) {
    seqSelect.addEventListener('change', updateStep1Preview);
  }
  if (firstNameEl) firstNameEl.addEventListener('input', updateStep1Preview);
  if (companyEl)   companyEl.addEventListener('input', updateStep1Preview);
  if (jobTitleEl)  jobTitleEl.addEventListener('input', updateStep1Preview);

  // Copy Step 1 note to clipboard
  if (btnCopyNote && step1NoteText) {
    btnCopyNote.addEventListener('click', async () => {
      const text = step1NoteText.innerText;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const originalText = btnCopyNote.innerText;
        btnCopyNote.innerText = '✓ Copied!';
        setTimeout(() => { btnCopyNote.innerText = originalText; }, 1800);
      } catch (err) {
        console.warn('Clipboard write error:', err);
      }
    });
  }

  // Custom connection note char counter
  if (customConnNote && charCountVal) {
    customConnNote.addEventListener('input', () => {
      charCountVal.innerText = customConnNote.value.length;
    });
  }

  // Finish cadence later toggle
  if (chkFinishCadenceLater && customStepsContainer) {
    chkFinishCadenceLater.addEventListener('change', () => {
      customStepsContainer.style.display = chkFinishCadenceLater.checked ? 'none' : 'block';
    });
  }

  // Refresh button handler
  btnRefresh.addEventListener('click', async () => {
    banner.className     = 'banner';
    banner.style.display = 'none';
    dupeWarn.style.display = 'none';
    btnAdd.disabled      = false;
    btnAdd.className     = 'btn-add';
    btnAdd.innerHTML     = '+ Add Lead to LeadFlow';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes('linkedin.com/in/')) {
      await runScrape(tab);
    }
  });

  // Submit Lead to LeadFlow CRM
  leadForm.addEventListener('submit', async e => {
    e.preventDefault();

    if (!lfToken) {
      alert('You must be logged in to save leads.');
      await renderState();
      return;
    }

    btnAdd.disabled  = true;
    btnAdd.innerHTML = 'Saving to CRM…';
    banner.className = 'banner';
    banner.style.display = 'none';

    const isApprovedMode = (activeOutreachMode === 'approved');
    let sequencePayload = {};

    if (isApprovedMode) {
      const selectedSeq = cachedSequences.find(s => s.id === seqSelect?.value);
      const isSent = chkConnSentApproved ? chkConnSentApproved.checked : true;
      const note = (step1PreviewBox && step1PreviewBox.style.display !== 'none') ? step1NoteText.innerText : null;

      sequencePayload = {
        sequenceMode: 'approved',
        sequenceId: selectedSeq?.id || null,
        sequenceName: selectedSeq?.name || null,
        connectionStatus: isSent ? 'request_sent' : 'not_started',
        connectionNote: note,
        notes: note ? `Connection note: ${note}` : null,
        isConnectionSent: isSent,
        outreachStatus: isSent ? 'in_sequence' : (selectedSeq ? 'in_sequence' : 'unassigned'),
      };
    } else {
      const note = customConnNote ? customConnNote.value.trim() : '';
      const hasCustomFollowUps = Boolean(customStep2Msg?.value.trim() || customStep3Msg?.value.trim());
      const finishLater = chkFinishCadenceLater ? (chkFinishCadenceLater.checked && !hasCustomFollowUps) : !hasCustomFollowUps;
      const customSteps = !finishLater ? [
        {
          stepNumber: 1,
          actionType: 'connection_request',
          delayDays: 0,
          messageTemplate: note || '',
          title: 'Connection Request',
        },
        {
          stepNumber: 2,
          actionType: 'send_message',
          delayDays: parseInt(customStep2Delay?.value || '3', 10) || 3,
          messageTemplate: customStep2Msg?.value.trim() || '',
          title: 'First Follow-up',
        },
        ...(customStep3Msg?.value.trim() ? [{
          stepNumber: 3,
          actionType: 'send_message',
          delayDays: parseInt(customStep3Delay?.value || '7', 10) || 7,
          messageTemplate: customStep3Msg.value.trim(),
          title: 'Second Follow-up',
        }] : [])
      ] : [];

      sequencePayload = {
        sequenceMode: 'custom',
        connectionStatus: note ? 'request_sent' : 'not_started',
        connectionNote: note || null,
        notes: note ? `Connection note: ${note}` : null,
        isConnectionSent: Boolean(note),
        finishCadenceLater: finishLater,
        outreachStatus: finishLater ? 'needs_sequence' : 'pending_sequence_approval',
        customSteps,
      };
    }

    const userDisplayName = lfUser?.displayName || lfUser?.name || (lfUser?.email ? lfUser.email.split('@')[0] : 'Outbound SDR');
    const userUid = lfUser?.uid || lfUser?.id || null;
    const userEmail = lfUser?.email || '';

    const leadPayload = {
      firstName:   firstNameEl.value.trim(),
      lastName:    lastNameEl.value.trim(),
      jobTitle:    jobTitleEl.value.trim(),
      company:     companyEl.value.trim(),
      linkedinUrl: linkedinUrlEl.value.trim(),
      source:      'linkedin_extension',
      status:      'NEW',
      channel:     'linkedin',
      capturedBy:      userEmail,
      capturedByUid:   userUid,
      assignedToId:    userUid,
      assignedToName:  userDisplayName,
      assignedToEmail: userEmail,
      workspaceId:     lfUser?.workspaceId || '',
      ...sequencePayload,
    };

    try {
      const targetUrl = cleanUrl(apiEndpoint);
      const resp = await fetch(`${targetUrl}/api/leads`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lfToken}`,
          'x-workspace-id': lfUser?.workspaceId || '',
        },
        body: JSON.stringify(leadPayload)
      });

      if (resp.status === 401) {
        // Token expired or invalid
        lfToken = null;
        lfUser = null;
        await chrome.storage.local.remove(['lf_token', 'lf_user']);
        alert('Your session has expired. Please sign in again.');
        await renderState();
        return;
      }

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${resp.status}`);
      }

      // Record lead locally
      const currSaved = (await chrome.storage.local.get('savedLeads')).savedLeads || [];
      currSaved.push(leadPayload);
      await chrome.storage.local.set({ savedLeads: currSaved });

      btnAdd.innerHTML = '✓ Added to LeadFlow!';
      btnAdd.className = 'btn-add saved';
      banner.className = 'banner ok';
      banner.innerHTML = `Lead saved! <a href="${targetUrl}/leads" target="_blank">View in CRM →</a>`;
    } catch (err) {
      console.error('[LeadFlow] Save error:', err);
      btnAdd.disabled  = false;
      btnAdd.innerHTML = '+ Add Lead to LeadFlow';
      banner.className = 'banner err';
      banner.innerHTML = `Save failed: ${err.message || 'Check server connection at ' + apiEndpoint}`;
    }
  });

  // Initial render
  await renderState();
});
