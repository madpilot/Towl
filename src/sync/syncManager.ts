import * as syncQueue from '@/db/syncQueue';
import type { SyncOp, SyncPayload } from '@/db/syncQueue';
import * as itemsDb from '@/db/items';
import * as listsDb from '@/db/lists';
import * as api from '@/api/shoppinglists';
import { useSyncStore } from '@/store/syncStore';
import { useNetworkStore } from './connectivityMonitor';
import { MAX_SYNC_RETRIES, SYNC_BACKOFF_MS } from '@/utils/constants';
import axios from 'axios';

let draining = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function drain(): Promise<void> {
  if (draining) return;
  if (!useNetworkStore.getState().isOnline) return;

  draining = true;
  const store = useSyncStore.getState();
  store.setStatus('syncing');

  try {
    const ops = await syncQueue.getAll();
    store.setPendingCount(ops.length);

    if (ops.length === 0) {
      store.setStatus('idle');
      return;
    }

    for (const op of ops) {
      if (op.attempts >= MAX_SYNC_RETRIES) {
        await syncQueue.remove(op.id);
        continue;
      }
      try {
        await executeOp(op);
        await syncQueue.remove(op.id);
      } catch (err) {
        if (isNonRetryable(err)) {
          await syncQueue.remove(op.id);
        } else {
          await syncQueue.incrementAttempts(op.id);
          const delay = SYNC_BACKOFF_MS[Math.min(op.attempts, SYNC_BACKOFF_MS.length - 1)];
          scheduleRetry(delay);
          break;
        }
      }
    }
  } finally {
    draining = false;
    const remaining = (await syncQueue.getAll()).length;
    useSyncStore.getState().setPendingCount(remaining);
    useSyncStore.getState().setStatus(remaining > 0 ? 'error' : 'idle');
  }
}

function isNonRetryable(err: unknown): boolean {
  if (axios.isAxiosError(err) && err.response) {
    const { status } = err.response;
    return status >= 400 && status < 500;
  }
  return false;
}

function scheduleRetry(ms: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void drain();
  }, ms);
}

async function executeOp(op: SyncOp): Promise<void> {
  await dispatchPayload(op.payload);
}

async function dispatchPayload(payload: SyncPayload): Promise<void> {
  switch (payload.opType) {
    case 'ADD_ITEM': {
      const result = await api.addItemByName(
        payload.listServerId,
        payload.name,
        payload.description
      );
      await itemsDb.markItemSynced(payload.itemLocalId, result.id);
      break;
    }

    case 'REMOVE_ITEM': {
      try {
        await api.removeItem(payload.listServerId, payload.itemServerId);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) break;
        throw err;
      }
      await itemsDb.hardDeleteItem(payload.itemLocalId);
      break;
    }

    case 'UPDATE_ITEM_DESC': {
      await api.updateItemDescription(
        payload.listServerId,
        payload.itemServerId,
        payload.description
      );
      break;
    }

    case 'CREATE_LIST': {
      const result = await api.createShoppingList(payload.name);
      await listsDb.markListSynced(payload.listLocalId, result.id);
      break;
    }

    case 'DELETE_LIST': {
      if (payload.listServerId !== null) {
        try {
          await api.deleteShoppingList(payload.listServerId);
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 404) break;
          throw err;
        }
      }
      await listsDb.hardDeleteList(payload.listLocalId);
      break;
    }
  }
}
