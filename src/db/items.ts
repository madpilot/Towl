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
  checkedAt: number | null;
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
  checked_at: number | null;
}

/**
 * Parses the "important" hack out of a server description.
 * A leading `!` marks the item as important; strip it and any following spaces
 * before storing locally so they're never shown in the UI.
 */
export function parseImportantDescription(raw: string): { description: string; isImportant: boolean } {
  if (raw.startsWith('!')) {
    return { description: raw.slice(1).trimStart(), isImportant: true };
  }
  return { description: raw, isImportant: false };
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
    checkedAt: row.checked_at ?? null,
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
     ORDER BY is_important DESC, name ASC`,
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
    checkedAt: null,
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

  const parsed = parseImportantDescription(description);

  if (existing) {
    // Don't overwrite locally-dirty (unsynced) items with server data
    if (existing.is_dirty === 0) {
      await db.runAsync(
        `UPDATE local_items
         SET name=?, description=?, icon_key=?, category=?,
             server_category_id=?, server_category_name=?, server_category_ordering=?,
             is_important=?, is_dirty=0, is_deleted=0
         WHERE local_id=?`,
        [name, parsed.description, iconKey, category,
         serverCategoryId, serverCategoryName, serverCategoryOrdering,
         parsed.isImportant ? 1 : 0,
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
      is_checked, is_important, is_dirty, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 0, ?)`,
    [localId, serverId, listLocalId, name, parsed.description, iconKey, category,
     serverCategoryId, serverCategoryName, serverCategoryOrdering,
     parsed.isImportant ? 1 : 0, Date.now()]
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

/** Move an item into the trolley: marks it checked, dirty, and records when it was checked. */
export async function checkItem(localId: string, checkedAt: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET is_checked = 1, is_dirty = 1, checked_at = ? WHERE local_id = ?',
    [checkedAt, localId]
  );
}

/**
 * Move an item back to active.
 * Pass isDirty=true when the CHECK_ITEM op already synced to the server
 * (so an ADD_ITEM is needed to restore it); false when the CHECK_ITEM was
 * still pending and can simply be cancelled from the queue.
 */
export async function uncheckItem(localId: string, isDirty: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET is_checked = 0, is_dirty = ?, checked_at = NULL WHERE local_id = ?',
    [isDirty ? 1 : 0, localId]
  );
}

/** Clear the dirty flag after a CHECK_ITEM sync op drains successfully. */
export async function markItemCheckSynced(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET is_dirty = 0 WHERE local_id = ?',
    [localId]
  );
}

/** Hard-delete all checked (trolley) items for a list. No server call needed — the
 *  server was already updated by the CHECK_ITEM sync op. */
export async function clearCheckedItems(listLocalId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM local_items WHERE list_local_id = ? AND is_checked = 1',
    [listLocalId]
  );
}

/** Hard-delete checked items that were added to the trolley before `olderThan` (epoch ms). */
export async function clearExpiredCheckedItems(
  listLocalId: string,
  olderThan: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM local_items
     WHERE list_local_id = ? AND is_checked = 1
       AND checked_at IS NOT NULL AND checked_at < ?`,
    [listLocalId, olderThan]
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
  description: string,
  iconKey: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_items SET name = ?, description = ?, icon_key = ?, is_dirty = 1 WHERE local_id = ?',
    [name, description, iconKey, localId]
  );
}

export async function updateItemCategory(
  localId: string,
  categoryName: string,
  serverCategoryId: number | null,
  serverCategoryName: string | null,
  serverCategoryOrdering: number | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_items
     SET category = ?, server_category_id = ?, server_category_name = ?,
         server_category_ordering = ?, is_dirty = 1
     WHERE local_id = ?`,
    [categoryName, serverCategoryId, serverCategoryName, serverCategoryOrdering, localId]
  );
}

/**
 * Hard-deletes local items that were removed on the server.
 *
 * After a fresh server fetch we know the authoritative item list. Any local
 * item that:
 *   - has a serverId (was previously synced — not a pending local add), AND
 *   - is NOT currently soft-deleted (isDeleted=1 items are pending REMOVE_ITEM
 *     drain; leave them so the queue op can complete), AND
 *   - whose serverId is absent from the server's current list
 * is an orphan and must be removed.
 *
 * Items with serverId=null are never touched — they are queued ADD_ITEM ops
 * that haven't reached the server yet.
 */
export async function removeItemsDeletedOnServer(
  listLocalId: string,
  serverIds: number[]
): Promise<void> {
  const db = await getDb();
  if (serverIds.length === 0) {
    // Server returned no items — delete every synced, non-pending-removal item.
    // Checked (trolley) items are excluded: their absence from the server list
    // is intentional (we removed them via CHECK_ITEM) and they expire locally.
    await db.runAsync(
      `DELETE FROM local_items
       WHERE list_local_id = ? AND server_id IS NOT NULL
         AND is_deleted = 0 AND is_checked = 0`,
      [listLocalId]
    );
  } else {
    const placeholders = serverIds.map(() => '?').join(',');
    await db.runAsync(
      `DELETE FROM local_items
       WHERE list_local_id = ?
         AND server_id IS NOT NULL
         AND is_deleted = 0
         AND is_checked = 0
         AND server_id NOT IN (${placeholders})`,
      [listLocalId, ...serverIds]
    );
  }
}
