/**
 * LeadFlow Chrome Extension — popup.js (v6)
 * The scraping logic lives in extractor.js (shared with content.js).
 */

// ─────────────────────────────────────────────────────────────────────────────
// POPUP CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const pillEl        = $('status-pill');
  const viewEmpty     = $('view-empty');
  const viewLead      = $('view-lead');
  const cardName      = $('card-name');
  const cardSub       = $('card-sub');
  const dupeWarn      = $('dupe-warn');
  const banner        = $('banner');

  const firstNameEl   = $('firstName');
  const lastNameEl    = $('lastName');
  const jobTitleEl    = $('jobTitle');
  const companyEl     = $('company');
  const linkedinUrlEl = $('linkedinUrl');

  const btnRefresh    = $('btn-refresh');
  const btnAdd        = $('btn-add');
  const btnSettings   = $('btn-settings');
  const settingsPanel = $('settings');
  const apiInput      = $('api-input');
  const btnSaveSettings = $('btn-save-settings');
  const crmLink       = $('crm-link');

  // Load stored settings
  const store = await chrome.storage.local.get(['apiEndpoint', 'savedLeads']);
  let apiEndpoint = store.apiEndpoint || 'https://leadflow-nine-zeta.vercel.app';
  apiInput.value  = apiEndpoint;
  if (crmLink) crmLink.href = `${apiEndpoint}/leads`;

  btnSettings.addEventListener('click', () => settingsPanel.classList.toggle('open'));
  btnSaveSettings.addEventListener('click', async () => {
    apiEndpoint = apiInput.value.trim().replace(/\/$/, '');
    if (crmLink) crmLink.href = `${apiEndpoint}/leads`;
    await chrome.storage.local.set({ apiEndpoint });
    settingsPanel.classList.remove('open');
  });

  // Verify tab is a LinkedIn profile
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

  // Scrape runner
  async function runScrape() {
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
      }

    } catch (err) {
      console.error('[LeadFlow] Execution error:', err);
      cardName.innerText = 'Manual entry required';
      cardSub.innerText  = 'Could not auto-scrape. Please enter details.';
    } finally {
      btnRefresh.classList.remove('spinning');
    }
  }

  await runScrape();

  // Refresh button handler
  btnRefresh.addEventListener('click', async () => {
    banner.className     = 'banner';
    banner.style.display = 'none';
    dupeWarn.style.display = 'none';
    btnAdd.disabled      = false;
    btnAdd.className     = 'btn-add';
    btnAdd.innerHTML     = '+ Add Lead to LeadFlow';
    await runScrape();
  });

  // Submit Lead to LeadFlow CRM
  $('lead-form').addEventListener('submit', async e => {
    e.preventDefault();
    btnAdd.disabled  = true;
    btnAdd.innerHTML = 'Saving…';
    banner.className = 'banner';
    banner.style.display = 'none';

    const leadPayload = {
      firstName:   firstNameEl.value.trim(),
      lastName:    lastNameEl.value.trim(),
      jobTitle:    jobTitleEl.value.trim(),
      company:     companyEl.value.trim(),
      linkedinUrl: linkedinUrlEl.value.trim(),
      source:      'linkedin_extension',
      status:      'NEW'
    };

    try {
      const resp = await fetch(`${apiEndpoint}/api/leads`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(leadPayload)
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      // Record lead locally
      const currSaved = (await chrome.storage.local.get('savedLeads')).savedLeads || [];
      currSaved.push(leadPayload);
      await chrome.storage.local.set({ savedLeads: currSaved });

      btnAdd.innerHTML = '✓ Added to LeadFlow!';
      btnAdd.className = 'btn-add saved';
      banner.className = 'banner ok';
      banner.innerHTML = `Lead saved! <a href="${apiEndpoint}/leads" target="_blank">View in CRM →</a>`;
    } catch (err) {
      console.error('[LeadFlow] Save error:', err);
      btnAdd.disabled  = false;
      btnAdd.innerHTML = '+ Add Lead to LeadFlow';
      banner.className = 'banner err';
      banner.innerHTML = `Could not connect to CRM at ${apiEndpoint}. Make sure dev server is running.`;
    }
  });
});