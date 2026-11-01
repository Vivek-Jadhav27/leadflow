import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firestore';
import { UserProfile } from '@/types/user';

export class AuthRepository {
  /**
   * Sets session persistence (remember me: local vs session)
   */
  async setPersistenceMode(rememberMe: boolean): Promise<void> {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch (e) {
      console.warn('Error setting auth persistence mode:', e);
    }
  }

  /**
   * Signs in a user with email and password using Firebase Auth SDK.
   */
  async loginWithEmail(email: string, password: string, rememberMe = true): Promise<UserCredential> {
    await this.setPersistenceMode(rememberMe);
    return await signInWithEmailAndPassword(auth, email, password);
  }

  /**
   * Registers a new user with email and password using Firebase Auth SDK.
   */
  async signUpWithEmail(email: string, password: string): Promise<UserCredential> {
    return await createUserWithEmailAndPassword(auth, email, password);
  }

  /**
   * Updates display name on Firebase Auth user.
   */
  async updateDisplayName(user: FirebaseUser, displayName: string): Promise<void> {
    return await updateProfile(user, { displayName });
  }

  /**
   * Triggers Firebase email verification link
   */
  async sendEmailVerification(user: FirebaseUser): Promise<void> {
    return await firebaseSendEmailVerification(user);
  }

  /**
   * Triggers password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    return await firebaseSendPasswordResetEmail(auth, email);
  }

  /**
   * Verifies password reset action code (oobCode)
   */
  async verifyPasswordResetCode(code: string): Promise<string> {
    return await firebaseVerifyPasswordResetCode(auth, code);
  }

  /**
   * Confirms password reset with new password
   */
  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    return await firebaseConfirmPasswordReset(auth, code, newPassword);
  }

  /**
   * Saves user profile record in Firestore 'users' collection.
   */
  async createUserProfileDocument(profile: UserProfile): Promise<void> {
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, {
      uid: profile.uid,
      email: profile.email,
      name: profile.fullName || profile.name || '',
      emailNormalized: profile.email.toLowerCase().trim(),
      role: profile.role || 'sdr',
      status: profile.status || 'active',
      createdAt: profile.createdAt,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  /**
   * Fetches user profile document from Firestore
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  }

  /**
   * Signs out the current authenticated user.
   */
  async logout(): Promise<void> {
    return await firebaseSignOut(auth);
  }

  /**
   * Subscribes to Firebase Auth state changes.
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, callback);
  }

  /**
   * Gets the currently authenticated user synchronously.
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Gets a fresh ID token for the current user
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(forceRefresh);
  }
}

export const authRepository = new AuthRepository();
