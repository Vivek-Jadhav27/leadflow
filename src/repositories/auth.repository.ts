import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User as FirebaseUser,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';
import { db } from '@/lib/firestore';
import { UserProfile } from '@/types/user';

export class AuthRepository {
  /**
   * Signs in a user with email and password using Firebase Auth SDK.
   */
  async loginWithEmail(email: string, password: string): Promise<UserCredential> {
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
   * Saves user profile record in Firestore 'users' collection.
   */
  async createUserProfileDocument(profile: UserProfile): Promise<void> {
    const userDocRef = doc(db, 'users', profile.uid);
    await setDoc(userDocRef, {
      uid: profile.uid,
      email: profile.email,
      fullName: profile.fullName || '',
      createdAt: profile.createdAt,
    });
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
}

export const authRepository = new AuthRepository();
