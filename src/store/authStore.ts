import { create } from 'zustand';
import type { StoredUser } from '@/auth/tokenStore';
import type { HouseholdsApi } from '@/api/households';
import type { ShoppingListsApi } from '@/api/shoppinglists';

export type AuthStatus = 'unknown' | 'unauthenticated' | 'authenticated';

type AuthState = {
  status: AuthStatus;
  user: StoredUser | null;
  serverUrl: string | null;
  householdsApi: HouseholdsApi | null;
  shoppingListsApi: ShoppingListsApi | null;

  setAuthenticated: (user: StoredUser | null, serverUrl: string) => void;
  setUnauthenticated: () => void;
  setServerUrl: (url: string) => void;
  setApis: (householdsApi: HouseholdsApi, shoppingListsApi: ShoppingListsApi) => void;
  clearApis: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  serverUrl: null,
  householdsApi: null,
  shoppingListsApi: null,

  setAuthenticated: (user, serverUrl) =>
    set({ status: 'authenticated', user, serverUrl }),

  setUnauthenticated: () =>
    set({ status: 'unauthenticated', user: null }),

  setServerUrl: (url) => set({ serverUrl: url }),

  setApis: (householdsApi, shoppingListsApi) =>
    set({ householdsApi, shoppingListsApi }),

  clearApis: () =>
    set({ householdsApi: null, shoppingListsApi: null }),
}));
