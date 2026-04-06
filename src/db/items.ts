import { getDb } from './schema';
import { randomUUID } from 'expo-crypto';

export type LocalItem = {
  localId: string;
  serverId: number | null;
  listLocalId: string;
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
  serverCategoryId: number | null;
  serverCategoryName: string | null;
  serverCategoryOrdering: number | null;
  isChecked: boolean;
  isImportant: boolean;
  isDirty: boolean;
  isDeleted: boolean;
  createdAt: number;
}

/** Row shape returned by SQLite for the local_items table. */
type ItemRow = {
  local_id: string;
  server_id: number | null;
  list_local_id: string;
  name: string;
  description: string;
  icon_key: string | null;
  category: string;
  server_category_id: number | null;
  server_category_name: string | null;
  server_category_ordering: number | null;
  is_checked: number;
  is_important: number;
  is_dirty: number;
  is_deleted: number;
  created_at: number;
}

function rowToItem(row: ItemRow): LocalItem {
  return {
    localId: row.local_id,
    serverId: row.server_id,
    listLocalId: row.list_local_id,
    name: row.name,
    description: row.description,
    iconKey: row.icon_key,
    category: row.category,
    serverCategoryId: row.server_category_id ?? null,
    serverCategoryName: row.server_category_name ?? null,
    serverCategoryOrdering: row.server_category_ordering ?? null,
    isChecked: row.is_checked !== 0,
    isImportant: row.is_important !== 0,
    isDirty: row.is_dirty !== 0,
    isDeleted: row.is_deleted !== 0,
    createdAt: row.created_at,
  };
}

export async function getItem(localId: string): Promise<LocalItem | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM local_items WHERE local_id = ?',
    [localId]
  );
  return row ? rowToItem(row) : null;
}

export async function getItemsForList(listLocalId: string): Promise<LocalItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT * FROM local_items
     WHERE list_local_id = ? AND is_deleted = 0
     ORDER BY name ASC`,
    [listLocalId]
  );
  return rows.map(rowToItem);
}

export async function addItemLocally(
  listLocalId: string,
  name: string,
  description: string,
  iconKey: string | null,
  category: string
): Promise<LocalItem> {
  const db = await getDb();
  const localId = randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO local_items
     (local_id, server_id, list_local_id, name, description, icon_key, category,
      is_checked, is_dirty, is_deleted, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, 0, 1, 0, ?)`,
    [localId, listLocalId, name, description, iconKey, category, now]
  );
  return {
    localId,
    serverId: null,
    listLocalId,
    name,
    description,
    iconKey,
    category,
    serverCategoryId: null,
    serverCategoryName: null,
    serverCategoryOrdering: null,
    isChecked: false,
    isImportant: false,
    isDirty: true,
    isDeleted: false,
    createdAt: now,
  };
}

export async function upsertItemFromServer(
  serverId: number,
  listLocalId: string,
  name: string,
  description: string,
  iconKey: string | null,
  category: string,
  serverCategoryId: number | null,
  serverCategoryName: string | null,
  serverCategoryOrdering: number | null
): Promise<LocalItem> {
  const db = await getDb();

  const existing = await db.getFirstAsync<ItemRow>(
    `SELECT * FROM local_items WHERE server_id = ? AND list_local_id = ?`,
    [serverId, listLocalId]
  );

  if (existing) {
    // Don't overwrite locally-dirty (unsynced) items with server data
    if (existing.is_dirty === 0) {
      await db.runAsync(
        `UPDATE local_items
         SET name=?, description=?, icon_key=?, category=?,
             server_category_id=?, server_category_name=?, server_category_ordering=?,
             is_dirty=0, is_deleted=0
         WHERE local_id=?`,
        [name, description, iconKey, category,
         serverCategoryId, serverCategoryName, serverCategoryOrdering,
         existing.local_id]
      );
    }
    const updated = await db.getFirstAsync<ItemRow>(
      'SELECT * FROM local_items WHERE local_id = ?',
      [existing.local_id]
    );
    if (!updated) throw new Error(`Failed to read back item ${existing.local_id}`);
    return rowToItem(updated);
  }

  const localId = randomUUID();
  await db.runAsync(
    `INSERT INTO local_items
     (local_id, server_id, list_local_id, name, description, icon_key, category,
      server_category_id, server_category_name, server_category_ordering,
      is_checked, is_dirty, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`,
    [localId, serverId, listLocalId, name, description, iconKey, category,
     serverCategoryId, serverCategoryName, serverCategoryOrdering, Date.now()]
  );
  const row = await db.getFirstAsync<ItemRow>(
    'SELECT * FROM local_items WHERE local_id = ?',
    [localId]
  );
  if (!row) throw new Error(`Failed to read back item ${localId}`);
  return rowToItem(row);
}

export async function markItemSynced(
  localId: string,
  serverId: number,
  serverCategoryId: number | null = null,
  serverCategoryName: string | null = null,
  serverCategoryOrdering: number | null = null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_items
     SET server_id = ?, is_dirty = 0,
         server_category_id = COALESCE(?, server_category_id),
         server_category_name = COALESCE(?, server_category_name),
         server_category_ordering = COALESCE(?, server_category_ordering)
     WHERE local_id = ?`,
    [serverId, serverCategoryId, serverCategoryName, serverCategoryOrdering, localId]
  );
}

export async function softDeleteItem(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_items SET is_deleted = 1, is_dirty = 1 WHERE local_id = ?`,
    [localId]
  );
}

export async function hardDeleteItem(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_items WHERE local_id = ?', [localId]);
}

export async function toggleItemChecked(localId: string, checked: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET is_checked = ? WHERE local_id = ?',
    [checked ? 1 : 0, localId]
  );
}

export async function toggleItemImportant(localId: string, important: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET is_important = ? WHERE local_id = ?',
    [important ? 1 : 0, localId]
  );
}

export async function updateItemNameAndIcon(
  localId: string,
  name: string,
  iconKey: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET name = ?, icon_key = ?, is_dirty = 1 WHERE local_id = ?',
    [name, iconKey, localId]
  );
}
