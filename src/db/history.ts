import { getDb } from './schema';

export type HistoryEntry = {
  id: number;
  name: string;
  displayName: string;
  iconKey: string | null;
  category: string;
  useCount: number;
  lastUsedAt: number;
}

type HistoryRow = {
  id: number;
  name: string;
  display_name: string;
  icon_key: string | null;
  category: string;
  use_count: number;
  last_used_at: number;
}

function rowToEntry(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    iconKey: row.icon_key,
    category: row.category,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
  };
}

export async function recordItemUsed(
  displayName: string,
  iconKey: string | null,
  category: string
): Promise<void> {
  const db = await getDb();
  const name = displayName.toLowerCase().trim();
  await db.runAsync(
    `INSERT INTO item_history (name, display_name, icon_key, category, use_count, last_used_at)
     VALUES (?, ?, ?, ?, 1, ?)
     ON CONFLICT(name) DO UPDATE SET
       display_name = excluded.display_name,
       icon_key     = COALESCE(excluded.icon_key, icon_key),
       category     = CASE WHEN excluded.category != '' THEN excluded.category ELSE category END,
       use_count    = use_count + 1,
       last_used_at = excluded.last_used_at`,
    [name, displayName, iconKey, category, Date.now()]
  );
}

export async function getRecentHistory(limit = 20): Promise<HistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM item_history ORDER BY last_used_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToEntry);
}

export async function getFrequentHistory(limit = 20): Promise<HistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM item_history ORDER BY use_count DESC, last_used_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map(rowToEntry);
}

export async function searchHistory(query: string, limit = 10): Promise<HistoryEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT * FROM item_history
     WHERE name LIKE ?
     ORDER BY use_count DESC, last_used_at DESC
     LIMIT ?`,
    [`%${query.toLowerCase().trim()}%`, limit]
  );
  return rows.map(rowToEntry);
}
