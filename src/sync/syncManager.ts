import {
  enqueue as enqueueOp,
  getAll,
  remove,
  incrementAttempts,
  removePendingCheckItem as removePendingFromQueue,
} from '@/db/syncQueue';
import type { SyncOp, SyncPayload } from '@/db/syncQueue';
import { getItem, markItemSynced, hardDeleteItem, markItemCheckSynced } from '@/db/items';
import { generateServerDescription } from '@/utils/generateServerDescription';
import { markListSynced, hardDeleteList } from '@/db/lists';
import type { ShoppingListsApi } from '@/api/shoppinglists';
import { useSyncStore } from '@/store/syncStore';
import { useAuthStore } from '@/store/authStore';
import { useNetworkStore } from './connectivityMonitor';
import { MAX_SYNC_RETRIES, SYNC_BACKOFF_MS } from '@/utils/constants';
import { isAxiosError } from '@/api/client';

let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function enqueue(payload: SyncPayload, listLocalId?: string): Promise<void> {
  await enqueueOp(payload, listLocalId);
  void drain();
}

export async function removePendingCheckItem(itemLocalId: string): Promise<boolean> {
  return removePendingFromQueue(itemLocalId);
}

export async function drain(): Promise<void> {
  if (draining) {
    return;
  }
  if (!useNetworkStore.getState().isOnline) {
    return;
  }

  draining = true;
  const store = useSyncStore.getState();
  store.setStatus('syncing');

  let anyRemoved = false;
  let failedDuringDrain = false;

  try {
    const ops = await getAll();
    store.setPendingCount(ops.length);

    if (ops.length === 0) {
      store.setStatus('idle');
      return;
    }

    for (const op of ops) {
      if (op.attempts >= MAX_SYNC_RETRIES) {
        await remove(op.id);
        anyRemoved = true;
        continue;
      }
      try {
        await executeOp(op);
        await remove(op.id);
        anyRemoved = true;
      } catch (err) {
        if (isNonRetryable(err)) {
          await remove(op.id);
          anyRemoved = true;
        } else {
          await incrementAttempts(op.id);
          const delay = SYNC_BACKOFF_MS[Math.min(op.attempts, SYNC_BACKOFF_MS.length - 1)];
          scheduleRetry(delay);
          failedDuringDrain = true;
          break;
        }
      }
    }
  } finally {
    draining = false;
    const remaining = (await getAll()).length;
    useSyncStore.getState().setPendingCount(remaining);
    useSyncStore
      .getState()
      .setStatus(failedDuringDrain ? 'error' : remaining > 0 ? 'syncing' : 'idle');
    if (anyRemoved) {
      useSyncStore.getState().bumpSyncVersion();
    }
    // Re-drain if ops were concurrently enqueued while this pass was running.
    // Don't re-drain immediately after a failure — scheduleRetry handles backoff.
    if (remaining > 0 && !failedDuringDrain) {
      void drain();
    }
  }
}

function isNonRetryable(err: unknown): boolean {
  if (isAxiosError(err) && err.response) {
    const { status } = err.response;
    return status >= 400 && status < 500;
  }
  return false;
}

function scheduleRetry(ms: number): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, ms);
}

async function executeOp(op: SyncOp): Promise<void> {
  const api = useAuthStore.getState().shoppingListsApi;
  if (!api) {
    throw new Error('No shopping lists API available');
  }
  await dispatchPayload(api, op.payload);
}

async function dispatchPayload(api: ShoppingListsApi, payload: SyncPayload): Promise<void> {
  switch (payload.opType) {
    case 'ADD_ITEM': {
      const addItem = await getItem(payload.itemLocalId);
      const addDescription = addItem
        ? generateServerDescription({ ...addItem, description: payload.description })
        : payload.description;
      const result = await api.addItemByName(payload.listServerId, payload.name, addDescription);
      await markItemSynced(
        payload.itemLocalId,
        result.id,
        result.category?.id ?? null,
        result.category?.name ?? null,
        result.category?.ordering ?? null
      );
      break;
    }

    case 'REMOVE_ITEM': {
      try {
        await api.removeItemFromList(payload.listServerId, payload.itemServerId, payload.removedAt);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          break;
        }
        throw err;
      }
      await hardDeleteItem(payload.itemLocalId);
      break;
    }

    case 'CHECK_ITEM': {
      // Remove the item from the server list but keep it in the local trolley —
      // it will be cleared by the user or by the 4-hour expiry.
      try {
        await api.removeItemFromList(payload.listServerId, payload.itemServerId, payload.removedAt);
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          break;
        }
        throw err;
      }
      await markItemCheckSynced(payload.itemLocalId);
      break;
    }

    case 'UPDATE_ITEM_DESC': {
      await api.updateItemDescription(
        payload.listServerId,
        payload.itemServerId,
        payload.description
      );
      await markItemCheckSynced(payload.itemLocalId);
      break;
    }

    case 'UPDATE_ITEM': {
      const updateItem = await getItem(payload.itemLocalId);
      const updateDescription = updateItem
        ? generateServerDescription({ ...updateItem, description: payload.description })
        : payload.description;
      await api.updateItem(
        payload.itemServerId,
        payload.name,
        updateDescription,
        payload.iconKey,
        payload.category
      );
      await markItemCheckSynced(payload.itemLocalId);
      break;
    }

    case 'CREATE_LIST': {
      const result = await api.createShoppingList(payload.name, payload.householdId);
      await markListSynced(payload.listLocalId, result.id);
      break;
    }

    case 'DELETE_LIST': {
      if (payload.listServerId !== null) {
        try {
          await api.deleteShoppingList(payload.listServerId);
        } catch (err) {
          if (isAxiosError(err) && err.response?.status === 404) {
            break;
          }
          throw err;
        }
      }
      await hardDeleteList(payload.listLocalId);
      break;
    }
  }
}
