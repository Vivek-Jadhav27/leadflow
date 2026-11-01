import { cert } from 'firebase-admin/app';

function normalizeKey(key) {
  if (!key) return key;
  // Replace all literal escaped '\n' and '\r' with actual newlines
  let normalized = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  // Ensure header and footer have newlines
  normalized = normalized.trim();
  return normalized;
}

const key1 = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3y\\n-----END PRIVATE KEY-----\\n";
console.log('Normalized key1:', JSON.stringify(normalizeKey(key1)));

