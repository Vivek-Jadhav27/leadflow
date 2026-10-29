'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser, UserRole } from '@/types/user';
import { ADMIN_USER, SDR_USER } from '@/services/prototypeStore';

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
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

  useEffect(() => {
    // Check if user has an active session stored in localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('leadflow_auth_user_v3');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email) {
            setUser(parsed);
          }
        }
      } catch (e) {
        console.warn('Error reading auth session', e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const trimmed = email.toLowerCase().trim();
    if (trimmed === 'admin@leadflow.io' || trimmed === 'admin') {
      setUser(ADMIN_USER);
      if (typeof window !== 'undefined') {
        localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(ADMIN_USER));
      }
      return true;
    }

    if (trimmed === 'sdr@leadflow.io' || trimmed === 'sdr') {
      setUser(SDR_USER);
      if (typeof window !== 'undefined') {
        localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(SDR_USER));
      }
      return true;
    }

    // Default to SDR for any other test email in prototype mode
    const customUser: AuthUser = {
      uid: `user_${Date.now()}`,
      email: trimmed,
      displayName: trimmed.split('@')[0],
      photoURL: null,
      role: 'sdr',
      title: 'Outbound Specialist',
    };
    setUser(customUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(customUser));
    }
    return true;
  };

  const loginAsAdmin = () => {
    setUser(ADMIN_USER);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(ADMIN_USER));
    }
  };

  const loginAsSDR = () => {
    setUser(SDR_USER);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(SDR_USER));
    }
  };

  const switchRole = (role: UserRole) => {
    if (role === 'admin') {
      loginAsAdmin();
    } else {
      loginAsSDR();
    }
  };

  const setRole = (role: UserRole) => {
    switchRole(role);
  };

  const signUp = async (fullName: string, email: string, password: string): Promise<void> => {
    const newUser: AuthUser = {
      uid: `user_${Date.now()}`,
      email: email.trim(),
      displayName: fullName.trim() || email.split('@')[0],
      photoURL: null,
      role: 'sdr',
      title: 'Outbound SDR',
    };
    setUser(newUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadflow_auth_user_v3', JSON.stringify(newUser));
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('leadflow_auth_user_v3');
    }
  };

  const role: UserRole = user?.role || 'admin';
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
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

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
