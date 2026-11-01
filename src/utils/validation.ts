/**
 * General string and input sanitization and validation helpers
 */

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeString(input: string): string {
  return input.trim();
}

/**
 * Validates company name:
 * - 2 to 100 characters
 * - No control characters
 * - Not empty or whitespace only
 */
export function validateCompanyName(name: string): { isValid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Company name is required.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Company name must be at least 2 characters.' };
  }
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Company name cannot exceed 100 characters.' };
  }
  // Check for control characters (\x00-\x1F, \x7F)
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return { isValid: false, error: 'Company name contains invalid control characters.' };
  }
  return { isValid: true };
}

/**
 * Validates LinkedIn company URL:
 * - Must be HTTPS
 * - Must belong to linkedin.com
 * - Must be a company URL (e.g. /company/name)
 * - Reject personal profiles (/in/...)
 */
export function validateCompanyLinkedinUrl(url: string): { isValid: boolean; normalizedUrl?: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'Company LinkedIn URL is required.' };
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith('https://')) {
    return { isValid: false, error: 'URL must use HTTPS protocol (https://).' };
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname !== 'linkedin.com' && !hostname.endsWith('.linkedin.com')) {
      return { isValid: false, error: 'URL must belong to linkedin.com.' };
    }

    const pathname = parsed.pathname;

    // Reject personal profiles explicitly
    if (pathname.startsWith('/in/') || pathname === '/in') {
      return { isValid: false, error: 'Personal LinkedIn profiles are not permitted. Please use your Company page URL.' };
    }

    // Require company URL structure: /company/<slug>
    const match = pathname.match(/^\/company\/([a-zA-Z0-9_\-\.%]+)/i);
    if (!match || !match[1]) {
      return {
        isValid: false,
        error: 'Must be a valid company URL format (e.g. https://www.linkedin.com/company/example/).',
      };
    }

    // Normalized format without trailing slash, consistent lowercase host
    const normalized = `https://${hostname}/company/${match[1].replace(/\/+$/, '')}`;
    return { isValid: true, normalizedUrl: normalized };
  } catch {
    return { isValid: false, error: 'Malformed or invalid URL.' };
  }
}

export interface PasswordRequirements {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  isValid: boolean;
}

/**
 * Checks password complexity rules in real-time
 */
export function checkPasswordRequirements(password: string): PasswordRequirements {
  const hasMinLength = password.length >= 8 && password.length <= 128;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`';]/.test(password);

  const isValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isValid,
  };
}
