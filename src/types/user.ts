export type UserRole = 'admin' | 'sdr';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  title: string;
  emailVerified?: boolean;
  workspaceId?: string;
  companyName?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName?: string;
  name?: string;
  emailNormalized?: string;
  role: UserRole;
  status?: 'active' | 'disabled';
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  currentWorkspaceId?: string;
}
