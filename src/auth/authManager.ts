/**
 * authManager — called once on app startup.
 * Tries to restore a valid session without requiring the user to log in again.
 *
 * Strategy:
 *   1. If no server URL → unauthenticated
 *   2. Create Axios client for stored server URL
 *   3. Try GET /auth/refresh with stored refresh token
 *   4. On failure, attempt GET /auth/refresh with LLT as bearer
 *   5. If all fail → unauthenticated (URL kept for next attempt)
 */
import { createApiClient } from '@/api/client';
import * as tokenStore from '@/auth/tokenStore';
import * as authApi from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { restoreSelectedHousehold } from '@/store/householdStore';
import { createLongLivedToken } from '@/api/auth';
import axios from 'axios';

export async function initializeAuth(): Promise<void> {
  const serverUrl = await tokenStore.getServerUrl();
  if (!serverUrl) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  useAuthStore.getState().setServerUrl(serverUrl);
  createApiClient(serverUrl);

  // Restore the previously selected household so returning users skip the picker.
  await restoreSelectedHousehold();

  const tokens = await tokenStore.getTokens();
  if (!tokens) {
    useAuthStore.getState().setUnauthenticated();
    return;
  }

  // Attempt silent refresh
  try {
    const refreshed = await authApi.refreshToken();
    await tokenStore.saveTokens({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      llt: tokens.llt,
    });
    await tokenStore.saveUser(refreshed.user);
    useAuthStore.getState().setAuthenticated(refreshed.user, serverUrl);
    return;
  } catch {
    // Fall through to LLT attempt
  }

  // Attempt re-auth with LLT
  const llt = tokens.llt ?? (await tokenStore.getLlt());
  if (llt) {
    try {
      const base = serverUrl.replace(/\/$/, '') + '/api';
      const res = await axios.get<authApi.AuthResponse>(`${base}/auth/refresh`, {
        headers: { Authorization: `Bearer ${llt}` },
        timeout: 15_000,
      });
      await tokenStore.saveTokens({
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
        llt,
      });
      await tokenStore.saveUser(res.data.user);
      createApiClient(serverUrl);
      useAuthStore.getState().setAuthenticated(res.data.user, serverUrl);
      return;
    } catch {
      // Fall through to unauthenticated
    }
  }

  useAuthStore.getState().setUnauthenticated();
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
  createApiClient(serverUrl);

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
