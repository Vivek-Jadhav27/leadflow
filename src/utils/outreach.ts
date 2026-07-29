import { toast } from 'sonner';

/**
 * Ensures a URL starts with http:// or https://
 */
export function formatUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Opens Gmail compose tab with prefilled recipient, subject, and body.
 */
export function openGmailCompose(email: string, subject?: string, body?: string) {
  if (!email) {
    toast.error('Lead email address is missing');
    return false;
  }
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1');
  params.set('to', email);
  if (subject) params.set('su', subject);
  if (body) params.set('body', body);

  const gmailUrl = `https://mail.google.com/mail/?${params.toString()}`;
  window.open(gmailUrl, '_blank', 'noopener,noreferrer');

  if (body) {
    navigator.clipboard.writeText(body).catch(() => {});
  }
  toast.success('Opening Gmail compose window...');
  return true;
}

/**
 * Opens LinkedIn profile in new tab and copies outreach text to clipboard.
 */
export function openLinkedinProfile(linkedinUrl: string, message?: string) {
  if (!linkedinUrl) {
    toast.error('Lead LinkedIn URL is missing. Please edit lead to add LinkedIn profile.');
    return false;
  }
  const formatted = formatUrl(linkedinUrl);
  window.open(formatted, '_blank', 'noopener,noreferrer');

  if (message) {
    navigator.clipboard.writeText(message).then(() => {
      toast.info('Message copied to clipboard! Paste it on LinkedIn.');
    }).catch(() => {});
  } else {
    toast.success('Opening LinkedIn profile...');
  }
  return true;
}
