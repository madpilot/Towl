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
});
export type RemoveItemPayload = z.infer<typeof RemoveItemPayloadSchema>;

export const UpdateItemDescPayloadSchema = z.object({
  opType: z.literal('UPDATE_ITEM_DESC'),
  listServerId: z.number(),
  itemServerId: z.number(),
  description: z.string(),
});
export type UpdateItemDescPayload = z.infer<typeof UpdateItemDescPayloadSchema>;

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

export const SyncPayloadSchema = z.discriminatedUnion('opType', [
  AddItemPayloadSchema,
  RemoveItemPayloadSchema,
  UpdateItemDescPayloadSchema,
  CreateListPayloadSchema,
  DeleteListPayloadSchema,
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
  op_type: string;
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
