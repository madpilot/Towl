jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@/api/client', () => ({
  ApiClientManager: jest.fn().mockImplementation(() => ({
    axiosInstance: {},
  })),
}));

jest.mock('@/api/auth', () => ({
  AuthApi: jest.fn().mockImplementation(() => ({
    createLongLivedToken: jest.fn().mockResolvedValue('llt-token'),
    logout: jest.fn().mockResolvedValue(undefined),
  })),
  login: jest.fn(),
  isAxiosAuthError: jest.fn(),
}));

jest.mock('@/api/households', () => ({
  HouseholdsApi: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/api/shoppinglists', () => ({
  ShoppingListsApi: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/store/householdStore', () => ({
  restoreSelectedHousehold: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/store/authStore', () => {
  const setAuthenticated = jest.fn();
  const setUnauthenticated = jest.fn();
  const setServerUrl = jest.fn();
  const setApis = jest.fn();
  const clearApis = jest.fn();
  return {
    useAuthStore: {
      getState: () => ({ setAuthenticated, setUnauthenticated, setServerUrl, setApis, clearApis }),
    },
  };
});

jest.mock('@/auth/tokenStore', () => ({
  TokenStore: {
    instance: {
      getServerUrl: jest.fn(),
      getTokens: jest.fn(),
      getUser: jest.fn(),
      saveServerUrl: jest.fn(),
      saveTokens: jest.fn(),
      saveUser: jest.fn(),
      saveLlt: jest.fn(),
      clearAll: jest.fn(),
    },
  },
}));

import { initializeAuth } from '@/auth/authManager';
import { TokenStore } from '@/auth/tokenStore';
const mockTokenStore = TokenStore.instance;
import { useAuthStore } from '@/store/authStore';

const { setAuthenticated, setUnauthenticated } = useAuthStore.getState();

const STORED_TOKENS = { accessToken: 'acc', refreshToken: 'ref', llt: 'llt' };
const STORED_USER = { id: 1, name: 'Alice', username: 'alice' };
const SERVER_URL = 'http://kitchen.local';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('initializeAuth', () => {
  it('sets unauthenticated when no server URL is stored', async () => {
    (mockTokenStore.getServerUrl as jest.Mock).mockResolvedValue(null);

    await initializeAuth();

    expect(setUnauthenticated).toHaveBeenCalled();
    expect(setAuthenticated).not.toHaveBeenCalled();
  });

  it('sets unauthenticated when no tokens are stored', async () => {
    (mockTokenStore.getServerUrl as jest.Mock).mockResolvedValue(SERVER_URL);
    (mockTokenStore.getTokens as jest.Mock).mockResolvedValue(null);

    await initializeAuth();

    expect(setUnauthenticated).toHaveBeenCalled();
    expect(setAuthenticated).not.toHaveBeenCalled();
  });

  it('sets authenticated when tokens and user are stored', async () => {
    (mockTokenStore.getServerUrl as jest.Mock).mockResolvedValue(SERVER_URL);
    (mockTokenStore.getTokens as jest.Mock).mockResolvedValue(STORED_TOKENS);
    (mockTokenStore.getUser as jest.Mock).mockResolvedValue(STORED_USER);

    await initializeAuth();

    expect(setAuthenticated).toHaveBeenCalledWith(STORED_USER, SERVER_URL);
    expect(setUnauthenticated).not.toHaveBeenCalled();
  });

  it('sets authenticated even when stored user is null (schema mismatch or missing)', async () => {
    (mockTokenStore.getServerUrl as jest.Mock).mockResolvedValue(SERVER_URL);
    (mockTokenStore.getTokens as jest.Mock).mockResolvedValue(STORED_TOKENS);
    (mockTokenStore.getUser as jest.Mock).mockResolvedValue(null);

    await initializeAuth();

    expect(setAuthenticated).toHaveBeenCalledWith(null, SERVER_URL);
    expect(setUnauthenticated).not.toHaveBeenCalled();
  });
});
