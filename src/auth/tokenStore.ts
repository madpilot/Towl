import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { SECURE_STORE_KEYS } from '@/utils/constants';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  llt: string | null;
}

export const StoredUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
});

export type StoredUser = z.infer<typeof StoredUserSchema>;

export class TokenStore {
  static readonly instance = new TokenStore();
  private constructor() {}

  async saveTokens(tokens: StoredTokens): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
      tokens.llt
        ? SecureStore.setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, tokens.llt)
        : Promise.resolve(),
    ]);
  }

  async getTokens(): Promise<StoredTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
    ]);
    if (!accessToken || !refreshToken) return null;
    const llt = await SecureStore.getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
    return { accessToken, refreshToken, llt };
  }

  async saveLlt(llt: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, llt);
  }

  async getLlt(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
  }

  async saveUser(user: StoredUser): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_JSON, JSON.stringify(user));
  }

  async getUser(): Promise<StoredUser | null> {
    const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_JSON);
    if (!raw) return null;
    try {
      return StoredUserSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async saveServerUrl(url: string): Promise<void> {
    await SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, url);
  }

  async getServerUrl(): Promise<string | null> {
    return SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_URL);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.LLT_TOKEN),
      SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_JSON),
    ]);
  }
}

