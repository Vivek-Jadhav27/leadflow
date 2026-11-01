import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

console.log('Testing unauthenticated getFirestore:');
try {
  const app = initializeApp({ projectId: 'test-project' }, 'testApp');
  console.log('App initialized.');
  const db = getFirestore(app);
  console.log('getFirestore succeeded synchronously.');
} catch (e) {
  console.error('getFirestore failed synchronously:', e);
}

