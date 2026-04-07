import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as tokenStore from '@/auth/tokenStore';

let axiosInstance: AxiosInstance | null = null;
let sessionExpiredCallback: (() => void) | null = null;

// Track requests that have already been retried to prevent infinite loops.
const retriedRequests = new WeakSet<InternalAxiosRequestConfig>();

// Queue of subscribers waiting for the in-flight refresh to complete.
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

function subscribeToRefresh(callback: (token: string | null) => void): void {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers(token: string | null): void {
  for (const cb of refreshSubscribers) cb(token);
  refreshSubscribers = [];
}

export function createApiClient(serverUrl: string, onSessionExpired?: () => void): AxiosInstance {
  sessionExpiredCallback = onSessionExpired ?? null;

  const instance = axios.create({
    baseURL: serverUrl.replace(/\/$/, '') + '/api',
    timeout: 15_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Attach access token to every outbound request.
  instance.interceptors.request.use(async (config) => {
    const tokens = await tokenStore.getTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  });

  // Handle 401 — attempt silent refresh then replay the original request.
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config;

      if (error.response?.status !== 401 || !config || retriedRequests.has(config)) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the in-flight refresh to complete, then replay.
        return new Promise((resolve, reject) => {
          subscribeToRefresh((token) => {
            if (!token) return reject(error);
            config.headers.Authorization = `Bearer ${token}`;
            resolve(instance(config));
          });
        });
      }

      retriedRequests.add(config);
      isRefreshing = true;

      try {
        const newToken = await performRefresh(instance);
        notifyRefreshSubscribers(newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        return instance(config);
      } catch {
        notifyRefreshSubscribers(null);
        sessionExpiredCallback?.();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
  );

  axiosInstance = instance;
  return instance;
}

async function performRefresh(instance: AxiosInstance): Promise<string> {
  const tokens = await tokenStore.getTokens();

  // Step 1: try the refresh token.
  if (tokens?.refreshToken) {
    try {
      const res = await axios.get<{ access_token: string; refresh_token: string }>(
        `${instance.defaults.baseURL}/auth/refresh`,
        {
          headers: { Authorization: `Bearer ${tokens.refreshToken}` },
          timeout: 15_000,
        }
      );
      await tokenStore.saveTokens({
        accessToken: res.data.access_token,
        refreshToken: res.data.refresh_token,
        llt: tokens.llt,
      });
      return res.data.access_token;
    } catch {
      // Fall through to LLT
    }
  }

  // Step 2: try the long-lived token.
  const llt = tokens?.llt ?? (await tokenStore.getLlt());
  if (!llt) throw new Error('No valid token available for refresh');

  const res = await axios.get<{ access_token: string; refresh_token: string }>(
    `${instance.defaults.baseURL}/auth/refresh`,
    {
      headers: { Authorization: `Bearer ${llt}` },
      timeout: 15_000,
    }
  );
  await tokenStore.saveTokens({
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    llt,
  });
  return res.data.access_token;
}

export function getApiClient(): AxiosInstance {
  if (!axiosInstance) {
    throw new Error('API client not initialized — call createApiClient first.');
  }
  return axiosInstance;
}

export function resetApiClient(): void {
  axiosInstance = null;
  isRefreshing = false;
  refreshSubscribers = [];
  sessionExpiredCallback = null;
}
