import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  status: SyncStatus;
  pendingCount: number;
  syncVersion: number;
  errorMessage: string | null;
  /** Number of in-flight Axios requests (used to animate Tommy while any API call is active). */
  requestCount: number;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  bumpSyncVersion: () => void;
  setErrorMessage: (msg: string | null) => void;
  incrementRequestCount: () => void;
  decrementRequestCount: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  syncVersion: 0,
  errorMessage: null,
  requestCount: 0,
  setStatus: (status) => set({ status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  bumpSyncVersion: () => set((s) => ({ syncVersion: s.syncVersion + 1 })),
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  incrementRequestCount: () => set((s) => ({ requestCount: s.requestCount + 1 })),
  decrementRequestCount: () => set((s) => ({ requestCount: Math.max(0, s.requestCount - 1) })),
}));
