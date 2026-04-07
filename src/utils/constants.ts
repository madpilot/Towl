export const SECURE_STORE_KEYS = {
  ACCESS_TOKEN: 'towl_access_token',
  REFRESH_TOKEN: 'towl_refresh_token',
  LLT_TOKEN: 'towl_llt_token',
  SERVER_URL: 'towl_server_url',
  USER_JSON: 'towl_user_json',
  SELECTED_HOUSEHOLD: 'towl_selected_household',
  LAST_LIST_LOCAL_ID: 'towl_last_list_local_id',
} as const;

export const SYNC_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000];
export const MAX_SYNC_RETRIES = 10;
export const BACKGROUND_REFRESH_INTERVAL_MS = 10 * 60 * 1_000; // 10 min
