import { getDb } from './schema';
import { randomUUID } from 'expo-crypto';
import { z } from 'zod';

// ── Typed payloads per operation ────────────────────────────────────────────

export const AddItemPayloadSchema = z.object({
  opType: z.literal('ADD_ITEM'),
  listServerId: z.number(),
  listLocalId: z.string(),
  itemLocalId: z.string(),
  name: z.string(),
  description: z.string(),
});
export type AddItemPayload = z.infer<typeof AddItemPayloadSchema>;

export const RemoveItemPayloadSchema = z.object({
  opType: z.literal('REMOVE_ITEM'),
  listServerId: z.number(),
  itemServerId: z.number(),
  itemLocalId: z.string(),
  removedAt: z.number(),
});
export type RemoveItemPayload = z.infer<typeof RemoveItemPayloadSchema>;

export const UpdateItemDescPayloadSchema = z.object({
  opType: z.literal('UPDATE_ITEM_DESC'),
  listServerId: z.number(),
  itemServerId: z.number(),
  description: z.string(),
});
export type UpdateItemDescPayload = z.infer<typeof UpdateItemDescPayloadSchema>;

const ServerCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  ordering: z.number(),
});
export type ServerCategory = z.infer<typeof ServerCategorySchema>;

export const UpdateItemPayloadSchema = z.object({
  opType: z.literal('UPDATE_ITEM'),
  listServerId: z.number(),
  itemServerId: z.number(),
  itemLocalId: z.string(),
  name: z.string(),
  description: z.string(),
  iconKey: z.string().nullable(),
  category: ServerCategorySchema.nullable(),
});
export type UpdateItemPayload = z.infer<typeof UpdateItemPayloadSchema>;

export const CreateListPayloadSchema = z.object({
  opType: z.literal('CREATE_LIST'),
  listLocalId: z.string(),
  householdId: z.number(),
  name: z.string(),
});
export type CreateListPayload = z.infer<typeof CreateListPayloadSchema>;

export const DeleteListPayloadSchema = z.object({
  opType: z.literal('DELETE_LIST'),
  listLocalId: z.string(),
  listServerId: z.number().nullable(),
});
export type DeleteListPayload = z.infer<typeof DeleteListPayloadSchema>;

export const CheckItemPayloadSchema = z.object({
  opType: z.literal('CHECK_ITEM'),
  listServerId: z.number(),
  itemServerId: z.number(),
  itemLocalId: z.string(),
  removedAt: z.number(),
});
export type CheckItemPayload = z.infer<typeof CheckItemPayloadSchema>;

export const SyncPayloadSchema = z.discriminatedUnion('opType', [
  AddItemPayloadSchema,
  RemoveItemPayloadSchema,
  UpdateItemDescPayloadSchema,
  UpdateItemPayloadSchema,
  CreateListPayloadSchema,
  DeleteListPayloadSchema,
  CheckItemPayloadSchema,
]);

export type SyncPayload = z.infer<typeof SyncPayloadSchema>;

export type SyncOpType = SyncPayload['opType'];

// ── Public record type ───────────────────────────────────────────────────────

export type SyncOp = {
  readonly id: string;
  readonly payload: SyncPayload;
  readonly listLocalId: string | null;
  readonly createdAt: number;
  readonly attempts: number;
}

// ── Internal SQLite row ──────────────────────────────────────────────────────

type SyncQueueRow = {
  id: string;
  payload: string;
  list_local_id: string | null;
  created_at: number;
  attempts: number;
}

function rowToOp(row: SyncQueueRow): SyncOp {
  const payload = SyncPayloadSchema.parse(JSON.parse(row.payload));
  return {
    id: row.id,
    payload,
    listLocalId: row.list_local_id,
    createdAt: row.created_at,
    attempts: row.attempts,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function enqueue(payload: SyncPayload, listLocalId?: string): Promise<SyncOp> {
  const db = await getDb();
  const id = randomUUID();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO sync_queue (id, payload, list_local_id, created_at, attempts)
     VALUES (?, ?, ?, ?, 0)`,
    [id, JSON.stringify(payload), listLocalId ?? null, now]
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

/**
 * Remove any pending CHECK_ITEM ops for a given item from the queue.
 * Returns true if at least one op was found and removed (meaning the item was
 * still pending removal from the server — the caller can skip re-adding it).
 */
export async function removePendingCheckItem(itemLocalId: string): Promise<boolean> {
  const ops = await getAll();
  const matching = ops.filter(
    (op) => op.payload.opType === 'CHECK_ITEM' && op.payload.itemLocalId === itemLocalId
  );
  for (const op of matching) { await remove(op.id); }
  return matching.length > 0;
}
