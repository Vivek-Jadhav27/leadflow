/**
 * LeadFlow shared LinkedIn extractor (extractor.js)
 *
 * Loaded by manifest as a content script (before content.js) and injected by popup.js.
 * Defines window.__lfExtract(), which returns { firstName, lastName, jobTitle, company, linkedinUrl, debug }.
 *
 * LinkedIn's current markup uses hashed class names and no longer wraps text in
 * <li> / span[aria-hidden]. So this reads the page's visible text line by line
 * (innerText) and parses the lines, instead of relying on CSS class selectors.
 */
(function () {
  'use strict';

  const TYPES = 'Full-time|Part-time|Self-employed|Freelance|Contract|Internship|Apprenticeship|Seasonal|Trainee';
  const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?';
  const DATE_RANGE = new RegExp('(?:' + MONTH + '\\s+)?\\d{4}\\s*[-–—]\\s*(?:Present|(?:' + MONTH + '\\s+)?\\d{4})', 'i');
  // "3 yrs 2 mos" or "Full-time · 3 yrs" (the company row of a grouped experience entry)
  const DURATION_ONLY = new RegExp('^(?:(?:' + TYPES + ')\\s*·\\s*)?(?:\\d+\\s*(?:yrs?|mos?|years?|months?)\\s*)+$', 'i');
  const HERO_NOISE = /^(?:[·•|]|\(?(?:he|she|they)\s*\/\s*\w+\)?|\d+(?:st|nd|rd|th)(?:\s*degree)?|.*\b(?:connections?|followers?)\b.*|contact info|message|connect|follow|more|pending|resources|enhance profile)$/i;

  const EMPTY = () => ({ title: '', company: '' });
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  function cleanName(s) {
    return clean(
      (s || '')
        .replace(/·?\s*\d+(?:st|nd|rd|th)?\s*degree/gi, '')
        .replace(/\s*\(.*?\)/g, '')
        .replace(/·\s*\d+(st|nd|rd|th)?/gi, '')
        .replace(/,\s*(MD|MBA|PhD|PMP|CPA|Esq|MS|BS)\.?/gi, '')
    );
  }

  function cleanMeta(s) {
    return clean(s)
      .replace(new RegExp('\\s*·\\s*(?:' + TYPES + '|Remote|On-site|Hybrid).*', 'i'), '')
      .replace(/^Current company:\s*/i, '');
  }

  // Visible text of an element as de-duplicated, non-empty lines
  function linesOf(el) {
    const out = [];
    for (const raw of (el.innerText || el.textContent || '').split('\n')) {
      const l = clean(raw);
      if (l && l !== out[out.length - 1]) out.push(l);
    }
    return out;
  }

  function parseHeadline(text) {
    text = clean(text);
    if (!text) return EMPTY();

    const at = text.match(/^(.+?)\s+(?:at|of|@)\s+(.+?)(?:\s*[|·•].*)?$/i);
    if (at) return { title: cleanMeta(at[1]), company: cleanMeta(at[2]) };

    const dash = text.match(/^([^\-|]+?)\s+[-–—]\s+([^\-|]+)(?:\s*[|·•].*)?$/);
    if (dash) return { title: cleanMeta(dash[1]), company: cleanMeta(dash[2]) };

    if (text.includes('|')) return { title: cleanMeta(text.split('|')[0]), company: '' };
    if (/[·•]/.test(text)) return { title: cleanMeta(text.split(/[·•]/)[0]), company: '' };
    return { title: cleanMeta(text.slice(0, 80)), company: '' };
  }

  // Lines that follow the "Experience" heading, e.g.
  //   SDE 1 / Prachay Group · Full-time / Aug 2026 - Present · 4 mos / ...
  // or, for several roles at one company:
  //   Company / 3 yrs 2 mos / Role title / Full-time / Aug 2026 - Present / ...
  function parseExperienceLines(lines) {
    const i = lines.findIndex(l => DATE_RANGE.test(l));
    if (i < 1) return EMPTY();
    const head = lines.slice(0, i);

    if (head.length >= 3 && DURATION_ONLY.test(head[1])) {
      return { company: cleanMeta(head[0]), title: cleanMeta(head[2]) };
    }
    return {
      title: cleanMeta(head[0]),
      company: head[1] ? cleanMeta(head[1].split('·')[0]) : ''
    };
  }

  function fromExperience() {
    const isExp = el => clean(el.textContent).toLowerCase() === 'experience';
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,[role="heading"]')).filter(isExp);
    const fallback = headings.length
      ? []
      : Array.from(document.querySelectorAll('p,span,div')).filter(el => el.children.length <= 2 && isExp(el));

    for (const h of headings.concat(fallback)) {
      let cur = h;
      for (let d = 0; d < 8 && cur; d++, cur = cur.parentElement) {
        if (!DATE_RANGE.test(cur.innerText || '')) continue;
        const lines = linesOf(cur);
        const idx = lines.findIndex(l => /^experience$/i.test(l));
        const parsed = parseExperienceLines(idx >= 0 ? lines.slice(idx + 1) : lines);
        if (parsed.title || parsed.company) return parsed;
        break;
      }
    }
    return EMPTY();
  }

  // Headline under the profile name, e.g. "SDE 1 at Prachay Group"
  function fromHeadline(fullName) {
    const norm = s => clean(s).toLowerCase();
    const target = norm(fullName);
    if (!target) return EMPTY();

    const matches = Array.from(document.querySelectorAll('h1,h2,[role="heading"],p,span'))
      .filter(n => (n.textContent || '').length <= 80 && norm(cleanName(n.textContent)) === target)
      .slice(0, 5);

    for (const n of matches) {
      let cur = n;
      for (let d = 0; d < 6 && cur; d++, cur = cur.parentElement) {
        const lines = linesOf(cur);
        const i = lines.findIndex(l => norm(cleanName(l)) === target);
        if (i < 0) continue;
        const cand = lines.slice(i + 1).find(l => l.length > 4 && l.length <= 220 && !HERO_NOISE.test(l));
        if (cand) return parseHeadline(cand);
      }
    }
    return EMPTY();
  }

  function fromJsonLd() {
    for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      let data;
      try { data = JSON.parse(script.textContent || ''); } catch (_) { continue; }
      const items = Array.isArray(data) ? data : (data['@graph'] || [data]);
      const person = items.find(it => it && it['@type'] === 'Person');
      if (!person) continue;
      const title = Array.isArray(person.jobTitle) ? person.jobTitle[0] : person.jobTitle;
      const w = Array.isArray(person.worksFor) ? person.worksFor[0] : person.worksFor;
      const company = w && typeof w === 'object' ? w.name : w;
      if (title || company) return { title: cleanMeta(title), company: cleanMeta(company) };
    }
    return EMPTY();
  }

  function fromMeta() {
    const og = (document.querySelector('meta[property="og:title"]') || {}).content || '';
    const parts = og.split('|')[0].split(/\s+[-–—]\s+/).map(clean).filter(Boolean);
    if (parts.length >= 3) return { title: cleanMeta(parts[1]), company: cleanMeta(parts[2]) };
    if (parts.length === 2) return parseHeadline(parts[1]);
    return EMPTY();
  }

  const safe = (name, fn) => {
    try { return fn() || EMPTY(); } catch (e) { console.warn('[LeadFlow] ' + name + ' failed:', e); return EMPTY(); }
  };

  function extract() {
    const slug = window.location.pathname.match(/^\/in\/[^/]+/);
    const result = {
      firstName: '',
      lastName: '',
      jobTitle: '',
      company: '',
      linkedinUrl: window.location.origin + (slug ? slug[0] : window.location.pathname.replace(/\/$/, '')),
      debug: {}
    };

    // Name: first usable <h1>, else og:title / document.title (minus the "(3) " unread prefix)
    let name = '';
    for (const h1 of Array.from(document.querySelectorAll('h1'))) {
      const raw = cleanName(h1.innerText || h1.textContent);
      if (raw.length >= 2 && raw.length <= 60 && !/linkedin|feed|notifications|messaging/i.test(raw)) {
        name = raw;
        break;
      }
    }
    if (!name) {
      const og = (document.querySelector('meta[property="og:title"]') || {}).content || document.title || '';
      name = cleanName(og.replace(/^\(\d+\)\s*/, '').split(/[|\-–—]/)[0]);
    }
    const parts = name.split(/\s+/).filter(Boolean);
    result.firstName = parts[0] || '';
    result.lastName = parts.slice(1).join(' ');

    const exp = safe('experience', fromExperience);
    const hero = safe('headline', () => fromHeadline(name));
    const ld = safe('json-ld', fromJsonLd);
    const meta = safe('meta', fromMeta);
    result.debug = { exp, hero, ld, meta };

    result.jobTitle = exp.title || hero.title || ld.title || meta.title || '';
    result.company = exp.company || hero.company || ld.company || meta.company || '';
    return result;
  }

  extract._internals = { parseExperienceLines, parseHeadline };
  window.__lfExtract = extract;
})();