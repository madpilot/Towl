import { create } from 'zustand';
import type { StoredUser } from '@/auth/tokenStore';
import type { AuthApi } from '@/api/auth';
import type { HouseholdsApi } from '@/api/households';
import type { ShoppingListsApi } from '@/api/shoppinglists';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: StoredUser | null;
  serverUrl: string | null;
  authApi: AuthApi | null;
  householdsApi: HouseholdsApi | null;
  shoppingListsApi: ShoppingListsApi | null;

  setAuthenticated: (user: StoredUser | null, serverUrl: string) => void;
  setUnauthenticated: () => void;
  setServerUrl: (url: string) => void;
  setApis: (authApi: AuthApi, householdsApi: HouseholdsApi, shoppingListsApi: ShoppingListsApi) => void;
  clearApis: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  serverUrl: null,
  authApi: null,
  householdsApi: null,
  shoppingListsApi: null,

  setAuthenticated: (user, serverUrl) =>
    set({ status: 'authenticated', user, serverUrl }),

  setUnauthenticated: () =>
    set({ status: 'unauthenticated', user: null }),

  setServerUrl: (url) => set({ serverUrl: url }),

  setApis: (authApi, householdsApi, shoppingListsApi) =>
    set({ authApi, householdsApi, shoppingListsApi }),

  clearApis: () =>
    set({ authApi: null, householdsApi: null, shoppingListsApi: null }),
}));
