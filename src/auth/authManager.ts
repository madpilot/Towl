/**
 * authManager — called once on app startup.
 * Restores session state from SecureStore without any network calls.
 * Token refresh is handled lazily by the Axios interceptor on first API call:
 *   1. Access token attached to every request
 *   2. On 401 → try refresh token → try LLT → signal session expired
 */
import { createApiClient } from '@/api/client';
import * as tokenStore from '@/auth/tokenStore';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { restoreSelectedHousehold } from '@/store/householdStore';
import { createLongLivedToken } from '@/api/auth';

function makeSessionExpiredCallback(): () => void {
  return () => {
    void tokenStore.clearAll();
    useAuthStore.getState().setUnauthenticated();
  };
}

export async function initializeAuth(): Promise<void> {
  const serverUrl = await tokenStore.getServerUrl();
  if (!serverUrl) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  const tokens = await tokenStore.getTokens();
  if (!tokens) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  // User data is best-effort — a schema mismatch from an older install returns null,
  // but that's fine. The interceptor will get fresh user data on the first API call
  // if needed, and the token chain handles re-authentication transparently.
  const user = await tokenStore.getUser();

  useAuthStore.getState().setServerUrl(serverUrl);
  createApiClient(serverUrl, makeSessionExpiredCallback());
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
    tokenStore.saveServerUrl(serverUrl),
    tokenStore.saveTokens({ accessToken, refreshToken, llt: null }),
    tokenStore.saveUser(user),
  ]);
  createApiClient(serverUrl, makeSessionExpiredCallback());

  // Create a long-lived token for future resilience
  try {
    const llt = await createLongLivedToken();
    await tokenStore.saveLlt(llt);
    await tokenStore.saveTokens({ accessToken, refreshToken, llt });
  } catch {
    // Non-fatal: LLT creation failure just means one fewer fallback
  }

  useAuthStore.getState().setAuthenticated(user, serverUrl);
}

export async function logout(): Promise<void> {
  await authApi.logout();
  await tokenStore.clearAll();
  useAuthStore.getState().setUnauthenticated();
}
