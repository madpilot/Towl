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

import {
  saveTokens,
  getTokens,
  saveLlt,
  getLlt,
  saveUser,
  getUser,
  saveServerUrl,
  getServerUrl,
  saveCredentials,
  getCredentials,
  clearAll,
} from '@/auth/tokenStore';
import { SECURE_STORE_KEYS } from '@/utils/constants';

beforeEach(() => {
  // Clear the mock store between tests
  for (const key of Object.keys(store)) delete store[key];
  jest.clearAllMocks();
});

describe('tokenStore', () => {
  describe('saveTokens / getTokens', () => {
    it('round-trips access and refresh tokens', async () => {
      await saveTokens({ accessToken: 'acc', refreshToken: 'ref', llt: null });
      const tokens = await getTokens();
      expect(tokens?.accessToken).toBe('acc');
      expect(tokens?.refreshToken).toBe('ref');
      expect(tokens?.llt).toBeNull();
    });

    it('saves LLT when provided', async () => {
      await saveTokens({ accessToken: 'a', refreshToken: 'r', llt: 'long-lived' });
      const tokens = await getTokens();
      expect(tokens?.llt).toBe('long-lived');
    });

    it('returns null when no tokens stored', async () => {
      expect(await getTokens()).toBeNull();
    });
  });

  describe('saveLlt / getLlt', () => {
    it('round-trips the long-lived token', async () => {
      await saveLlt('my-llt');
      expect(await getLlt()).toBe('my-llt');
    });
  });

  describe('saveUser / getUser', () => {
    it('round-trips user object', async () => {
      const user = { id: 1, name: 'Alice', username: 'alice' };
      await saveUser(user);
      expect(await getUser()).toEqual(user);
    });

    it('returns null when no user stored', async () => {
      expect(await getUser()).toBeNull();
    });

    it('returns null when JSON is malformed', async () => {
      store[SECURE_STORE_KEYS.USER_JSON] = 'not-json{{{';
      expect(await getUser()).toBeNull();
    });

    it('returns null when stored JSON has wrong shape', async () => {
      // Valid JSON but missing required fields — Zod parse should fail
      store[SECURE_STORE_KEYS.USER_JSON] = JSON.stringify({ id: 'not-a-number', name: 42 });
      expect(await getUser()).toBeNull();
    });
  });

  describe('saveServerUrl / getServerUrl', () => {
    it('round-trips the server URL', async () => {
      await saveServerUrl('http://192.168.1.1:8080');
      expect(await getServerUrl()).toBe('http://192.168.1.1:8080');
    });
  });

  describe('saveCredentials / getCredentials', () => {
    it('round-trips username and password', async () => {
      await saveCredentials('alice', 's3cr3t');
      const creds = await getCredentials();
      expect(creds?.username).toBe('alice');
      expect(creds?.password).toBe('s3cr3t');
    });

    it('returns null when nothing is stored', async () => {
      expect(await getCredentials()).toBeNull();
    });

    it('returns null when only username is stored', async () => {
      store[SECURE_STORE_KEYS.SAVED_USERNAME] = 'alice';
      expect(await getCredentials()).toBeNull();
    });

    it('returns null when only password is stored', async () => {
      store[SECURE_STORE_KEYS.SAVED_PASSWORD] = 's3cr3t';
      expect(await getCredentials()).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('removes access token, refresh token, LLT, user, and credentials', async () => {
      await saveTokens({ accessToken: 'a', refreshToken: 'r', llt: 'l' });
      await saveUser({ id: 1, name: 'Bob', username: 'bob' });
      await saveCredentials('bob', 'p4ss');

      await clearAll();

      expect(await getTokens()).toBeNull();
      expect(await getUser()).toBeNull();
      expect(await getCredentials()).toBeNull();
      // Server URL is intentionally NOT cleared (to persist across logouts)
    });
  });
});
