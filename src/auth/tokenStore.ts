import { setItemAsync, getItemAsync, deleteItemAsync } from 'expo-secure-store';
import { z } from 'zod';
import { SECURE_STORE_KEYS } from '@/utils/constants';

export const StoredTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  llt: z.string().nullable(),
});

export type StoredTokens = z.infer<typeof StoredTokensSchema>;

export const StoredUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  email: z.string().optional(),
});

export type StoredUser = z.infer<typeof StoredUserSchema>;

export class TokenStore {
  static readonly instance = new TokenStore();
  private constructor() {}

  async saveTokens(tokens: StoredTokens): Promise<void> {
    await Promise.all([
      setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, tokens.accessToken),
      setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
      tokens.llt ? setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, tokens.llt) : Promise.resolve(),
    ]);
  }

  async getTokens(): Promise<StoredTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
      getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
    ]);
    if (!accessToken || !refreshToken) {
      return null;
    }
    const llt = await getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
    return { accessToken, refreshToken, llt };
  }

  async saveLlt(llt: string): Promise<void> {
    await setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, llt);
  }

  async getLlt(): Promise<string | null> {
    return getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
  }

  async saveUser(user: StoredUser): Promise<void> {
    await setItemAsync(SECURE_STORE_KEYS.USER_JSON, JSON.stringify(user));
  }

  async getUser(): Promise<StoredUser | null> {
    const raw = await getItemAsync(SECURE_STORE_KEYS.USER_JSON);
    if (!raw) {
      return null;
    }
    try {
      return StoredUserSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async saveServerUrl(url: string): Promise<void> {
    await setItemAsync(SECURE_STORE_KEYS.SERVER_URL, url);
  }

  async getServerUrl(): Promise<string | null> {
    return getItemAsync(SECURE_STORE_KEYS.SERVER_URL);
  }

  async clearAll(): Promise<void> {
    // SERVER_URL is intentionally NOT cleared — it persists across logouts so
    // the user can re-authenticate to the same server without re-entering the URL.
    await Promise.all([
      deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
      deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
      deleteItemAsync(SECURE_STORE_KEYS.LLT_TOKEN),
      deleteItemAsync(SECURE_STORE_KEYS.USER_JSON),
    ]);
  }
}
