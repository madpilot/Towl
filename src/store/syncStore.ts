import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({ pendingCount: count }),
}));
