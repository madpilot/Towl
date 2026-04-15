import { getDb } from './schema';
import { randomUUID } from 'expo-crypto';

export type LocalList = {
  localId: string;
  serverId: number | null;
  householdId: number;
  name: string;
  isDirty: boolean;
  isDeleted: boolean;
  lastSynced: number;
}

/** Row shape returned by SQLite for the local_lists table. */
type ListRow = {
  local_id: string;
  server_id: number | null;
  household_id: number;
  name: string;
  is_dirty: number;
  is_deleted: number;
  last_synced: number;
}

function rowToList(row: ListRow): LocalList {
  return {
    localId: row.local_id,
    serverId: row.server_id,
    householdId: row.household_id,
    name: row.name,
    isDirty: row.is_dirty !== 0,
    isDeleted: row.is_deleted !== 0,
    lastSynced: row.last_synced,
  };
}

export async function getAllLists(householdId: number): Promise<LocalList[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ListRow>(
    'SELECT * FROM local_lists WHERE household_id = ? AND is_deleted = 0 ORDER BY name ASC',
    [householdId]
  );
  return rows.map(rowToList);
}

export async function upsertListFromServer(
  serverId: number,
  householdId: number,
  name: string,
  existingLocalId?: string
): Promise<LocalList> {
  const db = await getDb();
  const localId = existingLocalId ?? randomUUID();
  await db.runAsync(
    `INSERT INTO local_lists (local_id, server_id, household_id, name, is_dirty, is_deleted, last_synced)
     VALUES (?, ?, ?, ?, 0, 0, ?)
     ON CONFLICT(local_id) DO UPDATE SET
       server_id    = excluded.server_id,
       name         = excluded.name,
       is_dirty     = 0,
       is_deleted   = 0,
       last_synced  = excluded.last_synced`,
    [localId, serverId, householdId, name, Date.now()]
  );
  const row = await db.getFirstAsync<ListRow>(
    'SELECT * FROM local_lists WHERE local_id = ?',
    [localId]
  );
  if (!row) { throw new Error(`Failed to read back list with local_id=${localId}`); }
  return rowToList(row);
}

export async function createListLocally(householdId: number, name: string): Promise<LocalList> {
  const db = await getDb();
  const localId = randomUUID();
  await db.runAsync(
    `INSERT INTO local_lists (local_id, server_id, household_id, name, is_dirty, is_deleted, last_synced)
     VALUES (?, NULL, ?, ?, 1, 0, 0)`,
    [localId, householdId, name]
  );
  return {
    localId,
    serverId: null,
    householdId,
    name,
    isDirty: true,
    isDeleted: false,
    lastSynced: 0,
  };
}

export async function markListSynced(localId: string, serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_lists SET server_id = ?, is_dirty = 0, last_synced = ? WHERE local_id = ?`,
    [serverId, Date.now(), localId]
  );
}

export async function softDeleteList(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_lists SET is_deleted = 1, is_dirty = 1 WHERE local_id = ?`,
    [localId]
  );
}

export async function hardDeleteList(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_lists WHERE local_id = ?', [localId]);
  await db.runAsync('DELETE FROM local_items WHERE list_local_id = ?', [localId]);
}

export async function getListByServerId(serverId: number): Promise<LocalList | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ListRow>(
    'SELECT * FROM local_lists WHERE server_id = ?',
    [serverId]
  );
  return row ? rowToList(row) : null;
}
