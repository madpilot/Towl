// Mock expo-secure-store before importing anything that uses it
const store: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
  getItemAsync: jest.fn(async (key: string) => store[key] ?? null),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete store[key];
  }),
}));

import { TokenStore } from '@/auth/tokenStore';
const tokenStore = TokenStore.instance;
import { SECURE_STORE_KEYS } from '@/utils/constants';

beforeEach(() => {
  // Clear the mock store between tests
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  jest.clearAllMocks();
});

describe('tokenStore', () => {
  describe('saveTokens / getTokens', () => {
    it('round-trips access and refresh tokens', async () => {
      await tokenStore.saveTokens({ accessToken: 'acc', refreshToken: 'ref', llt: null });
      const tokens = await tokenStore.getTokens();
      expect(tokens?.accessToken).toBe('acc');
      expect(tokens?.refreshToken).toBe('ref');
      expect(tokens?.llt).toBeNull();
    });

    it('saves LLT when provided', async () => {
      await tokenStore.saveTokens({ accessToken: 'a', refreshToken: 'r', llt: 'long-lived' });
      const tokens = await tokenStore.getTokens();
      expect(tokens?.llt).toBe('long-lived');
    });

    it('returns null when no tokens stored', async () => {
      expect(await tokenStore.getTokens()).toBeNull();
    });
  });

  describe('saveLlt / getLlt', () => {
    it('round-trips the long-lived token', async () => {
      await tokenStore.saveLlt('my-llt');
      expect(await tokenStore.getLlt()).toBe('my-llt');
    });
  });

  describe('saveUser / getUser', () => {
    it('round-trips user object', async () => {
      const user = { id: 1, name: 'Alice', username: 'alice' };
      await tokenStore.saveUser(user);
      expect(await tokenStore.getUser()).toEqual(user);
    });

    it('returns null when no user stored', async () => {
      expect(await tokenStore.getUser()).toBeNull();
    });

    it('returns null when JSON is malformed', async () => {
      store[SECURE_STORE_KEYS.USER_JSON] = 'not-json{{{';
      expect(await tokenStore.getUser()).toBeNull();
    });

    it('returns null when stored JSON has wrong shape', async () => {
      // Valid JSON but missing required fields — Zod parse should fail
      store[SECURE_STORE_KEYS.USER_JSON] = JSON.stringify({ id: 'not-a-number', name: 42 });
      expect(await tokenStore.getUser()).toBeNull();
    });
  });

  describe('saveServerUrl / getServerUrl', () => {
    it('round-trips the server URL', async () => {
      await tokenStore.saveServerUrl('http://192.168.1.1:8080');
      expect(await tokenStore.getServerUrl()).toBe('http://192.168.1.1:8080');
    });
  });

  describe('clearAll', () => {
    it('removes access token, refresh token, LLT and user', async () => {
      await tokenStore.saveTokens({ accessToken: 'a', refreshToken: 'r', llt: 'l' });
      await tokenStore.saveUser({ id: 1, name: 'Bob', username: 'bob' });

      await tokenStore.clearAll();

      expect(await tokenStore.getTokens()).toBeNull();
      expect(await tokenStore.getUser()).toBeNull();
      // Server URL is intentionally NOT cleared (to persist across logouts)
    });
  });
});
