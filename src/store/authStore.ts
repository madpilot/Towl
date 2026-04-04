import { create } from 'zustand';
import type { StoredUser } from '@/auth/tokenStore';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: StoredUser | null;
  serverUrl: string | null;

  setAuthenticated: (user: StoredUser, serverUrl: string) => void;
  setUnauthenticated: () => void;
  setServerUrl: (url: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  serverUrl: null,

  setAuthenticated: (user, serverUrl) =>
    set({ status: 'authenticated', user, serverUrl }),

  setUnauthenticated: () =>
    set({ status: 'unauthenticated', user: null }),

  setServerUrl: (url) => set({ serverUrl: url }),
}));
