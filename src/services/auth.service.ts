import { authRepository, AuthRepository } from '@/repositories/auth.repository';
import { AuthUser, UserProfile, UserRole } from '@/types/user';
import { getFirebaseErrorMessage } from '@/utils/firebaseError';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';
import { Workspace } from '@/types/auth';

export interface MeApiResponse {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'disabled';
  currentWorkspaceId: string | null;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
}

export class AuthService {
  constructor(private repository: AuthRepository = authRepository) {}

  /**
   * Fetches user context, role, and accessible workspaces from trusted backend
   */
  async fetchMeContext(token?: string, workspaceIdOverride?: string): Promise<MeApiResponse | null> {
    try {
      const idToken = token || (await this.repository.getIdToken());
      if (!idToken) return null;

      const headers: Record<string, string> = {
        Authorization: `Bearer ${idToken}`,
      };
      if (workspaceIdOverride) {
        headers['x-workspace-id'] = workspaceIdOverride;
      }

      const res = await fetch('/api/auth/me', { headers });
      if (!res.ok) {
        return null;
      }
      return await res.json();
    } catch (e) {
      console.error('[AuthService] fetchMeContext error:', e);
      return null;
    }
  }

  /**
   * Transforms Firebase and backend user details into AuthUser
   */
  mapToAuthUser(
    firebaseUser: FirebaseUser | null,
    backendContext?: MeApiResponse | null
  ): AuthUser | null {
    if (!firebaseUser) return null;

    const role = backendContext?.role || 'sdr';
    const workspaceId = backendContext?.currentWorkspaceId || undefined;
    const companyName = backendContext?.currentWorkspace?.companyName || undefined;

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: backendContext?.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      photoURL: firebaseUser.photoURL,
      role,
      title: role === 'admin' ? 'Workspace Owner' : (role === 'ae' ? 'Account Executive' : 'Outbound SDR'),
      emailVerified: firebaseUser.emailVerified,
      workspaceId,
      companyName,
    };
  }

  /**
   * Logs in user with email and password via Firebase Auth SDK and verifies role with backend
   */
  async login(email: string, password: string, rememberMe = true): Promise<AuthUser> {
    try {
      const credential = await this.repository.loginWithEmail(email, password, rememberMe);
      const firebaseUser = credential.user;

      // Get fresh ID token
      const idToken = await firebaseUser.getIdToken(true);

      // Verify and fetch server-authorized role & active workspace
      const meContext = await this.fetchMeContext(idToken);

      if (meContext && meContext.status === 'disabled') {
        await this.logout();
        throw new Error('Your account has been disabled. Contact your workspace administrator.');
      }

      if (meContext?.currentWorkspace && meContext.currentWorkspace.status === 'suspended') {
        throw new Error('This workspace is currently unavailable.');
      }

      const user = this.mapToAuthUser(firebaseUser, meContext);
      if (!user) {
        throw new Error('Failed to retrieve user profile after login.');
      }

      return user;
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Admin Signup and atomic workspace provisioning
   */
  async adminSignUp(params: {
    fullName?: string;
    companyName: string;
    companyLinkedinUrl: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }): Promise<{ user: AuthUser; workspaceId: string }> {
    try {
      const userDisplayName = (params.fullName && params.fullName.trim())
        ? params.fullName.trim()
        : params.email.trim().split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      let workspaceId = '';
      let isBackendProvisioned = false;

      // 1. Attempt backend API provisioning first (if server Firebase Admin credentials are configured)
      try {
        const res = await fetch('/api/auth/admin-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          workspaceId = data.workspaceId;
          isBackendProvisioned = true;
        } else if (data.code === 'MISSING_ADMIN_CREDENTIALS') {
          console.info('[AdminSignup] Firebase Admin Service Account not configured in .env.local; provisioning directly via Firebase Client SDK.');
        } else {
          throw new Error(data.error || 'Failed to provision admin workspace.');
        }
      } catch (backendErr: any) {
        if (backendErr.message && !backendErr.message.includes('credentials') && !backendErr.message.includes('Failed to fetch')) {
          throw backendErr;
        }
      }

      let firebaseUser: FirebaseUser;

      // 2. If backend provisioned, sign in client
      if (isBackendProvisioned) {
        const credential = await this.repository.loginWithEmail(params.email, params.password, true);
        firebaseUser = credential.user;
      } else {
        // Fallback: Real Firebase Authentication client creation + real Cloud Firestore records
        const credential = await this.repository.signUpWithEmail(params.email, params.password);
        firebaseUser = credential.user;

        const userDisplayName = (params.fullName && params.fullName.trim())
          ? params.fullName.trim()
          : params.email.trim().split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        await this.repository.updateDisplayName(firebaseUser, userDisplayName);

        workspaceId = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date().toISOString();
        const emailNorm = params.email.trim().toLowerCase();

        // Write user profile to Cloud Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(userRef, {
          uid: firebaseUser.uid,
          name: userDisplayName,
          email: emailNorm,
          emailNormalized: emailNorm,
          status: 'active',
          role: 'admin',
          currentWorkspaceId: workspaceId,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        }, { merge: true });

        // Write workspace document to Cloud Firestore
        const wsRef = doc(db, 'workspaces', workspaceId);
        await setDoc(wsRef, {
          workspaceId,
          companyName: params.companyName.trim(),
          companyLinkedinUrl: params.companyLinkedinUrl.trim(),
          ownerId: firebaseUser.uid,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        }, { merge: true });

        // Write workspace membership to Cloud Firestore
        const memberRef = doc(db, 'workspaces', workspaceId, 'members', firebaseUser.uid);
        await setDoc(memberRef, {
          uid: firebaseUser.uid,
          name: userDisplayName,
          role: 'admin',
          status: 'active',
          joinedAt: now,
          invitedBy: 'self',
        }, { merge: true });
      }

      // 3. Send verification email via Firebase Auth
      try {
        await this.repository.sendEmailVerification(firebaseUser);
      } catch (emailErr) {
        console.warn('Failed to send verification email immediately:', emailErr);
      }

      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: userDisplayName,
        photoURL: null,
        role: 'admin',
        title: 'Workspace Owner',
        emailVerified: firebaseUser.emailVerified,
        workspaceId,
        companyName: params.companyName.trim(),
      };

      return { user: authUser, workspaceId };
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * SDR registration with invitation acceptance
   */
  async sdrSignUpAndAccept(params: {
    fullName: string;
    email: string;
    password: string;
    token: string;
  }): Promise<{ user: AuthUser; workspaceId: string }> {
    try {
      // 1. Create Firebase Auth user
      const credential = await this.repository.signUpWithEmail(params.email, params.password);
      const firebaseUser = credential.user;

      // 2. Update display name
      if (params.fullName) {
        await this.repository.updateDisplayName(firebaseUser, params.fullName);
      }

      // 3. Send verification email
      try {
        await this.repository.sendEmailVerification(firebaseUser);
      } catch (e) {
        console.warn('Failed to send SDR verification email:', e);
      }

      // 4. Get ID token for acceptance
      const idToken = await firebaseUser.getIdToken(true);

      // 5. Call backend accept API
      const acceptRes = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: params.token, fullName: params.fullName }),
      });

      const acceptData = await acceptRes.json();
      if (!acceptRes.ok) {
        throw new Error(acceptData.error || 'Failed to accept invitation.');
      }

      const resolvedRole: UserRole = acceptData.role === 'ae' ? 'ae' : 'sdr';
      const authUser: AuthUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: params.fullName,
        photoURL: null,
        role: resolvedRole,
        title: resolvedRole === 'ae' ? 'Account Executive' : 'Outbound SDR',
        emailVerified: firebaseUser.emailVerified,
        workspaceId: acceptData.workspaceId,
        companyName: acceptData.companyName,
      };

      return { user: authUser, workspaceId: acceptData.workspaceId };
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Accepts invitation for an existing logged-in user
   */
  async acceptExistingInvitation(token: string): Promise<{ workspaceId: string; companyName: string }> {
    const idToken = await this.repository.getIdToken();
    if (!idToken) {
      throw new Error('You must be logged in to accept this invitation.');
    }

    const res = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to accept invitation.');
    }

    return data;
  }

  /**
   * Resends verification email to the current authenticated user
   */
  async sendVerificationEmail(): Promise<void> {
    const user = this.repository.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in.');
    await this.repository.sendEmailVerification(user);
  }

  /**
   * Reloads user token to refresh emailVerified status
   */
  async reloadUser(): Promise<FirebaseUser | null> {
    const user = this.repository.getCurrentUser();
    if (user) {
      await user.reload();
      return this.repository.getCurrentUser();
    }
    return null;
  }

  /**
   * Sends password reset email
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await this.repository.sendPasswordResetEmail(email);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Verifies password reset action code (oobCode)
   */
  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      return await this.repository.verifyPasswordResetCode(code);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Confirms password reset
   */
  async confirmPasswordReset(code: string, newPass: string): Promise<void> {
    try {
      await this.repository.confirmPasswordReset(code, newPass);
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Logs out user from Firebase Auth
   */
  async logout(): Promise<void> {
    try {
      await this.repository.logout();
    } catch (error) {
      throw new Error(getFirebaseErrorMessage(error));
    }
  }

  /**
   * Subscribes to auth state changes and validates with backend context
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return this.repository.onAuthStateChanged(callback);
  }
}

export const authService = new AuthService();
