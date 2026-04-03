import * as SecureStore from 'expo-secure-store';
import { SECURE_STORE_KEYS } from '@/utils/constants';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  llt: string | null;
}

export interface StoredUser {
  id: number;
  name: string;
  email: string;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN, tokens.accessToken),
    SecureStore.setItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
    tokens.llt
      ? SecureStore.setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, tokens.llt)
      : Promise.resolve(),
  ]);
}

export async function getTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
    SecureStore.getItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
  ]);
  if (!accessToken || !refreshToken) return null;
  const llt = await SecureStore.getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
  return { accessToken, refreshToken, llt };
}

export async function saveLlt(llt: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.LLT_TOKEN, llt);
}

export async function getLlt(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.LLT_TOKEN);
}

export async function saveUser(user: StoredUser): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_JSON, JSON.stringify(user));
}

export async function getUser(): Promise<StoredUser | null> {
  const raw = await SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_JSON);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export async function saveServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, url);
}

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_URL);
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.LLT_TOKEN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_JSON),
  ]);
}
