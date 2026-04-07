import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { TokenStore } from '@/auth/tokenStore';

export { AxiosError };
export function isAxiosError(err: unknown): err is AxiosError {
  return axios.isAxiosError(err);
}

export class ApiClientManager {
  private readonly axiosInstance: AxiosInstance;
  private sessionExpiredCallback: (() => void) | null;
  private retriedRequests = new WeakSet<InternalAxiosRequestConfig>();
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor(serverUrl: string, onSessionExpired?: () => void) {
    this.sessionExpiredCallback = onSessionExpired ?? null;

    const instance = axios.create({
      baseURL: serverUrl.replace(/\/$/, '') + '/api',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Attach access token to every outbound request.
    instance.interceptors.request.use(async (config) => {
      const tokens = await TokenStore.instance.getTokens();
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

        if (error.response?.status !== 401 || !config || this.retriedRequests.has(config)) {
          return Promise.reject(error);
        }

        if (this.isRefreshing) {
          // Wait for the in-flight refresh to complete, then replay.
          return new Promise((resolve, reject) => {
            this.subscribeToRefresh((token) => {
              if (!token) return reject(error);
              config.headers.Authorization = `Bearer ${token}`;
              resolve(instance(config));
            });
          });
        }

        this.retriedRequests.add(config);
        this.isRefreshing = true;

        try {
          const newToken = await this.performRefresh(instance);
          this.notifyRefreshSubscribers(newToken);
          config.headers.Authorization = `Bearer ${newToken}`;
          return instance(config);
        } catch {
          this.notifyRefreshSubscribers(null);
          this.sessionExpiredCallback?.();
          return Promise.reject(error);
        } finally {
          this.isRefreshing = false;
        }
      }
    );

    this.axiosInstance = instance;
  }

  static unauthenticated(serverUrl: string): AxiosInstance {
    return axios.create({
      baseURL: serverUrl.replace(/\/$/, '') + '/api',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  private subscribeToRefresh(callback: (token: string | null) => void): void {
    this.refreshSubscribers.push(callback);
  }

  private notifyRefreshSubscribers(token: string | null): void {
    for (const cb of this.refreshSubscribers) cb(token);
    this.refreshSubscribers = [];
  }

  private async performRefresh(instance: AxiosInstance): Promise<string> {
    const baseURL = instance.defaults.baseURL;
    if (!baseURL) throw new Error('API client has no baseURL configured');

    const tokens = await TokenStore.instance.getTokens();

    // Step 1: try the refresh token.
    if (tokens?.refreshToken) {
      try {
        const res = await axios.get<{ access_token: string; refresh_token: string }>(
          `${baseURL}/auth/refresh`,
          {
            headers: { Authorization: `Bearer ${tokens.refreshToken}` },
            timeout: 15_000,
          }
        );
        await TokenStore.instance.saveTokens({
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
    const llt = tokens?.llt ?? (await TokenStore.instance.getLlt());
    if (!llt) throw new Error('No valid token available for refresh');

    const res = await axios.get<{ access_token: string; refresh_token: string }>(
      `${baseURL}/auth/refresh`,
      {
        headers: { Authorization: `Bearer ${llt}` },
        timeout: 15_000,
      }
    );
    await TokenStore.instance.saveTokens({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
      llt,
    });
    return res.data.access_token;
  }
}
