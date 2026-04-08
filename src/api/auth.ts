import { z } from 'zod';
import { ApiClientManager, isAxiosError, AxiosError } from './client';

export type AxiosAuthError = AxiosError & {
  response: NonNullable<AxiosError['response']>;
};

export function isAxiosAuthError(err: unknown): err is AxiosAuthError {
  return isAxiosError(err) && err.response !== undefined;
}

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
    email: z.string().optional(),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─── Pre-auth functions (no authenticated client needed) ──────────────────────

export async function login(
  serverUrl: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  const client = ApiClientManager.unauthenticated(serverUrl);
  const res = await client.post<unknown>('/auth', { username, password, device: 'Towl' });
  return AuthResponseSchema.parse(res.data);
}

export async function testConnection(serverUrl: string): Promise<boolean> {
  try {
    const client = ApiClientManager.unauthenticated(serverUrl);
    await client.get('/auth', { timeout: 8_000 });
    return true;
  } catch (err: unknown) {
    // A 405 or 4xx from /api/auth still means the server is reachable
    if (isAxiosError(err) && err.response) return true;
    return false;
  }
}

// ─── Authenticated API class ──────────────────────────────────────────────────

export class AuthApi {
  constructor(private client: ApiClientManager) {}

  async refreshToken(): Promise<AuthResponse> {
    const res = await this.client.get<unknown>('/auth/refresh');
    return AuthResponseSchema.parse(res.data);
  }

  async createLongLivedToken(): Promise<string> {
    const res = await this.client.post<{ longlived_token: string }>('/auth/llt', {
      device: 'Towl',
    });
    return res.data.longlived_token;
  }

  async logout(): Promise<void> {
    try {
      await this.client.delete('/auth');
    } catch {
      // Ignore logout errors — we always clear local state
    }
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  // Endpoint: POST /user  (shape unconfirmed — update once verified)
  async updateProfile(name: string): Promise<void> {
    await this.client.post('/user', { name });
  }

  // Endpoint unknown — stub until KitchenOwl endpoint is confirmed
  async updateEmail(_email: string): Promise<void> {
    throw new Error('updateEmail: KitchenOwl API endpoint not yet confirmed');
  }

  // Endpoint unknown — stub until KitchenOwl endpoint is confirmed
  async changePassword(_oldPassword: string, _newPassword: string): Promise<void> {
    throw new Error('changePassword: KitchenOwl API endpoint not yet confirmed');
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  // Endpoints unknown — stubs until confirmed
  async getSessions(): Promise<Session[]> {
    throw new Error('getSessions: KitchenOwl API endpoint not yet confirmed');
  }

  async revokeSession(_sessionId: number): Promise<void> {
    throw new Error('revokeSession: KitchenOwl API endpoint not yet confirmed');
  }

  async revokeAllOtherSessions(): Promise<void> {
    throw new Error('revokeAllOtherSessions: KitchenOwl API endpoint not yet confirmed');
  }
}

export type Session = {
  id: number;
  device: string;
  location: string;
  lastSeen: string;
  current: boolean;
};
