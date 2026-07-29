import { authRepository, AuthRepository } from '@/repositories/auth.repository';
import { AuthUser, UserProfile } from '@/types/user';
import { getFirebaseErrorMessage } from '@/utils/firebaseError';
import { User as FirebaseUser } from 'firebase/auth';

export class AuthService {
  constructor(private repository: AuthRepository = authRepository) {}

  /**
   * Transforms Firebase user object to AuthUser application model.
   */
  mapFirebaseUser(user: FirebaseUser | null): AuthUser | null {
    if (!user) return null;
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      photoURL: user.photoURL,
    };
  }

  /**
   * Logs in user and returns sanitized AuthUser or throws formatted error string.
   */
  async login(email: string, password: string): Promise<AuthUser> {
    try {
      const credential = await this.repository.loginWithEmail(email, password);
      const user = this.mapFirebaseUser(credential.user);
      if (!user) {
        throw new Error('Failed to retrieve user profile after login.');
      }
      return user;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Registers a new SDR user in Firebase Auth and creates their profile document in Firestore.
   */
  async signUp(fullName: string, email: string, password: string): Promise<AuthUser> {
    try {
      // 1. Create Auth credentials
      const credential = await this.repository.signUpWithEmail(email, password);
      const firebaseUser = credential.user;

      // 2. Update Auth display name
      if (fullName) {
        await this.repository.updateDisplayName(firebaseUser, fullName);
      }

      // 3. Save profile document in Firestore 'users' collection
      const userProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: email,
        fullName: fullName,
        createdAt: new Date().toISOString(),
      };
      await this.repository.createUserProfileDocument(userProfile);

      const user = this.mapFirebaseUser({
        ...firebaseUser,
        displayName: fullName,
      } as FirebaseUser);

      if (!user) {
        throw new Error('Failed to create account profile.');
      }
      return user;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Logs out user or throws formatted error string.
   */
  async logout(): Promise<void> {
    try {
      await this.repository.logout();
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Subscribes to auth state changes.
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return this.repository.onAuthStateChanged((firebaseUser) => {
      callback(this.mapFirebaseUser(firebaseUser));
    });
  }
}

export const authService = new AuthService();
