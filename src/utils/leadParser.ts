import { LeadFormData } from '@/schemas/lead.schema';

/**
 * Parses raw unformatted text (e.g. email signature, LinkedIn snippet, line)
 * and extracts lead fields automatically.
 */
export function parseLeadText(rawText: string): Partial<LeadFormData> {
  if (!rawText || typeof rawText !== 'string') return {};

  const result: Partial<LeadFormData> = {
    firstName: '',
    lastName: '',
    company: '',
    designation: '',
    email: '',
    phone: '',
    linkedin: '',
    notes: '',
  };

  const text = rawText.trim();
  if (!text) return result;

  // 1. Extract Email
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) {
    result.email = emailMatch[1].trim();
  }

  // 2. Extract LinkedIn URL
  const linkedinRegex = /(https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9%_-]+\/?)/i;
  const linkedinMatch = text.match(linkedinRegex);
  if (linkedinMatch) {
    result.linkedin = linkedinMatch[1].trim();
  }

  // 3. Extract Phone
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) {
    result.phone = phoneMatch[0].trim();
  }

  // 4. Check for explicit Key: Value multi-line format
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let handledKeyValues = false;

  lines.forEach((line) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const key = line.substring(0, colonIdx).toLowerCase().trim();
      const val = line.substring(colonIdx + 1).trim();

      if (key.includes('name')) {
        handledKeyValues = true;
        const nameParts = val.split(/\s+/);
        result.firstName = nameParts[0] || '';
        result.lastName = nameParts.slice(1).join(' ') || '';
      } else if (key.includes('first name')) {
        handledKeyValues = true;
        result.firstName = val;
      } else if (key.includes('last name')) {
        handledKeyValues = true;
        result.lastName = val;
      } else if (key.includes('company') || key.includes('organization') || key.includes('org')) {
        handledKeyValues = true;
        result.company = val;
      } else if (key.includes('title') || key.includes('designation') || key.includes('role') || key.includes('position')) {
        handledKeyValues = true;
        result.designation = val;
      } else if (key.includes('email') && !result.email) {
        handledKeyValues = true;
        result.email = val;
      } else if ((key.includes('phone') || key.includes('mobile') || key.includes('cell')) && !result.phone) {
        handledKeyValues = true;
        result.phone = val;
      } else if (key.includes('linkedin') && !result.linkedin) {
        handledKeyValues = true;
        result.linkedin = val;
      }
    }
  });

  if (handledKeyValues && result.firstName) {
    return cleanParsedResult(result);
  }

  // 5. Unstructured Parsing: Clean text by removing email, linkedin, phone
  let cleanText = text;
  if (result.email) cleanText = cleanText.replace(result.email, '');
  if (result.linkedin) cleanText = cleanText.replace(result.linkedin, '');
  if (result.phone) cleanText = cleanText.replace(result.phone, '');

  // Look for company keywords like " at ", " @ "
  const atMatch = cleanText.match(/(?:^|\s)(?:at|@)\s+([A-Za-z0-9\s&.,'-]+?)(?=[,\n|-]|$)/i);
  if (atMatch && atMatch[1]) {
    result.company = atMatch[1].trim().replace(/[()[\]<>{}]/g, '');
    cleanText = cleanText.replace(atMatch[0], ' ');
  }

  // Split remaining text into tokens by common separators (, - | / \n)
  const tokens = cleanText
    .split(/[,|\-\/\n]/)
    .map((t) => t.replace(/[()[\]<>{}]/g, '').trim())
    .filter((t) => t.length > 0);

  const titleKeywords = [
    'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'Founder', 'Co-Founder', 'President',
    'Vice President', 'VP', 'Director', 'Manager', 'Lead', 'Head',
    'Engineer', 'Developer', 'Specialist', 'SDR', 'BDR', 'Consultant', 'Executive', 'Marketing'
  ];

  if (tokens.length > 0) {
    // First non-empty token is almost always the Name
    const rawName = tokens[0];
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    if (nameParts.length > 0) {
      result.firstName = capitalize(nameParts[0]);
      if (nameParts.length > 1) {
        result.lastName = nameParts.slice(1).map(capitalize).join(' ');
      }
    }

    // Process remaining tokens
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token || token.toLowerCase().includes('http')) continue;

      const hasTitleWord = titleKeywords.some((title) =>
        new RegExp(`\\b${title}\\b`, 'i').test(token)
      );

      if (hasTitleWord && !result.designation) {
        result.designation = token;
      } else if (!result.company) {
        result.company = token;
      } else if (!result.designation) {
        result.designation = token;
      }
    }
  }

  // Fallback: If company is empty but email domain is available, derive company name from email
  if (!result.company && result.email) {
    const domain = result.email.split('@')[1];
    if (domain) {
      const domainName = domain.split('.')[0];
      if (domainName && !['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud', 'protonmail'].includes(domainName.toLowerCase())) {
        result.company = capitalize(domainName);
      }
    }
  }

  return cleanParsedResult(result);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanParsedResult(res: Partial<LeadFormData>): Partial<LeadFormData> {
  const cleaned: Partial<LeadFormData> = {};
  if (res.firstName) cleaned.firstName = res.firstName.trim();
  if (res.lastName) cleaned.lastName = res.lastName.trim();
  if (res.company) cleaned.company = res.company.trim();
  if (res.designation) cleaned.designation = res.designation.trim();
  if (res.email) cleaned.email = res.email.trim();
  if (res.phone) cleaned.phone = res.phone.trim();
  if (res.linkedin) cleaned.linkedin = res.linkedin.trim();
  if (res.notes) cleaned.notes = res.notes.trim();
  if (res.sequenceType) cleaned.sequenceType = res.sequenceType;
  return cleaned;
}

import { SequenceType } from '@/types/lead';
import { CreateSequenceStepInput } from '@/types/sequence';
import { getFutureDateString } from '@/utils/date';

/**
 * Auto-generates default sequence follow-up steps (default 3 steps)
 */
export function getDefaultSequenceSteps(
  sequenceType: SequenceType = 'linkedin',
  count: number = 3
): CreateSequenceStepInput[] {
  const generated: CreateSequenceStepInput[] = [];

  for (let i = 1; i <= count; i++) {
    const daysAhead = (i - 1) * 2;
    const scheduledDate = getFutureDateString(daysAhead);

    if (sequenceType === 'linkedin') {
      generated.push({
        stepNumber: i,
        scheduledDate,
        message:
          i === 1
            ? 'Hi {{firstName}}, I noticed your work at {{company}} and would love to connect!'
            : `Hi {{firstName}}, following up on my previous message regarding {{company}}.`,
      });
    } else {
      generated.push({
        stepNumber: i,
        scheduledDate,
        subject:
          i === 1
            ? 'Quick question regarding {{company}}'
            : `Following up: {{company}} x LeadFlow`,
        message:
          i === 1
            ? 'Hi {{firstName}},\n\nI hope this email finds you well. I wanted to reach out regarding...'
            : 'Hi {{firstName}},\n\nJust checking in to see if you had a chance to read my previous email.',
      });
    }
  }

  return generated;
}

