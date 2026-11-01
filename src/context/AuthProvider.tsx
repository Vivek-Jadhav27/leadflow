'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser, UserRole } from '@/types/user';
import { Workspace } from '@/types/auth';
import { authService, MeApiResponse } from '@/services/auth.service';
import { authRepository } from '@/repositories/auth.repository';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firestore';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  emailVerified: boolean;
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  adminSignUp: (params: {
    companyName: string;
    companyLinkedinUrl: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }) => Promise<string>;
  sdrSignUpAndAccept: (params: {
    fullName: string;
    email: string;
    password: string;
    token: string;
  }) => Promise<string>;
  acceptExistingInvitation: (token: string) => Promise<string>;
  logout: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
  // Fallback demo helpers preserved for decision canvas or testing
  loginAsAdmin: () => void;
  loginAsSDR: () => void;
  switchRole: (role: UserRole) => void;
  setRole: (role: UserRole) => void;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Sync token with cookie for server-side auth verification in API requests
  const syncTokenCookie = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (typeof window === 'undefined') return;
    if (firebaseUser) {
      const token = await firebaseUser.getIdToken();
      document.cookie = `leadflow_auth_token=${token}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = 'leadflow_auth_token=; path=/; max-age=0; SameSite=Lax';
    }
  }, []);

  // Hydrate auth state and backend session verification
  const loadUserContext = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      await syncTokenCookie(null);
      setLoading(false);
      return;
    }

    try {
      await syncTokenCookie(firebaseUser);
      const idToken = await firebaseUser.getIdToken();
      const meData = await authService.fetchMeContext(idToken);

      if (meData) {
        if (meData.status === 'disabled') {
          await authService.logout();
          setUser(null);
          setLoading(false);
          return;
        }

        const mapped = authService.mapToAuthUser(firebaseUser, meData);
        setUser(mapped);
        setWorkspaces(meData.workspaces || []);
        setCurrentWorkspace(meData.currentWorkspace || null);
      } else {
        // Fallback to client Firestore lookup if backend service account is not yet configured
        let role: UserRole = 'admin';
        let companyName: string | undefined;
        let workspaceId: string | undefined;
        let currentWs: Workspace | null = null;

        try {
          const profile = await authRepository.getUserProfile(firebaseUser.uid);
          if (profile) {
            role = profile.role || 'admin';
            workspaceId = profile.currentWorkspaceId;
            if (workspaceId) {
              const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId));
              if (wsSnap.exists()) {
                currentWs = wsSnap.data() as Workspace;
                companyName = currentWs.companyName;
              }
            }
          }
        } catch (e) {
          console.warn('Client Firestore fallback read:', e);
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: companyName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL,
          role,
          title: role === 'admin' ? 'Workspace Owner' : 'Outbound SDR',
          emailVerified: firebaseUser.emailVerified,
          workspaceId,
          companyName,
        });

        if (currentWs) {
          setCurrentWorkspace(currentWs);
          setWorkspaces([currentWs]);
        }
      }
    } catch (err) {
      console.error('[AuthProvider] Failed to load session context:', err);
    } finally {
      setLoading(false);
    }
  }, [syncTokenCookie]);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((firebaseUser) => {
      loadUserContext(firebaseUser);
    });

    return () => unsubscribe();
  }, [loadUserContext]);

  const login = async (email: string, password: string, rememberMe = true): Promise<boolean> => {
    setLoading(true);
    try {
      const authUser = await authService.login(email, password, rememberMe);
      const firebaseUser = authRepository.getCurrentUser();
      await loadUserContext(firebaseUser);
      return true;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const adminSignUp = async (params: {
    companyName: string;
    companyLinkedinUrl: string;
    email: string;
    password: string;
    confirmPassword?: string;
  }): Promise<string> => {
    setLoading(true);
    try {
      const result = await authService.adminSignUp(params);
      const firebaseUser = authRepository.getCurrentUser();
      await loadUserContext(firebaseUser);
      return result.workspaceId;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const sdrSignUpAndAccept = async (params: {
    fullName: string;
    email: string;
    password: string;
    token: string;
  }): Promise<string> => {
    setLoading(true);
    try {
      const result = await authService.sdrSignUpAndAccept(params);
      const firebaseUser = authRepository.getCurrentUser();
      await loadUserContext(firebaseUser);
      return result.workspaceId;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const acceptExistingInvitation = async (token: string): Promise<string> => {
    setLoading(true);
    try {
      const result = await authService.acceptExistingInvitation(token);
      const firebaseUser = authRepository.getCurrentUser();
      await loadUserContext(firebaseUser);
      return result.workspaceId;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const selectWorkspace = async (workspaceId: string): Promise<void> => {
    const firebaseUser = authRepository.getCurrentUser();
    if (!firebaseUser) return;

    setLoading(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const meData = await authService.fetchMeContext(idToken, workspaceId);
      if (meData) {
        const mapped = authService.mapToAuthUser(firebaseUser, meData);
        setUser(mapped);
        setCurrentWorkspace(meData.currentWorkspace);
      }
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async (): Promise<void> => {
    await authService.sendVerificationEmail();
  };

  const refreshUser = async (): Promise<void> => {
    const reloaded = await authService.reloadUser();
    await loadUserContext(reloaded);
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setWorkspaces([]);
      setCurrentWorkspace(null);
      await syncTokenCookie(null);
    } finally {
      setLoading(false);
    }
  };

  // Demo fallback stubs
  const loginAsAdmin = () => {
    login('admin@leadflow.io', 'Admin123!').catch(() => {});
  };

  const loginAsSDR = () => {
    login('sdr@leadflow.io', 'Sdr12345!').catch(() => {});
  };

  const switchRole = (r: UserRole) => {
    if (r === 'admin') loginAsAdmin();
    else loginAsSDR();
  };

  const setRole = (r: UserRole) => {
    switchRole(r);
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    // Basic compatibility redirect
    console.warn('Standard signup called; use adminSignUp or sdrSignUpAndAccept');
  };

  const role: UserRole = user?.role || 'sdr';
  const isAdmin = role === 'admin';
  const emailVerified = user?.emailVerified ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        loading,
        isAuthenticated: !!user,
        emailVerified,
        workspaces,
        currentWorkspace,
        selectWorkspace,
        login,
        adminSignUp,
        sdrSignUpAndAccept,
        acceptExistingInvitation,
        logout,
        resendVerificationEmail,
        refreshUser,
        loginAsAdmin,
        loginAsSDR,
        switchRole,
        setRole,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
