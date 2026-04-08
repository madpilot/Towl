/**
 * authManager — called once on app startup.
 * Restores session state from SecureStore without any network calls.
 * Token refresh is handled lazily by the Axios interceptor on first API call:
 *   1. Access token attached to every request
 *   2. On 401 → try refresh token → try LLT → signal session expired
 */
import { ApiClientManager } from '@/api/client';
import { AuthApi } from '@/api/auth';
import { HouseholdsApi } from '@/api/households';
import { ShoppingListsApi } from '@/api/shoppinglists';
import { TokenStore } from '@/auth/tokenStore';
import { useAuthStore } from '@/store/authStore';
import { restoreSelectedHousehold } from '@/store/householdStore';

// Holds the AuthApi for the current session — only needed within this module.
let authApi: AuthApi | null = null;

function makeSessionExpiredCallback(): () => void {
  return () => {
    void TokenStore.instance.clearAll();
    useAuthStore.getState().setUnauthenticated();
    useAuthStore.getState().clearApis();
    authApi = null;
  };
}

function createApis(serverUrl: string): AuthApi {
  const manager = new ApiClientManager(serverUrl, makeSessionExpiredCallback());
  const api = new AuthApi(manager);
  authApi = api;
  useAuthStore.getState().setApis(
    api,
    new HouseholdsApi(manager),
    new ShoppingListsApi(manager),
  );
  return api;
}

export async function initializeAuth(): Promise<void> {
  const serverUrl = await TokenStore.instance.getServerUrl();
  if (!serverUrl) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  const tokens = await TokenStore.instance.getTokens();
  if (!tokens) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  // User data is best-effort — a schema mismatch from an older install returns null,
  // but that's fine. The interceptor will get fresh user data on the first API call
  // if needed, and the token chain handles re-authentication transparently.
  const user = await TokenStore.instance.getUser();

  useAuthStore.getState().setServerUrl(serverUrl);
  createApis(serverUrl);
  await restoreSelectedHousehold();
  useAuthStore.getState().setAuthenticated(user, serverUrl);
}

export async function onLoginSuccess(
  serverUrl: string,
  accessToken: string,
  refreshToken: string,
  user: { id: number; name: string; username: string },
): Promise<void> {
  await Promise.all([
    TokenStore.instance.saveServerUrl(serverUrl),
    TokenStore.instance.saveTokens({ accessToken, refreshToken, llt: null }),
    TokenStore.instance.saveUser(user),
  ]);
  const api = createApis(serverUrl);

  // Create a long-lived token for future resilience
  try {
    const llt = await api.createLongLivedToken();
    await TokenStore.instance.saveLlt(llt);
    await TokenStore.instance.saveTokens({ accessToken, refreshToken, llt });
  } catch {
    // Non-fatal: LLT creation failure just means one fewer fallback
  }

  useAuthStore.getState().setAuthenticated(user, serverUrl);
}

export async function logout(): Promise<void> {
  await authApi?.logout();
  authApi = null;
  await TokenStore.instance.clearAll();
  useAuthStore.getState().setUnauthenticated();
  useAuthStore.getState().clearApis();
}
