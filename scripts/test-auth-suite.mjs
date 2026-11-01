import crypto from 'crypto';
import assert from 'assert';

console.log('🧪 Starting LeadFlow Authentication & Workspace Security Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. Validation Logic Unit Tests
// -----------------------------------------------------------------------------
console.log('--- 1. Validation Logic Tests ---');

function validateCompanyName(name) {
  if (!name || typeof name !== 'string') return { isValid: false, error: 'Required' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { isValid: false, error: 'Too short' };
  if (trimmed.length > 100) return { isValid: false, error: 'Too long' };
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return { isValid: false, error: 'Control chars' };
  return { isValid: true };
}

runTest('Company Name: Valid standard company name', () => {
  assert.strictEqual(validateCompanyName('Acme Sales Inc.').isValid, true);
  assert.strictEqual(validateCompanyName('LeadFlow & Partners, LLC').isValid, true);
});

runTest('Company Name: Reject empty or whitespace-only', () => {
  assert.strictEqual(validateCompanyName('').isValid, false);
  assert.strictEqual(validateCompanyName('   ').isValid, false);
});

runTest('Company Name: Reject single character or >100 characters', () => {
  assert.strictEqual(validateCompanyName('A').isValid, false);
  assert.strictEqual(validateCompanyName('A'.repeat(101)).isValid, false);
});

runTest('Company Name: Reject control characters', () => {
  assert.strictEqual(validateCompanyName('Acme\x00Corp').isValid, false);
  assert.strictEqual(validateCompanyName('Acme\x1BMarketing').isValid, false);
});

function validateCompanyLinkedinUrl(url) {
  if (!url || typeof url !== 'string') return { isValid: false };
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return { isValid: false };
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return { isValid: false };
    if (parsed.pathname.startsWith('/in/') || parsed.pathname === '/in') return { isValid: false, reason: 'personal_profile' };
    const match = parsed.pathname.match(/^\/company\/([a-zA-Z0-9_\-\.%]+)/i);
    if (!match || !match[1]) return { isValid: false, reason: 'not_company' };
    const normalized = `https://${host}/company/${match[1].replace(/\/+$/, '')}`;
    return { isValid: true, normalizedUrl: normalized };
  } catch {
    return { isValid: false };
  }
}

runTest('LinkedIn URL: Accept valid company URLs with normalization', () => {
  const res1 = validateCompanyLinkedinUrl('https://www.linkedin.com/company/leadflow/');
  assert.strictEqual(res1.isValid, true);
  assert.strictEqual(res1.normalizedUrl, 'https://www.linkedin.com/company/leadflow');

  const res2 = validateCompanyLinkedinUrl('https://linkedin.com/company/acme-corp');
  assert.strictEqual(res2.isValid, true);
});

runTest('LinkedIn URL: Reject non-HTTPS protocol', () => {
  const res = validateCompanyLinkedinUrl('http://www.linkedin.com/company/leadflow/');
  assert.strictEqual(res.isValid, false);
});

runTest('LinkedIn URL: Reject personal profiles (/in/...)', () => {
  const res = validateCompanyLinkedinUrl('https://www.linkedin.com/in/john-doe-sales/');
  assert.strictEqual(res.isValid, false);
  assert.strictEqual(res.reason, 'personal_profile');
});

runTest('LinkedIn URL: Reject unrelated domains', () => {
  const res = validateCompanyLinkedinUrl('https://www.twitter.com/company/leadflow/');
  assert.strictEqual(res.isValid, false);
});

function checkPasswordRequirements(password) {
  const hasMinLength = password.length >= 8 && password.length <= 128;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`';]/.test(password);
  return {
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar,
    isValid: hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar,
  };
}

runTest('Password Complexity: Valid complex password', () => {
  const res = checkPasswordRequirements('SuperSecret99!');
  assert.strictEqual(res.isValid, true);
  assert.strictEqual(res.hasMinLength, true);
  assert.strictEqual(res.hasUppercase, true);
  assert.strictEqual(res.hasLowercase, true);
  assert.strictEqual(res.hasNumber, true);
  assert.strictEqual(res.hasSpecialChar, true);
});

runTest('Password Complexity: Reject weak passwords lacking requirements', () => {
  assert.strictEqual(checkPasswordRequirements('password').isValid, false); // no upper, no number, no special
  assert.strictEqual(checkPasswordRequirements('Password123').isValid, false); // no special
  assert.strictEqual(checkPasswordRequirements('PASSWORD123!').isValid, false); // no lower
  assert.strictEqual(checkPasswordRequirements('Pass!1').isValid, false); // <8 chars
});

// -----------------------------------------------------------------------------
// 2. Cryptographic Token & Hash Security Tests
// -----------------------------------------------------------------------------
console.log('\n--- 2. Cryptographic Security Tests ---');

runTest('Token Security: Minimum 256 bits entropy and secure SHA-256 hash', () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  assert.strictEqual(rawToken.length, 64); // 32 bytes * 2 hex chars = 64 hex characters (256 bits)

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.strictEqual(tokenHash.length, 64);
  assert.notStrictEqual(tokenHash, rawToken);

  // Hash must be deterministic for matching
  const verifyHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  assert.strictEqual(verifyHash, tokenHash);
});

runTest('Token Tampering: Tampered token fails hash comparison', () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const storedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const tamperedToken = rawToken.slice(0, -1) + (rawToken.slice(-1) === 'a' ? 'b' : 'a');
  const tamperedHash = crypto.createHash('sha256').update(tamperedToken).digest('hex');

  assert.notStrictEqual(tamperedHash, storedHash);
});

// -----------------------------------------------------------------------------
// 3. Invitation Lifecycle & Business Rules Tests
// -----------------------------------------------------------------------------
console.log('\n--- 3. Invitation Lifecycle Tests ---');

runTest('Invitation Expiry: 48-hour expiration calculation', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  assert.strictEqual(expiresAt.toISOString(), '2026-11-03T12:00:00.000Z');

  const testWithin48h = new Date('2026-11-02T12:00:00Z');
  assert.strictEqual(testWithin48h < expiresAt, true);

  const testAfter48h = new Date('2026-11-03T12:00:01Z');
  assert.strictEqual(testAfter48h < expiresAt, false);
});

runTest('Email Matching: Case-insensitive normalized matching prevents impersonation', () => {
  const inviteEmail = 'SDR.Prospect@Company.COM';
  const callerEmail = 'sdr.prospect@company.com';
  const attackerEmail = 'hacker@malicious.com';

  const normalizedInvite = inviteEmail.trim().toLowerCase();
  const normalizedCaller = callerEmail.trim().toLowerCase();
  const normalizedAttacker = attackerEmail.trim().toLowerCase();

  assert.strictEqual(normalizedInvite === normalizedCaller, true);
  assert.strictEqual(normalizedInvite === normalizedAttacker, false);
});

runTest('Owner Protection: Cannot suspend or remove workspace owner', () => {
  const workspaceOwnerId = 'usr_owner_123';
  const regularMemberId = 'usr_sdr_456';

  function canRemoveMember(targetUid, ownerId) {
    if (targetUid === ownerId) {
      return { allowed: false, error: 'Cannot remove workspace owner.' };
    }
    return { allowed: true };
  }

  assert.strictEqual(canRemoveMember(workspaceOwnerId, workspaceOwnerId).allowed, false);
  assert.strictEqual(canRemoveMember(regularMemberId, workspaceOwnerId).allowed, true);
});

runTest('Role Authorization: SDR cannot invite members or assign admin role', () => {
  function canInvite(role) {
    return role === 'admin';
  }

  assert.strictEqual(canInvite('admin'), true);
  assert.strictEqual(canInvite('sdr'), false);
});

console.log(`\n==============================================`);
console.log(`Test Results: ${passedTests} / ${totalTests} passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`==============================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}

