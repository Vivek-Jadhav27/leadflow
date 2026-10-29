export type UserRole = 'admin' | 'sdr';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  title: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName?: string;
  role: UserRole;
  createdAt: string;
}
