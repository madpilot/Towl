import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  status: SyncStatus;
  pendingCount: number;
  syncVersion: number;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  bumpSyncVersion: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  syncVersion: 0,
  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  bumpSyncVersion: () => set((s) => ({ syncVersion: s.syncVersion + 1 })),
}));
