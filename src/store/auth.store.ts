import { AuthUser } from '@/types/user';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export const initialAuthState: AuthState = {
  user: null,
  loading: true,
  isAuthenticated: false,
};
