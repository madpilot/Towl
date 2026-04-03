import { getDb } from './schema';
import { v4 as uuid } from 'uuid';

// ── Typed payloads per operation ────────────────────────────────────────────

export interface AddItemPayload {
  readonly opType: 'ADD_ITEM';
  readonly listServerId: number;
  readonly listLocalId: string;
  readonly itemLocalId: string;
  readonly name: string;
  readonly description: string;
}

export interface RemoveItemPayload {
  readonly opType: 'REMOVE_ITEM';
  readonly listServerId: number;
  readonly itemServerId: number;
  readonly itemLocalId: string;
}

export interface UpdateItemDescPayload {
  readonly opType: 'UPDATE_ITEM_DESC';
  readonly listServerId: number;
  readonly itemServerId: number;
  readonly description: string;
}

export interface CreateListPayload {
  readonly opType: 'CREATE_LIST';
  readonly listLocalId: string;
  readonly name: string;
}

export interface DeleteListPayload {
  readonly opType: 'DELETE_LIST';
  readonly listLocalId: string;
  readonly listServerId: number | null;
}

export type SyncPayload =
  | AddItemPayload
  | RemoveItemPayload
  | UpdateItemDescPayload
  | CreateListPayload
  | DeleteListPayload;

export type SyncOpType = SyncPayload['opType'];

// ── Public record type ───────────────────────────────────────────────────────

export interface SyncOp {
  readonly id: string;
  readonly payload: SyncPayload;
  readonly listLocalId: string | null;
  readonly createdAt: number;
  readonly attempts: number;
}

// ── Internal SQLite row ──────────────────────────────────────────────────────

interface SyncQueueRow {
  id: string;
  op_type: string;
  payload: string;
  list_local_id: string | null;
  created_at: number;
  attempts: number;
}

function rowToOp(row: SyncQueueRow): SyncOp {
  return {
    id: row.id,
    payload: JSON.parse(row.payload) as SyncPayload,
    listLocalId: row.list_local_id,
    createdAt: row.created_at,
    attempts: row.attempts,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function enqueue(payload: SyncPayload, listLocalId?: string): Promise<SyncOp> {
  const db = await getDb();
  const id = uuid();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sync_queue (id, op_type, payload, list_local_id, created_at, attempts)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [id, payload.opType, JSON.stringify(payload), listLocalId ?? null, now]
  );
  return { id, payload, listLocalId: listLocalId ?? null, createdAt: now, attempts: 0 };
}

export async function getAll(): Promise<SyncOp[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT * FROM sync_queue ORDER BY created_at ASC`
  );
  return rows.map(rowToOp);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

export async function incrementAttempts(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`,
    [id]
  );
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_queue');
}
